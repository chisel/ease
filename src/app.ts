#!/usr/bin/env node

import program from 'commander';
import path from 'path';
import { HammerConfig } from './app.model';
import { Hammer } from './hammer';

// Define CLI
program
  .version('1.0.0', '--version')
  .usage('[options] <jobs>')
  .option('-c, --config <path>', 'Path to the hammer config file')
  .option('-v --verbose', 'Detailed console logs')
  .option('-a --all', 'Run all jobs defined in the hammer config file')
  .parse(process.argv);

// Set config path to default if not provided
program.config = path.join(process.cwd(), program.config || 'hammer.js');

// If no job names are provided
if ( ! program.args.length && ! program.all ) program.help();

// Load the config
const config: HammerConfig = require(program.config);

const hammer: Hammer = new Hammer(program.verbose);

// Configure Hammer
config(hammer);

// Run the jobs
hammer._execJobs(program.args, program.all);
