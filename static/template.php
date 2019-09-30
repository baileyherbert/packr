<?php

/*

    Copyright © ${year} ${author}
    Version ${version}

    This source code bundle was generated by Packr, an open source utility that packages a full PHP application into
    a single executable file. For more information, see the repository: https://github.com/baileyherbert/packr

*/

define('PACKR_BUNDLE_FILE', __FILE__);
define('PACKR_EMBED_OFFSET', __COMPILER_HALT_OFFSET__);
define('PACKR_DEBUGGING', ${debugging});
define('PACKR_CONFIG', '${configEncoded}');
define('PACKR_BUILD', '${buildInfoEncoded}');

function packr_bits() {
    static $bits;

    if (is_null($bits)) {
        $bits = ${bitsArray};
    }

    return $bits;
}

/*${packr_decode}*/

spl_autoload_register(function ($className) {
    $className = strtolower($className);

    if (array_key_exists($className, packr_bits())) {
        eval(packr_decode(packr_bits()[$className]));
        return;
    }
});

if (ini_get('suhosin.executor.disable_eval')) {
    http_response_code(500);
    echo 'Packr: Cannot execute the bundle because eval() is disabled on the interpreter.';
    exit(1);
}

if (!function_exists('gzinflate')) {
    if (Packr\Bundle::getEncodingMode() == 'deflate' || Packr\Bundle::getCompressionMode() == 'deflate') {
        http_response_code(500);
        echo 'Packr: The zlib extension must be enabled to execute this bundle.';
        exit(1);
    }
}

Packr\Debugger::init();
${mainMethodName}();

__halt_compiler();
