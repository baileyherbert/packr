<?php

/*

    Packr
    https://github.com/baileyherbert/packr

    [About this file]
    This is a bundle generated by the Packr command line tool. It contains multiple source files which have been
    consolidated for execution through a single file.

    [Source code]
    The code inside this bundle is not encrypted. However, you will need to expand the bundle before you can view the
    source code within it. You can use an online expansion tool such as https://bailey.sh/tools/packr-expander/ to
    convert this bundle file back into the original source files.

    [Modification]
    Please do not modify this file directly. These bundles often contain raw binary, which will usually become corrupted
    when saved through a code editor.

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

spl_autoload_register(function ($className) {
    $className = strtolower($className);

    if (array_key_exists($className, packr_bits())) {
        eval(base64_decode(packr_bits()[$className]));
        return;
    }
});

if (ini_get('suhosin.executor.disable_eval')) {
    echo 'Packr: Cannot execute the bundle because eval() is disabled on the interpreter.';
    exit(1);
}

Packr\Debugger::init();
${mainMethodName}();

__halt_compiler();
