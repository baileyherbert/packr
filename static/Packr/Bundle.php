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

    public static function getEncodingMode() {
        return self::getBuildInfo()->encoding;
    }

    public static function getCompressionMode() {
        return self::getBuildInfo()->fileCompression;
    }

    public static function getFileEncodingMode() {
        return self::getBuildInfo()->fileEncoding;
    }

    public static function getFile($name, $processor = null, $chunkSize = 4096) {
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

        // Disallow buffering when compression is enabled
        if (self::getCompressionMode() !== null && $processor !== null) {
            throw new Exception('Cannot buffer file "' . $name . '" because compression is enabled');
        }

        // Disallow buffering when encoding is enabled
        if (self::getFileEncodingMode() !== null && $processor !== null) {
            throw new Exception('Cannot buffer file "' . $name . '" because encoding is enabled');
        }

        // Use a default processor if one is not supplied
        $data = '';
        if (is_null($processor)) {
            $processor = function($chunk) use (&$data) {
                $data .= $chunk;
            };
        }

        // Open the bundle file for reading
        $handle = fopen(PACKR_BUNDLE_FILE, 'rb');
        if ($handle === false) throw new Exception('Failed to read embedded file (' . $name . '): Could not open the bundle for reading');

        // Seek to the proper position
        fseek($handle, PACKR_EMBED_OFFSET + $bytesBefore);
        $remaining = $bytes;

        // Read the embedded file into the processor
        while (!feof($handle) && $remaining > 0) {
            $size = min($chunkSize, $remaining);
            $chunk = fread($handle, $size);
            $remaining -= strlen($chunk);

            $processor($chunk);
        }

        // Decoding
        if (self::getFileEncodingMode() == 'base64') $data = @base64_decode($data);

        // Decompression
        $mode = static::getBuildInfo()->fileCompression;
        if ($mode == 'deflate') $data = @gzinflate($data);

        fclose($handle);
        return $data;
    }

    public static function checkFileIntegrity($name) {
        $content = self::getFile($name);
        $hash = md5($content);
        $entry = null;

        foreach (self::getBuildInfo()->files as $file) {
            if ($file->name == $name) {
                $entry = $file;
            }
        }

        if (is_null($entry)) {
            throw new Exception('Failed to check integrity of embedded file (' . $name . ') because its entry could not be found.');
        }

        return ($hash === $entry->hash);
    }

}
