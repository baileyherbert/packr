#!/usr/bin/env node

const { PackrCommandLine } = require('../dist/commands/PackrCommandLine.js');
const packr = new PackrCommandLine();
packr.execute();
