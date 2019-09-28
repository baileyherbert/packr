"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const zlib = require("zlib");
const chalk_1 = require("chalk");
const user_error_1 = require("../error/user-error");
const terminal_1 = require("../terminal");
// Regex
let configRegex = /define\('PACKR_CONFIG', '([^']+)'\);/;
let buildInfoRegex = /define\('PACKR_BUILD', '([^']+)'\);/;
let bitsArrayRegex = /\$bits = array\(\r?\n([^)]+)\);/;
async function expand(args) {
    if (!args[0])
        return console.log('Usage: packr expand <file>');
    let targetFile = path.resolve(process.cwd(), args[0]);
    let outputDir = path.resolve(process.cwd(), args[1] || '.');
    if (!fs.existsSync(targetFile)) {
        throw new user_error_1.UserError(`Could not find a bundle file at ${targetFile}`);
    }
    // Check if the output directory already contains files
    if (!terminal_1.Terminal.hasFlag('force', 'f') && fs.existsSync(outputDir) && fs.readdirSync(outputDir).length > 0) {
        throw new user_error_1.UserError(`Output directory is not empty (use --force to overwrite): ${outputDir}`);
    }
    // Read the file
    let contents;
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
        throw new user_error_1.UserError(`The target file is not a Packr bundle: ${targetFile}`);
    }
    // Match expressions
    let configMatch = contents.match(configRegex);
    let buildInfoMatch = contents.match(buildInfoRegex);
    let bitsArrayMatch = contents.match(bitsArrayRegex);
    // Make sure this file is a Packr bundle
    if (!configMatch || !buildInfoMatch || !bitsArrayMatch) {
        throw new user_error_1.UserError(`The target file is not a Packr bundle: ${targetFile}`);
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
    let bitEncodingMode = buildInfo.encoding;
    let fileCompressionMode = buildInfo.fileCompression;
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
                            if (bitEncodingMode == 'deflate')
                                fileData = zlib.inflateRawSync(fileData);
                            let expandedPercent = Math.floor(((fileData.length - originalSize) / originalSize) * 100 + 0.5);
                            let stamp = (expandedPercent > 0 ? `(inflated ${expandedPercent}%)` : '');
                            mkdirp.sync(fileDirPath);
                            fs.writeFileSync(filePath, '<?php\n\n' + fileData.toString());
                            console.log(chalk_1.default.green('+ Restored:'), filePath, stamp);
                            break;
                        }
                    }
                    break;
                }
            }
        }
    });
    // Get information on embedded files
    let embedded = [];
    let offset = 0;
    buildInfo.files.forEach((file) => {
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
            fs.close(outputHandle, (err) => { });
            let originalSize = fs.statSync(file.extractPath).size;
            let expandedSize = originalSize;
            if (fileCompressionMode == 'deflate') {
                fs.writeFileSync(file.extractPath, zlib.inflateRawSync(fs.readFileSync(file.extractPath)));
                expandedSize = fs.statSync(file.extractPath).size;
            }
            let expandedPercent = Math.floor(((expandedSize - originalSize) / originalSize) * 100 + 0.5);
            let stamp = (expandedPercent > 0 ? `(inflated ${expandedPercent}%)` : '');
            console.log(chalk_1.default.cyan('+ Extracted:'), file.extractPath, stamp);
        }
        ;
        fs.close(handle, (err) => { });
    }
    console.log('Finished expanding files.');
}
exports.expand = expand;
function openFile(targetFile, flags) {
    return new Promise((resolve, reject) => {
        fs.open(targetFile, flags, (err, fd) => {
            if (err)
                return reject(err);
            resolve(fd);
        });
    });
}
function readFile(file, start, length) {
    return new Promise((resolve, reject) => {
        fs.read(file, Buffer.alloc(length), 0, length, start, (err, _, buffer) => {
            if (err)
                return reject(err);
            resolve(buffer);
        });
    });
}
function writeFile(file, buffer) {
    return new Promise((resolve, reject) => {
        fs.write(file, buffer, (err, _, buffer) => {
            if (err)
                return reject(err);
            resolve();
        });
    });
}
