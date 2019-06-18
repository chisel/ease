#!/usr/bin/env node

import program from 'commander';
import path from 'path';
import { HammerConfig } from './app.model';
import { Hammer } from './hammer';

// Define CLI
program
  .version('1.0.0')
  .usage('[options] <jobs>')
  .option('-c, --config <path>', 'Path to the hammer config file')
  .option('-v --verbose', 'Detailed console logs')
  .parse(process.argv);

// Set config path to default if not provided
program.config = path.join(process.cwd(), program.config || 'hammer.js');

if ( ! program.args.length ) throw new Error(`No job name provided!`);

// Load the config
const config: HammerConfig = require(program.config);

const hammer: Hammer = new Hammer(program.verbose);

// Configure Hammer
config(hammer);

// Run the jobs
hammer._execJobs(program.args);
