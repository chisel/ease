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
    .version('1.0.0')
    .usage('[options] <job>')
    .option('-c, --config <path>', 'Path to the hammer config file')
    .option('-v --verbose', 'Detailed console logs')
    .parse(process.argv);
// Set config path to default if not provided
commander_1.default.config = path_1.default.join(process.cwd(), commander_1.default.config || 'hammer.js');
if (!commander_1.default.args.length)
    throw new Error(`No job name provided!`);
// Load the config
const config = require(commander_1.default.config);
const hammer = new hammer_1.Hammer(commander_1.default.verbose);
// Configure Hammer
config(hammer);
// Run the job
hammer._execJob(commander_1.default.args[0])
    .finally(() => process.exit());
