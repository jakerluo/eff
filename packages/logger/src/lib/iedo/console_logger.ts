import { Level } from './../level';
import Logger from '../logger';
import ConsoleTransport from '../transports/console';
import type { TransportOptions } from '../transports/transports';
import { consoleFormatter } from '../utils';

export default class ConsoleLogger extends Logger {
  constructor(options?: TransportOptions) {
    super(options);
    this.set(
      'console',
      new ConsoleTransport({
        level: this.options.level,
        formatter: consoleFormatter,
      })
    );
  }

  override get defaults() {
    return {
      encoding: 'utf8',
      level: (process.env.NODE_CONSOLE_LOGGRE_LEVEL ||
        (process.env.NODE_ENV === 'production' ? 'INFO' : 'WARN')) as Level,
    };
  }
}
