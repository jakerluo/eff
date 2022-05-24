import type { Level } from '../level';
import levels from '../level';
import { assign, FormatMeta, normalizeLevel } from '../utils';
import Transport, { TransportOptions } from './transports';

export default class ConsoleTransport extends Transport {
  constructor(options: TransportOptions) {
    super(options);
    this.options.stderrLevel = normalizeLevel((this.options.stderrLevel ?? levels.NONE) as Level);
    if (process.env.IEDO_LOG) {
      this.options.level = normalizeLevel(process.env.IEDO_LOG as Level);
    }
  }

  override get defaults() {
    return assign(super.defaults, {
      stderrLevel: 'ERROR',
    });
  }

  override log(level: Level, args: string[], meta: FormatMeta) {
    const message = super.log(level as Level, args, meta) || '';
    if (
      this.options.stderrLevel &&
      (levels[level] as any) >= this.options.stderrLevel &&
      (levels[level] as unknown as number) < levels['NONE']
    ) {
      process.stderr.write(message);
    } else {
      process.stdout.write(message);
    }
  }
}
