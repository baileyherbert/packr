"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    author: {
        format: String,
        default: 'Unknown'
    },
    version: {
        format: String,
        default: '1.0.0'
    },
    main: {
        format: (val) => {
            if (!/^((?:[\w_]+\\)*[\w_]+)(::[\w_]+)?$/.test(val)) {
                throw new Error('must be a valid class name');
            }
        },
        default: 'App\\Application'
    },
    out: {
        format: String,
        default: 'bundle.packr.php'
    },
    namespaces: {
        format: Object,
        default: {},
        required: true
    },
    files: {
        format: Object,
        default: {}
    },
    encoding: {
        format: ['deflate', 'base64'],
        default: 'deflate'
    },
    file_compression: {
        format: (val) => {
            if (val !== 'deflate' && val !== null) {
                throw new Error('must be one of: deflate, or null');
            }
        },
        default: null
    }
};
