<?php

namespace Packr;

use Exception;

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

    public static function getFile($name, $processor = null) {
        // Check that the file exists
        $original = self::getBuildInfo()->files;
        $files = [];
        foreach ($original as $file) $files[($file->name)] = $file;
        if (!isset($files[$name])) throw new Exception('Failed to read embedded file (' . $name . '): No such file found in the bundle');

        // Get the number of bytes before the file
        $bytesBefore = 0;
        foreach ($files as $fileName => $file) {
            if ($name !== $fileName) $bytesBefore += $file->size;
            else break;
        }

        // Get the size (in bytes) of the file
        $bytes = $files[$name]->size;

        // Use a default processor if one is not supplied
        $data = '';
        if (is_null($processor)) {
            $processor = function($chunk) use (&$data) {
                $data .= $chunk;
            };
        }

        // Buffer through the bundle until we get to the start of embedded files
        $handle = fopen(PACKR_BUNDLE_FILE, 'rb');
        if ($handle === false) throw new Exception('Failed to read embedded file (' . $name . '): Could not open the bundle for reading');

        $contents = '';
        $prechunk = null;
        $index = 0;
        $offset = null;

        while (!feof($handle)) {
            $contents .= fread($handle, 1024);

            if (strlen($contents) > 2048) $contents = substr($contents, strlen($contents) - 2048);
            if (($pos = strpos($contents, '__halt_compiler();;;')) !== false) {
                $offset = $index + $pos + 21;
                $prechunk = substr($contents, $pos + 21);
                break;
            }

            $index += strlen($contents);
        }

        // Buffer through until we find our file
        $relativeIndex = 0;
        while (!feof($handle)) {
            $chunk = fread($handle, 2048);
            if (!is_null($prechunk)) {
                $chunk = $prechunk . $chunk;
                $prechunk = null;
            }

            // Check if the file starts in the current chunk
            $limit = $relativeIndex + strlen($chunk);
            if ($bytesBefore <= $limit) {
                $prechunk = substr($chunk, $bytesBefore - $relativeIndex);
                break;
            }

            $relativeIndex += strlen($chunk);
        }

        // Buffer the rest of the file
        $index = $bytesBefore;
        $lastIndex = $bytesBefore + $bytes;
        if (feof($handle)) {
            $chunk = $prechunk;

            // Check if the file ends in this chunk
            $limit = $index + strlen($chunk);
            if ($lastIndex <= $limit) {
                $chunk = substr($chunk, 0, $lastIndex - $index);
            }

            // Send the chunk
            if (strlen($chunk) > 0) {
                $processor($chunk);
            }
        }
        else {
            while (!feof($handle)) {
                $chunk = fread($handle, 2048);
                $halt = false;

                if (!is_null($prechunk)) {
                    $chunk = $prechunk . $chunk;
                    $prechunk = null;
                }

                // Check if the file ends in this chunk
                $limit = $index + strlen($chunk);
                if ($lastIndex <= $limit) {
                    $chunk = substr($chunk, 0, $lastIndex - $index);
                    $halt = true;
                }

                // Send the chunk
                if (strlen($chunk) > 0) {
                    $processor($chunk);
                }
                if ($halt) break;

                $index += strlen($chunk);
            }
        }

        fclose($handle);
        return $data;
    }

}
