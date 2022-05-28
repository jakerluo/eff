import { ConsoleLoggerType } from '@iedo/logger';
import assert from 'assert';
import EventEmitter from 'events';
import getReady from 'get-ready';
import { Ready } from 'ready-callback';
import debug$0 from 'debug';
import { getCalleeFromStack } from './utils';

const debug = debug$0('iedo-core:lifecycle');

const INIT = Symbol('Lifycycle#init');
const INIT_READY = Symbol('Lifecycle#initReady');
const DELEGATE_READY_EVENT = Symbol('Lifecycle#delegateReadyEvent');
const REGISTER_READY_CALLBACK = Symbol('Lifecycle#registerReadyCallback');
const CLOSE_SET = Symbol('Lifecycle#closeSet');
const IS_CLOSED = Symbol('Lifecycle#isClosed');
const BOOT_HOOKS = Symbol('Lifecycle#bootHooks');
const BOOTS = Symbol('Lifecycle#boots');

export interface LifecycleOptions {
  baseDir: string;
  app: any;
  logger: ConsoleLoggerType;
}

interface Boot {
  willReady?: () => void;
  didReady?: (error: Error) => void;
  fullPath?: string;
}

export default class Lifecycle extends EventEmitter {
  options: LifecycleOptions;
  [BOOT_HOOKS]: unknown[];
  [BOOTS]: Array<Boot>;
  [CLOSE_SET]: Set<unknown>;
  [IS_CLOSED]: boolean;
  [INIT]: boolean;
  readyTimeout: number;
  loadReady: any;
  bootReady: Ready | null = null;

  constructor(options: LifecycleOptions) {
    super();
    this.options = options;
    this[BOOT_HOOKS] = [];
    this[BOOTS] = [];
    this[CLOSE_SET] = new Set();
    this[IS_CLOSED] = false;
    this[INIT] = false;

    getReady.mixin(this);

    this.timing.start('Application Start');

    const iedoReadyTimoutEnv = Number.parseInt(process.env.IEDO_READY_TIMEOUT_ENV || '10000', 10);

    assert(
      Number.isInteger(iedoReadyTimoutEnv),
      `process.env.IEDO_READY_TIMEOUT_ENV ${process.env.IEDO_READY_TIMEOUT_ENV} should be able to parseInt.`
    );
    this.readyTimeout = iedoReadyTimoutEnv;

    this[INIT_READY]();

    this.on('ready_stat', (data) => {
      this.logger.info('[iedo:core:ready_stat] end ready task %s, remain %j', data.id, data.remain);
    });
    this.on('ready_timeout', (id: string) => {
      this.logger.warn(
        '[iedo:core:ready_timeout] %s seconds later %s was still unable to finish.',
        this.readyTimeout / 1000,
        id
      );
    });

    this.ready((err: Error) => {
      this.triggerDidReady(err);
      this.timing.end('Application Start');
    });
  }

  ready(errFn: boolean | Error | ((err: Error) => void)) {
    console.log('errFn: ', errFn);
  }

  get app() {
    return this.options.app;
  }

  get logger() {
    return this.options.logger;
  }

  get timing() {
    return this.app.timing;
  }

  [INIT_READY]() {
    this.loadReady = new Ready({ timeout: this.readyTimeout });
    this[DELEGATE_READY_EVENT](this.loadReady);
    this.loadReady.ready((err: Error) => {
      if (err) {
        this.ready(err);
      } else {
        this.triggerWillReady().then();
      }
    });

    this.bootReady = new Ready({ timeout: this.readyTimeout, lazyStart: true });
    this[DELEGATE_READY_EVENT](this.bootReady);
    this.bootReady.ready((err: Error) => {
      this.ready(err || true);
    });
  }

  [DELEGATE_READY_EVENT](ready: any) {
    ready.once('error', (err: Error) => ready.ready(err));
    ready.on('ready_timeout', (id: string) => this.emit('ready_timeout', id));
    ready.on('ready_stat', (data: any) => this.emit('ready_stat', data));
    ready.on('error', (err: Error) => this.emit('error', err));
  }

  [REGISTER_READY_CALLBACK]({
    scope,
    scopeFullName,
  }: {
    scope: () => void;
    ready: Ready | null;
    scopeFullName: string;
    timingKeyPrefix: string;
  }) {
    if (!(typeof scope === 'function')) {
      throw new Error('boot only support function');
    }
    const name = scopeFullName || getCalleeFromStack(true, 4);
    console.log(name);
    // const timingkey = `${timingKeyPrefix} in ` + getResolvedFilename(name, this.app.baseDir);
  }

  private async triggerWillReady() {
    debug('registry willReady');
    this.bootReady?.start();
    for (const boot of this[BOOTS]) {
      const willReady = boot.willReady && boot.willReady.bind(boot);
      if (willReady) {
        this[REGISTER_READY_CALLBACK]({
          scope: willReady,
          ready: this.bootReady,
          timingKeyPrefix: 'Will Ready',
          scopeFullName: `${boot.fullPath}:willReady`,
        });
      }
    }
  }

  private triggerDidReady(err: Error) {
    debug('trigger didReady');
    (async () => {
      for (const boot of this[BOOTS]) {
        if (boot.didReady) {
          try {
            await boot.didReady(err);
          } catch (error) {
            this.emit('error', error);
          }
        }
      }
      debug('trigger didReady done');
    })();
  }
}
