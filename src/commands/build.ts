import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as path from 'path';

import { Project } from '../project';

export async function build(args: string[]) {
    let target = path.resolve(process.cwd(), args[0] || '.');
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
    console.log('Finished bundling to', project.getOutputPath());
}
