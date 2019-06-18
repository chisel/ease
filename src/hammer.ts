import { Registry, Task, Job, GenericTaskRunner, ErrorTaskRunner, ErrorJobRunner, GenericJobRunner } from './app.model';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import chalk from 'chalk';
import request from 'request';

export class Hammer {

  private jobs: Registry<Job> = {};
  private tasks: Registry<Task> = {};

  constructor(
    private _verbose: boolean
  ) {

    fs.ensureFileSync(path.join(os.homedir(), '.hammer', 'hammer.log'));

  }

  private _parseName(name: string): { name: string; hook?: string; } {

    const components = name.split(':');

    return {
      name: components[0].toLowerCase(),
      hook: components[1] ? components[1].toLowerCase() : undefined
    };

  }

  private _logToFile(message: string): void {

    fs.appendFileSync(path.join(os.homedir(), '.hammer', 'hammer.log'), message + '\n');

  }

  private _log(message: string): void {

    console.log(`[HAMMER] ${message}`);
    this._logToFile(`[HAMMER] ${message}`);

  }

  private _logError(message: string): void {

    console.log(chalk.bold.redBright(`[ERROR] ${message}`));
    this._logToFile(`[ERROR] ${message}`);

  }

  private _logWarning(message: string): void {

    console.log(chalk.bold.yellowBright(`[WARNING] ${message}`));
    this._logToFile(`[WARNING] ${message}`);

  }

  private _logConfig(message: string): void {

    if ( this._verbose ) console.log(chalk.bold.greenBright(`[CONFIG] ${message}`));
    this._logToFile(`[CONFIG] ${message}`);

  }

  private async _onTaskError(handler: ErrorTaskRunner|undefined, taskName: string, jobName: string, error: Error) {

    if ( handler ) {

      try {

        await handler(jobName, error);

      }
      catch (error) {

        this._logError(`An error has occurred on the error hook of task "${taskName}"\n${error}`);

        throw new Error(`An error has occurred on the error hook of task "${taskName}"\n${error}`);

      }

    }

  }

  private async _onJobError(handler: ErrorJobRunner|undefined, jobName: string, error: Error) {

    if ( handler ) {

      try {

        await handler(error);

      }
      catch (error) {

        this._logError(`An error has occurred on the error hook of job "${jobName}"\n${error}`);

        throw new Error(`An error has occurred on the error hook of job "${jobName}"\n${error}`);

      }

    }

  }

  private async _onJobSuspend(job: Job) {

    this._logWarning(`Job "${job.name}" was suspended!`);

    if ( job.suspendHook ) {

      this._log(`Running suspend hook of job "${job.name}"...`);

      try {

        await job.suspendHook();

      }
      catch (error) {

        this._logError(`An error has occurred on the suspend hook of the job "${job.name}"!\n${error}`);

        throw new Error(`An error has occurred on the suspend hook of the job "${job.name}"!\n${error}`);

      }

    }

  }

  private async _execJob(jobName: string) {

    // Check if job exists
    if ( ! this.jobs[jobName] ) {

      this._logError(`Job "${jobName}" not found!`);

      throw new Error(`Job "${jobName}" not found!`);

    }

    // Check if job has tasks
    if ( ! this.jobs[jobName].tasks.length ) {

      this._logError(`Job "${jobName}" has no tasks!`);

      throw new Error(`Job "${jobName}" has no tasks!`);

    }

    const job = this.jobs[jobName];

    // Call job before if any
    if ( job.beforeHook ) {

      this._log(`Running before hook of job "${jobName}"...`);

      try {

        await job.beforeHook(() => job.suspended = true);

      }
      catch (error) {

        this._logError(`An error has occurred on the before hook of the job "${jobName}"!\n${error}`);

        throw new Error(`An error has occurred on the before hook of the job "${jobName}"!\n${error}`);

      }

    }

    // If job was suspended, call the suspend hook if any
    if ( job.suspended ) {

      await this._onJobSuspend(job);

      return;

    }

    // Execute job tasks
    this._log(`Executing job "${jobName}"...`);

    for ( const taskName of job.tasks ) {

      const task: Task = this.tasks[taskName];

      // If task has no definition
      if ( ! task.runner ) {

        this._logError(`Task "${taskName}" does not have a definition!`);

        await this._onTaskError(task.errorHook, taskName, jobName, new Error(`Task "${taskName}" does not have a definition!`));

        throw new Error(`Task "${taskName}" does not have a definition!`);

      }

      // Run task before hook if any
      if ( task.beforeHook ) {

        this._log(`Running before hook of task "${taskName}"...`);

        try {

          await task.beforeHook(jobName, () => task.suspended = true);

        }
        catch (error) {

          this._logError(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);

          await this._onTaskError(task.errorHook, taskName, jobName, error);

          throw new Error(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);

        }

      }

      // If job is suspended, run job suspend hook if any
      if ( job.suspended ) {

        await this._onJobSuspend(job);

        return;

      }

      // If task is suspended, run task suspend hook if any
      if ( task.suspended ) {

        this._logWarning(`Task "${taskName}" was suspended!`);

        if ( task.suspendHook ) {

          this._log(`Running suspend hook of task "${taskName}"...`);

          try {

            await task.suspendHook(jobName);

          }
          catch (error) {

            this._logError(`An error has occurred on the suspend hook of the task "${taskName}"!\n${error}`);

            await this._onTaskError(task.errorHook, taskName, jobName, error);

            throw new Error(`An error has occurred on the suspend hook of the task "${taskName}"!\n${error}`);

          }

        }

        continue;

      }

      // Run the task
      this._log(`Running task "${taskName}"...`);

      try {

        await task.runner(jobName);

      }
      catch (error) {

        this._logError(`An error has occurred on task "${taskName}"!\n${error}`);

        await this._onTaskError(task.errorHook, taskName, jobName, error);

        throw new Error(`An error has occurred on task "${taskName}"!\n${error}`);

      }

      if ( job.suspended ) {

        await this._onJobSuspend(job);

        return;

      }

      // Run task after hook if any
      if ( task.afterHook ) {

        this._log(`Running after hook of task "${taskName}"...`);

        try {

          await task.afterHook(jobName);

        }
        catch (error) {

          this._logError(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);

          await this._onTaskError(task.errorHook, taskName, jobName, error);

          throw new Error(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);

        }

      }

      if ( job.suspended ) {

        await this._onJobSuspend(job);

        return;

      }

    }

    // Call job after if any
    if ( job.afterHook ) {

      this._log(`Running after hook of job "${jobName}"...`);

      try {

        await job.afterHook();

      }
      catch (error) {

        this._logError(`An error has occurred on the after hook of the job "${jobName}"!\n${error}`);

        throw new Error(`An error has occurred on the after hook of the job "${jobName}"!\n${error}`);

      }

    }

    this._log(`Job "${jobName}" was executed successfully.`);

  }

  public task(name: string, task: GenericTaskRunner): void {

    const parsed = this._parseName(name);
    const hooksWhitelist: string[] = [
      'before',
      'after',
      'error',
      'suspend'
    ];

    if ( parsed.hook && ! hooksWhitelist.includes(parsed.hook) ) {

      this._logError(`Unsupported hook name "${parsed.hook}" for task "${parsed.name}"`);

      throw new Error(`Unsupported hook name "${parsed.hook}" for task "${parsed.name}"`);

    }

    if ( ! this.tasks[parsed.name] ) {

      this.tasks[parsed.name] = {
        name: parsed.name,
        suspended: false
      };

    }

    if ( parsed.hook === 'before' ) {

      this._logConfig(`Registering before hook for task "${parsed.name}"`);
      this.tasks[parsed.name].beforeHook = task;

    }
    else if ( parsed.hook === 'after' ) {

      this._logConfig(`Registering after hook for task "${parsed.name}"`);
      this.tasks[parsed.name].afterHook = task;

    }
    else if ( parsed.hook === 'error' ) {

      this._logConfig(`Registering error hook for task "${parsed.name}"`);
      this.tasks[parsed.name].errorHook = task;

    }
    else if ( parsed.hook === 'suspend' ) {

      this._logConfig(`Registering suspend hook for task "${parsed.name}"`);
      this.tasks[parsed.name].suspendHook = task;

    }
    else {

      this._logConfig(`Registering task "${parsed.name}"`);
      this.tasks[parsed.name].runner = task;

    }

  }

  public job(name: string, tasks: string[]): void {

    const parsed = this._parseName(name);

    if ( ! tasks || ! tasks.length ) {

      this._logError(`Job "${parsed.name}" must have at least one task!`);

      throw new Error(`Job "${parsed.name}" must have at least one task!`);

    }

    for ( const taskName of tasks ) {

      if ( ! this.tasks[taskName] ) {

        this._logError(`Task "${taskName}" not found!`);

        throw new Error(`Task "${taskName}" not found!`);

      }

      if ( ! this.tasks[taskName].runner ) {

        this._logError(`Task "${taskName}" does not have a definition!`);

        throw new Error(`Task "${taskName}" does not have a definition!`);

      }

    }

    this._logConfig(`Registering job "${parsed.name}" with tasks ${tasks.map(task => `"${task}"`).join(', ')}`);

    if ( ! this.jobs[parsed.name] ) {

      this.jobs[parsed.name] = {
        name: parsed.name,
        tasks: tasks,
        suspended: false
      };

    }
    else {

      this.jobs[parsed.name].tasks = tasks;

    }

  }

  public hook(job: string, task: GenericJobRunner): void {

    const parsed = this._parseName(job);
    const hooksWhitelist: string[] = [
      'before',
      'after',
      'error',
      'suspend'
    ];

    if ( parsed.hook && ! hooksWhitelist.includes(parsed.hook) ) {

      this._logError(`Unsupported hook name "${parsed.hook}" for job "${parsed.name}"`);

      throw new Error(`Unsupported hook name "${parsed.hook}" for job "${parsed.name}"`);

    }

    if ( ! this.jobs[parsed.name] ) {

      this.jobs[parsed.name] = {
        name: parsed.name,
        suspended: false,
        tasks: []
      };

    }

    if ( parsed.hook === 'before' ) {

      this._logConfig(`Registering before hook for job "${parsed.name}"`);
      this.jobs[parsed.name].beforeHook = task;

    }
    else if ( parsed.hook === 'after' ) {

      this._logConfig(`Registering after hook for job "${parsed.name}"`);
      this.jobs[parsed.name].afterHook = task;

    }
    else if ( parsed.hook === 'error' ) {

      this._logConfig(`Registering error hook for job "${parsed.name}"`);
      this.jobs[parsed.name].errorHook = task;

    }
    else if ( parsed.hook === 'suspend' ) {

      this._logConfig(`Registering suspend hook for job "${parsed.name}"`);
      this.jobs[parsed.name].suspendHook = task;

    }

  }

  public log(message: string): void {

    console.log(chalk.cyanBright(`[LOG] ${message}`));

    this._logToFile(`[LOG] ${message}`);

  }

  public suspend(jobName: string): void {

    if ( ! this.jobs[jobName] ) {

      this._logError(`Cannot suspend job "${jobName}" because it doesn't exist!`);

      throw new Error(`Cannot suspend job "${jobName}" because it doesn't exist!`);

    }

    this.jobs[jobName].suspended = true;

  }

  public request(options: request.OptionsWithUri): Promise<request.Response> {

    return new Promise((resolve, reject) => {

      request(options, (error, response) => {

        if ( error ) return reject(error);

        if ( response.headers['content-type'] && response.headers['content-type'].toLowerCase() === 'application/json' ) {

          try {

            response.body = JSON.parse(response.body);

          }
          catch (error) {

            reject(new Error('Failed to parse response body!\n' + error.message));

          }

        }

        resolve(response);

      });

    });

  }

  public async _execJobs(jobNames: string[]) {

    for ( const jobName of jobNames ) {

      try {

        await this._execJob(jobName);

      }
      catch (error) {

        this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);

        const job = this.jobs[jobName];

        if ( job ) {

          try {

            await this._onJobError(job.errorHook, jobName, error);

          }
          catch (error) {

            // Do nothing!

          }

        }

      }

    }

  }

}
