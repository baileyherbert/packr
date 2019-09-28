"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const source_file_1 = require("./bundler/source-file");
const recursive = require("recursive-readdir");
const chalk_1 = require("chalk");
class Namespace {
    constructor(project, name, path) {
        this.project = project;
        this.name = name;
        this.path = path;
    }
    /**
     * Returns the absolute path to the namespace's source directory.
     */
    getPath() {
        return this.path;
    }
    /**
     * Returns the project this namespace belongs to.
     */
    getProject() {
        return this.project;
    }
    /**
     * Returns an array of all bits in the namespace.
     */
    async getBits() {
        let bits = [];
        let files = await this.getFiles();
        files.forEach(file => {
            try {
                bits.push({
                    name: file.getClassName(),
                    value: file.compile()
                });
            }
            catch (error) {
                console.log('%s file %s (%s).', chalk_1.default.yellow('Skipped'), this.project.getRelativePath(file.getPath()), error.message);
            }
        });
        return bits;
    }
    /**
     * Returns an array of source files in the namespace.
     */
    async getFiles() {
        let files = await this.getFilesRecursively(this.path);
        files = files.filter(file => file.toLowerCase().endsWith('.php'));
        return files.map(file => {
            let namespace = this.project.resolveNamespace(this.name, this.path, file);
            return new source_file_1.SourceFile(this, namespace, file);
        });
    }
    /**
     * Recursively searches for files in the given path.
     */
    getFilesRecursively(path) {
        return new Promise((resolve, reject) => {
            recursive(path, (err, files) => {
                if (err)
                    return reject(err);
                resolve(files);
            });
        });
    }
}
exports.Namespace = Namespace;
