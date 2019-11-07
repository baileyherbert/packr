import * as fs from 'fs';
import * as path from 'path';

export class Composer {

    private vendorPath: string;

    private namespacesPsr0 : Namespaces = {};
    private namespacesPsr4 : Namespaces = {};

    public constructor(private baseDir: string) {
        this.vendorPath = path.join(baseDir, 'vendor');

        if (fs.existsSync(this.vendorPath) && fs.statSync(this.vendorPath).isDirectory()) {
            // TODO: this.loadClassMap();
            this.loadNamespacesPsr0();
            this.loadNamespacesPsr4();
            this.loadFiles();
        }
    }

    private loadNamespacesPsr0() {
        this.namespacesPsr0 = this.loadNamespaces('namespaces');
    }

    private loadNamespacesPsr4() {
        this.namespacesPsr0 = this.loadNamespaces('psr4');
    }

    private loadNamespaces(file: 'psr4' | 'namespaces') {
        let found : { [prefix: string]: string } = {};
        let data = this.readAutoloadFile(file);
        let expression = /^\s+'([^']+)'\s+=>\s+array\(\$([^\s]+)\s+\.\s+'([^']+)'\),?$/gm;
        let matches = this.matchAll(expression, data);

        for (let match of matches) {
            let prefix = match[1];
            let type = match[2];
            let relativePath = match[3];

            // Trim directory slashes off the path
            while (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }

            // Append the vendor path if needed
            if (type === 'vendorDir') {
                relativePath = 'vendor/' + relativePath;
            }

            // Replace "\\" with "\" in the prefix
            prefix = prefix.replace(/\\\\/g, '\\');

            // Add the prefix and path
            found[prefix] = relativePath;
        }

        return found;
    }

    private loadFiles() {

    }

    public getNamespacesPsr0() {
        return this.namespacesPsr0;
    }

    public getNamespacesPsr4() {
        return this.namespacesPsr4;
    }

    /**
     * Finds all matches of a regular expression in the string, and returns an array. The expression must have the `g`
     * modifier flag.
     *
     * @param regex
     * @param input
     */
    private matchAll(regex: RegExp, input: string) {
        let matches : RegExpMatchArray[] = [];
        let match : RegExpMatchArray;

        do {
            match = regex.exec(input);
            if (match) {
                matches.push(match);
            }
        }
        while (match);

        return matches;
    }

    /**
     * Reads and returns the contents of the specified autoload file if it exists in the vendor. Otherwise, returns
     * `undefined`.
     *
     * @param name
     * @param encoding
     */
    private readAutoloadFile(name: 'classmap' | 'files' | 'namespaces' | 'psr4', encoding: 'utf8' | 'base64' = 'utf8') {
        let targetPath = path.join(this.vendorPath, 'composer', 'autoload_' + name + '.php');

        if (fs.existsSync(targetPath)) {
            return fs.readFileSync(targetPath).toString(encoding);
        }
    }

}

type Namespaces = {
    [prefix: string]: string
};
