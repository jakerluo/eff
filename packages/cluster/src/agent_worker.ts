const options = JSON.parse(process.argv[2]);
if (options.require) {
  options.require.forEach((mod) => {
    require(mod);
  });
}

import debug$0 from 'debug';
import gracefulExit from 'graceful-process';
import { IedoConsoleLogger as ConsoleLogger, Level } from '@iedo/logger';

const debug = debug$0('iedo-cluster');
const consoleLogger = new ConsoleLogger({ level: process.env.IEDO_AGENT_WORKER_LOGGER_LEVEL as Level });

const Agent = require(options.framework).Agent;
debug('new Agent with options %j', options);
let agent;

try {
  agent = new Agent(options);
} catch (err) {
  consoleLogger.error(err);
  throw new Error(err);
}

function startErrorHandler(err) {
  consoleLogger.error(err);
  consoleLogger.error('[agent_worker] start error, exiting with code:1');
  process.exitCode = 1;
  process.kill(process.pid);
}

agent.ready((err) => {
  if (err) return;

  agent.removeListener('error', startErrorHandler);
  process.send({ action: 'agent-start', to: 'master' });
});

agent.on('error', startErrorHandler);

gracefulExit({
  logger: consoleLogger,
  label: 'agent_worker',
  beforeExit: () => agent.close(),
});

export default {};
