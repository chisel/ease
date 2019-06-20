#!/usr/bin/env node

import program from 'commander';
import path from 'path';
import { EaseConfig } from './app.model';
import { Ease } from './ease';

// Define CLI
program
  .version('1.0.3', '--version')
  .usage('[options] <jobs>')
  .option('-c, --config <path>', 'path to the ease config file')
  .option('-v --verbose', 'detailed console logs')
  .option('-a --all', 'run all jobs defined in the ease config file')
  .parse(process.argv);

// Set config path to default if not provided
program.config = path.join(process.cwd(), program.config || 'easeconfig.js');

// If no job names are provided
if ( ! program.args.length && ! program.all ) program.help();

// Load the config
const config: EaseConfig = require(program.config);

const ease: Ease = new Ease(program.verbose);

// Configure Ease
config(ease);

// Run the jobs
ease._execJobs(program.args, program.all);
