import chalk from 'chalk';

import { UserError } from './error/user-error';
import { Terminal } from './terminal';

import { build } from './commands/build';
import { watch } from './commands/watch';
import { expand } from './commands/expand';
import { info } from './commands/info';

async function bootstrap() {
    let commands = Terminal.getCommands('build');
    let command = commands[0];
    let args = commands.slice(1);

    if (command == 'build' || command == 'b') return await build(args);
    if (command == 'watch' || command == 'w') return await watch(args);
    if (command == 'expand' || command == 'e') return await expand(args);
    if (command == 'info' || command == 'i') return await info(args);
}

bootstrap().catch(error => {
    if (error instanceof UserError) console.error(chalk.red('Error:'), error.message);
    else console.error(error);

    process.exit(1);
});
