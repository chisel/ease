#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = __importDefault(require("commander"));
const path_1 = __importDefault(require("path"));
const hammer_1 = require("./hammer");
// Define CLI
commander_1.default
    .version('1.0.0', '--version')
    .usage('[options] <jobs>')
    .option('-c, --config <path>', 'Path to the hammer config file')
    .option('-v --verbose', 'Detailed console logs')
    .option('-a --all', 'Run all jobs defined in the hammer config file')
    .parse(process.argv);
// Set config path to default if not provided
commander_1.default.config = path_1.default.join(process.cwd(), commander_1.default.config || 'hammer.js');
// If no job names are provided
if (!commander_1.default.args.length && !commander_1.default.all)
    commander_1.default.help();
// Load the config
const config = require(commander_1.default.config);
const hammer = new hammer_1.Hammer(commander_1.default.verbose);
// Configure Hammer
config(hammer);
// Run the jobs
hammer._execJobs(commander_1.default.args, commander_1.default.all);
