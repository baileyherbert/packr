import { Project } from './project';
import { SourceFile } from './bundler/source-file';

import * as recursive from 'recursive-readdir';
import chalk from 'chalk';

export class Namespace {

    public constructor(private project: Project, private name: string, private path: string) {

    }

    /**
     * Returns the absolute path to the namespace's source directory.
     */
    public getPath() {
        return this.path;
    }

    /**
     * Returns the project this namespace belongs to.
     */
    public getProject() {
        return this.project;
    }

    /**
     * Returns an array of all bits in the namespace.
     */
    public async getBits() {
        let bits : Bit[] = [];
        let files = await this.getFiles();

        files.forEach(file => {
            try {
                bits.push({
                    name: file.getClassName(),
                    value: file.compile()
                });
            }
            catch (error) {
                console.log(
                    '%s file %s (%s).',
                    chalk.yellow('Skipped'),
                    this.project.getRelativePath(file.getPath()),
                    error.message
                );
            }
        });

        return bits;
    }

    /**
     * Returns an array of source files in the namespace.
     */
    public async getFiles() {
        let files = await this.getFilesRecursively(this.path);
        files = files.filter(file => file.toLowerCase().endsWith('.php'));

        return files.map(file => {
            let namespace = this.project.resolveNamespace(this.name, this.path, file);
            return new SourceFile(this, namespace, file);
        });
    }

    /**
     * Recursively searches for files in the given path.
     */
    private getFilesRecursively(path: string) {
        return new Promise<string[]>((resolve, reject) => {
            recursive(path, (err, files) => {
                if (err) return reject(err);
                resolve(files);
            });
        });
    }

}

export type Bit = { name: string; value: string; };
