# Ease Task Runner

Ease is a minimal task runner with scheduling capabilities designed to be flexible and easy to work with.

# Installation

```
npm install @chisel/ease -g
```

# Usage

Ease looks for a configuration file named `easeconfig.js` inside the current working directory for task and job definitions. The configuration file must export a function which accepts the `ease` object as its parameter, which can be used to define tasks, jobs, schedules, etc.

```js
module.exports = ease => {

  // Use the ease object here

};
```

## API

  - `ease.task(name, callback)`: Defines a task with the given name and calls the callback for performing the task. The call back should either return void (for synchronous execution) or return a void promise (for asynchronous execution). Callback will be called with two parameters: `jobName` which holds the current executing job name and either `suspend`, which is a function that suspends the current task from running (only available on the `:before` hook) or `error` which is an error object (only available on the `:error` hook.)
  - `ease.job(name, tasks [,options])`: Defines a job with the given name and a list of the tasks to execute in order. An optional [Job Execution Options](#job-execution-options) object can be provided.
  - `ease.hook(name, callback)`: Defines a job hook with a callback.
  - `ease.suspend(jobName)`: Suspends a job by name.
  - `ease.info(jobName)`: Returns an object with members `tasks` and `options` which are a list of the registered tasks and the options of the job. This info can help dynamically redefining jobs.
  - `ease.log(message)`: Logs a message which will be shown on the console and logged into `ease.log` file.
  - `ease.request(options)`: Sends an HTTP request using the given [options](https://www.npmjs.com/package/request#requestoptions-callback) and returns a promise with the response (the body of the response will be parsed to JSON if `content-type` header is set to `application/json` by the target.)
  - `ease.install(taskName, plugin, ...args)`: Installs a plugin as a task with the given name. `...args` will be sent to the plugin.

## Task Hooks

The following hooks are available for all tasks which will be defined when appended to the task name in the `ease.task()` method:
  - `:before`: Runs before the task and can suspend the task from running using the `suspend` method in the callback arguments. Can be asynchronous if the callback returns a promise.
  - `:after`: Runs after the task. Can be asynchronous if the callback returns a promise.
  - `:suspend`: Runs after the task was suspended. Can be asynchronous if the callback returns a promise.
  - `:error`: Runs after an error has occurred in the task or any of its hooks. Can be asynchronous if the callback returns a promise.

```js
module.exports = ease => {

  ease.task('foo:before', (jobName, suspend) => {

    ease.log('Running before task foo...');

  });

  ease.task('foo', jobName => {

    // Do stuff

  });

  ease.task('foo:error', (jobName, error) => {

    ease.log('Task foo has failed:\n' + error);

  });

};
```

## Job Hooks

Jobs have hooks identical to tasks and are defined using the `ease.hook()` method, the only difference is the callback arguments in which the `jobName` is not provided.

```js
module.exports = ease => {

  ease.task('foo', jobName => ease.log('Running foo...'));

  ease.job('job1', ['foo']);

  ease.hook('job1:after', () => ease.log('Job1 has finished.'));

};
```

## Job Execution Options

The following properties are defined on the options object:

  - `runImmediately`: A boolean property which indicates if job should be run immediately after the task manager is run (defaults to true).
  - `schedule`: Namespace for schedule options.
    - `recurrence`: A string enum (`daily`, `weekly`, and `monthly`) which indicates the recurrence of the job (required).
    - `day`: A number which indicates the day of the recurrence (day of the week or day of the month). This is required if `recurrence` is either `weekly` or `monthly`.
    - `time`: A string with `hh:mm:ss` format which indicates the time at which the recurrence occurs (required).

## Ease Configuration Example

```js
module.exports = ease => {

  // Define sync task before hook
  ease.task('sync-task:before', (jobName, suspend) => {

    ease.log('Running sync-task:before inside job ' + jobName);
    // Suspend sync-task
    suspend();

  });

  ease.task('sync-task', jobName => {

    ease.log('Running sync-task'); // Won't run since task was suspended

  });

  // Define async task
  ease.task('async-task', jobName => {

    return new Promise((resolve, reject) => {

      ease.request({
        uri: 'https://google.com'
      })
      .then(response => {

        ease.log('Got response');
        resolve();

      })
      .catch(reject);

    });

  });

  // Define async task after hook
  ease.task('async-task:after', jobName => {

    ease.log('Cleaning up...');
    ease.suspend(jobName); // Suspends the current job, no tasks will be run after this point

  });

  ease.job('test', ['sync-task', 'async-task', 'sync-task']);

  // Define job error handler
  ease.hook('test:error', error => {

    ease.log('Caught error: ' + error);

  });

};
```

Running `ease test` will execute the following tasks:
  1. `sync-task:before` (suspends `sync-task`)
  2. `async-task`
  3. `async-task:after` (suspends `test` job)

## Scheduled Job Example

```js
module.exports = ease => {

  ease.task('task1', () => ease.log('Running task 1'));

  // Schedule job to run every Monday at 5 in the afternoon
  ease.job('job1', ['task1'], {
    runImmediately: false,
    schedule: {
      recurrence: 'weekly',
      day: 1,
      time: '17:00:00'
    }
  });

};
```

## Plugins

Tasks can be made into plugins in order to allow reuse and quick development. To install a plugin, follow these steps:

  1. Install the plugin through NPM: `npm install ease-task-pluginname --save-dev` (replace `pluginname` with the name of the plugin)
  2. Use the `install()` method to install and configure the plugin:
      ```js
      const sass = require('ease-task-sass');

      module.exports = ease => {

        // Install the plugin as `sass` task
        ease.install('sass', sass, { dir: 'sass', ourDir: 'css', sourceMap: true });

        // Use the task in a job
        ease.job('process-sass-files', ['sass']);

      };
      ```

### Available Plugins

These plugins are made by the Chisel team:
  - [SASS Plugin](https://www.npmjs.com/package/ease-task-sass)
  - [CSS Minifier Plugin](https://www.npmjs.com/package/ease-task-minify-css)
  - [JS Minifier Plugin](https://www.npmjs.com/package/ease-task-minify-js)
  - [HTML Minifier Plugin](https://www.npmjs.com/package/ease-task-minify-html)
  - [TypeScript Transpiler Plugin](https://www.npmjs.com/package/ease-task-typescript)
  - [Autoprefixer Plugin](https://www.npmjs.com/package/ease-task-autoprefixer)

If you have written an Ease plugin, [let us know](https://github.com/chisel/ease/issues/new) and we'll include it here in the list.

### Creating Plugins

To create an Ease plugin, write a module that exports a factory function which takes the following arguments and returns a task runner function:
  - `logger`: An instance of `ease.log()` which can be used to log messages.
  - `dirname`: The path to the directory where `easeconfig.js` is. Use this when constructing paths to make them relative to the config file.
  - `...args`: Any arguments provided by the user. This can be the input your plugin needs (config object, etc.)

Example:
```js
const fs = require('fs-extra');
const path = require('path');

module.exports = (logger, dirname, config) => {

  // Task runner
  return () => {

    // Async task
    return new Promise((resolve, reject) => {

      const finalPath = path.join(dirname, config.dir);

      logger(`Emptying "${finalPath}"...`);

      // Empty the directory's content
      fs.emptyDir(finalPath, error => {

        if ( error ) reject(error);
        else resolve();

      });

    });

  };

};
```

> When publishing Ease tasks, it's good practice to prefix the plugin name with `ease-task-`.

## Redefining Jobs

Jobs can be redefined dynamically from within tasks. This can be achieved by calling `ease.job()` again which would allow redefining the tasks or the schedule for a job.

> If a job already exists, calling `ease.job()` the second time doesn't require the tasks array. This can be used to reschedule a job without affecting it's registered tasks. Example: `ease.job('job1', null, { schedule: {...} })`.

> You can remove a scheduled job by running `ease.job('job1', null, { schedule: null })` on an existing job.

> You can register new tasks dynamically using `ease.job('job1', ease.info('job1').tasks.concat('new-task'))`.

> You can define tasks dynamically, but jobs that are dynamically defined won't run unless scheduled. If you need to run a dynamically defined job right away, you can schedule it to be run the next second and then remove its schedule on the job's after hook.

```js
module.exports = ease => {

  ease.task('foo', () => ease.log('Running task foo'));
  ease.task('bar', () => ease.log('Running task bar'));

  // Defining job "job1" with task "foo"
  ease.job('job1', ['foo']);

  // Dynamically adding task "bar" to job "job1" using a before hook
  ease.hook('job1:before', () => {

    ease.job('job1', ease.info('job1').tasks.concat('bar'));

  });

};
```

# CLI Options

`ease [options] <jobs>`

Options:
  - `-v --verbose`: Displays detailed logs in the console.
  - `-c --config`: Override the default `easeconfig.js` file location.
  - `-a --all`: Run all jobs defined in the ease config file.
  - `-h --help`: Show help.
  - `--version`: Show ease version.

Example: `ease job1 job2`

# Logs

Logs are stored at `~/.ease/ease.log` (or `%userprofile%\.ease\ease.log` on Windows).

# Building

Run `npm run build` to build the source into the `dist` directory.
