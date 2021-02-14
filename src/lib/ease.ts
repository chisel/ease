import {
  Registry,
  Task,
  Job,
  GenericTaskRunner,
  ErrorTaskRunner,
  ErrorJobRunner,
  GenericJobRunner,
  JobExecutionOptions,
  JobScheduleOptions,
  JobInfo,
  EaseModule
} from './models';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import chalk from 'chalk';
import _ from 'lodash';

export class Ease {

  private jobs: Registry<Job> = {};
  private tasks: Registry<Task> = {};
  private scheduledJobs: Registry<boolean> = {};
  private clockActivated: boolean = false;
  private activeJobs: Registry<boolean> = {};
  private clock: any = null;

  constructor(
    private _verbose: boolean,
    private _configDirname: string
  ) {

    fs.ensureFileSync(path.join(os.homedir(), '.ease', 'ease.log'));

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
    const seconds = +time.split(':')[2];

    return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}:${seconds < 10 ? '0' : ''}${seconds}`;

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

    fs.appendFileSync(path.join(os.homedir(), '.ease', 'ease.log'), message + '\n');

  }

  private _log(message: string): void {

    console.log(`[LOG] ${message}`);
    this._logToFile(`[${(new Date()).toISOString()}] [LOG] ${message}`);

  }

  private _logError(message: string): void {

    console.log(chalk.bold.redBright(`[ERROR] ${message}`));
    this._logToFile(`[${(new Date()).toISOString()}] [ERROR] ${message}`);

  }

  private _logWarning(message: string): void {

    console.log(chalk.bold.yellowBright(`[WARNING] ${message}`));
    this._logToFile(`[${(new Date()).toISOString()}] [WARNING] ${message}`);

  }

  private _logConfig(message: string): void {

    if ( this._verbose ) console.log(chalk.bold.greenBright(`[CONFIG] ${message}`));
    this._logToFile(`[${(new Date()).toISOString()}] [CONFIG] ${message}`);

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

      // Time must be in hh:mm:ss format
      const hour: number = +options.schedule.time.split(':')[0];
      const minute: number = +options.schedule.time.split(':')[1];
      const second: number = +options.schedule.time.split(':')[2];

      if (
        typeof hour !== 'number' || isNaN(hour) || typeof minute !== 'number' || isNaN(minute) || typeof second !== 'number' || isNaN(second) ||
        hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59
      ) {

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

    // Remove from active jobs
    delete this.activeJobs[job.name];

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

    // Add to active jobs
    this.activeJobs[job.name] = true;

    try {

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

    }
    catch (error) {

      // Remove from active jobs
      delete this.activeJobs[job.name];

      throw error;

    }

    // Remove from active jobs
    delete this.activeJobs[job.name];

    this._log(`Job "${jobName}" was executed.`);

  }

  private _activateClock(): void {

    this.clockActivated = true;

    // Run every minute
    this.clock = setInterval(() => {

      const date = new Date();

      for ( const jobName of _.keys(this.scheduledJobs) ) {

        const job = this.jobs[jobName];
        const schedule = <JobScheduleOptions>job.options.schedule;
        const recurrence = schedule.recurrence.trim().toLowerCase();
        const day = schedule.day;
        const hour = +schedule.time.split(':')[0];
        const minute = +schedule.time.split(':')[1];
        const second = +schedule.time.split(':')[2];

        if (
          // If recurrence is daily and time is now
          (recurrence === 'daily' && hour === date.getHours() && minute === date.getMinutes() && second === date.getSeconds()) ||
          // If recurrence is weekly and day of week and time is now
          (recurrence === 'weekly' && day === date.getDay() && hour === date.getHours() && minute === date.getMinutes() && second === date.getSeconds()) ||
          // If recurrence is monthly and day of month and time is now
          (recurrence === 'monthly' && day === date.getDate() && hour === date.getHours() && minute === date.getMinutes() && second === date.getSeconds())
        ) {

          // Reset all suspensions
          job.suspended = false;

          for ( const taskName of job.tasks ) {

            this.tasks[taskName].suspended = false;

          }

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

    }, 1000);

  }

  private _scheduleJob(jobName: string) {

    // Add the job to scheduled jobs
    this.scheduledJobs[jobName] = true;

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

    if ( (! tasks || ! tasks.length) && ! this.jobs[parsed.name] ) {

      this._logError(`Job "${parsed.name}" must have at least one task!`);

      throw new Error(`Job "${parsed.name}" must have at least one task!`);

    }

    if ( tasks ) {

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

    }

    if ( options ) {

      // Validate job options
      this._validateJobOptions(options, parsed.name);

    }

    if ( ! this.jobs[parsed.name] ) {

      this._logConfig(`Registering job "${parsed.name}"${ tasks ? ` with tasks ${tasks.map(task => `"${task}"`).join(', ')}` : ''}`);

      this.jobs[parsed.name] = {
        name: parsed.name,
        tasks: tasks,
        suspended: false,
        options: _.assign({ runImmediately: true }, options || {})
      };

    }
    else {

      if ( tasks ) this._logConfig(`Adding tasks ${tasks.map(task => `"${task}"`).join(', ')} to job "${parsed.name}"`);
      if ( options ) this._logConfig(`Updating options of job "${parsed.name}"`);

      this.jobs[parsed.name].tasks = tasks || this.jobs[parsed.name].tasks;
      this.jobs[parsed.name].options = options ? _.assign({ runImmediately: true }, options) : this.jobs[parsed.name].options;

    }

    // Schedule the job if specified
    if ( this.jobs[parsed.name].options.schedule ) this._scheduleJob(parsed.name);
    // Remove scheduled job if specified
    else {

      if ( this.scheduledJobs[parsed.name] ) this._logConfig(`Removed scheduled job "${parsed.name}"`);

      delete this.scheduledJobs[parsed.name];

      // Stop the program clock if no jobs are scheduled
      if ( ! _.keys(this.scheduledJobs).length && this.clock !== null ) clearInterval(this.clock);

    }

    // Show warning when job is not scheduled and not running immediately
    if ( ! this.jobs[parsed.name].options.runImmediately && ! this.jobs[parsed.name].options.schedule )
      this._logWarning(`Job "${parsed.name}" will never run due to options!`);

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

  public info(job: string): JobInfo {

    if ( ! this.jobs[job] ) throw new Error(`Job "${job}" not found!`);

    return {
      tasks: _.clone(this.jobs[job].tasks),
      options: _.cloneDeep(this.jobs[job].options)
    };

  }

  public log(message: string): void {

    console.log(chalk.cyanBright(`[TASK] ${message}`));

    this._logToFile(`[${(new Date()).toISOString()}] [TASK] ${message}`);

  }

  public suspend(jobName: string): void {

    if ( ! this.jobs[jobName] ) {

      this._logError(`Cannot suspend job "${jobName}" because it doesn't exist!`);

      throw new Error(`Cannot suspend job "${jobName}" because it doesn't exist!`);

    }

    // If job is not active show warning
    if ( ! this.activeJobs.hasOwnProperty(jobName) )
      this._logWarning(`Job "${jobName}" cannot be suspended because it's inactive!`);
    else
      this.jobs[jobName].suspended = true;

  }

  public install(name: string, module: EaseModule, ...args: any[]): void {

    this.task(name, module(this.log.bind(this), this._configDirname, ...args));

  }

  public async _execJobs(jobNames: string[], runAllJobs: boolean) {

    if ( runAllJobs ) jobNames = _.keys(this.jobs);

    const validJobs: string[] = [];

    // Validate jobs
    for ( const jobName of jobNames ) {

      // Check if job exists
      if ( ! this.jobs[jobName] ) {

        this._logError(`Job "${jobName}" not found!`);

        continue;

      }

      // Add to valid jobs
      validJobs.push(jobName);

    }

    // Run the jobs immediately
    for ( const jobName of validJobs ) {

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
