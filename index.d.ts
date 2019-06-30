import { OptionsWithUri } from 'request';

declare class Ease {
  task: (name: string, task: GenericTaskRunner) => void;
  job: (name: string, tasks: string[], options?: JobExecutionOptions) => void;
  request: (options: OptionsWithUri) => Promise<any>;
  suspend: (job: string) => void;
  log: (message: string) => void;
  hook: (job: string, task: GenericJobRunner) => void;
  info: (job: string) => JobInfo;
  install: (name: string, module: EaseModule, ...args: any[]) => void;
}

type GenericTaskRunner = (jobName: string) => Promise<void>|void;
type GenericJobRunner = () => Promise<void>|void;
type EaseModule = (logger: (message: string) => void, dirname: string, ...args: any[]) => GenericTaskRunner;

interface JobInfo {
  tasks: string[];
  options: JobExecutionOptions;
}

interface JobExecutionOptions {
  runImmediately?: boolean;
  schedule?: JobScheduleOptions;
}

interface JobScheduleOptions {
  recurrence: string;
  day?: number;
  time: string;
}

export = Ease;
