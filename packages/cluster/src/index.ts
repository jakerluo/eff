import Master, { MasterOptions } from './master';

require.resolve('./agent_worker');

export function startCluster(options: MasterOptions, callback: () => void) {
  new Master(options).ready(callback);
}
