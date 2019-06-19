import {
  Registry,
  Task,
  Job,
  GenericTaskRunner,
  ErrorTaskRunner,
  ErrorJobRunner,
  GenericJobRunner,
  JobExecutionOptions,
  JobScheduleOptions
} from './app.model';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import chalk from 'chalk';
import request from 'request';

export class Hammer {

  private jobs: Registry<Job> = {};
  private tasks: Registry<Task> = {};
  private scheduledJobs: string[] = [];
  private clockActivated: boolean = false;

  constructor(
    private _verbose: boolean
  ) {

    fs.ensureFileSync(path.join(os.homedir(), '.hammer', 'hammer.log'));

  }

  private _getWeekDayName(day: number): string {

    return [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ][day];

  }

  private _getTimeLabel(time: string): string {

    const hour = +time.split(':')[0];
    const minute = +time.split(':')[1];

    return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}`;

  }

  private _getDayLabel(day: number): string {

    return `${day}${Math.floor(day / 10) === 1 ? 'th' : ['st', 'nd', 'rd'][(day % 10) - 1] || 'th'}`;

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

  private _validateJobOptions(options: JobExecutionOptions, jobName: string): void {

    if ( options.schedule ) {

      const recurrenceWhitelist: string[] = [
        'monthly',
        'weekly',
        'daily'
      ];

      // Recurrence is required
      if ( ! options.schedule.recurrence ) {

        throw new Error(`Invalid job options on job "${jobName}"! "recurrence" is required.`);

      }

      // Recurrence must be valid
      if ( ! recurrenceWhitelist.includes(options.schedule.recurrence.trim().toLowerCase()) ) {

        throw new Error(`Invalid job options on job "${jobName}"! "recurrence" must be one of the following: ${recurrenceWhitelist.map(item => `"${item}"`).join(', ')}.`);

      }

      // Time is required
      if ( ! options.schedule.time ) {

        throw new Error(`Invalid job options on job "${jobName}"! "time" is required.`);

      }

      // Time must be string
      if ( typeof options.schedule.time !== 'string' ) {

        throw new Error(`Invalid job options on job "${jobName}"! "time" must be string.`);

      }

      // Time must be in hh:mm format
      const hour: number = +options.schedule.time.split(':')[0];
      const minute: number = +options.schedule.time.split(':')[1];

      if ( typeof hour !== 'number' || isNaN(hour) || typeof minute !== 'number' || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59 ) {

        throw new Error(`Invalid job options on job "${jobName}"! "time" has invalid format.`);

      }

      // Validate day if recurrence is not daily
      if ( options.schedule.recurrence.trim().toLowerCase() !== 'daily' ) {

        // Day is required
        if ( ! options.schedule.hasOwnProperty('day') ) {

          throw new Error(`Invalid job options on job "${jobName}"! "day" is required when recurrence is not daily.`);

        }

        // Day must be a number
        if ( typeof options.schedule.day !== 'number' ) {

          throw new Error(`Invalid job options on job "${jobName}"! "day" must be a number.`);

        }

        // Day must be between 1-7 if recurrence is weekly
        if ( options.schedule.recurrence.trim().toLowerCase() === 'weekly' && (options.schedule.day < 1 || options.schedule.day > 7) ) {

          throw new Error(`Invalid job options on job "${jobName}"! "day" must be between 1-7 when recurrence is weekly.`);

        }

        // Day must be between 1-31 if recurrence is monthly
        if ( options.schedule.recurrence.trim().toLowerCase() === 'mothly' && (options.schedule.day < 1 || options.schedule.day > 31) ) {

          throw new Error(`Invalid job options on job "${jobName}"! "day" must be between 1-31 when recurrence is monthly.`);

        }

        // Show warning if day is between 29-31 with monthly recurrence
        if ( options.schedule.recurrence.trim().toLowerCase() === 'mothly' && options.schedule.day > 28 ) {

          this._logWarning(`Job "${jobName}" will not be executed on certain months since schedule day is "${options.schedule.day}"!`);

        }

      }

    }
    else if ( ! options.runImmediately ) {

      // Show warning when job is not scheduled and not running immediately
      this._logWarning(`Job "${jobName}" will never run due to options!`);

    }

  }

  private async _onTaskError(handler: ErrorTaskRunner|undefined, taskName: string, jobName: string, error: Error) {

    if ( handler ) {

      try {

        await handler(jobName, error);

      }
      catch (error) {

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

        throw new Error(`An error has occurred on the suspend hook of the job "${job.name}"!\n${error}`);

      }

    }

  }

  private async _execJob(jobName: string) {

    const job = this.jobs[jobName];

    // Call job before if any
    if ( job.beforeHook ) {

      this._log(`Running before hook of job "${jobName}"...`);

      try {

        await job.beforeHook(() => job.suspended = true);

      }
      catch (error) {

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

        throw new Error(`An error has occurred on the after hook of the job "${jobName}"!\n${error}`);

      }

    }

    this._log(`Job "${jobName}" was executed successfully.`);

  }

  private _activateClock(): void {

    this.clockActivated = true;

    // Run every minute
    setInterval(() => {

      const date = new Date();

      for ( const jobName of this.scheduledJobs ) {

        const job = this.jobs[jobName];
        const schedule = <JobScheduleOptions>job.options.schedule;
        const recurrence = schedule.recurrence.trim().toLowerCase();
        const day = schedule.day;
        const hour = +schedule.time.split(':')[0];
        const minute = +schedule.time.split(':')[1];

        if (
          // If recurrence is daily and time is now
          (recurrence === 'daily' && hour === date.getHours() && minute === date.getMinutes()) ||
          // If recurrence is weekly and day of week and time is now
          (recurrence === 'weekly' && day === date.getDay() && hour === date.getHours() && minute === date.getMinutes()) ||
          // If recurrence is monthly and day of month and time is now
          (recurrence === 'monthly' && day === date.getDate() && hour === date.getHours() && minute === date.getMinutes())
        ) {

          // Execute job
          this._execJob(jobName)
          .catch(error => {

            this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);

            // Run job error handler if any
            this._onJobError(job.errorHook, jobName, error)
            .catch(error => this._logError(error));

          });

        }

      }

    }, 60000);

  }

  private _scheduleJob(jobName: string) {

    // Add the job to scheduled jobs
    this.scheduledJobs.push(jobName);

    // Activate the clock if it's inactive
    if ( ! this.clockActivated ) this._activateClock();

    const schedule = <JobScheduleOptions>this.jobs[jobName].options.schedule;

    if ( schedule.recurrence.toLowerCase().trim() === 'daily' )
      this._logConfig(`Scheduled job "${jobName}" to recur daily at ${this._getTimeLabel(schedule.time)}`);
    else if ( schedule.recurrence.toLowerCase().trim() === 'weekly' )
      this._logConfig(`Scheduled job "${jobName}" to recur weekly on ${this._getWeekDayName(<number>schedule.day)} at ${this._getTimeLabel(schedule.time)}`);
    else if ( schedule.recurrence.toLowerCase().trim() === 'monthly' )
      this._logConfig(`Scheduled job "${jobName}" to recur on ${this._getDayLabel(<number>schedule.day)} of each month at ${this._getTimeLabel(schedule.time)}`);

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

  public job(name: string, tasks: string[], options?: JobExecutionOptions): void {

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
        suspended: false,
        options: Object.assign({ runImmediately: true }, options || {})
      };

    }
    else {

      this.jobs[parsed.name].tasks = tasks;
      this.jobs[parsed.name].options = Object.assign(this.jobs[parsed.name].options, options || {});

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
        tasks: [],
        options: { runImmediately: true }
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

  public async _execJobs(jobNames: string[], runAllJobs: boolean) {

    if ( runAllJobs ) jobNames = Object.keys(this.jobs);

    // Validate and schedule the jobs
    for ( const jobName of jobNames ) {

      // Check if job exists
      if ( ! this.jobs[jobName] ) {

        this._logError(`Job "${jobName}" not found!`);

        continue;

      }

      try {

        // Check if job has tasks
        if ( ! this.jobs[jobName].tasks.length ) throw new Error(`Job "${jobName}" has no tasks!`);

        // Validate job options
        this._validateJobOptions(this.jobs[jobName].options, jobName);

        // Schedule the job if specified
        if ( this.jobs[jobName].options.schedule ) this._scheduleJob(jobName);

      }
      catch (error) {

        // Remove job
        delete this.jobs[jobName];

        this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);

      }

    }

    // Run the jobs immediately
    for ( const jobName in this.jobs ) {

      // Check if job exists
      if ( ! this.jobs[jobName] ) continue;

      try {

        // Run the job immediately if specified
        if ( this.jobs[jobName].options.runImmediately ) await this._execJob(jobName);

      }
      catch (error) {

        this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);

        // Run error handler if any
        try {

          await this._onJobError(this.jobs[jobName].errorHook, jobName, error);

        }
        catch (error) {

          this._logError(error);

        }

      }

    }

  }

}
