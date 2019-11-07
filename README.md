[![Packr](https://i.bailey.sh/MMvFGSN.png)](https://github.com/baileyherbert/packr)

<p align="center">
  <a aria-label="Build" href="https://travis-ci.org/baileyherbert/packr">
    <img alt="" src="https://img.shields.io/travis/baileyherbert/packr?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@baileyherbert/packr">
    <img alt="" src="https://img.shields.io/npm/v/@baileyherbert/packr.svg?style=for-the-badge&labelColor=000000">
  </a>
  <a aria-label="License" href="https://github.com/baileyherbert/packr/blob/master/LICENSE">
    <img alt="" src="https://img.shields.io/npm/l/@baileyherbert/packr.svg?style=for-the-badge&labelColor=000000">
  </a>
</p>

---

Packr is a command line tool that bundles a PHP project into a single file, along with its dependencies, assets, and any other necessary files. The bundled file can be used like any other PHP script, including through the command line and on a web server. Internally, source code is loaded through autoloading which can be customized, or inferred from Composer.

---

- [Introduction](#introduction)
    - [Installation](#installation)
    - [Server requirements](#server-requirements)
    - [Planned features](#planned-features)
- [Getting started](#getting-started)
    - [Creating a project](#creating-a-project)
    - [Application class](#application-class)
- [Command line tool](#command-line-tool)
    - [Build a bundle](#build-a-bundle)
    - [Build a bundle and watch for changes](#build-a-bundle-and-watch-for-changes)
    - [Expand a bundle](#expand-a-bundle)
    - [Get info about a bundle](#get-info-about-a-bundle)
- [Configuration](#configuration)
    - [Basic template](#basic-template)
    - [Available options](#available-options)
    - [Namespaces](#namespaces)
    - [Embedding files](#embedding-files)
    - [Compression](#compression)

---

## Introduction

### Installation

To start using the tool, you must install it globally using [`npm`](https://npmjs.com/@baileyherbert/packr).  After installation completes, you will be able to call the `packr` command globally.

```
npm install -g @baileyherbert/packr
```

### Server requirements

The generated bundles will work on PHP 5.4 and greater. There are no extension requirements except  `zlib` for inflation (which can be disabled per project).

### Planned features

This command line tool is still under development. I am planning on adding the following features soon:

- Composer support
- Better error handling when debugging
- Glob pattern support in configuration files

## Getting started

### Creating a project

First, create a new directory and a file inside it called `packr.json`. This is your configuration file and is required to use the tool. Have a look at the [basic template](#basic-template) for an example.

Next, create your source directory. In the basic template linked above, we are using `src` for the `App\` namespace, so create a new directory called `src` inside your project. We'll put our source files in there.

Now you need to create your main method which Packr will call when the bundle is executed. This is, by default, done through the `Application` class as described in the next section.

### Application class

Now you need to create your main class and method. This is `App\Application::main` by default and can be configured through the [`main`](#available-options) configuration option. Create a file at `src/Application.php`:

```php
<?php

namespace App;

class Application {
    public static function main() {
        echo "Hello world!";
    }
}
```

Finally, open a terminal in the project's root directory and run `packr build`. A bundle file called `bundle.php` will be created in the same directory. You can run it with PHP or through a web server:

```
> php bundle.php
Hello world!
```

## Command line tool

### Build a bundle

To bundle an existing project, open a terminal in the project's root directory, which should contain your `packr.json` configuration file. If you still need to set up your configuration file, see the [configuration docs](#x).

```
packr build [--debug -D]
```

### Build a bundle and watch for changes

You may wish to run the tool continuously and have it automatically build the bundle whenever you modify the configuration file or source files.

```
packr watch [--debug -D]
```

### Expand a bundle

This tool includes an expansion feature which will convert a bundle back into the original project. The resulting project will include the configuration file, embedded files, and source files in their original directories.

```
packr expand <bundle> <target> [--force -F]
```

- `<bundle>` – Path to the bundled `.php` file you wish to expand.
- `<target>` – Path to a directory under which the files will be unpacked. This is created if it does not exist.

If the `<target>` directory is not empty, you will encounter an error. To silence this error and forcefully overwrite the contents, append the `--force` flag.

### Get info about a bundle

Each bundle contains encoded information that may be useful under some circumstances, such as the time the bundle was built, the author and version of the bundle, and the size and compression of its embedded files. You can view this information from the command line.

```
packr info <bundle>
```

- `<bundle>` – Path to the bundled `.php` file you wish to get information on.

## Configuration

Each project must have a configuration file called `packr.json` at its root. The options in this file allow you to customize how the bundle is generated and specify which files and source code to include.

### Basic template

This is a basic starter template for your `packr.json` file. Continue reading for information about each configuration option.

```json
{
    "version": "1.0.0",
    "author": "John Doe <john.doe@example.com>",
    "namespaces": {
        "App\\": "src/"
    }
}
```

### Available options

This is a list of all available configuration options. If your file specifies options that are not in this list, you will receive an error.

| **Name**           | **Type** | **Description**                                              |
| ------------------ | -------- | ------------------------------------------------------------ |
| `version`          | string   | The version of the bundle in no particular format. This is visible to anyone with access to the bundle. Defaults to `1.0.0`. |
| `author`           | string   | The author of the bundle in no particular format. This is visible to anyone with access to the bundle. |
| `main`             | string   | The full name of a class and a static method to call when the bundle is executed. Defaults to `App\Application::main`. |
| `out`              | string   | The name or path of the bundle file to which output will be written. Relative paths are resolved relative to the project's root directory. Defaults to `bundle.php`. |
| `namespaces`       | object   | An object containing your PHP namespaces and their source directories. The key is always the namespace prefix and the value is always a path to a directory containing source files under that namespace. |
| `files`            | object   | An object containing the files to embed in the bundle. The key is always a name or identifier for the file (used to retrieve it from within the bundle), and the value is a path to the file. |
| `encoding`         | string   | The type of encoding and/or compression to use. The current allowed values are `deflate` (default) and `base64`. |
| `file_compression` | string   | The type of compression to use for embedded files. The current allowed values are `deflate` or `null` (default) to disable. |

### Namespaces

Packr works based on PSR standards, including namespaces. It does not support the embedding of classes which are not under a namespace, and each class must have its own file under directories that match the namespace.

For example, if the configuration file is set to map `App\` to `src/`, then a class whose full name is `App\Util\ZipArchive` must be defined at `src/Util/ZipArchive.php`.

### Embedding files

You may wish to embed files with the bundle. As an example, if you're creating an installer for an app, you may want to create a zip archive of the app's files and embed it in the installer. Packr has native support for this. Here's how to implement such an example:

First, add the file to the `files` directive in your configuration.

```json
{
    "version": "1.0.0",
    "namespaces": {},
    "files": {
        "app_files": "path/to/archive.zip"
    }
}
```

Then, you can use the `Packr\Bundle` class to retrieve the file from within your code. This class is always included in the bundle. For example, in our main method:

```php
namespace App;

use Packr\Bundle;

class Application {
    public static function main() {
        $contents = Bundle::getFile('app_files');
    }
}
```

The `$contents` variable in the code above will contain the raw binary content of the file. You can then save this file to the disk or a temporary file and use `ZipArchive` to extract it, or use a third party library to directly extract it from memory.

If you're working with large embedded files, you can also buffer it. This feature is only available when the `file_compression` option is set to `null`.

```php
Bundle::getFile('app_files', function($chunk) {
    echo $chunk;
}, 4096);
```

In the above example, the anonymous function in the second argument will receive the file in chunks of 4096 bytes as defined by the third argument. If not specified, the third argument defaults to 4096 bytes.

### Compression

The `encoding` configuration option controls how your source code is embedded into the file.

- The default value is `deflate`, which will first compress the source code and then encode it in base64 before writing it to the bundle. This can significantly reduce the overall size of the bundle, but will slow down bundles with a large number of classes.
- Setting this to `base64` will skip compression of source files, but they will still be encoded with base64. In this case, the bundle will often be larger than the original source files.

The `file_compression` configuration option controls whether or not embedded files such as zip archives will be compressed.

- The default value is `null` which disables compression entirely. The contents of any embedded files are directly appended to the bundle with no modification. Retrieving files will be faster, but the overall bundle size and memory usage will be negatively impacted.
- Setting this to `deflate` will use the deflate algorithm to compress embedded files. Retrieving files will be slower, but the overall bundle size and memory usage will decrease. Note that archives such as zip files are already compressed and that they will likely not deflate by more than a few percent.

Note that compression requires the `zlib` extension to be enabled in PHP. If it is not enabled, a relevant error will be printed on the screen when attempting to execute the bundle.
