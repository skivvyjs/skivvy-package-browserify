'use strict';

var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var watchify = require('watchify');
var objectAssign = require('object-assign');
var mkdirp = require('mkdirp');

module.exports = function(config) {
	var source = config.source;
	var destination = config.destination;
	var options = config.options || {};
	var watchOptions = config.watch || false;
	if (watchOptions === true) { watchOptions = {}; }
	var api = this;
	if (!source) {
		throw new api.errors.TaskError('No source path specified');
	}
	if (!destination) {
		throw new api.errors.TaskError('No destination path specified');
	}
	var sourceArray = Array.isArray(source) ? source : [source];
	return bundle(sourceArray, destination, options, watchOptions, api);


	function bundle(sources, destination, options, watchOptions, api) {
		var bundler = createBundler(sources, options, watchOptions);
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


		function createBundler(sources, options, watchOptions) {
			if (watchOptions) {
				options = objectAssign({}, options, watchify.args);
			}
			var bundler = browserify(sources, options);

			(options.require || []).forEach(function(item) {
				var filename = typeof item === 'object' ? item.file : item;
				var options = typeof item === 'object' ? item.options : null;
				bundler.require(filename, options);
			});

			(options.external || []).forEach(function(filename) {
				bundler.external(filename);
			});

			(options.ignore || []).forEach(function(filename) {
				bundler.ignore(filename);
			});

			(options.exclude || []).forEach(function(filename) {
				bundler.exclude(filename);
			});

			(options.transform || []).forEach(function(item) {
				var transform = typeof item === 'object' ? item.transform : item;
				var options = typeof item === 'object' ? item.options : null;
				bundler.transform(transform, options);
			});

			(options.plugins || []).forEach(function(item) {
				var plugin = typeof item === 'object' ? item.plugin : item;
				var options = typeof item === 'object' ? item.options : null;
				bundler.plugin(plugin, options);
			});

			if (watchOptions) {
				return watchify(bundler, watchOptions);
			} else {
				return bundler;
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
