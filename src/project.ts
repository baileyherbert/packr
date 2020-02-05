import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as zlib from 'zlib';
import * as recursive from 'recursive-readdir';
import * as md5 from 'md5';

import schema from './config/schema';
import { Namespace, Bit } from './namespace';
import { Terminal } from './terminal';
import { UserError } from './error/user-error';
import { config } from './config/config';
import { Composer } from './bundler/composer';

export class Project {

    private directoryPath : string;
    private configFilePath : string;
    private composerFilePath : string;

    private composer = false;
    private composerData ?: ComposerConfiguration;
    private composerReader ?: Composer;

    private config = config(schema);
    private bits : Bit[];
    private embeddedFiles : EmbeddedFile[];

    private namespaces: Namespace[];

    public constructor(private targetDirectory: string) {
        this.directoryPath = path.resolve(targetDirectory);
        this.configFilePath = path.join(this.directoryPath, 'packr.json');
        this.composerFilePath = path.join(this.directoryPath, 'composer.json');

        // Check that the cwd exists
        if (!fs.existsSync(this.directoryPath)) {
            throw new UserError('Directory does not exist: ' + this.directoryPath);
        }

        // Check if this is a composer project
        if (fs.existsSync(this.composerFilePath)) {
            this.composer = true;
        }

        // Check that we have a packr.json or composer.json file
        if (!fs.existsSync(this.configFilePath) && !this.composer) {
            throw new UserError('Packr project not found at ' + this.directoryPath);
        }

        // If we only have a composer.json file, make sure it has packr configuration in it
        else if (!fs.existsSync(this.configFilePath)) {
            let data = JSON.parse(fs.readFileSync(this.composerFilePath).toString());

            if (!('extra' in data) || typeof data.extra !== 'object' || !('packr' in data.extra)) {
                throw new UserError('Packr project not found at ' + this.directoryPath);
            }

            this.composerData = data;
        }

        // Finally, if we didn't load composer data, turn off the composer feature
        if (!this.composerData) {
            this.composer = false;
        }
    }

    /**
     * Loads the project's configuration and validates it.
     */
    public async load() {
        try {
            if (this.composer) {
                this.config.preload({
                    name: this.composerData.name,
                    version: this.composerData.version,
                    author: this.getAuthorString(this.composerData.authors),
                    namespaces: [],
                    ...this.composerData.extra.packr
                });
            }

            if (fs.existsSync(this.configFilePath)) {
                this.config.loadFile(this.configFilePath);
            }

            this.config.validate();
        }
        catch (error) {
            throw new UserError(error.message);
        }
    }

    /**
     * Generates and returns the contents of the bundled file as a string.
     */
    public async compile() {
        let bitsArray = await this.getBitsArray();
        let mainMethodName = this.getMainMethod();
        let configEncoded = this.config.toString('base64');
        let buildInfoEncoded = await this.getBuildInformation();
        let debugging = this.config.get('debugging') || (Terminal.hasFlag('--debug', '-d') ? 'true' : 'false');

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
    private async getBuildInformation() {
        let configFileEncoded = fs.existsSync(this.configFilePath) ? fs.readFileSync(this.configFilePath).toString() : null;
        let composerFileEncoded = this.composer ? fs.readFileSync(this.composerFilePath).toString() : null;

        return Buffer.from(JSON.stringify({
            built_at: Math.floor(new Date().getTime() / 1000),
            bits: this.bits.map(bit => bit.name),
            encoding: this.config.get('encoding'),
            features: {
                composer: this.composer,
            },
            fileCompression: this.config.get('file_compression'),
            fileEncoding: this.config.get('file_encoding'),
            files: (await this.getEmbeddedFiles()).map(file => {
                if (!fs.existsSync(file.path)) {
                    throw new UserError(`Cannot find embedded file: ${file.path}`);
                }

                file.data = fs.readFileSync(file.path);
                let size = file.data.length;
                let hash = md5(file.data);

                if (this.config.get('file_compression')) {
                    // Because compression is enabled, we need to compress it now to determine the final size
                    file.data = this.encodeFile(file.data);
                    size = file.data.length;
                }

                if (this.config.get('file_encoding') === 'base64') {
                    // Base64 encoding is enabled, so we must again encode it immediately to know the final size
                    file.data = Buffer.from(file.data!.toString('base64'));
                    size = file.data.length;
                }

                return { name: file.name, size, originalName: file.originalName, hash };
            }),
            configuration: {
                primary: configFileEncoded,
                composer: composerFileEncoded
            }
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
    public async getEmbeddedFiles() {
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
    private getFilesRecursively(path: string) {
        return new Promise<string[]>((resolve, reject) => {
            recursive(path, (err, files) => {
                if (err) return reject(err);
                resolve(files);
            });
        });
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

            // Add PSR-0 namespaces from composer
            let composer0 = this.getComposer().getNamespacesPsr0();
            for (let prefix in composer0) mappedNamespaces[prefix] = composer0[prefix];

            // Add PSR-4 namespaces from composer
            let composer4 = this.getComposer().getNamespacesPsr4();
            for (let prefix in composer4) mappedNamespaces[prefix] = composer4[prefix];

            // Add namespaces from the configuration file
            for (let namespace in mappedNamespaces) {
                let namespaceName = namespace.replace(/\\$/g, '') + (!namespace.endsWith('_') ? '\\' : '');
                let namespacePath = path.join(this.directoryPath, mappedNamespaces[namespace]);

                this.namespaces.push(new Namespace(this, namespaceName, namespacePath));
            }
        }

        return this.namespaces;
    }

    /**
     * Returns a `Composer` instance for reading the vendor.
     */
    protected getComposer() {
        if (!this.composerReader) {
            this.composerReader = new Composer(this.directoryPath);
        }

        return this.composerReader;
    }

    /**
     * Encodes the given text with the project's configured encoding strategy.
     *
     * @param raw
     */
    public encode(raw: string) {
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

        let prefix = mappedNamespace.substring(0, mappedNamespace.length - 1);
        let separator = mappedNamespace.substring(mappedNamespace.length - 1);
        let relativePath = filePath.substring(mappedPath.length);

        if (separator === '\\') {
            let className = relativePath.replace(/\.php$/i, '').replace('/', '\\');
            return (mappedNamespace + className).replace(/\\\\/g, '\\');
        }
        else if (separator === '_') {
            relativePath = relativePath.replace(/\.php$/i, '').replace('/', '\\');

            while (relativePath.startsWith('\\')) {
                relativePath = relativePath.substring(1);
            }

            if (relativePath.startsWith(prefix + '\\')) {
                return prefix + '_' + relativePath.substring(prefix.length + 1).replace(/\\/g, '_');
            }
        }

        throw new Error(`Could not calculate namespace for ${relativePath} (separator: '${separator}')`);
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

    /**
     * Returns the first author as a string from a composer-style author array.
     * @param authors
     */
    private getAuthorString(authors: { name ?: string; email ?: string; }[]) {
        if (Array.isArray(authors)) {
            if (authors.length > 0) {
                let author = authors[0];

                if (typeof author === 'object' && 'name' in author) {
                    return author.name + ('email' in author ? ` <${author.email}>` : '');
                }
            }
        }
        else if (typeof authors === 'string') {
            return authors;
        }
    }

}

export type EmbeddedFile = {
    name: string;
    originalName: string;
    path: string;
    data ?: Buffer;
};

export type ComposerConfiguration = {
    name ?: string;
    description ?: string;
    version ?: string;
    authors ?: { name ?: string; email ?: string; }[];
    license ?: string;
    extra ?: any;
};
