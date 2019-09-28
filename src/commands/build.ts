import * as path from 'path';
import { Project } from '../project';

export async function build(args: string[]) {
    let target = path.resolve(process.cwd(), args[0] || '.');
    let project = new Project(target);

    // Load the project and configuration
    await project.load();

    // Compile the bundled file
    await project.compile();

    // Finished
    console.log('Finished bundling to', project.getOutputPath());
}
