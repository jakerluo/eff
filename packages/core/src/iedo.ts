import { existsSync, statSync } from 'fs';
import KoaApplication from 'koa';
import assert from 'assert';
import Timing from './utils/timing';
import * as utils from './utils';
import { ConsoleTransport, ConsoleTransportType } from '@iedo/logger';
import BaseContextClass from './utils/base_context_class';
import Lifecycle from './lifecycle';
import type { IedoLoaderOptions } from './loader/iedo_loader';
import IedoLoader from './loader/iedo_loader';

export interface IedoCoreOptions {
  baseDir?: string;
  type?: 'application' | 'agent';
  plugins?: IedoLoaderOptions['plugins'];
  serverScope?: IedoLoaderOptions['serverScope'];
  env?: IedoLoaderOptions['env'];
}

const DEPRECATE = Symbol('EggCore#deprecate');
const EGG_LOADER = Symbol.for('egg#loader');

export default class IedoCore extends KoaApplication {
  timing: Timing;
  [DEPRECATE]: Map<string, any>;
  options: IedoCoreOptions;
  private _options: IedoCoreOptions;
  console: ConsoleTransportType;
  BaseContextClass: typeof BaseContextClass;
  Controller: typeof BaseContextClass;
  Service: typeof BaseContextClass;
  lifecycle: Lifecycle;
  loader: IedoLoader;

  constructor(options: IedoCoreOptions) {
    options.baseDir = options.baseDir || process.cwd();
    options.type = options.type || 'application';

    assert(typeof options.baseDir === 'string', 'options.baseDir required, and must be a string');
    assert(existsSync(options.baseDir), `Directory ${options.baseDir} not exists`);
    assert(statSync(options.baseDir).isDirectory(), `Directory ${options.baseDir} is not a directory`);
    assert(options.type === 'application' || options.type === 'agent', 'options.type should be application or agent');

    super();

    this.timing = new Timing();
    this[DEPRECATE] = new Map();
    this._options = this.options = options;
    this.deprecate.property(this, '_options', 'app._options is deprecated, use app.options instead.');

    this.console = new ConsoleTransport();

    this.BaseContextClass = BaseContextClass;

    const Controller = this.BaseContextClass;

    this.Controller = Controller;

    const Service = this.BaseContextClass;

    this.Service = Service;
    this.lifecycle = new Lifecycle({
      baseDir: options.baseDir,
      app: this,
      logger: this.console,
    });

    this.lifecycle.on('error', (err: Error) => this.emit('error', err));
    this.lifecycle.on('ready_timeout', (id: string) => this.emit('ready_timeout', id));
    this.lifecycle.on('ready_stat', (data) => this.emit('ready_stat', data));

    const Loader = this[EGG_LOADER];
    this.loader = new Loader({
      baseDir: options.baseDir,
      app: this,
      plugins: options.plugins,
      logger: this.console,
      serverScope: options.serverScope,
      env: options.env,
    });
  }

  ready(flagOrFunction: boolean | Error | ((err: Error) => void)) {
    this.lifecycle.ready(flagOrFunction);
  }

  get deprecate() {
    const caller = utils.getCalleeFromStack();
    if (!this[DEPRECATE].has(caller)) {
      const deprecate = require('depd')('egg');
      deprecate.__file = caller;
      this[DEPRECATE].set(caller, deprecate);
    }
    return this[DEPRECATE].get(caller);
  }

  get [EGG_LOADER]() {
    return IedoLoader;
  }
}
