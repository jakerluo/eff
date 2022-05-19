#!/usr/bin/env node

'use strict';

const Command = require('..');

async function main() {
  const command = new Command();
  await command.run(process.cwd(), process.argv.slice(2));
}

main().catch(err => {
  console.log(err.stack);
  process.exit(1);
});
