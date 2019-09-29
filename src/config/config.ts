import * as fs from 'fs';

export class ConfigurationStore<T> {
    private config: { [P in keyof T]: T[P] };

    public constructor(private schema: Schema<T>) {

    }

    public loadFile(path: string) {
        let config : any;

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

    public validate() {
        for (let propName in this.schema) {
            let { format, required } = this.schema[propName];
            let value : SchemaFormatType | undefined = this.config[propName];

            if (typeof value == 'undefined' && required) {
                throw new Error(`Missing required configuration option "${propName}"`);
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

            if (typeof format == 'function' && Object.values(types).indexOf(format as any) < 0) {
                try {
                    format(value);
                }
                catch (error) {
                    throw new Error(`Configuration option "${propName}" ${error.message}`);
                }
            }
        }
    }

    public get<K extends keyof T>(name: K): T[K] {
        if (name in this.config) {
            return this.config[name];
        }

        return this.schema[name].default;
    }
}

export function config<T>(schema: Schema<T>): ConfigurationStore<T> {
    return new ConfigurationStore<T>(schema);
}

type Schema<T> = {
    [P in keyof T]: SchemaDefinition<T[P]>
}

interface SchemaDefinition<T = any> {
    default: T;
    format ?: SchemaFormatType;
    required ?: boolean;
}

type SchemaFormatType = String | Object | Number | Boolean | RegExp | any[] | ((val: any) => void);
