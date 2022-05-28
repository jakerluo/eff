import IedoApplication, { IedoApplicationOptions } from './iedo';

export default class Agent extends IedoApplication {
  constructor(options: IedoApplicationOptions = {}) {
    options.type = 'agent';
    super(options);
  }
}
