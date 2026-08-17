#!/usr/bin/env node

const path = require('node:path');
const { createRequire } = require('node:module');

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1';

const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
const nextBin = projectRequire.resolve('next/dist/bin/next');

process.argv = [process.execPath, nextBin, 'build', ...process.argv.slice(2)];
require(nextBin);
