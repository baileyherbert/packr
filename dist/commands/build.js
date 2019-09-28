"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mkdirp = require("mkdirp");
const fs = require("fs");
const path = require("path");
const project_1 = require("../project");
async function build(args) {
    let target = path.resolve(process.cwd(), args[0] || '.');
    let project = new project_1.Project(target);
    // Load the project and configuration
    await project.load();
    // Compile the bundled file
    let output = await project.compile();
    // Ensure the output directory exists
    mkdirp.sync(path.dirname(project.getOutputPath()));
    // Write the bundle file
    fs.writeFileSync(project.getOutputPath(), output);
    // Finished
    console.log('Finished bundling to', project.getOutputPath());
}
exports.build = build;
