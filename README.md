# Skivvy package: `browserify`
[![npm version](https://img.shields.io/npm/v/@skivvy/skivvy-package-browserify.svg)](https://www.npmjs.com/package/@skivvy/skivvy-package-browserify)
![Stability](https://img.shields.io/badge/stability-stable-brightgreen.svg)
[![Build Status](https://travis-ci.org/skivvyjs/skivvy-package-browserify.svg?branch=master)](https://travis-ci.org/skivvyjs/skivvy-package-browserify)

> Compile JavaScript using Browserify


## Installation

```bash
skivvy install browserify
```


## Overview

This package allows you to compile JavaScript using [Browserify](http://browserify.org/) from within the [Skivvy](https://www.npmjs.com/package/skivvy) task runner.


## Included tasks

### `browserify`

Compile JavaScript using Browserify

#### Usage:

```bash
skivvy run browserify
```


#### Configuration settings:

| Name | Type | Required | Default | Description |
| ---- | ---- | -------- | ------- | ----------- |
| `source` | `string` `Array<string>` | Yes | N/A | Path to source files |
| `destination` | `string` | Yes | N/A | Path to compiled output file |
| `watch` | `boolean` `object` | No | `false` | Whether to watch source files for changes using [watchify](https://www.npmjs.com/package/watchify) |
| `options` | `object` | No | `{}` | Browserify [API options](https://github.com/substack/node-browserify#browserifyfiles--opts) |
| `options.require` | `Array<string|object>` | No | `[]` | Files to make available outside the bundle |
| `options.external` | `Array<string>` | No | `[]` | Prevent files from being loaded into the current bundle |
| `options.ignore` | `Array<string>` | No | `[]` | Prevent files from showing up in the output bundle (return `{}` when required) |
| `options.exclude` | `Array<string>` | No | `[]` | Prevent files from showing up in the output bundle (throw an error when required) |
| `options.transform` | `Array<string|object|function>` | No | `[]` | Browserify transforms |
| `options.plugins` | `Array<string|object|function>` | No | `[]` | Browserify plugins |


##### Notes:

- If a key/value object is used as the `watch` configuration setting, that object will be passed as the `watchify()` function's [`opts`](https://github.com/substack/watchify#var-w--watchifyb-opts) argument
- `options.require` is an array files to make available outside the bundle and any associated options:

	```json
	[
		"./vendor/jquery/jquery.js",
		"./vendor/d3/d3.js",
		{
			"file": "./vendor/angular/angular.js",
			"options": { "expose": "angular" }
		}
	]
	```

	Each entry in `options.require` will be passed to the [`b.require()`](https://github.com/substack/node-browserify#brequirefile-opts) method.

- `options.external` is an array of filenames that are prevented from being loaded into the current bundle:

	```json
	[
		"./external/foo.js",
		"./external/bar.js"
	]
	```

	Each entry in `options.external` will be passed to the [`b.external()`](https://github.com/substack/node-browserify#bexternalfile) method.

- `options.ignore` is an array of filenames that are prevented from showing up in the output bundle:

	```json
	[
		"./hidden/foo.js",
		"./hidden/bar.js"
	]
	```

	Each entry in `options.ignore` will be passed to the [`b.ignore()`](https://github.com/substack/node-browserify#bignorefile) method.

- `options.exclude` is an array of filenames that are prevented from showing up in the output bundle:

	```json
	[
		"./hidden/foo.js",
		"./hidden/bar.js"
	]
	```

	Each entry in `options.exclude` will be passed to the [`b.exclude()`](https://github.com/substack/node-browserify#bexcludefile) method.

- `options.transform` is an array of Browserify transforms and any associated options:

	```json
	[
		"brfs",
		"envify",
		{
			"transform": "babelify",
			"options": { "nonStandard": false, "comments": false }
		}
	]
	```

	> _If configuration is being set programmatically, transforms can also be specified as functions instead of strings._

	Each entry in `options.transforms` will be passed to the [`b.transform()`](https://github.com/substack/node-browserify#btransformtr-opts) method.


- `options.plugins` is an array of Browserify plugins and any associated options:

	```json
	[
		"my-plugin",
		"another-plugin",
		{
			"plugin": "factor-bundle",
			"options": { "outputs": [ "bundle/x.js", "bundle/y.js" ] }
		},
	]
	```

	> _If configuration is being set programmatically, plugins can also be specified as functions instead of strings._

	Each entry in `options.plugins` will be passed to the [`b.plugin()`](https://github.com/substack/node-browserify#bpluginplugin-opts) method.


#### Returns:

`Stream.Writable` The output stream that is written to the filesystem
