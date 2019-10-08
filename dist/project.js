"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const mkdirp = require("mkdirp");
const zlib = require("zlib");
const recursive = require("recursive-readdir");
const md5 = require("md5");
const schema_1 = require("./config/schema");
const namespace_1 = require("./namespace");
const terminal_1 = require("./terminal");
const user_error_1 = require("./error/user-error");
const config_1 = require("./config/config");
class Project {
    constructor(targetDirectory) {
        this.targetDirectory = targetDirectory;
        this.config = config_1.config(schema_1.default);
        this.directoryPath = path.resolve(targetDirectory);
        this.configFilePath = path.join(this.directoryPath, 'packr.json');
        // Check that the cwd exists
        if (!fs.existsSync(this.directoryPath)) {
            throw new user_error_1.UserError('Directory does not exist: ' + this.directoryPath);
        }
        // Check for the packr.json file
        if (!fs.existsSync(this.configFilePath)) {
            throw new user_error_1.UserError('Packr project not found at ' + this.directoryPath);
        }
    }
    /**
     * Loads the project's configuration and validates it.
     */
    async load() {
        try {
            this.config.loadFile(this.configFilePath);
            this.config.validate();
        }
        catch (error) {
            throw new user_error_1.UserError(error.message);
        }
    }
    /**
     * Generates and returns the contents of the bundled file as a string.
     */
    async compile() {
        let bitsArray = await this.getBitsArray();
        let mainMethodName = this.getMainMethod();
        let configEncoded = fs.readFileSync(this.configFilePath).toString('base64');
        let buildInfoEncoded = await this.getBuildInformation();
        let debugging = this.config.get('debugging') || (terminal_1.Terminal.hasFlag('--debug', '-d') ? 'true' : 'false');
        // Generate the bundle
        let bundle = this.getFilledTemplate({
            bitsArray, mainMethodName, configEncoded, buildInfoEncoded, debugging,
            author: this.config.get('author'),
            version: this.config.get('version'),
            year: (new Date()).getFullYear()
        });
        // Ensure the output directory exists
        mkdirp.sync(path.dirname(this.getOutputPath()));
        // Write the bundle file
        fs.writeFileSync(this.getOutputPath(), bundle);
        let stream = fs.createWriteStream(this.getOutputPath(), { flags: 'a' });
        // Append embedded files
        for (let file of await this.getEmbeddedFiles()) {
            if (file.data) {
                stream.write(file.data);
            }
            else {
                let reader = fs.createReadStream(file.path);
                await new Promise(resolve => {
                    reader.pipe(stream, { end: false });
                    reader.on('end', resolve);
                });
            }
        }
        stream.end();
    }
    /**
     * Returns information about the current build in base64 encoding.
     */
    async getBuildInformation() {
        return Buffer.from(JSON.stringify({
            built_at: Math.floor(new Date().getTime() / 1000),
            bits: this.bits.map(bit => bit.name),
            encoding: this.config.get('encoding'),
            fileCompression: this.config.get('file_compression'),
            files: (await this.getEmbeddedFiles()).map(file => {
                if (!fs.existsSync(file.path)) {
                    throw new user_error_1.UserError(`Cannot find embedded file: ${file.path}`);
                }
                file.data = fs.readFileSync(file.path);
                let size = file.data.length;
                let hash = md5(file.data);
                if (this.config.get('file_compression')) {
                    // Because compression is enabled, we need to compress it now to determine the final size
                    file.data = this.encodeFile(file.data);
                    size = file.data.length;
                }
                return { name: file.name, size, originalName: file.originalName, hash };
            })
        }, null, 4)).toString('base64');
    }
    /**
     * Returns a string containing autoloader bits in a PHP array.
     */
    async getBitsArray() {
        let bits = await this.getBits();
        let array = `array(\n`;
        bits.forEach(bit => {
            array += `            '${bit.name.toLowerCase()}' => '${bit.value}',\n`;
        });
        return array.replace(/,\n$/, '\n') + '        )';
    }
    /**
     * Returns an array of all autoloader bits.
     */
    async getBits() {
        if (!this.bits) {
            let namespaces = this.getNamespaces();
            this.bits = [];
            for (let i = 0; i < namespaces.length; i++) {
                (await namespaces[i].getBits()).forEach(bit => {
                    this.bits.push(bit);
                });
            }
        }
        return this.bits;
    }
    /**
     * Returns an array of all embedded files in the project.
     */
    async getEmbeddedFiles() {
        if (!this.embeddedFiles) {
            this.embeddedFiles = [];
            let configured = this.config.get('files');
            for (let name in configured) {
                let relativePath = configured[name];
                let realPath = path.resolve(this.directoryPath, relativePath);
                let stat = fs.statSync(realPath);
                if (stat.isFile()) {
                    this.embeddedFiles.push({
                        name,
                        originalName: relativePath,
                        path: realPath
                    });
                }
                else {
                    let files = (await this.getFilesRecursively(realPath)).map(file => {
                        let fileName = file.substring(realPath.length + 1);
                        let originalName = path.join(relativePath, fileName).replace(/\\/g, '/');
                        let innerName = path.join(name, fileName).replace(/\\/g, '/');
                        return {
                            name: innerName,
                            originalName,
                            path: file
                        };
                    });
                    files.forEach(file => {
                        this.embeddedFiles.push(file);
                    });
                }
            }
        }
        return this.embeddedFiles;
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
    /**
     * Returns an array of all namespaces in the project (will be cached on repeated invocations).
     */
    getNamespaces() {
        if (!this.namespaces) {
            this.namespaces = [];
            let mappedNamespaces = this.config.get('namespaces');
            // Add the Packr namespace
            this.namespaces.push(new namespace_1.Namespace(this, 'Packr\\', path.join(__dirname, '../static/Packr')));
            // Add namespaces from the configuration file
            for (let namespace in mappedNamespaces) {
                let namespaceName = namespace.replace(/\\$/g, '') + '\\';
                let namespacePath = path.join(this.directoryPath, mappedNamespaces[namespace]);
                this.namespaces.push(new namespace_1.Namespace(this, namespaceName, namespacePath));
            }
        }
        return this.namespaces;
    }
    /**
     * Encodes the given text with the project's configured encoding strategy.
     *
     * @param raw
     */
    encode(raw) {
        switch (this.config.get('encoding')) {
            case 'deflate': return zlib.deflateRawSync(raw).toString('base64');
            case 'base64': return Buffer.from(raw).toString('base64');
        }
    }
    /**
     * Encodes the data of an embedded file with the project's configured encoding strategy.
     *
     * @param raw
     */
    encodeFile(data) {
        switch (this.config.get('file_compression')) {
            case 'deflate': return zlib.deflateRawSync(data);
            default: return data;
        }
    }
    /**
     * Returns the contents of the bundle template after replacing the values given in the `values` object.
     *
     * @param values
     */
    getFilledTemplate(values) {
        let template = fs.readFileSync(path.join(__dirname, '../static/template.php')).toString().trim();
        for (let name in values) {
            template = template.replace(`\${${name}}`, values[name]);
        }
        return this.injectDecoder(template);
    }
    /**
     * Injects the decoder function into the template.
     *
     * @param template
     */
    injectDecoder(template) {
        let encoding = this.config.get('encoding');
        let decoder = fs.readFileSync(path.join(__dirname, '../static/decoder.' + encoding + '.php')).toString().trim();
        // Get rid of the <?php tag
        decoder = decoder.replace(/<\?php/, '').trim();
        // Inject
        return template.replace('/*${packr_decode}*/', decoder);
    }
    /**
     * Resolves the namespace of a file within a mapped namespace.
     *
     * @param mappedNamespace
     * @param mappedPath
     * @param filePath
     */
    resolveNamespace(mappedNamespace, mappedPath, filePath) {
        if (!filePath.startsWith(mappedPath))
            throw new Error('Mapped file path mismatch');
        let relativePath = filePath.substring(mappedPath.length);
        let className = relativePath.replace(/\.php$/i, '').replace('/', '\\');
        return (mappedNamespace + className).replace(/\\\\/g, '\\');
    }
    /**
     * Converts the given absolute path into a path relative to the project's root directory.
     *
     * @param absolutePath
     */
    getRelativePath(absolutePath) {
        if (absolutePath.startsWith(this.directoryPath)) {
            return absolutePath.substring(this.directoryPath.length + 1);
        }
        return absolutePath;
    }
    /**
     * Returns the main method of the project in the format `Path\To\Class::methodName`.
     */
    getMainMethod() {
        let className = this.config.get('main');
        if (className.indexOf('::') < 0)
            className += '::main';
        return className;
    }
    /**
     * Returns the absolute path to the output file.
     */
    getOutputPath() {
        return path.resolve(this.directoryPath, this.config.get('out'));
    }
    /**
     * Returns the absolute path to the config file.
     */
    getConfigPath() {
        return this.configFilePath;
    }
}
exports.Project = Project;
