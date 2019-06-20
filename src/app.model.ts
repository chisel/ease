import { OptionsWithUri } from 'request';

export interface Ease {

  task: (name: string, task: GenericTaskRunner) => void;
  job: (name: string, tasks: string[], options?: JobExecutionOptions) => void;
  request: (options: OptionsWithUri) => Promise<any>;
  suspend: (job: string) => void;
  log: (message: string) => void;
  hook: (job: string, task: GenericJobRunner) => void;
  info: (job: string) => JobInfo;

}

export type EaseConfig = (ease: Ease) => void;
export type GenericTaskRunner = (jobName: string) => Promise<void>|void;
export type BeforeTaskRunner = (jobName: string, suspend: () => void) => Promise<void>|void;
export type ErrorTaskRunner = (jobName: string, error: Error) => Promise<void>|void;
export type GenericJobRunner = () => Promise<void>|void;
export type BeforeJobRunner = (suspend: () => void) => Promise<void>|void;
export type ErrorJobRunner = (error: Error) => Promise<void>|void;

export interface JobInfo {

  tasks: string[];
  options: JobExecutionOptions;

}

export interface Task {

  name: string;
  suspended: boolean;
  beforeHook?: BeforeTaskRunner;
  afterHook?: GenericTaskRunner;
  errorHook?: ErrorTaskRunner;
  suspendHook?: GenericTaskRunner;
  runner?: GenericTaskRunner;

}

export interface Job {

  name: string;
  tasks: string[];
  suspended: boolean;
  beforeHook?: BeforeJobRunner;
  afterHook?: GenericJobRunner;
  errorHook?: ErrorJobRunner;
  suspendHook?: GenericJobRunner;
  options: JobExecutionOptions;

}

export interface Registry<T> {

  [name: string]: T;

}

export interface JobExecutionOptions {

  runImmediately?: boolean;
  schedule?: JobScheduleOptions;

}

export interface JobScheduleOptions {

  recurrence: string;
  day?: number;
  time: string;

}
