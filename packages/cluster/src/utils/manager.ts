import { ChildProcess } from 'child_process';
import EventEmitter from 'events';

export interface CustomChildProcess extends ChildProcess {
  status?: string;
  id?: number;
}

export default class Manager extends EventEmitter {
  workers: Map<any, any>;
  agent: CustomChildProcess | null;
  exception: number | undefined;
  timer: NodeJS.Timer | undefined;

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

  setWorker(worker: { process: { id: any } }) {
    this.workers.set(worker.process.id, worker);
  }

  getWorker(id: any) {
    return this.workers.get(id);
  }

  deleteWorker(id: any) {
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
      if (!this.exception) {
        this.exception = 0;
      }
      this.exception += 1;
      if (this.exception >= 3) {
        this.emit('execption', count);
        clearInterval(this.timer);
      }
    }, 10000);
  }
}
