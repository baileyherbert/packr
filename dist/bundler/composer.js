"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
class Composer {
    constructor(baseDir) {
        this.baseDir = baseDir;
        this.namespacesPsr0 = {};
        this.namespacesPsr4 = {};
        this.vendorPath = path.join(baseDir, 'vendor');
        if (fs.existsSync(this.vendorPath) && fs.statSync(this.vendorPath).isDirectory()) {
            // TODO: this.loadClassMap();
            this.loadNamespacesPsr0();
            this.loadNamespacesPsr4();
            this.loadFiles();
        }
    }
    loadNamespacesPsr0() {
        this.namespacesPsr0 = this.loadNamespaces('namespaces');
    }
    loadNamespacesPsr4() {
        this.namespacesPsr0 = this.loadNamespaces('psr4');
    }
    loadNamespaces(file) {
        let found = {};
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
    loadFiles() {
    }
    getNamespacesPsr0() {
        return this.namespacesPsr0;
    }
    getNamespacesPsr4() {
        return this.namespacesPsr4;
    }
    /**
     * Finds all matches of a regular expression in the string, and returns an array. The expression must have the `g`
     * modifier flag.
     *
     * @param regex
     * @param input
     */
    matchAll(regex, input) {
        let matches = [];
        let match;
        do {
            match = regex.exec(input);
            if (match) {
                matches.push(match);
            }
        } while (match);
        return matches;
    }
    /**
     * Reads and returns the contents of the specified autoload file if it exists in the vendor. Otherwise, returns
     * `undefined`.
     *
     * @param name
     * @param encoding
     */
    readAutoloadFile(name, encoding = 'utf8') {
        let targetPath = path.join(this.vendorPath, 'composer', 'autoload_' + name + '.php');
        if (fs.existsSync(targetPath)) {
            return fs.readFileSync(targetPath).toString(encoding);
        }
    }
}
exports.Composer = Composer;
