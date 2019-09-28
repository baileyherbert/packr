"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const chokidar = require("chokidar");
const project_1 = require("../project");
const build_1 = require("./build");
let project;
let wip;
async function watch(args) {
    let target = path.resolve(process.cwd(), args[0] || '.');
    let handleNewFiles = false;
    // Load the project
    project = new project_1.Project(target);
    await project.load();
    // Debugging
    console.log('Now monitoring for file changes (press Ctrl+C to stop)...');
    // Run an initial build
    await build_1.build(args);
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
            process.emit("SIGINT");
        });
    }
    // Terminate immediately upon Ctrl+C
    process.on("SIGINT", async function () {
        if (wip)
            await wip;
        process.exit();
    });
}
exports.watch = watch;
async function handleFileChange(args, filePath) {
    // Reload the project if the config file is changed
    if (filePath == project.getConfigPath()) {
        project = new project_1.Project(path.resolve(process.cwd(), args[0] || '.'));
        await project.load();
    }
    // Skip if this isn't a .php file
    if (!filePath.match(/\.php$/i))
        return;
    // Skip if this file isn't inside a mapped namespace
    if (!project.getNamespaces().filter(namespace => filePath.startsWith(namespace.getPath())).length)
        return;
    // Rebuild
    wip = build_1.build(args);
    await wip;
    wip = undefined;
}
