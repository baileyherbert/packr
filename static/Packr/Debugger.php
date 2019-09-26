<?php

namespace Packr;

class Debugger {

    public static function init() {
        if (PACKR_DEBUGGING) {
            error_reporting(E_ALL);
            ini_set('display_errors', 'On');
            ini_set('log_errors', 0);
        }
        else {
            ini_set('display_errors', 'Off');
        }
    }

}
