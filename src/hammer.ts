import { Registry, Task, Job, TaskRunner } from './app.model';
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

  public task(name: string, task: TaskRunner): void {

    const parsed = this._parseName(name);

    if ( parsed.hook && (parsed.hook !== 'before' && parsed.hook !== 'after') ) {

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

    this.jobs[parsed.name] = {
      name: parsed.name,
      tasks: tasks,
      suspended: false
    };

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

  public async _execJob(jobName: string) {

    if ( ! this.jobs[jobName] ) {

      this._logError(`Job "${jobName}" not found!`);

      throw new Error(`Job "${jobName}" not found!`);

    }

    this._log(`Executing job "${jobName}"...`);

    const job = this.jobs[jobName];

    for ( const taskName of job.tasks ) {

      const task: Task = this.tasks[taskName];

      if ( ! task.runner ) {

        this._logError(`Task "${taskName}" does not have a definition!`);

        throw new Error(`Task "${taskName}" does not have a definition!`);

      }

      if ( task.beforeHook ) {

        this._log(`Running before hook of task "${taskName}"...`);

        try {

          await task.beforeHook(jobName, () => task.suspended = true);

        }
        catch (error) {

          this._logError(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);

          throw new Error(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);

        }

      }

      if ( job.suspended ) {

        this._logWarning(`Job "${jobName}" was suspended!`);

        return;

      }

      if ( task.suspended ) {

        this._logWarning(`Task "${taskName}" was suspended!`);

        continue;

      }

      this._log(`Running task "${taskName}"...`);

      try {

        await task.runner(jobName);

      }
      catch (error) {

        this._logError(`An error has occurred on task "${taskName}"!\n${error}`);

        throw new Error(`An error has occurred on task "${taskName}"!\n${error}`);

      }

      if ( job.suspended ) {

        this._logWarning(`Job "${jobName}" was suspended!`);

        return;

      }

      if ( task.afterHook ) {

        this._log(`Running after hook of task "${taskName}"...`);

        try {

          await task.afterHook(jobName);

        }
        catch (error) {

          this._logError(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);

          throw new Error(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);

        }

      }

      if ( job.suspended ) {

        this._logWarning(`Job "${jobName}" was suspended!`);

        return;

      }

    }

    this._log(`Job "${jobName}" was executed successfully.`);

  }

}
