"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class SourceFile {
    constructor(namespace, className, path) {
        this.namespace = namespace;
        this.className = className;
        this.path = path;
        this.namespaceName = className.replace(/\\[\w_]+$/, '');
    }
    /**
     * Refactors the file as needed and then returns it in Base64 encoding. Throws an `Error` if there is an issue
     * preventing the file from being bundled.
     */
    compile() {
        let content = fs.readFileSync(this.path).toString().trim();
        if (!content.startsWith('<?php'))
            throw new Error('did not start with a php tag');
        content = content.substring(5).trim();
        content = content.replace(/\?>$/, '').trim();
        let firstBracket = content.indexOf('{');
        let search = firstBracket >= 0 ? content.substring(0, firstBracket) : content;
        let match = search.match(/^[\t ]*namespace ((?:[\w_]+\\)*[\w_]+)[\t ]*(?:;|{|$)/m);
        if (match && match[1] != this.namespaceName)
            throw new Error(`did not match the expected namespace (${match[1]} != ${this.namespaceName})`);
        return this.namespace.getProject().encode(content);
    }
    /**
     * Returns the absolute path to the source file.
     */
    getPath() {
        return this.path;
    }
    /**
     * Returns the absolute class name, including its namespace.
     */
    getClassName() {
        return this.className;
    }
    /**
     * Returns the mapped namespace of the source file.
     */
    getNamespace() {
        return this.namespaceName;
    }
}
exports.SourceFile = SourceFile;
