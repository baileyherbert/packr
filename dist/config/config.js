"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class ConfigurationStore {
    constructor(schema) {
        this.schema = schema;
    }
    loadFile(path) {
        let config;
        try {
            config = JSON.parse(fs.readFileSync(path).toString());
        }
        catch (error) {
            throw new Error(`Error parsing configuration file: ${path}`);
        }
        if (typeof config !== 'object') {
            throw new Error(`Configuration file (${config}) must be an object`);
        }
        this.config = config;
    }
    validate() {
        for (let propName in this.schema) {
            let { format, required } = this.schema[propName];
            let value = this.config[propName];
            if (typeof value == 'undefined') {
                if (required) {
                    throw new Error(`Missing required configuration option "${propName}"`);
                }
                continue;
            }
            let types = {
                'object': Object,
                'number': Number,
                'string': String,
                'boolean': Boolean
            };
            for (let type in types) {
                let fn = types[type];
                if (format === fn && typeof value !== type) {
                    throw new Error(`Configuration option "${propName}" should be type ${type}, got ${typeof value}`);
                }
            }
            if (format instanceof RegExp) {
                if (typeof value !== 'string') {
                    throw new Error(`Configuration option "${propName}" should be type string, got ${typeof value}`);
                }
                if (!format.test(value)) {
                    throw new Error(`Configuration option "${propName}" must match: ${format.toString()}`);
                }
            }
            if (typeof format == 'function' && Object.values(types).indexOf(format) < 0) {
                try {
                    format(value);
                }
                catch (error) {
                    throw new Error(`Configuration option "${propName}" ${error.message}`);
                }
            }
        }
    }
    get(name) {
        if (name in this.config) {
            return this.config[name];
        }
        return this.schema[name].default;
    }
}
exports.ConfigurationStore = ConfigurationStore;
function config(schema) {
    return new ConfigurationStore(schema);
}
exports.config = config;
