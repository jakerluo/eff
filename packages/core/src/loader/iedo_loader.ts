import type Lifecycle from './../lifecycle';
import { existsSync, readFileSync, realpathSync } from 'fs';
import { ConsoleTransportType } from '@iedo/logger';
import type IedoCore from '../iedo';
import assert from 'assert';
import Timing from '../utils/timing';
import { join } from 'path';
import utility from 'utility';
import { homedir } from 'os';

const REQUIRE_COUNT = Symbol('IedoLoader#requireCount');

export interface IedoLoaderOptions {
  baseDir: string;
  app: IedoCore;
  plugins?: unknown[];
  logger: ConsoleTransportType;
  serverScope?: string;
  env?: string;
}

export default class IedoLoader {
  options: IedoLoaderOptions;
  app: IedoCore;
  lifecycle: Lifecycle;
  timing: Timing;
  pkg: utility.ObjStatic;
  eggPaths: string[];
  serverEnv: string;
  serverScope: string;
  appInfo: {
    name: any;
    baseDir: string;
    env: string;
    scope: string;
    HOME: string;
    pkg: utility.ObjStatic;
    root: string;
  };

  constructor(options: IedoLoaderOptions) {
    this.options = options;
    assert(existsSync(this.options.baseDir), ` ${this.options.baseDir} not exists`);
    assert(this.options.app, 'options.app is required');
    assert(this.options.logger, 'options.logger is required');

    this.app = this.options.app;
    this.lifecycle = this.app.lifecycle;
    this.timing = this.app.timing || new Timing();
    this[REQUIRE_COUNT] = 0;
    this.pkg = utility.readJSONSync(join(this.options.baseDir, 'package.json'));
    // this.eggPaths = this.getIedoPaths();
    this.serverEnv = this.getServerEnv();

    this.appInfo = this.getAppInfo();
    this.serverScope = this.options.serverScope !== undefined ? this.options.serverScope : this.getServerScope();
  }

  private getIedoPaths() {
    const IedoCore = require('../iedo');
    const iedoPaths = [];

    let proto = this.app;

    while (proto) {
      proto = Object.getPrototypeOf(proto);
      if (proto === Object.prototype || proto == IedoCore.prototype) {
        break;
      }
      assert(
        proto.hasOwnProperty(Symbol.for('iedo#iedoPath')),
        "Symbol.for('iedo#iedoPath') is required on Application"
      );
      const iedoPath = proto[Symbol.for('iedo#iedoPath')];
      assert(iedoPath && typeof iedoPath === 'string', "Symbol.for('egg#eggPath') should be string");
      assert(existsSync(iedoPath), `${iedoPath} not exists`);
      const realpath = realpathSync(iedoPath);
      if (!iedoPaths.includes(realpath)) {
        iedoPaths.unshift(realpath);
      }
    }
    return iedoPaths;
  }

  private getServerEnv() {
    let serverEnv = this.options.env;

    const envPath = join(this.options.baseDir, 'config/env');
    if (!serverEnv && existsSync(envPath)) {
      serverEnv = readFileSync(envPath, 'utf8').trim();
    }

    if (!serverEnv) {
      serverEnv = process.env.EGG_SERVER_ENV;
    }

    if (!serverEnv) {
      if (process.env.NODE_ENV === 'test') {
        serverEnv = 'unittest';
      } else if (process.env.NODE_ENV === 'production') {
        serverEnv = 'prod';
      } else {
        serverEnv = 'local';
      }
    } else {
      serverEnv = serverEnv.trim();
    }

    return serverEnv;
  }

  private getAppname() {
    if (this.pkg.name) {
      return this.pkg.name;
    }
    const pkg = join(this.options.baseDir, 'package.json');
    throw new Error(`name is required from ${pkg}`);
  }
  private getAppInfo() {
    const env = this.serverEnv;
    const scope = this.serverScope;
    const home = this.getHomedir();
    const baseDir = this.options.baseDir;

    return {
      name: this.getAppname(),
      baseDir,
      env,
      scope,
      HOME: home,
      pkg: this.pkg,
      root: env === 'local' || env === 'unittest' ? baseDir : home,
    };
  }

  private getHomedir() {
    return process.env.IEDO_HOME || homedir() || '/home/admin';
  }

  private getServerScope() {
    return process.env.IEDO_SERVER_SCOPE || '';
  }
}
