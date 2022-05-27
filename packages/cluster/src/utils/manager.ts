import { ChildProcess } from 'child_process';
import EventEmitter from 'events';

export interface CustomChildProcess extends ChildProcess {
  status?: string;
  id?: number;
}

export default class Manager extends EventEmitter {
  workers: Map<any, any>;
  agent: CustomChildProcess;
  exception: number;
  timer: NodeJS.Timer;

  constructor() {
    super();
    this.workers = new Map();
    this.agent = null;
  }

  setAgent(agent: CustomChildProcess) {
    this.agent = agent;
  }

  deleteAgent() {
    this.agent = null;
  }

  setWorker(worker) {
    this.workers.set(worker.process.id, worker);
  }

  getWorker(id) {
    return this.workers.get(id);
  }

  deleteWorker(id) {
    this.workers.delete(id);
  }

  listWorkerIds() {
    return Array.from(this.workers.keys());
  }

  getListeningWokerIds() {
    const keys = [];
    for (const id of this.workers.keys()) {
      if (this.getWorker(id).state === 'listening') {
        keys.push(id);
      }
    }
    return keys;
  }

  count() {
    return {
      agent: this.agent && this.agent.status === 'started' ? 1 : 0,
      worker: this.listWorkerIds().length,
    };
  }

  startCheck() {
    this.exception = 0;

    this.timer = setInterval(() => {
      const count = this.count();
      if (count.agent && count.worker) {
        this.exception = 0;
        return;
      }
      this.exception += 1;
      if (this.exception >= 3) {
        this.emit('execption', count);
        clearInterval(this.timer);
      }
    }, 10000);
  }
}
