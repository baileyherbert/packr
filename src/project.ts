import * as path from 'path';
import * as fs from 'fs';
import * as convict from 'convict';
import * as mkdirp from 'mkdirp';
import * as zlib from 'zlib';

import schema from './config/schema';
import { Namespace, Bit } from './namespace';
import { Terminal } from './terminal';
import { UserError } from './error/user-error';

export class Project {

    private directoryPath : string;
    private configFilePath : string;
    private config = convict(schema);
    private bits : Bit[];
    private embeddedFiles : EmbeddedFile[];

    private namespaces: Namespace[];

    public constructor(private targetDirectory: string) {
        this.directoryPath = path.resolve(targetDirectory);
        this.configFilePath = path.join(this.directoryPath, 'packr.json');

        // Check that the cwd exists
        if (!fs.existsSync(this.directoryPath)) {
            throw new UserError('Directory does not exist: ' + this.directoryPath);
        }

        // Check for the packr.json file
        if (!fs.existsSync(this.configFilePath)) {
            throw new UserError('Packr project not found at ' + this.directoryPath);
        }
    }

    /**
     * Loads the project's configuration and validates it.
     */
    public async load() {
        this.config.loadFile(this.configFilePath);
        this.config.validate();
    }

    /**
     * Generates and returns the contents of the bundled file as a string.
     */
    public async compile() {
        let bitsArray = await this.getBitsArray();
        let mainMethodName = this.getMainMethod();
        let configEncoded = fs.readFileSync(this.configFilePath).toString('base64');
        let buildInfoEncoded =  this.getBuildInformation();
        let debugging = Terminal.hasFlag('--debug', '-d') ? 'true' : 'false';

        // Generate the bundle
        let bundle = this.getFilledTemplate({
            bitsArray, mainMethodName, configEncoded, buildInfoEncoded, debugging
        });

        // Ensure the output directory exists
        mkdirp.sync(path.dirname(this.getOutputPath()));

        // Write the bundle file
        fs.writeFileSync(this.getOutputPath(), bundle);
        let stream = fs.createWriteStream(this.getOutputPath(), { flags: 'a' });

        // Append embedded files
        for (let file of this.getEmbeddedFiles()) {
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
    private getBuildInformation() {
        return Buffer.from(JSON.stringify({
            built_at: Math.floor(new Date().getTime() / 1000),
            bits: this.bits.map(bit => bit.name),
            encoding: this.config.get('encoding'),
            fileCompression: this.config.get('file_compression'),
            files: this.getEmbeddedFiles().map(file => {
                if (!fs.existsSync(file.path)) {
                    throw new UserError(`Cannot find embedded file: ${file.path}`);
                }

                let size : number;

                if (this.config.get('file_compression')) {
                    // Because compression is enabled, we need to read the file and compress it now
                    let data = file.data = this.encodeFile(fs.readFileSync(file.path));
                    size = data.length;
                }
                else {
                    size = fs.statSync(file.path).size;
                }

                return { name: file.name, size };
            })
        }, null, 4)).toString('base64');
    }

    /**
     * Returns a string containing autoloader bits in a PHP array.
     */
    private async getBitsArray() {
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
    private async getBits() {
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
    public getEmbeddedFiles() {
        if (!this.embeddedFiles) {
            this.embeddedFiles = [];
            let configured = this.config.get('files');

            for (let name in configured) {
                let relativePath = configured[name];
                let realPath = path.resolve(this.directoryPath, relativePath);

                this.embeddedFiles.push({
                    name,
                    originalName: relativePath,
                    path: realPath
                });
            }
        }

        return this.embeddedFiles;
    }

    /**
     * Returns an array of all namespaces in the project (will be cached on repeated invocations).
     */
    public getNamespaces() {
        if (!this.namespaces) {
            this.namespaces = [];
            let mappedNamespaces = this.config.get('namespaces');

            // Add the Packr namespace
            this.namespaces.push(new Namespace(this, 'Packr\\', path.join(__dirname, '../static/Packr')));

            // Add namespaces from the configuration file
            for (let namespace in mappedNamespaces) {
                let namespaceName = namespace.replace(/\\$/g, '') + '\\';
                let namespacePath = path.join(this.directoryPath, mappedNamespaces[namespace]);

                this.namespaces.push(new Namespace(this, namespaceName, namespacePath));
            }
        }

        return this.namespaces;
    }

    /**
     * Encodes the given text with the project's configured encoding strategy.
     *
     * @param raw
     */
    public encode(raw: string) {
        switch (this.config.get('encoding')) {
            case 'deflate': return zlib.deflateRawSync(raw).toString('base64');
            case 'gzip': return zlib.gzipSync(raw).toString('base64');
            case 'base64': return Buffer.from(raw).toString('base64');
        }
    }

    /**
     * Encodes the data of an embedded file with the project's configured encoding strategy.
     *
     * @param raw
     */
    public encodeFile(data: Buffer) {
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
    private getFilledTemplate(values: Object) {
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
    private injectDecoder(template: string) {
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
    public resolveNamespace(mappedNamespace: string, mappedPath: string, filePath: string) {
        if (!filePath.startsWith(mappedPath)) throw new Error('Mapped file path mismatch');

        let relativePath = filePath.substring(mappedPath.length);
        let className = relativePath.replace(/\.php$/i, '').replace('/', '\\');

        return (mappedNamespace + className).replace(/\\\\/g, '\\');
    }

    /**
     * Converts the given absolute path into a path relative to the project's root directory.
     *
     * @param absolutePath
     */
    public getRelativePath(absolutePath: string) {
        if (absolutePath.startsWith(this.directoryPath)) {
            return absolutePath.substring(this.directoryPath.length + 1);
        }

        return absolutePath;
    }

    /**
     * Returns the main method of the project in the format `Path\To\Class::methodName`.
     */
    public getMainMethod() {
        let className = this.config.get('main');
        if (className.indexOf('::') < 0) className += '::main';

        return className;
    }

    /**
     * Returns the absolute path to the output file.
     */
    public getOutputPath() {
        return path.resolve(this.directoryPath, this.config.get('out'));
    }

    /**
     * Returns the absolute path to the config file.
     */
    public getConfigPath() {
        return this.configFilePath;
    }

}

export type EmbeddedFile = {
    name: string;
    originalName: string;
    path: string;
    data ?: Buffer;
};
