import { Project } from './project';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import { UserError } from './error/user-error';

async function bootstrap() {
    let target = process.cwd();
    let project = new Project(target);

    // Load the project and configuration
    await project.load();

    // Compile the bundled file
    let output = await project.compile();

    // Ensure the output directory exists
    mkdirp.sync(path.dirname(project.getOutputPath()));

    // Write the bundle file
    fs.writeFileSync(project.getOutputPath(), output);

    // Finished
    console.log(chalk.cyan('Finished'), 'generating bundle ->', project.getOutputPath());
}

bootstrap().catch(error => {
    if (error instanceof UserError) console.error(chalk.red('Error:'), error.message);
    else console.error(error);

    process.exit(1);
});
