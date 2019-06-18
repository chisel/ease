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
        fs_extra_1.default.ensureFileSync(path_1.default.join(os_1.default.homedir(), '.hammer', 'hammer.log'));
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
        console.log(`[HAMMER] ${message}`);
        this._logToFile(`[HAMMER] ${message}`);
    }
    _logError(message) {
        console.log(chalk_1.default.bold.redBright(`[ERROR] ${message}`));
        this._logToFile(`[ERROR] ${message}`);
    }
    _logWarning(message) {
        console.log(chalk_1.default.bold.yellowBright(`[WARNING] ${message}`));
        this._logToFile(`[WARNING] ${message}`);
    }
    _logConfig(message) {
        if (this._verbose)
            console.log(chalk_1.default.bold.greenBright(`[CONFIG] ${message}`));
        this._logToFile(`[CONFIG] ${message}`);
    }
    async _onTaskError(handler, taskName, jobName, error) {
        if (handler) {
            try {
                await handler(jobName, error);
            }
            catch (error) {
                this._logError(`An error has occurred on the error hook of task "${taskName}"\n${error}`);
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
                this._logError(`An error has occurred on the error hook of job "${jobName}"\n${error}`);
                throw new Error(`An error has occurred on the error hook of job "${jobName}"\n${error}`);
            }
        }
    }
    async _onJobSuspend(job) {
        this._logWarning(`Job "${job.name}" was suspended!`);
        if (job.suspendHook) {
            this._log(`Running suspend hook of job "${job.name}"...`);
            try {
                await job.suspendHook();
            }
            catch (error) {
                this._logError(`An error has occurred on the suspend hook of the job "${job.name}"!\n${error}`);
                throw new Error(`An error has occurred on the suspend hook of the job "${job.name}"!\n${error}`);
            }
        }
    }
    async _execJob(jobName) {
        // Check if job exists
        if (!this.jobs[jobName]) {
            this._logError(`Job "${jobName}" not found!`);
            throw new Error(`Job "${jobName}" not found!`);
        }
        // Check if job has tasks
        if (!this.jobs[jobName].tasks.length) {
            this._logError(`Job "${jobName}" has no tasks!`);
            throw new Error(`Job "${jobName}" has no tasks!`);
        }
        const job = this.jobs[jobName];
        // Call job before if any
        if (job.beforeHook) {
            this._log(`Running before hook of job "${jobName}"...`);
            try {
                await job.beforeHook(() => job.suspended = true);
            }
            catch (error) {
                this._logError(`An error has occurred on the before hook of the job "${jobName}"!\n${error}`);
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
                this._logError(`Task "${taskName}" does not have a definition!`);
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
                    this._logError(`An error has occurred on the before hook of the task "${taskName}"!\n${error}`);
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
                        this._logError(`An error has occurred on the suspend hook of the task "${taskName}"!\n${error}`);
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
                this._logError(`An error has occurred on task "${taskName}"!\n${error}`);
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
                    this._logError(`An error has occurred on the after hook of the task "${taskName}"!\n${error}`);
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
                this._logError(`An error has occurred on the after hook of the job "${jobName}"!\n${error}`);
                throw new Error(`An error has occurred on the after hook of the job "${jobName}"!\n${error}`);
            }
        }
        this._log(`Job "${jobName}" was executed successfully.`);
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
    job(name, tasks) {
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
                suspended: false
            };
        }
        else {
            this.jobs[parsed.name].tasks = tasks;
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
                tasks: []
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
        console.log(chalk_1.default.cyanBright(`[LOG] ${message}`));
        this._logToFile(`[LOG] ${message}`);
    }
    suspend(jobName) {
        if (!this.jobs[jobName]) {
            this._logError(`Cannot suspend job "${jobName}" because it doesn't exist!`);
            throw new Error(`Cannot suspend job "${jobName}" because it doesn't exist!`);
        }
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
    async _execJobs(jobNames) {
        for (const jobName of jobNames) {
            try {
                await this._execJob(jobName);
            }
            catch (error) {
                this._logError(`Job "${jobName}" has failed due to an error:\n${error}`);
                const job = this.jobs[jobName];
                if (job) {
                    try {
                        await this._onJobError(job.errorHook, jobName, error);
                    }
                    catch (error) {
                        // Do nothing!
                    }
                }
            }
        }
    }
}
exports.Hammer = Hammer;
