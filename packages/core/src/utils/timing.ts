import assert from 'assert';

const MAP = Symbol('Timing#map');
const LIST = Symbol('Timing#list');

interface TimingMapItem {
  name?: string;
  end?: number;
  duration?: number;
  start: number;
  pid: number;
  index: number;
}

export default class Timing {
  private enabled: boolean;
  [MAP]: Map<string, TimingMapItem>;
  [LIST]: TimingMapItem[];

  constructor() {
    this.enabled = true;
    this[MAP] = new Map();
    this[LIST] = [];

    this.init();
  }

  private init() {
    this.start('Process Start', Date.now() - Math.floor(process.uptime() * 1000));
    this.end('Process Start');
    // @ts-ignore
    if (process.scriptStartTime && typeof process.scriptStartTime === 'number') {
      // @ts-ignore
      this.start('Script Start', process.scriptStartTime);
      this.end('Script Start');
    }
  }

  start(name: string, start?: number) {
    if (!name || !this.enabled) return;
    if (this[MAP].has(name)) this.end(name);

    start = start || Date.now();
    const item = {
      name,
      start,
      end: undefined,
      duration: undefined,
      pid: process.pid,
      index: this[LIST].length,
    };
    this[MAP].set(name, item);
    this[LIST].push(item);
    return item;
  }

  end(name: string) {
    if (!name || !this.enabled) return;
    assert(this[MAP].has(name), `Timing ${name} not exists`);

    const item = this[MAP].get(name);
    if (item) {
      item.end = Date.now();
      item.duration = item.end - item.start;
      return item;
    }
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  clear() {
    this[MAP].clear();
    this[LIST] = [];
  }

  toJSON() {
    return this[LIST];
  }
}
