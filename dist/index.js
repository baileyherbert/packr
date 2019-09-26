"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const project_1 = require("./project");
const chalk_1 = require("chalk");
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const user_error_1 = require("./error/user-error");
async function bootstrap() {
    let target = process.cwd();
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
    console.log(chalk_1.default.cyan('Finished'), 'generating bundle ->', project.getOutputPath());
}
bootstrap().catch(error => {
    if (error instanceof user_error_1.UserError)
        console.error(chalk_1.default.red('Error:'), error.message);
    else
        console.error(error);
    process.exit(1);
});
