The following properties are defined on the options object:

  - `runImmediately`: A boolean property which indicates if job should be run immediately after the task manager is run (defaults to true).
  - `schedule`: Namespace for schedule options.
    - `recurrence`: A string enum (`daily`, `weekly`, and `monthly`) which indicates the recurrence of the job (required).
    - `day`: A number which indicates the day of the recurrence (day of the week or day of the month). This is required if `recurrence` is either `weekly` or `monthly`.
    - `time`: A string with `hh:mm:ss` format which indicates the time at which the recurrence occurs (required).
