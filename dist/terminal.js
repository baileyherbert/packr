"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Terminal {
    /**
     *
     * @param name The long name of the flag, case-insensitive (`--name`)
     * @param shorthand The short name of the flag, case-sensitive (`-n`)
     */
    static hasFlag(name, shorthand) {
        let args = process.argv.slice(2);
        name = '--' + name.replace(/^--/, '');
        shorthand = shorthand ? '-' + shorthand.replace(/^-/, '') : undefined;
        return args.filter(arg => {
            return arg.toLowerCase().trim() == name || arg.trim() == shorthand;
        }).length > 0;
    }
}
exports.Terminal = Terminal;
