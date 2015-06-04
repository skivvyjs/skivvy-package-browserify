'use strict';

var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var watchify = require('watchify');
var envify = require('envify/custom');
var objectAssign = require('object-assign');
var mkdirp = require('mkdirp');

module.exports = function(config) {
	var source = config.source;
	var destination = config.destination;
	var options = config.options || {};
	var watchOptions = config.watch || false;
	var envOptions = config.env || false;

	if (watchOptions === true) { watchOptions = {}; }
	if (typeof envOptions === 'string') {
		envOptions = {
			NODE_ENV: envOptions
		};
	}

	var api = this;
	if (!source) {
		throw new api.errors.TaskError('No source path specified');
	}
	if (!destination) {
		throw new api.errors.TaskError('No destination path specified');
	}
	var sourceArray = Array.isArray(source) ? source : [source];
	return bundle(sourceArray, destination, options, watchOptions, envOptions, api);


	function bundle(sources, destination, options, watchOptions, envOptions, api) {
		var bundler = createBundler(sources, options, watchOptions, envOptions);
		var outputStream = writeBundle(bundler, destination);
		if (watchOptions) {
			bundler.on('update', function(ids) {
				api.utils.log.info('Rebuilding browserify bundle...');
				var outputStream = writeBundle(bundler, destination);
				outputStream.on('finish', function() {
					api.utils.log.success('Browserify bundle rebuilt');
				});
				outputStream.on('error', function(error) {
					api.utils.log.error(error);
				});
			});
			api.utils.log.info('Watching for changes...');
		}
		return outputStream;


		function createBundler(sources, options, watchOptions, envOptions) {
			if (watchOptions) {
				options = objectAssign({}, options, watchify.args);
			}
			var bundler = browserify(sources, options);

			var requires = options.require || [];
			var externals = options.external || [];
			var ignores = options.ignore || [];
			var excludes = options.exclude || [];
			var transforms = options.transform || [];
			var plugins = options.plugins || [];

			if (envOptions) {
				transforms.unshift(envify(envOptions));
			}

			applyRequires(requires, bundler);
			applyExternals(externals, bundler);
			applyIgnores(ignores, bundler);
			applyExcludes(excludes, bundler);
			applyTransforms(transforms, bundler);
			applyPlugins(plugins, bundler);

			if (watchOptions) {
				return watchify(bundler, watchOptions);
			} else {
				return bundler;
			}


			function applyRequires(requires, bundler) {
				if (!requires) { return; }
				requires.forEach(function(item) {
					var filename = typeof item === 'object' ? item.file : item;
					var options = typeof item === 'object' ? item.options : null;
					bundler.require(filename, options);
				});
			}


			function applyExternals(externals, bundler) {
				if (!externals) { return; }
				externals.forEach(function(filename) {
					bundler.external(filename);
				});
			}

			function applyIgnores(ignores, bundler) {
				if (!ignores) { return; }
				ignores.forEach(function(filename) {
					bundler.ignore(filename);
				});
			}

			function applyExcludes(excludes, bundler) {
				if (!excludes) { return; }
				excludes.forEach(function(filename) {
					bundler.exclude(filename);
				});
			}

			function applyTransforms(transforms, bundler) {
				if (!transforms) { return; }
				transforms.forEach(function(item) {
					var transform = typeof item === 'object' ? item.transform : item;
					var options = typeof item === 'object' ? item.options : null;
					bundler.transform(transform, options);
				});
			}

			function applyPlugins(plugins, bundler) {
				if (!plugins) { return; }
				plugins.forEach(function(item) {
					var plugin = typeof item === 'object' ? item.plugin : item;
					var options = typeof item === 'object' ? item.options : null;
					bundler.plugin(plugin, options);
				});
			}
		}

		function writeBundle(bundler, destination) {
			var outputStream = createOutputStream(destination);
			return bundler.bundle()
				.on('error', function(error) {
					outputStream.emit('error', error);
				}).pipe(outputStream);


			function createOutputStream(destination) {
				var outputDir = path.dirname(destination);
				mkdirp.sync(outputDir);
				return fs.createWriteStream(destination);
			}
		}
	}
};

module.exports.defaults = {
	source: null,
	destination: null,
	options: {
		require: [],
		external: [],
		ignore: [],
		exclude: [],
		transform: [],
		plugins: []
	}
};

module.exports.description = 'Compile JavaScript using Browserify';
