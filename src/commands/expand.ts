import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
import * as zlib from 'zlib';
import chalk from 'chalk';
import { UserError } from '../error/user-error';
import { Terminal } from '../terminal';

// Regex
let configRegex = /define\('PACKR_CONFIG', '([^']+)'\);/;
let buildInfoRegex = /define\('PACKR_BUILD', '([^']+)'\);/;
let bitsArrayRegex = /\$bits = array\(\r?\n([^)]+)\);/;

export async function expand(args: string[]) {
    if (!args[0]) return console.log('Usage: packr expand <file>');

    let targetFile = path.resolve(process.cwd(), args[0]);
    let outputDir = path.resolve(process.cwd(), args[1] || '.');

    if (!fs.existsSync(targetFile)) {
        throw new UserError(`Could not find a bundle file at ${targetFile}`);
    }

    // Check if the output directory already contains files
    if (!Terminal.hasFlag('force', 'f') && fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
        throw new UserError(`Output directory is not empty (use --force to overwrite): ${outputDir}`);
    }

    // Read the file
    let contents : string | undefined;
    let buffer = Buffer.alloc(0);
    let file = await openFile(targetFile, 'r');
    let remaining = fs.statSync(targetFile).size;
    let step = 4096;

    while (remaining > 0) {
        let portion = Math.min(step, remaining);
        let chunk = await readFile(file, null, portion);
        buffer = Buffer.concat([buffer, chunk]);

        if (buffer.indexOf('__halt_compiler();') > 0) {
            contents = buffer.toString();
            break;
        }
    }

    if (!contents) {
        throw new UserError(`The target file is not a Packr bundle: ${targetFile}`);
    }

    // Match expressions
    let configMatch = contents.match(configRegex);
    let buildInfoMatch = contents.match(buildInfoRegex);
    let bitsArrayMatch = contents.match(bitsArrayRegex);

    // Make sure this file is a Packr bundle
    if (!configMatch || !buildInfoMatch || !bitsArrayMatch) {
        throw new UserError(`The target file is not a Packr bundle: ${targetFile}`);
    }

    // Create the output directory
    mkdirp.sync(outputDir);

    // Extract the config file
    let configFileText = Buffer.from(configMatch[1], 'base64').toString();
    let config = JSON.parse(configFileText);
    fs.writeFileSync(path.join(outputDir, 'packr.json'), configFileText);

    // Read namespaces
    let namespaces = {};
    if ('namespaces' in config) {
        for (let namespaceName in config.namespaces) {
            let namespace = (namespaceName.replace(/\\$/, '') + '\\').toLowerCase();
            let namespacePath = path.resolve(outputDir, config.namespaces[namespaceName]);
            namespaces[namespace] = namespacePath;
        }
    }

    // Read build info
    let buildInfoText = Buffer.from(buildInfoMatch[1], 'base64').toString();
    let buildInfo = JSON.parse(buildInfoText);
    let bitEncodingMode : ('base64' | 'deflate') = buildInfo.encoding;
    let fileCompressionMode : ('deflate' | null) = buildInfo.fileCompression;
    let fileEncoding : ('base64' | null) = buildInfo.fileEncoding;

    // Parse bits
    let bitsLines = bitsArrayMatch[1].trim().split(/\n+/);
    bitsLines.forEach(line => {
        let match = line.trim().match(/\s*'([^']+)'\s+=>\s+'([^']+)'\s*,?\s*/);
        if (match) {
            let namespacePath = match[1];
            let encoded = match[2];

            for (let prefix in namespaces) {
                if (namespacePath.startsWith(prefix)) {
                    for (let i = 0; i < buildInfo.bits.length; i++) {
                        let bitPath = buildInfo.bits[i];

                        if (bitPath.toLowerCase() == namespacePath) {
                            let filePath = path.join(namespaces[prefix], bitPath.substring(prefix.length) + '.php');
                            let fileDirPath = path.dirname(filePath);
                            let fileData = Buffer.from(encoded, 'base64');
                            let originalSize = fileData.length;

                            if (bitEncodingMode == 'deflate') fileData = zlib.inflateRawSync(fileData);

                            let expandedPercent = Math.floor(((fileData.length - originalSize) / originalSize) * 100 + 0.5);
                            let stamp = (expandedPercent > 0 ? `(inflated ${expandedPercent}%)` : '');

                            mkdirp.sync(fileDirPath);
                            fs.writeFileSync(filePath, '<?php\n\n' + fileData.toString());
                            console.log(chalk.green('+ Restored:'), getShortPath(outputDir, filePath), stamp);

                            break;
                        }
                    }

                    break;
                }
            }
        }
    });

    // Get information on embedded files
    let embedded : EmbeddedFileDescriptor[] = [];
    let offset = 0;
    buildInfo.files.forEach((file: EmbeddedFileRecord) => {
        if (!file.originalName) {
            if (typeof config.files === 'object' && file.name in config.files) {
                file.originalName = config.files[file.name];
            }
            else {
                console.log(chalk.red('> Error:'), 'Failed to restore embedded file (could not determine path):', file.originalName);
                return;
            }
        }

        embedded.push({
            name: file.name,
            size: file.size,
            extractPath: path.resolve(outputDir, file.originalName),
            offset
        });

        offset += file.size;
    });

    // If we have any embedded files, let's find the start position
    if (embedded.length > 0) {
        let handle = await openFile(targetFile, 'r');
        let startOffset = contents.indexOf('__halt_compiler();') + 19;

        for (let file of embedded) {
            let start = startOffset + file.offset;
            let remaining = file.size;
            let chunkSize = 8192;

            mkdirp.sync(path.dirname(file.extractPath));
            let outputHandle = await openFile(file.extractPath, 'w');

            while (remaining > 0) {
                let size = Math.min(chunkSize, remaining);
                let chunk = await readFile(handle, start, size);
                await writeFile(outputHandle, chunk);

                start += size;
                remaining -= size;
            }

            fs.close(outputHandle, (err) => {});

            let originalSize = fs.statSync(file.extractPath).size;
            let expandedSize = originalSize;

            if (fileEncoding == 'base64') {
                let decoded = Buffer.from(fs.readFileSync(file.extractPath).toString(), 'base64').toString('binary');
                fs.writeFileSync(file.extractPath, decoded, { encoding: 'binary' });
                expandedSize = fs.statSync(file.extractPath).size;
            }

            if (fileCompressionMode == 'deflate') {
                fs.writeFileSync(file.extractPath, zlib.inflateRawSync(fs.readFileSync(file.extractPath)));
                expandedSize = fs.statSync(file.extractPath).size;
            }

            let expandedPercent = Math.floor(((expandedSize - originalSize) / originalSize) * 100 + 0.5);
            let stamp = (expandedPercent > 0 ? `(inflated ${expandedPercent}%)` : '');

            console.log(chalk.cyan('+ Extracted:'), getShortPath(outputDir, file.extractPath), stamp);
        };

        fs.close(handle, (err) => {});
    }

    console.log('Finished expanding files.');
}

function openFile(targetFile: string, flags: string) : Promise<number> {
    return new Promise((resolve, reject) => {
        fs.open(targetFile, flags, (err, fd) => {
            if (err) return reject(err);
            resolve(fd);
        });
    });
}

function readFile(file: number, start: number, length: number) : Promise<Buffer> {
    return new Promise((resolve, reject) => {
        fs.read(file, Buffer.alloc(length), 0, length, start, (err, _, buffer) => {
            if (err) return reject(err);
            resolve(buffer);
        });
    });
}

function writeFile(file: number, buffer: Buffer) : Promise<void> {
    return new Promise((resolve, reject) => {
        fs.write(file, buffer, (err, _, buffer) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function getShortPath(parent: string, child: string) {
    if (child.startsWith(parent)) {
        return child.substring(parent.length + 1);
    }

    return child;
}

type EmbeddedFileRecord = { name: string; size: number; originalName: string; hash: string; };
type EmbeddedFileDescriptor = { name: string; extractPath: string; size: number; offset: number; };
