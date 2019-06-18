import { OptionsWithUri } from 'request';

export interface Hammer {

  task: (name: string, task: TaskRunner) => void;
  job: (name: string, tasks: string[]) => void;
  request: (options: OptionsWithUri) => Promise<any>;
  suspend: (job: string) => void;
  log: (message: string) => void;

}

export type HammerConfig = (hammer: Hammer) => void;
export type TaskRunner = (jobName: string, suspend?: () => void) => Promise<void>|void;

export interface Task {

  name: string;
  suspended: boolean;
  beforeHook?: TaskRunner;
  afterHook?: TaskRunner;
  runner?: TaskRunner;

}

export interface Job {

  name: string;
  tasks: string[];
  suspended: boolean;

}

export interface Registry<T> {

  [name: string]: T;

}
