#!/usr/bin/env node
import 'source-map-support/register';
import path from 'path';
import app from 'argumental';
import fs from 'fs-extra';
import { register } from 'ts-node';
import { EaseConfig } from './lib/models';
import { Ease } from './lib/ease';

app
.version(require(path.resolve(__dirname, '..', 'package.json')).version)

.argument('[...jobs]', 'list of job names to run')

.option('-c --config <path>', 'path to the ease config file')
.validate(app.FILE_PATH)
.option('-V --verbose', 'detailed console logs')
.option('-a --all', 'run all jobs defined in the ease config file')

.on('validators:after', data => {

  // If no jobs provided while --all is false
  if ( ! data.opts.all && ! data.args.jobs?.length ) {

    app.error('No jobs to run! To run all jobs, provide the --all flag');
    process.exit(1);

  }

})

.action(async (args, opts) => {

  if ( ! opts.config ) opts.config = '.';

  let easeconfigPath = path.isAbsolute(opts.config) ? opts.config : path.resolve(process.cwd(), opts.config);

  // Look for easeconfig file
  let currentDir = process.cwd();
  let found = false;

  while ( ! found ) {

    // Look for easeconfig file
    if ( await fs.pathExists(path.resolve(currentDir, 'easeconfig.js')) ) {

      easeconfigPath = path.resolve(currentDir, 'easeconfig.js');
      found = true;

    }
    else if ( await fs.pathExists(path.resolve(currentDir, 'easeconfig.ts')) ) {

      easeconfigPath = path.resolve(currentDir, 'easeconfig.ts');
      found = true;

    }
    // If reached root directory
    else if ( path.parse(process.cwd()).root === currentDir ) {

      app.error('Could not locate ease config file!');
      process.exit(1);

    }
    // Traverse back one directory
    else {

      currentDir = path.resolve(currentDir, '..');

    }

  }

  // Register TS handler
  if ( path.extname(easeconfigPath) === '.ts' )
    register({ dir: path.dirname(easeconfigPath) });

  // Load easeconfig file
  let config = require(easeconfigPath);

  // Sanitize and validate import
  if ( typeof config !== 'function' ) {

    if ( config && typeof config === 'object' && config.hasOwnProperty('default') && typeof config.default === 'function' ) {

      config = config.default;

    }
    else {

      app.error(`Invalid ${path.basename(easeconfigPath)}! Config file does not export a function.`);
      process.exit(1);

    }

  }

  // Instantiate Ease
  const ease = new Ease(opts.verbose, path.dirname(easeconfigPath));

  // Configure ease
  (<EaseConfig>config)(ease);

  // Execute the jobs
  (<any>ease)._execJobs(args.jobs, opts.all);

})

.parse(process.argv);
