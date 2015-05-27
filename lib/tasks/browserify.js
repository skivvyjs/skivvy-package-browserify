'use strict';

var fs = require('fs');
var path = require('path');
var browserify = require('browserify');
var mkdirp = require('mkdirp');

module.exports = function(config) {
	var source = config.source;
	var destination = config.destination;
	var options = config.options;
	var api = this;
	if (!source) {
		throw new api.errors.TaskError('No source path specified');
	}
	if (!destination) {
		throw new api.errors.TaskError('No destination path specified');
	}
	var sourceArray = Array.isArray(source) ? source : [source];
	return bundle(sourceArray, destination, options);


	function bundle(sources, destination, options) {
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

		var bundleStream = createBundleStream(bundler);
		var outputStream = createOutputStream(destination);

		return bundleStream
			.on('error', function(error) {
				outputStream.emit('error', error);
			}).pipe(outputStream);


		function createOutputStream(destination) {
			var outputDir = path.dirname(destination);
			mkdirp.sync(outputDir);
			return fs.createWriteStream(destination);
		}

		function createBundleStream(bundler) {
			return bundler.bundle();
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
