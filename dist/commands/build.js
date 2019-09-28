"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const project_1 = require("../project");
async function build(args) {
    let target = path.resolve(process.cwd(), args[0] || '.');
    let project = new project_1.Project(target);
    // Load the project and configuration
    await project.load();
    // Compile the bundled file
    await project.compile();
    // Finished
    console.log('Finished bundling to', project.getOutputPath());
}
exports.build = build;
