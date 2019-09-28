export class Terminal {

    /**
     *
     * @param name The long name of the flag, case-insensitive (`--name`)
     * @param shorthand The short name of the flag, case-sensitive (`-n`)
     */
    public static hasFlag(name: string, shorthand?: string) {
        let args = process.argv.slice(2);

        name = '--' + name.replace(/^--/, '');
        shorthand = shorthand ? '-' + shorthand.replace(/^-/, '') : undefined;

        return args.filter(arg => {
            return arg.toLowerCase().trim() == name || arg.trim() == shorthand;
        }).length > 0;
    }

    /**
     * Extracts the commands from the terminal, in their original order, excluding the `packr` command itself.
     * For example, if the user runs `packr help`, this returns `['help']`. If the user runs `packr watch help`, this
     * returns `['watch', 'help']`. If no command is given, returns an empty array.
     */
    public static getCommands(defaultCommandName ?: string) : string[] {
        let args = process.argv.slice(2);
        let commands : string[] = [];

        args.forEach(arg => {
            if (!arg.trim().startsWith('-')) {
                commands.push(arg);
            }
        });

        if (defaultCommandName && commands.length === 0) {
            return [defaultCommandName];
        }

        return commands;
    }

}
