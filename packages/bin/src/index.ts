import { join } from 'path';
import Command$0 from './lib/command';
import TestCommand$0 from './lib/cmd/test';
import DevCommand$0 from './lib/cmd/dev';
import PkgFilesCommand$0 from './lib/cmd/pkgfiles';

export default class EasyDoBin extends Command$0 {
  constructor(rawArgv: string[]) {
    super(rawArgv);
    this.usage = 'Usage: iedo [command] [options]';

    this.load(join(__dirname, 'lib/cmd'));
  }
}

module.exports = exports = EasyDoBin;

export const Command = Command$0;
export const DevCommand = DevCommand$0;
export const TestCommand = TestCommand$0;
export const PkgFilesCommand = PkgFilesCommand$0;
