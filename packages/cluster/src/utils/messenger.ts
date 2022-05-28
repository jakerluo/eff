import cluster from 'cluster';
import sendMessage from 'sendmessage';
import type Master from '../master';

interface SendData<T extends unknown = {}> {
  from?: 'master' | 'parent' | 'worker' | 'agent' | 'app';
  to?: 'master' | 'parent' | 'worker' | 'agent' | 'app';
  action?: 'message' | 'error' | 'exit' | 'listening' | 'disconnect' | 'fork' | 'online' | 'offline' | string;
  receiverPid?: string;
  data: T;
}

export default class Messenger {
  master: Master;
  hasParent: boolean;
  constructor(master: Master) {
    this.master = master;
    this.hasParent = !!process.send;
    process.on('message', (msg: SendData) => {
      msg.from = 'parent';
      this.send(msg);
    });
    process.once('disconnect', () => {
      this.hasParent = false;
    });
  }

  send<T>(data: SendData<T>) {
    if (!data.from) {
      data.from = 'master';
    }

    if (data.receiverPid) {
      if (data.receiverPid === String(process.pid)) {
        data.to = 'master';
      } else if (data.receiverPid === String(this.master.agentWorker?.pid)) {
        data.to = 'agent';
      } else {
        data.to = 'app';
      }
    }

    if (!data.to) {
      if (data.from === 'agent') data.to = 'app';
      if (data.from === 'app') data.to = 'agent';
      if (data.from === 'parent') data.to = 'master';
    }

    if (data.to === 'master') {
      this.sendToMaster(data);
      return;
    }

    if (data.to === 'parent') {
      this.sentToParent(data);
      return;
    }

    if (data.to === 'app') {
      this.sendToAppWorker(data);
      return;
    }

    if (data.to === 'agent') {
      this.sendToAgentWorker(data);
      return;
    }
  }

  sendToMaster(data: SendData) {
    if (data.action) {
      this.master.emit(data.action, data);
    }
  }

  sentToParent(data: SendData) {
    if (this.hasParent && process.send) {
      process.send(data);
    }
  }

  sendToAppWorker(data: SendData) {
    for (const id in cluster.workers) {
      const worker = cluster.workers[id] as any;
      if (worker.state === 'disconnected') {
        continue;
      }
      if (data.receiverPid && data.receiverPid !== String(worker.process.pid)) {
        continue;
      }
      sendMessage(worker, data);
    }
  }

  sendToAgentWorker(data: SendData) {
    if (this.master.agentWorker) {
      sendMessage(this.master.agentWorker, data);
    }
  }
}
