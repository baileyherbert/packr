"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    author: {
        doc: 'The author of the bundled project, in no particular format.',
        format: String,
        default: 'None provided'
    },
    version: {
        doc: 'The version of the bundled project in the format x.x(.x)?.',
        format: String,
        default: '1.0.0'
    },
    main: {
        doc: 'The absolute name of the class, and optionally the method, to bootstrap.',
        format: (val) => {
            if (!/^((?:[\w_]+\\)*[\w_]+)(::[\w_]+)?$/.test(val)) {
                throw new Error('must be a valid class name');
            }
        },
        default: 'Application'
    },
    out: {
        doc: 'Relative or absolute path to the bundled output file.',
        format: String,
        default: 'bundle.packr.php'
    },
    namespaces: {
        doc: 'Namespaces and their source directories to include in the bundle for autoloading.',
        format: Object,
        default: {}
    },
    files: {
        doc: 'An object containing files to include in the bundle. The keys should be identifiers, and the value a relative path.',
        format: Object,
        default: {}
    }
};
