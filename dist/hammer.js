"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const os_1 = __importDefault(require("os"));
const chalk_1 = __importDefault(require("chalk"));
const request_1 = __importDefault(require("request"));
class Hammer {
    constructor(_verbose) {
        this._verbose = _verbose;
        this.jobs = {};
        this.tasks = {};
        this.scheduledJobs = [];
        this.clockActivated = false;
        this.activeJobs = [];
        fs_extra_1.default.ensureFileSync(path_1.default.join(os_1.default.homedir(), '.hammer', 'hammer.log'));
    }
    _getWeekDayName(day) {
        return [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday'
        ][day];
    }
    _getTimeLabel(time) {
        const hour = +time.split(':')[0];
        const minute = +time.split(':')[1];
        return `${hour < 10 ? '0' : ''}${hour}:${minute < 10 ? '0' : ''}${minute}`;
    }
    _getDayLabel(day) {
        return `${day}${Math.floor(day / 10) === 1 ? 'th' : ['st', 'nd', 'rd'][(day % 10) - 1] || 'th'}`;
    }
    _parseName(name) {
        const components = name.split(':');
        return {
            name: components[0].toLowerCase(),
            hook: components[1] ? components[1].toLowerCase() : undefined
        };
    }
    _logToFile(message) {
        fs_extra_1.default.appendFileSync(path_1.default.join(os_1.default.homedir(), '.hammer', 'hammer.log'), message + '\n');
    }
    _log(message) {
        console.log(`[LOG] ${message}`);
        this._logToFile(`[${(new Date()).toISOString()}] [LOG] ${message}`);
    }
    _logError(message) {
        console.log(chalk_1.default.bold.redBright(`[ERROR] ${message}`));
        this._logToFile(`[${(new Date()).toISOString()}] [ERROR] ${message}`);
    }
    _logWarning(message) {
        console.log(chalk_1.default.bold.yellowBright(`[WARNING] ${message}`));
        this._logToFile(`[${(new Date()).toISOString()}] [WARNING] ${message}`);
    }
    _logConfig(message) {
        if (this._verbose)
            console.log(chalk_1.default.bold.greenBright(`[CONFIG] ${message}`));
        this._logToFile(`[${(new Date()).toISOString()}] [CONFIG] ${message}`);
    }
    _validateJobOptions(options, jobName) {
        if (options.schedule) {
            const recurrenceWhitelist = [
                'monthly',
                'weekly',
                'daily'
            ];
            // Recurrence is required
            if (!options.schedule.recurrence) {
                throw new Error(`Invalid job options on job "${jobName}"! "recurrence" is required.`);
            }
            // Recurrence must be valid
            if (!recurrenceWhitelist.includes(options.schedule.recurrence.trim().toLowerCase())) {
                throw new Error(`Invalid job options on job "${jobName}"! "recurrence" must be one of the following: ${recurrenceWhitelist.map(item => `"${item}"`).join(', ')}.`);
            }
            // Time is required
            if (!options.schedule.time) {
                throw new Error(`Invalid job options on job "${jobName}"! "time" is required.`);
            }
            // Time must be string
            if (typeof options.schedule.time !== 'string') {
                throw new Error(`Invalid job options on job "${jobName}"! "time" must be string.`);
            }
            // Time must be in hh:mm format
            const hour = +options.schedule.time.split(':')[0];
            const minute = +options.schedule.time.split(':')[1];
            if (typeof hour !== 'number' || isNaN(hour) || typeof minute !== 'number' || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
                throw new Error(`Invalid job options on job "${jobName}"! "time" has invalid format.`);
            }
            // Validate day if recurrence is not daily
            if (options.schedule.recurrence.trim().toLowerCase() !== 'daily') {
                // Day is required
                if (!options.schedule.hasOwnProperty('day')) {
                    throw new Error(`Invalid job options on job "${jobName}"! "day" is required when recurrence is not daily.`);
                }
                // Day must be a number
                if (typeof options.schedule.day !== 'number') {
                    throw new Error(`Invalid job options on job "${jobName}"! "day" must be a number.`);
                }
                // Day must be between 1-7 if recurrence is weekly
                if (options.schedule.recurrence.trim().toLowerCase() === 'weekly' && (options.schedule.day < 1 || options.schedule.day > 7)) {
                    throw new Error(`Invalid job options on job "${jobName}"! "day" must be between 1-7 when recurrence is weekly.`);
                }
                // Day must be between 1-31 if recurrence is monthly
                if (options.schedule.recurrence.trim().toLowerCase() === 'mothly' && (options.schedule.day < 1 || options.schedule.day > 31)) {
                    throw new Error(`Invalid job options on job "${jobName}"! "day" must be between 1-31 when recurrence is monthly.`);
                }
                // Show warning if day is between 29-31 with monthly recurrence
                if (options.schedule.recurrence.trim().toLowerCase() === 'mothly' && options.schedule.day > 28) {
                    this._logWarning(`Job "${jobName}" will not be executed on certain months since schedule day is "${options.schedule.day}"!`);
                }
            }
        }
        else if (!options.runImmediately) {
            // Show warning when job is not scheduled and not running immediately
            this._logWarning(`Job "${jobName}" will never run due to options!`);
        }
    }
    async _onTaskError(handler, taskName, jobName, error) {
        if (handler) {
            try {
                await handler(jobName, error);
            }
            catch (error) {
                throw new Error(`An error has occurred on the error hook of task "${taskName}"\n${error}`);
            }
        }
    }
    async _onJobError(handler, jobName, error) {
        if (handler) {
            try {
                await handler(error);
            }
            catch (error) {
                throw new Error(`An error has occurred on the error hook of job "${jobName}"\n${error}`);
            }
        }
    }
    async _onJobSuspend(job) {
        this._logWarning(`Job "${job.name}" was suspended!`);
        // Remove from active jobs
        this.activeJobs.splice(this.activeJobs.findIndex(name => name === job.name), 1);
        if (job.suspendHook) {
            this._log(`Running suspend hook of job "${job.name}"...`);
            try {
                await job.suspendHook();
            }
            catch (error) {
                throw new Error(`An error has occurred on the suspend hook of the job "${job.name}"!\n${error}`);
            }
        }
    }
    async _execJob(jobName) {
        const job = this.jobs[jobName];
        // Add to active jobs
        this.activeJobs.push(job.name);
        try {
            // Call job before if any
            if (job.beforeHook) {
                this._log(`Running before hook of job "${jobName}"...`);
                try {
                    await job.beforeHook(() => job.suspended = true);
                }
                catch (error) {
                    throw new Error(`An error has occurred on the before hook of the job "${jobName}"!\n${error}`);
                }
            }
            // If job was suspended, call the suspend hook if any
            if (job.suspended) {
                await this._onJobSuspend(job);
                return;
            }
            // Execute job tasks
            this._log(`Executing job "${jobName}"...`);
            for (const taskName of job.tasks) {
                const task = this.tasks[taskName];
                // If task has no definition
                if (!task.runner) {
                    await this._onTaskError(task.errorHook, taskName, jobName, new Error(`Task "${taskName}" does not have a definition!`));
                    throw new Error(`Task "${taskName}" does not have a definition!`);
                }
                // Run task before hook if any
                if (task.beforeHook) {
                    this._log(`Running before hook of task "${taskName}"...`);
                    try {
                        await task.beforeHook(jobName, () => task.suspended = true);
                    }
                    catch (error) {
                        await this._onTaskError(task.errorHook, taskName, jobName, error);
                        throw new Error(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);
                    }
                }
                // If job is suspended, run job suspend hook if any
                if (job.suspended) {
                    await this._onJobSuspend(job);
                    return;
                }
                // If task is suspended, run task suspend hook if any
                if (task.suspended) {
                    this._logWarning(`Task "${taskName}" was suspended!`);
                    if (task.suspendHook) {
                        this._log(`Running suspend hook of task "${taskName}"...`);
                        try {
                            await task.suspendHook(jobName);
                        }
                        catch (error) {
                            await this._onTaskError(task.errorHook, taskName, jobName, error);
                            throw new Error(`An error has occurred on the suspend hook of the task "${taskName}"!\n${error}`);
                        }
                    }
                    continue;
                }
                // Run the task
                this._log(`Running task "${taskName}"...`);
                try {
                    await task.runner(jobName);
                }
                catch (error) {
                    await this._onTaskError(task.errorHook, taskName, jobName, error);
                    throw new Error(`An error has occurred on task "${taskName}"!\n${error}`);
                }
                if (job.suspended) {
                    await this._onJobSuspend(job);
                    return;
                }
                // Run task after hook if any
                if (task.afterHook) {
                    this._log(`Running after hook of task "${taskName}"...`);
                    try {
                        await task.afterHook(jobName);
                    }
                    catch (error) {
                        await this._onTaskError(task.errorHook, taskName, jobName, error);
                        throw new Error(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);
                    }
                }
                if (job.suspended) {
                    await this._onJobSuspend(job);
                    return;
                }
            }
            // Call job after if any
            if (job.afterHook) {
                this._log(`Running after hook of job "${jobName}"...`);
                try {
                    await job.afterHook();
                }
                catch (error) {
                    throw new Error(`An error has occurred on the after hook of the job "${jobName}"!\n${error}`);
                }
            }
        }
        catch (error) {
            // Remove from active jobs
            this.activeJobs.splice(this.activeJobs.findIndex(name => name === job.name), 1);
            throw error;
        }
        // Remove from active jobs
        this.activeJobs.splice(this.activeJobs.findIndex(name => name === job.name), 1);
        this._log(`Job "${jobName}" was executed successfully.`);
    }
    _activateClock() {
        this.clockActivated = true;
        // Run every minute
        setInterval(() => {
            const date = new Date();
            for (const jobName of this.scheduledJobs) {
                const job = this.jobs[jobName];
                const schedule = job.options.schedule;
                const recurrence = schedule.recurrence.trim().toLowerCase();
                const day = schedule.day;
                const hour = +schedule.time.split(':')[0];
                const minute = +schedule.time.split(':')[1];
                if (
                // If recurrence is daily and time is now
                (recurrence === 'daily' && hour === date.getHours() && minute === date.getMinutes()) ||
                    // If recurrence is weekly and day of week and time is now
                    (recurrence === 'weekly' && day === date.getDay() && hour === date.getHours() && minute === date.getMinutes()) ||
                    // If recurrence is monthly and day of month and time is now
                    (recurrence === 'monthly' && day === date.getDate() && hour === date.getHours() && minute === date.getMinutes())) {
                    // Reset all suspensions
                    job.suspended = false;
                    for (const taskName of job.tasks) {
                        this.tasks[taskName].suspended = false;
                    }
                    // Execute job
                    this._execJob(jobName)
                        .catch(error => {
                        this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);
                        // Run job error handler if any
                        this._onJobError(job.errorHook, jobName, error)
                            .catch(error => this._logError(error));
                    });
                }
            }
        }, 60000);
    }
    _scheduleJob(jobName) {
        // Add the job to scheduled jobs
        this.scheduledJobs.push(jobName);
        // Activate the clock if it's inactive
        if (!this.clockActivated)
            this._activateClock();
        const schedule = this.jobs[jobName].options.schedule;
        if (schedule.recurrence.toLowerCase().trim() === 'daily')
            this._logConfig(`Scheduled job "${jobName}" to recur daily at ${this._getTimeLabel(schedule.time)}`);
        else if (schedule.recurrence.toLowerCase().trim() === 'weekly')
            this._logConfig(`Scheduled job "${jobName}" to recur weekly on ${this._getWeekDayName(schedule.day)} at ${this._getTimeLabel(schedule.time)}`);
        else if (schedule.recurrence.toLowerCase().trim() === 'monthly')
            this._logConfig(`Scheduled job "${jobName}" to recur on ${this._getDayLabel(schedule.day)} of each month at ${this._getTimeLabel(schedule.time)}`);
    }
    task(name, task) {
        const parsed = this._parseName(name);
        const hooksWhitelist = [
            'before',
            'after',
            'error',
            'suspend'
        ];
        if (parsed.hook && !hooksWhitelist.includes(parsed.hook)) {
            this._logError(`Unsupported hook name "${parsed.hook}" for task "${parsed.name}"`);
            throw new Error(`Unsupported hook name "${parsed.hook}" for task "${parsed.name}"`);
        }
        if (!this.tasks[parsed.name]) {
            this.tasks[parsed.name] = {
                name: parsed.name,
                suspended: false
            };
        }
        if (parsed.hook === 'before') {
            this._logConfig(`Registering before hook for task "${parsed.name}"`);
            this.tasks[parsed.name].beforeHook = task;
        }
        else if (parsed.hook === 'after') {
            this._logConfig(`Registering after hook for task "${parsed.name}"`);
            this.tasks[parsed.name].afterHook = task;
        }
        else if (parsed.hook === 'error') {
            this._logConfig(`Registering error hook for task "${parsed.name}"`);
            this.tasks[parsed.name].errorHook = task;
        }
        else if (parsed.hook === 'suspend') {
            this._logConfig(`Registering suspend hook for task "${parsed.name}"`);
            this.tasks[parsed.name].suspendHook = task;
        }
        else {
            this._logConfig(`Registering task "${parsed.name}"`);
            this.tasks[parsed.name].runner = task;
        }
    }
    job(name, tasks, options) {
        const parsed = this._parseName(name);
        if (!tasks || !tasks.length) {
            this._logError(`Job "${parsed.name}" must have at least one task!`);
            throw new Error(`Job "${parsed.name}" must have at least one task!`);
        }
        for (const taskName of tasks) {
            if (!this.tasks[taskName]) {
                this._logError(`Task "${taskName}" not found!`);
                throw new Error(`Task "${taskName}" not found!`);
            }
            if (!this.tasks[taskName].runner) {
                this._logError(`Task "${taskName}" does not have a definition!`);
                throw new Error(`Task "${taskName}" does not have a definition!`);
            }
        }
        this._logConfig(`Registering job "${parsed.name}" with tasks ${tasks.map(task => `"${task}"`).join(', ')}`);
        if (!this.jobs[parsed.name]) {
            this.jobs[parsed.name] = {
                name: parsed.name,
                tasks: tasks,
                suspended: false,
                options: Object.assign({ runImmediately: true }, options || {})
            };
        }
        else {
            this.jobs[parsed.name].tasks = tasks;
            this.jobs[parsed.name].options = Object.assign(this.jobs[parsed.name].options, options || {});
        }
    }
    hook(job, task) {
        const parsed = this._parseName(job);
        const hooksWhitelist = [
            'before',
            'after',
            'error',
            'suspend'
        ];
        if (parsed.hook && !hooksWhitelist.includes(parsed.hook)) {
            this._logError(`Unsupported hook name "${parsed.hook}" for job "${parsed.name}"`);
            throw new Error(`Unsupported hook name "${parsed.hook}" for job "${parsed.name}"`);
        }
        if (!this.jobs[parsed.name]) {
            this.jobs[parsed.name] = {
                name: parsed.name,
                suspended: false,
                tasks: [],
                options: { runImmediately: true }
            };
        }
        if (parsed.hook === 'before') {
            this._logConfig(`Registering before hook for job "${parsed.name}"`);
            this.jobs[parsed.name].beforeHook = task;
        }
        else if (parsed.hook === 'after') {
            this._logConfig(`Registering after hook for job "${parsed.name}"`);
            this.jobs[parsed.name].afterHook = task;
        }
        else if (parsed.hook === 'error') {
            this._logConfig(`Registering error hook for job "${parsed.name}"`);
            this.jobs[parsed.name].errorHook = task;
        }
        else if (parsed.hook === 'suspend') {
            this._logConfig(`Registering suspend hook for job "${parsed.name}"`);
            this.jobs[parsed.name].suspendHook = task;
        }
    }
    log(message) {
        console.log(chalk_1.default.cyanBright(`[TASK] ${message}`));
        this._logToFile(`[${(new Date()).toISOString()}] [TASK] ${message}`);
    }
    suspend(jobName) {
        if (!this.jobs[jobName]) {
            this._logError(`Cannot suspend job "${jobName}" because it doesn't exist!`);
            throw new Error(`Cannot suspend job "${jobName}" because it doesn't exist!`);
        }
        // If job is not active show warning
        if (this.activeJobs.findIndex(name => name === jobName) === -1)
            this._logWarning(`Job "${jobName}" cannot be suspended because it's inactive!`);
        else
            this.jobs[jobName].suspended = true;
    }
    request(options) {
        return new Promise((resolve, reject) => {
            request_1.default(options, (error, response) => {
                if (error)
                    return reject(error);
                if (response.headers['content-type'] && response.headers['content-type'].toLowerCase() === 'application/json') {
                    try {
                        response.body = JSON.parse(response.body);
                    }
                    catch (error) {
                        reject(new Error('Failed to parse response body!\n' + error.message));
                    }
                }
                resolve(response);
            });
        });
    }
    async _execJobs(jobNames, runAllJobs) {
        if (runAllJobs)
            jobNames = Object.keys(this.jobs);
        const validJobs = [];
        // Validate and schedule the jobs
        for (const jobName of jobNames) {
            // Check if job exists
            if (!this.jobs[jobName]) {
                this._logError(`Job "${jobName}" not found!`);
                continue;
            }
            try {
                // Check if job has tasks
                if (!this.jobs[jobName].tasks.length)
                    throw new Error(`Job "${jobName}" has no tasks!`);
                // Validate job options
                this._validateJobOptions(this.jobs[jobName].options, jobName);
                // Schedule the job if specified
                if (this.jobs[jobName].options.schedule)
                    this._scheduleJob(jobName);
                // Add to valid jobs
                validJobs.push(jobName);
            }
            catch (error) {
                // Remove job
                delete this.jobs[jobName];
                this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);
            }
        }
        // Run the jobs immediately
        for (const jobName of validJobs) {
            try {
                // Run the job immediately if specified
                if (this.jobs[jobName].options.runImmediately)
                    await this._execJob(jobName);
            }
            catch (error) {
                this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);
                // Run error handler if any
                try {
                    await this._onJobError(this.jobs[jobName].errorHook, jobName, error);
                }
                catch (error) {
                    this._logError(error);
                }
            }
        }
    }
}
exports.Hammer = Hammer;
