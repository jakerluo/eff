'use strict';

import { hostname } from 'os';
import util from 'util';
import chalk from 'chalk';
import * as utility from 'utility';
import * as iconv from 'iconv-lite';
import { Level, LevelValue } from './level';
import { TransportOptions } from './transports/transports';

const duartionRegexp = /([0-9]+ms)/g;
const categoryRegexp = /(\[[\w\-_.:]+\])/g;
const httpMethodRegexp = /(GET|POST|PUT|PATH|HEAD|DELETE) /g;

// Like `Object.assign`, but don't copy `undefined` value
export function assign(target: any, ...sources: Array<Record<string, any>>) {
  if (!target) return {};

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    if (!source) continue;
    const keys = Object.keys(source);
    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      if (source[key] !== undefined && source[key] !== null) {
        target[key] = source[key];
      }
    }
  }
  return target;
}

export function normalizeLevel(level?: Level): Level | LevelValue {
  // 'WARN' => level.warn
  if (typeof level === 'string' && level) {
    return (level as string).toUpperCase() as Level;
  }

  if (typeof level === 'number') {
    return level;
  }

  return 'NONE';
}

export interface FormatMeta {
  level?: Level;
  raw?: boolean;
  formatter?: (...args: any[]) => string;
  error?: Error;
  message?: string;
  pid?: number;
  hostname?: string;
  date?: string;
  ctx?: any;
}

export interface FormatOptions extends TransportOptions {
  encoding?: string;
  json?: boolean;
  formatter?: (...args: any[]) => string;
  contextFormatter?: (...args: any[]) => string;
}

export function format(level: Level, args: any[], meta: FormatMeta, options: FormatOptions): Buffer | string {
  meta = meta || {};
  let message;
  let output;
  let formatter = meta.formatter || options.formatter;
  if (meta.ctx && options.contextFormatter) {
    formatter = options.contextFormatter;
  }

  if (args[0] instanceof Error) {
    message = args[0].stack;
  } else {
    message = util.format.apply(util, args);
  }

  if (meta.raw === true) {
    output = message;
  } else if (options.json === true || formatter) {
    meta.level = level;
    meta.date = utility.logDate(',');
    meta.pid = process.pid;
    meta.hostname = hostname();
    meta.message = message;
    if (options.json === true) {
      const outputMeta = { ...meta };
      outputMeta.ctx = undefined;
      output = JSON.stringify(outputMeta);
    } else if (formatter) {
      output = formatter(meta);
    }
  } else {
    output = message;
  }

  if (!output) return Buffer.from('');

  output += options.eol;

  return options.encoding === 'utf8' ? output : iconv.encode(output, options.encoding || 'utf8');
}

export function consoleFormatter(meta: FormatMeta) {
  let msg = meta.date + ' ' + meta.level + ' ' + meta.pid + ' ' + meta.message;
  if (!chalk.supportsColor) {
    return msg;
  }

  if (meta.level === 'ERROR') {
    return chalk.red(msg);
  } else if (meta.level === 'WARN') {
    return chalk.yellow(msg);
  }

  msg = msg.replace(duartionRegexp, chalk.green('$1'));
  msg = msg.replace(categoryRegexp, chalk.blue('$1'));
  msg = msg.replace(httpMethodRegexp, chalk.cyan('$1 '));
  return msg;
}
