#!/usr/bin/env node

import program from 'commander';
import path from 'path';

// Define options
program
  .option('-c, --config <path>', 'Path to the hammer config file');

// Run
program.parse(process.argv);

// Set config path to default if not provided
program.config = path.join(process.cwd(), program.config || 'hammerconfig.js');

// Load the config
const config: any = require(program.config);

console.log(config);
