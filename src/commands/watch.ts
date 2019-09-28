import * as path from 'path';
import * as chokidar from 'chokidar';

import { Project } from '../project';
import { build } from './build';

let project : Project;
let wip: Promise<any>;

export async function watch(args: string[]) {
    let target = path.resolve(process.cwd(), args[0] || '.');
    let handleNewFiles = false;

    // Load the project
    project = new Project(target);
    await project.load();

    // Debugging
    console.log('Now monitoring for file changes (press Ctrl+C to stop)...');

    // Run an initial build
    await build(args);

    // Watch for file changes
    let watch = chokidar.watch(target, { persistent: true });
    watch.on('add', (file) => handleNewFiles && handleFileChange(args, file));
    watch.on('change', (file) => handleNewFiles && handleFileChange(args, file));
    watch.on('unlink', (file) => handleNewFiles && handleFileChange(args, file));
    watch.on('ready', () => handleNewFiles = true);

    // Proper sigint emission on Windows
    if (process.platform === 'win32') {
        var rl = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.on("SIGINT", function () {
            process.emit("SIGINT" as any);
        });
    }

    // Terminate immediately upon Ctrl+C
    process.on("SIGINT", async function () {
        if (wip) await wip;
        process.exit();
    });
}

async function handleFileChange(args: string[], filePath: string) {
    let rebuild = (async () => {
        // Rebuild
        wip = build(args);
        await wip;
        wip = undefined;
    });

    // Reload the project if the config file is changed
    if (filePath == project.getConfigPath()) {
        project = new Project(path.resolve(process.cwd(), args[0] || '.'));
        await project.load();
        await rebuild();
    }

    // Skip if this isn't a .php file
    if (!filePath.match(/\.php$/i)) return;

    // Skip if this file isn't inside a mapped namespace
    if (!project.getNamespaces().filter(namespace => filePath.startsWith(namespace.getPath())).length) return;

    // Rebuild
    await rebuild();
}
