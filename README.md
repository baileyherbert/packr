# Packr

This is a command line tool that packages a PHP project into a single file. At this time, it only supports basic PSR-0 and PSR-4 namespace mapping, and does not yet integrate well with Composer.

The bundled files work on PHP 5.3 and above, and can be executed on web servers or in the command line, making them great for distribution.

## Installation

You can install the command globally via npm:

```
npm install -g @baileyherbert/packr
```

## Work in progress

This tool is a work in progress. I am planning on adding the following features when I have a chance:

- [ ] Support for bundling Composer packages.
- [ ] Loading configuration from `composer.json` instead of `packr.json`.
- [ ] File and archive embedding.

## Getting started

As a basic proof of concept, you can first create an empty project directory. Then create a `packr.json` file inside that directory with the following contents:

```json
{
    "main": "App\\Application",
    "out": "bundle.php",
    "namespaces": {
        "App": "src/"
    }
}
```

Next, create a class at `src/Application.php` which looks like this:

```php
<?php

namespace App;

class Application {

    public static function main() {
        echo "Hello world!";
    }

}
```

Finally, run the `packr` command, optionally with the `--debug` flag, to generate our bundle file.

```
packr --debug
```

This will create a new file called `bundle.php` which can be executed on a web server or in the command line through a PHP interpreter:

```
> php bundle.php
Hello world!
```

## Namespaces

In the example above, there is only one namespace and class. However, you can import and use other classes and namespaces with the `use` construct as normal.

This is because Packr bundles include a PSR-4 autoloader. All eligible source files under the `namespaces` directive of the configuration file can be loaded by this autoloader, because all eligible files will be embedded into the bundle.
