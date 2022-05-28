import { TransportOptions } from './transports/transports';
import { assign, FormatMeta } from './utils';

type LoggerOptions = {
  excludes: string[];
};

type DuplicateLogger = {
  logger: any;
  options: LoggerOptions;
};

export default class Logger extends Map {
  options: TransportOptions;
  transports: Record<string, unknown>;
  name: string;
  redirectLoggers: Map<any, LoggerOptions>;
  duplicateLoggers: Map<string, DuplicateLogger>;

  constructor(options?: TransportOptions) {
    super();
    this.options = assign(this.defaults, options || {});
    this.transports = {};
    this.name = this.constructor.name;
    this.redirectLoggers = new Map();
    this.duplicateLoggers = new Map();
  }

  get defaults() {
    return {};
  }

  disable(name: string) {
    const transport = this.get(name);
    if (transport) transport.disabled();
  }

  enable(name: string) {
    const transport = this.get(name);
    if (transport) transport.enabled();
  }

  log(level: string, args: any, meta?: FormatMeta) {
    let excludes;
    let { logger, options } = this.duplicateLoggers.get(level) || {};
    if (logger) {
      if (options) {
        excludes = options.excludes;
        logger.log(level, args, meta);
      }
    } else {
      logger = this.redirectLoggers.get(level);
      if (logger) {
        logger.log(level, args, meta);
        return;
      }
    }

    for (const [key, transport] of this.entries()) {
      if (transport.shouldLog(level) && !(excludes && excludes.includes(key))) {
        transport.log(level, args, meta);
      }
    }
  }

  error(...args: any[]) {
    this.log('ERROR', args);
  }

  warn(...args: any[]) {
    this.log('WARN', args);
  }

  info(...args: any[]) {
    this.log('INFO', args);
  }

  debug(...args: any[]) {
    this.log('DEBUG', args);
  }
}
