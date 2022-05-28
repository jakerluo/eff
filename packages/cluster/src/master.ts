import GetFreePort from 'detect-port';
import { writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { EventEmitter } from 'events';
import Manager, { CustomChildProcess } from './utils/manager';
import Messenger from './utils/messenger';
import parseOptions from './utils/options';
import ready from 'get-ready';
import { IedoConsoleLogger, ConsoleLoggerType } from '@iedo/logger';
import type { Level } from '@iedo/logger';
import utility from 'utility';
import { EOL } from 'os';
import { mkdirp } from 'mz-modules';
import semver from 'semver';
import { fork, ForkOptions } from 'child_process';

interface HttpOptions {
  ca?: string;
  key: string;
  cert: string;
}

export interface MasterOptions {
  baseDir: string;
  framework: string;
  customIedo?: string;
  plugins?: unknown[];
  workers?: number;
  sticky?: boolean;
  isDebug?: boolean;
  port?: number;
  stickyWorkerPort?: number;
  clusterPort?: number;
  https?: boolean | HttpOptions;
  require?: string[] | string;
  pidFile?: string;
  key?: string;
  cert?: string;
  captureRejections?: boolean | undefined;
}

export interface ToParentData {
  port?: MasterOptions['port'];
  address: string;
  protocol: string;
}

function isProduction() {
  const serverEnv = process.env.IEDO_SERVER_ENV;
  if (serverEnv) {
    return serverEnv !== 'local' && serverEnv !== 'unittest';
  }

  return process.env.NODE_ENV === 'production';
}

const PROTOCOL = Symbol('Master#protocol');
const REAL_PORT = Symbol('Master#real_port');
const APP_ADDRESS = Symbol('Master#appAddress');

export default class Master extends EventEmitter {
  agentStartTime: number | undefined;
  ready(callback: () => void) {
    callback();
    throw new Error('Method not implemented.');
  }
  options: MasterOptions;
  workManager: Manager;
  messenger: Messenger;
  isProduction: boolean;
  agentWorkerIndex: number;
  closed: boolean;
  isStarted: boolean;
  logger: ConsoleLoggerType;
  logMethod: Lowercase<Level>;
  [REAL_PORT]: MasterOptions['port'];
  [PROTOCOL]: string;
  [APP_ADDRESS]: string;
  constructor(options: MasterOptions) {
    super();
    this.options = parseOptions(options);
    this.workManager = new Manager();
    this.messenger = new Messenger(this);

    ready.mixin(this);

    this.isProduction = isProduction();
    this.agentWorkerIndex = 0;
    this.closed = false;
    this[REAL_PORT] = this.options.port;
    this[PROTOCOL] = this.options.https ? 'https' : 'http';

    this.isStarted = false;
    this.logger = new IedoConsoleLogger({ level: (process.env.IEDO_MASTER_LOGGER_LEVEL || 'INFO') as Level });
    this.logMethod = 'info';
    if (process.env.IEDO_SERVER_ENV === 'local' || process.env.NODE_ENV === 'development') {
      this.logMethod = 'debug';
    }

    const frameworkPath = this.options.framework;
    const frameworkPkg = utility.readJSONSync(join(frameworkPath, 'package.json'));
    this.log(`[master] =================== ${frameworkPkg.name} start =====================`);
    this.logger.info(`[master] node version ${process.version}`);
    /* istanbul ignore next */
    this.logger.info(`[master] ${frameworkPkg.name} version ${frameworkPkg.version}`);

    if (this.isProduction) {
      this.logger.info('[master] start with options:%s%s', EOL, JSON.stringify(this.options, null, 2));
    } else {
      this.log('[master] start with options: %j', this.options);
    }
    this.log(
      '[master] start with env: isProduction: %s, EGG_SERVER_ENV: %s, NODE_ENV: %s',
      this.isProduction,
      process.env.EGG_SERVER_ENV,
      process.env.NODE_ENV
    );

    const startTime = Date.now();
    this.ready(() => {
      this.isStarted = true;
      const stickyMsg = this.options.sticky ? '  with STICKY MODE!' : '';
      this.logger.info(
        '[master] %s started on %s (%sms)%s',
        frameworkPkg.name,
        this[APP_ADDRESS],
        Date.now() - startTime,
        stickyMsg
      );

      const action = 'egg-ready';
      this.messenger.send<ToParentData>({
        action,
        to: 'parent',
        data: {
          port: this[REAL_PORT],
          address: this[APP_ADDRESS],
          protocol: this[PROTOCOL],
        },
      });
      this.messenger.send<MasterOptions>({
        action,
        to: 'app',
        data: this.options,
      });
      this.messenger.send<MasterOptions>({
        action,
        to: 'agent',
        data: this.options,
      });

      if (this.isProduction) {
        this.workManager.startCheck();
      }
    });

    if (this.options.pidFile) {
      mkdirp.sync(dirname(this.options.pidFile));
      writeFileSync(this.options.pidFile, process.pid.toString(), 'utf-8');
    }

    this.detectPorts().then(() => {
      this.forkAgentWorker();
    });

    this.workManager.on('execption', ({ agent, worker }) => {
      const err = new Error(`[master] ${agent} agent and ${worker} worker(s) alive, exit to avoid unknown state`);
      err.name = 'ClusterWorkerExceptionError';
      // @ts-ignore
      err.count = {
        agent,
        worker,
      };
      this.logger.error(err);
      process.exit(1);
    });
  }

  private async detectPorts() {
    // @ts-ignore
    return GetFreePort()
      .then((port) => {
        console.log(port);
        this.options.clusterPort = port;
        if (this.options.sticky) {
          // @ts-ignore
          return GetFreePort();
        }
      })
      .then((port: number | undefined) => {
        if (this.options.sticky) {
          this.options.stickyWorkerPort = port;
        }
      })
      .catch((err: Error) => {
        this.logger.error(err);
        process.exit(1);
      });
  }

  private forkAgentWorker() {
    this.agentStartTime = Date.now();

    const args = [JSON.stringify(this.options)];
    console.log('this.options: ', this.options);
    console.log('args: ', args);
    const opt: ForkOptions & { windowsHide?: boolean } = {};
    if (process.platform === 'win32') opt.windowsHide = true;

    const debugPort = process.env.IEDO_AGENT_DEBUG_PORT || 5800;
    console.log('debugPort', debugPort);
    if (this.options.isDebug) opt.execArgv = process.execArgv.concat([`--${semver.gte(process.version, '8.0.0')}`]);
    const agentWorker = fork(this.getAgentWorkerFile(), args, opt) as CustomChildProcess;
    agentWorker.status = 'starting';
    agentWorker.id = ++this.agentWorkerIndex;
    this.workManager.setAgent(agentWorker);

    agentWorker.on('error', (err) => {
      console.log('err: ', err);
    });
    this.log(
      '[master] agent_worker#%s:%s start with clusterPort:%s',
      agentWorker.id,
      agentWorker.pid,
      this.options.clusterPort
    );
  }

  private getAgentWorkerFile() {
    return join(__dirname, 'agent_worker.js');
  }

  private log(...args: (string | number | boolean | MasterOptions | undefined)[]) {
    // @ts-ignore
    this.logger[this.logMethod as Level](...args);
  }

  get agentWorker() {
    return this.workManager.agent;
  }
}
