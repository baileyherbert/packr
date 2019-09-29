export default {

    author: {
        format: String,
        default: 'Unknown'
    },
    version: {
        format: String,
        default: '1.0.0'
    },
    main: {
        format: (val: string) => {
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
        default: <{ [namespace: string]: string }> {},
        required: true
    },
    files: {
        format: Object,
        default: <{ [namespace: string]: string }> {}
    },
    encoding: {
        format: ['deflate', 'base64'],
        default: <'deflate' | 'base64'> 'deflate'
    },
    file_compression: {
        format: (val: string) => {
            if (val !== 'deflate' && val !== null) {
                throw new Error('must be one of: deflate, or null');
            }
        },
        default: <'deflate' | null> null
    }

};
