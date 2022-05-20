import * as utils from '@iedo/utils';
import { isAbsolute, join } from 'path';
import Command from '../command';
import type { Context } from 'common-bin';
import debug from 'debug';
import detect from 'detect-port';

const debugLog = debug('iedo-bin');

export default class DevCommand extends Command {
  defaultPort: number;
  serverBin: string;
  constructor(rawArgv: string[]) {
    super(rawArgv);
    this.usage = 'Usage: iedo dev [dir] [options]';

    this.defaultPort = 7001;
    this.serverBin = join(__dirname, '../../../start-cluster');

    this.options = {
      baseDir: {
        description: 'directory of application, default to `process.cwd()`',
        type: 'string',
      },
      workers: {
        description: 'numbers of app workers, default to 1 at local mode',
        type: 'number',
        alias: ['c', 'cluster'],
        default: 1,
      },
      port: {
        description: 'listening port, default to 7001',
        type: 'number',
        alias: 'p',
      },
      framework: {
        description: 'specify framework that can be absolute path or npm package',
        type: 'string',
      },
      require: {
        description: 'will add to execArgv --require',
        type: 'array',
        alias: 'r',
      },
    };
  }

  // @ts-ignore
  get description() {
    return 'start server at local dev mode';
  }

  // @ts-ignore
  get context() {
    const context = super.context;
    const { argv, execArgvObj } = context;
    execArgvObj.require = execArgvObj?.require || [];

    if (argv.require) {
      execArgvObj.require.push(...argv.require);
      argv.require = undefined;
    }

    return context;
  }

  override async run(context: Context) {
    const devArgs = await this.formatArgs(context);

    const env = {
      NODE_ENV: 'development',
      EASYDO_MASTER_CLOSE_TIMEOUT: 1000,
    };

    const options = {
      execArgv: context.execArgv,
      env: Object.assign(env, context.env),
    };
    debugLog('%s %j %j, %j', this.serverBin, devArgs, options.execArgv, options.env.NODE_ENV);
    const task = this.helper.forkNode(this.serverBin, devArgs, options);
    // @ts-ignore
    this.proc = task.proc;
    await task;
  }

  async formatArgs(context: Context) {
    const { cwd, argv } = context;
    argv.baseDir = argv.baseDir || cwd;

    if (!isAbsolute(argv.baseDir)) {
      argv.baseDir = join(cwd, argv.baseDir);
    }
    argv.port = argv.port || argv.p;

    argv.framework = utils.getFrameworkPath({
      framework: argv.framework,
      baseDir: argv.baseDir,
    });

    argv.cluster = undefined;
    argv.c = undefined;
    argv.p = undefined;
    // @ts-ignore
    argv._ = undefined;
    // @ts-ignore
    argv.$0 = undefined;

    if (!argv.port) {
      debugLog('detect available port');
      const port = await detect(this.defaultPort);
      if (port !== this.defaultPort) {
        argv.port = port;
        console.warn(`[iedo-bin] server port ${this.defaultPort} is in use, now using port ${port}\n`);
      }
      debugLog('use available port %d', port);
    }

    return [JSON.stringify(argv)];
  }
}
