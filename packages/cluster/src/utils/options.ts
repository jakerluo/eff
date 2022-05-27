import { getFrameworkPath } from '@iedo/utils';
import { existsSync } from 'fs';
import { join } from 'path';
import { MasterOptions } from '../master';
import { cpus } from 'os';
import assert from 'assert';
import deprecate from 'depd';

export default function parseOptions(options: MasterOptions): MasterOptions {
  const defaults: MasterOptions = {
    framework: '',
    baseDir: process.cwd(),
    port: options.https ? 8443 : null,
    workers: null,
    plugins: null,
    https: false,
  };

  options = extend(defaults, options);
  if (!options.workers) {
    options.workers = cpus().length;
  }

  const pkgPath = join(options.baseDir, 'package.json');
  assert(existsSync(pkgPath), `${pkgPath} should exist`);
  options.framework = getFrameworkPath({
    baseDir: options.baseDir,
    framework: options.framework || options.customIedo,
  });

  const iedo = require(options.framework);
  assert(iedo.Application, `should define Application in ${options.framework}`);
  assert(iedo.Agent, `should define Agent in ${options.framework}`);

  if (options.https) {
    if (typeof options.https === 'boolean') {
      deprecate('[master] Please use `https: { key, cert, ca }` instead of `https: true`');
      options.https = {
        key: options.key,
        cert: options.cert,
      };
    }

    assert(options.https.key && existsSync(options.https.key), 'options.https.key should exists');
    assert(options.https.cert && existsSync(options.https.cert), 'options.https.cert should exists');
    assert(!options.https.ca || existsSync(options.https.ca), 'options.https.ca should exists');
  }

  options.port = Number.parseInt(`${options.port}`, 10) || undefined;
  options.workers = Number.parseInt(`${options.workers}`, 10) || undefined;
  if (options.require) options.require = [].concat(options.require);

  if (process.env.NODE_ENV === 'production') {
    process.env.NO_DEPRECATION = '*';
  }

  const isDebug = process.execArgv.some((arg) => arg.includes('--inspect') || arg.includes('--debug'));
  if (isDebug) options.isDebug = isDebug;

  return options;
}

function extend(target, src) {
  const keys = Object.keys(src);
  for (const key of keys) {
    if (src[key] != null) {
      target[key] = src[key];
    }
  }
  return target;
}
