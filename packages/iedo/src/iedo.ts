import { IedoCore, IedoCoreOptions } from '@iedo/core';

export interface IedoApplicationOptions extends IedoCoreOptions {
  mode?: string;
}

export default class IedoApplication extends IedoCore {
  constructor(options: IedoApplicationOptions = {}) {
    options.mode = options.mode || 'cluster';
    super(options);

    console.log('IedoApplication', this);
  }
}
