import * as fs from 'fs';
import * as path from 'path';
import * as mkdirp from 'mkdirp';
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
    let contents = fs.readFileSync(targetFile).toString();

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

                            mkdirp.sync(fileDirPath);
                            fs.writeFileSync(filePath, '<?php\n\n' + Buffer.from(encoded, 'base64').toString());
                            console.log(chalk.green('+ Restored:'), filePath);

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
        embedded.push({
            name: file.name,
            size: file.size,
            extractPath: path.resolve(outputDir, config.files[file.name]),
            offset,
        });

        offset += file.size;
    });

    // If we have any embedded files, let's find the start position
    if (embedded.length > 0) {
        let handle = await openFile(targetFile, 'r');
        let startOffset = contents.indexOf('__halt_compiler();') + 18;

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

            console.log(chalk.cyan('+ Extracted:'), file.extractPath);
        };
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

type EmbeddedFileRecord = { name: string; size: number; };
type EmbeddedFileDescriptor = { name: string; extractPath: string; size: number; offset: number; };
