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
