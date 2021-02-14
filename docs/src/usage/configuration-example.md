```js
const got = require('got');

module.exports = ease => {

  // Define sync task before hook
  ease
  .task('sync-task:before', (jobName, suspend) => {

    ease.log('Running sync-task:before inside job ' + jobName);
    // Suspend sync-task
    suspend();

  })
  .task('sync-task', jobName => {

    ease.log('Running sync-task'); // Won't run since task was suspended

  })
  // Define async task
  .task('async-task', jobName => {

    return new Promise((resolve, reject) => {

      got.get('https://google.com')
      .then(response => {

        ease.log('Got response');
        resolve();

      })
      .catch(reject);

    });

  })
  // Define async task after hook
  .task('async-task:after', jobName => {

    ease.log('Cleaning up...');
    ease.suspend(jobName); // Suspends the current job, no tasks will be run after this point

  })
  .job('test', ['sync-task', 'async-task', 'sync-task']);
  // Define job error handler
  .hook('test:error', error => {

    ease.log('Caught error: ' + error);

  });

};
```

Running `ease test` will execute the following tasks:
  1. `sync-task:before` (suspends `sync-task`)
  2. `async-task`
  3. `async-task:after` (suspends `test` job)
