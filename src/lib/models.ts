import { Ease } from './ease';

/** Suspends the current task or job. */
export type SuspendFunction = () => void;

export type EaseConfig = (ease: Ease) => void;
/**
* A task runner function.
* @param jobName The name of the running job.
* @param errorOrSuspend Either an erro object (if within :error hook) or a suspend function (if within :before hook).
                        Would be undefined otherwise.
*/
export type TaskRunner<T=unknown> = (jobName: string, errorOrSuspend?: T) => Promise<void>|void;
/**
* A job runner function for an :error job hook.
* @param errorOrSuspend Either an erro object (if within :error hook) or a suspend function (if within :before hook).
                        Would be undefined otherwise.
*/
export type JobRunner<T=unknown> = (errorOrSuspend?: T) => Promise<void>|void;

/** Information about a registered job. */
export interface JobInfo {

  /** Name of the registered tasks in the job. */
  tasks: string[];
  /** The job execution options. */
  options: JobExecutionOptions;

}

/** Ease plugin module. */
export type EaseModule = (logger: (message: string) => void, dirname: string, ...args: any[]) => TaskRunner;

export interface Task {

  name: string;
  suspended: boolean;
  beforeHook?: TaskRunner<SuspendFunction>;
  afterHook?: TaskRunner;
  errorHook?: TaskRunner<Error>;
  suspendHook?: TaskRunner;
  runner?: TaskRunner;

}

export interface Job {

  name: string;
  tasks: string[];
  suspended: boolean;
  beforeHook?: JobRunner<SuspendFunction>;
  afterHook?: JobRunner;
  errorHook?: JobRunner<Error>;
  suspendHook?: JobRunner;
  options: JobExecutionOptions;

}

export interface Registry<T> {

  [name: string]: T;

}

/** Job execution options object. */
export interface JobExecutionOptions {

  /** Indicates if job should be run immediately after the task manager is run. */
  runImmediately?: boolean;
  /** Job schedule options object. */
  schedule?: DailyScheduleOptions|WeeklyScheduleOptions|MonthlyScheduleOptions;

}

export interface DailyScheduleOptions {

  /** The job recurrence. */
  recurrence: 'daily';
  /** The time of the recurrence in hh:mm:ss format. */
  time: string;

}

export interface WeeklyScheduleOptions {

  /** The job recurrence. */
  recurrence: 'weekly';
  /** Day of the week. */
  day: number;
  /** The time of the recurrence in hh:mm:ss format. */
  time: string;

}

export interface MonthlyScheduleOptions {

  /** The job recurrence. */
  recurrence: 'monthly';
  /** Day of the month. */
  day: number;
  /** The time of the recurrence in hh:mm:ss format. */
  time: string;

}

export interface JobScheduleOptions {

  recurrence: 'daily'|'weekly'|'monthly';
  day?: number;
  time: string;

}
