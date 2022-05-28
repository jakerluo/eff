import { LevelValue } from '../level';
import { assign, format, normalizeLevel, FormatMeta } from '../utils';
import { EOL } from 'os';
import levels from '../level';
import { Level } from '../level';

const ENABLED = Symbol('Transport#enabled');

export type TransportOptions = {
  level?: Level | LevelValue;
  formatter?: any;
  contextFormatter?: any;
  json?: any;
  encoding?: string;
  eol?: string;
  stderrLevel?: Level | LevelValue;
};

export default class Transport {
  options: TransportOptions;

  [ENABLED] = true;

  constructor(options: Partial<TransportOptions>) {
    this.options = assign(this.defaults, options) as unknown as Required<TransportOptions>;

    if (this.options.encoding === 'utf-8') {
      this.options.encoding = 'utf8';
    }
    this.options.level = normalizeLevel(this.options.level as Level);
  }

  get defaults(): TransportOptions {
    return {
      level: 'NONE',
      formatter: null,
      contextFormatter: null,
      json: false,
      encoding: 'utf8',
      eol: EOL,
    };
  }

  get enabled() {
    return this[ENABLED];
  }

  enable() {
    this[ENABLED] = true;
  }

  disable() {
    this[ENABLED] = false;
  }

  set level(level: Level) {
    this.options.level = normalizeLevel(level);
  }

  get level() {
    return (this.options.level || levels.NONE) as Level;
  }

  shouldLog(level: Level) {
    if (!this[ENABLED]) {
      return false;
    }

    if (this.options.level === levels.NONE) {
      return false;
    }

    if (this.options.level) {
      return this.options.level <= levels[level];
    }

    return true;
  }

  log(level: Level, args: string[], meta: FormatMeta): string | Buffer | void {
    return format(level, args, meta, this.options);
  }

  reload() {}

  close() {}

  end() {}
}
