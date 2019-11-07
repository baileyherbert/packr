import * as fs from 'fs';
import { Namespace } from '../namespace';

export class SourceFile {

    private namespaceName : string;

    public constructor(private namespace: Namespace, private className: string, private path: string) {
        this.namespaceName = className.replace(/\\[\w_]+$/, '');
    }

    /**
     * Refactors the file as needed and then returns it in Base64 encoding. Throws an `Error` if there is an issue
     * preventing the file from being bundled.
     */
    public compile() : string {
        let content = fs.readFileSync(this.path).toString().trim();

        if (!content.startsWith('<?php')) throw new Error('did not start with a php tag');
        content = content.substring(5).trim();
        content = content.replace(/\?>$/, '').trim();

        let firstBracket = content.indexOf('{');
        let search = firstBracket >= 0 ? content.substring(0, firstBracket) : content;

        let match = search.match(/^[\t ]*namespace ((?:[\w_]+\\)*[\w_]+)[\t ]*(?:;|{|$)/m);
        if (match && match[1] != this.namespaceName) throw new Error(`did not match the expected namespace (${match[1]} != ${this.namespaceName})`);

        return this.namespace.getProject().encode(content);
    }

    /**
     * Returns the absolute path to the source file.
     */
    public getPath() {
        return this.path;
    }

    /**
     * Returns the absolute class name, including its namespace.
     */
    public getClassName() {
        return this.className;
    }

    /**
     * Returns the mapped namespace of the source file.
     */
    public getNamespace() {
        return this.namespaceName;
    }

}
