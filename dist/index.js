"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chalk_1 = require("chalk");
const user_error_1 = require("./error/user-error");
const terminal_1 = require("./terminal");
const build_1 = require("./commands/build");
const watch_1 = require("./commands/watch");
const expand_1 = require("./commands/expand");
async function bootstrap() {
    let commands = terminal_1.Terminal.getCommands('build');
    let command = commands[0];
    let args = commands.slice(1);
    // Build ('build' or 'b')
    if (command == 'build' || command == 'b')
        return await build_1.build(args);
    // Watch and build ('watch' or 'w')
    if (command == 'watch' || command == 'w')
        return await watch_1.watch(args);
    // Expand
    if (command == 'expand' || command == 'e')
        return await expand_1.expand(args);
}
bootstrap().catch(error => {
    if (error instanceof user_error_1.UserError)
        console.error(chalk_1.default.red('Error:'), error.message);
    else
        console.error(error);
    process.exit(1);
});
