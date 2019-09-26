<?php

namespace Packr;

class Bundle {

    private static $config;
    private static $buildInfo;

    public static function getCompileTimestamp() {
        return self::getBuildInfo()->built_at;
    }

    public static function getAuthor() {
        return self::getConfig()['author'];
    }

    public static function getVersion() {
        return self::getConfig()['version'];
    }

    public static function getConfig() {
        if (is_null(self::$config)) {
            self::$config = json_decode(base64_decode(PACKR_CONFIG), true);

            if (!isset(self::$config['author'])) self::$config['author'] = 'None provided';
            if (!isset(self::$config['version'])) self::$config['version'] = '1.0.0';
        }

        return self::$config;
    }

    public static function getBuildInfo() {
        if (is_null(self::$buildInfo)) {
            self::$buildInfo = json_decode(base64_decode(PACKR_BUILD));
        }

        return self::$buildInfo;
    }

}
