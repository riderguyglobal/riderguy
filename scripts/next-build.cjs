#!/usr/bin/env node

const path = require('node:path');
const { createRequire } = require('node:module');

process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = '1';
process.env.NEXT_TELEMETRY_DISABLED = process.env.NEXT_TELEMETRY_DISABLED || '1';

const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
const nextBin = projectRequire.resolve('next/dist/bin/next');

// Keep production builds on webpack while the monorepo still consumes
// TypeScript workspace packages directly. Turbopack's project-root boundary
// otherwise treats those linked packages as unresolved external sources.
process.argv = [process.execPath, nextBin, 'build', '--webpack', ...process.argv.slice(2)];
require(nextBin);
