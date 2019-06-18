import { OptionsWithUri } from 'request';

export interface Hammer {

  task: (name: string, task: GenericTaskRunner) => void;
  job: (name: string, tasks: string[]) => void;
  request: (options: OptionsWithUri) => Promise<any>;
  suspend: (job: string) => void;
  log: (message: string) => void;
  hook: (job: string, task: GenericJobRunner) => void;

}

export type HammerConfig = (hammer: Hammer) => void;
export type GenericTaskRunner = (jobName: string) => Promise<void>|void;
export type BeforeTaskRunner = (jobName: string, suspend: () => void) => Promise<void>|void;
export type ErrorTaskRunner = (jobName: string, error: Error) => Promise<void>|void;
export type GenericJobRunner = () => Promise<void>|void;
export type BeforeJobRunner = (suspend: () => void) => Promise<void>|void;
export type ErrorJobRunner = (error: Error) => Promise<void>|void;

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

}

export interface Registry<T> {

  [name: string]: T;

}
