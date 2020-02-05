import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { UserError } from '../error/user-error';

// Regex
let configRegex = /define\('PACKR_CONFIG', '([^']+)'\);/;
let buildInfoRegex = /define\('PACKR_BUILD', '([^']+)'\);/;

export async function info(args: string[]) {
    if (!args[0]) return console.log('Usage: packr info <file>');

    let targetFile = path.resolve(process.cwd(), args[0]);

    if (!fs.existsSync(targetFile)) {
        throw new UserError(`Could not find a bundle file at ${targetFile}`);
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

        if (buffer.indexOf('function packr_bits()') > 0) {
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

    // Make sure this file is a Packr bundle
    if (!configMatch || !buildInfoMatch) {
        throw new UserError(`The target file is not a Packr bundle: ${targetFile}`);
    }

    // Extract the config file
    let configFileText = Buffer.from(configMatch[1], 'base64').toString();
    let config = JSON.parse(configFileText);

    // Read build info
    let buildInfoText = Buffer.from(buildInfoMatch[1], 'base64').toString();
    let buildInfo = JSON.parse(buildInfoText);

    // Extract all available information from the file
    let version = config.version || '1.0.0';
    let author = config.author || 'Unknown';
    let fileCompressionMode = buildInfo.fileCompression;
    let fileEncodingMode = buildInfo.fileEncoding;
    let encodingMode = buildInfo.encoding;
    let builtAt = new Date(buildInfo.built_at * 1000);
    let numberBits : number = buildInfo.bits.length;
    let files: { name: string; size: number; originalFileName: string; }[] = [];

    // Calculate the number of standard and user bits
    // A standard bit is a built-in Packr bit that is always integrated in the bundles
    let standardBits = numberBits;
    numberBits -= buildInfo.bits.filter(bit => bit.startsWith('Packr\\')).length;
    standardBits = standardBits - numberBits;

    // Get files along with their sizes
    buildInfo.files.forEach(file => {
        let name = file.name;
        let size = file.size;
        let originalFileName = file.originalName || path.basename(config.files[name]);

        files.push({
            name, size, originalFileName
        });
    });

    // Print the file name
    console.log('Reading:', path.basename(targetFile));
    console.log();

    // Bundle details (timestamp, version, author)
    drawHeader('Bundle details');
    drawValue('Timestamp', builtAt.toLocaleString());
    drawValue('Version', version);
    drawValue('Author', author);
    console.log();

    // Storage (# classes, encoding, compression)
    drawHeader('Storage');
    drawValue('Classes', `${numberBits.toLocaleString()} user (+${standardBits} integrated)`);
    drawValue('Encoding', encodingMode + (encodingMode !== 'base64' ? ', base64' : ''));
    drawValue('Compression', fileCompressionMode || 'disabled');
    drawValue('File encoding', fileEncodingMode || 'disabled');
    console.log();

    // Embedded files
    drawHeader('Embedded files');
    files.forEach(file => {
        let size = getFileSize(file.size);
        console.log(
            chalk.green(`${file.originalFileName}`),
            ' '.repeat(Math.max(0, 67 - (file.originalFileName.length + size.length))),
            size
        );
    });

    // Show "none" if there are no files in the bundle
    if (!files.length) {
        console.log('None.');
    }
}

function drawHeader(title: string) {
    console.log('-- %s %s', title, '-'.repeat(65 - title.length));
}

function drawValue(name: string, value: string | number) {
    console.log(chalk.green(name + ': ') + ' '.repeat(15 - name.length), value);
}

function getFileSize(bytes: number) {
    if (bytes >= 1024 * 512) return (Math.ceil(100 * (bytes / 1048576)) / 100) + ' MiB';
    if (bytes >= 1024) return (Math.ceil(100 * (bytes / 1024)) / 100) + ' KiB';
    return bytes + ' B';
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
