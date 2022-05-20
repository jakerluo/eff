'use strict';

import { Context } from 'common-bin';
import Command from '../command';

export default class PkgFilesCommand extends Command {
  constructor(rawArgs: string[]) {
    super(rawArgs);

    this.usage = 'Usage: iedo-bin pkg files';
    this.options = {
      check: {
        description: `assert whether it's same`,
      },
    };
  }

  get description() {
    return 'Generate pkg.files automatically';
  }

  override async run(context: Context) {
    const { argv, cwd } = context;

    const args = ['--entry', 'app', '--entry', 'config', '--entry', '*.js'];

    if (argv.check) args.push('--check');
    const PkgFiles = require.resolve('ypkgfiles/bin/ypkgfiles.js');
    await this.helper.spawn(PkgFiles, args, { cwd });
  }
}
