# Air Hammer

Air Hammer is a minimal task runner made for RESTful APIs. It is built as a temporary solution for Chisel Data Integration Platform task management and automation.

# Installation

  1. Clone this repo.
  2. `npm install`
  3. `npm link`

# Usage

Air Hammer looks for a configuration file named `hammer.js` inside the current working directory for task and job definitions. The configuration file must export a function which accepts the `hammer` object as its parameter, which can be used to define tasks, jobs, schedules, etc.

## Hammer Object API

  - `hammer.task(name, callback)`: Defines a task with the given name and calls the callback for performing the task. The call back should either return void (for synchronous execution) or return a void promise (for asynchronous execution). Callback will be called with two parameters: `jobName` which holds the current executing job name and either `suspend`, which is a function that suspends the current task from running (only available on the `:before` hook) or `error`, which is an error object (only available on the `:error` hook.)
  - `hammer.job(name, tasks)`: Defines a job with the given name and a list of the tasks to execute in order.
  - `hammer.suspend(jobName)`: Suspends a job by name.
  - `hammer.log(message)`: Logs a message which will be shown on the console and logged into `hammer.log` file.
  - `hammer.request(options)`: Sends a request using the given [options](https://www.npmjs.com/package/request#requestoptions-callback) and returns a promise with the response (the body of the response will be parsed to JSON if the correct headers are set by the target.)

## Task Hooks

The following hooks are available for all tasks which will be defined when appended to the task name in the `hammer.task` method:
  - `:before`: Runs before the task and can suspend the task from running using the `suspend` method in the callback arguments. Can be asynchronous if the callback returns a promise.
  - `:after`: Runs after the task. Can be asynchronous if the callback returns a promise.
  - `:suspend`: Runs after the task was suspended. Can be asynchronous if the callback returns a promise.
  - `:error`: Runs after an error has occurred in the task or any of its hooks. Can be asynchronous if the callback returns a promise.

## Example Hammer Configuration

```js
module.exports = hammer => {

  // Define sync task before hook
  hammer.task('sync-task:before', (jobName, suspend) => {

    hammer.log('Running sync-task:before inside job ' + jobName);
    // Suspend sync-task
    suspend();

  });

  hammer.task('sync-task', jobName => {

    hammer.log('Running sync-task'); // Won't run since task was suspended

  });

  // Define async task
  hammer.task('async-task', jobName => {

    return new Promise((resolve, reject) => {

      hammer.request({
        uri: 'https://google.com'
      })
      .then(response => {

        hammer.log('Got response');
        resolve();

      })
      .catch(reject);

    });

  });

  // Define async task after hook
  hammer.task('async-task:after', jobName => {

    hammer.log('Cleaning up...');
    hammer.suspend(jobName); // Suspends the current job, no tasks will be run after this point

  });

  hammer.jon('test', ['sync-task', 'async-task', 'sync-task']);

};
```

Running `hammer test` will execute the following tasks:
  1. `sync-task:before` (suspends `sync-task`)
  2. `async-task`
  3. `async-task:after` (suspends `test` job)

# CLI Options

`hammer [options] <jobs>`

Options:
  - `-v --verbose`: Displays detailed logs in the console.
  - `-c --config`: Override the default `hammer.js` file location.
  - `-a --async`: Runs all jobs at the same time.

Example: `hammer job1 job2 --async`

# Building

Run `npm run build` to build the source into the `dist` directory.
