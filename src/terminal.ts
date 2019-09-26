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

}
