import chalk from 'chalk';

import { UserError } from './error/user-error';
import { Terminal } from './terminal';

import { build } from './commands/build';
import { watch } from './commands/watch';
import { expand } from './commands/expand';

async function bootstrap() {
    let commands = Terminal.getCommands('build');
    let command = commands[0];
    let args = commands.slice(1);

    // Build ('build' or 'b')
    if (command == 'build' || command == 'b') return await build(args);

    // Watch and build ('watch' or 'w')
    if (command == 'watch' || command == 'w') return await watch(args);

    // Expand
    if (command == 'expand' || command == 'e') return await expand(args);
}

bootstrap().catch(error => {
    if (error instanceof UserError) console.error(chalk.red('Error:'), error.message);
    else console.error(error);

    process.exit(1);
});
