'use strict';

var chai = require('chai');
var expect = chai.expect;
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var rewire = require('rewire');
var util = require('util');
var path = require('path');
var EventEmitter = require('events').EventEmitter;
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('task:browserify', function() {
	var mockApi;
	var mockBrowserify;
	var mockWatchify;
	var mockEnvify;
	var mockMkdirp;
	var mockFs;
	var task;
	before(function() {
		mockApi = createMockApi();
		mockBrowserify = createMockBrowserify();
		mockWatchify = createMockWatchify();
		mockEnvify = createMockEnvify();
		mockMkdirp = createMockMkdirp();
		mockFs = createMockFs();
		task = rewire('../../lib/tasks/browserify');
		task.__set__('browserify', mockBrowserify);
		task.__set__('watchify', mockWatchify);
		task.__set__('envify', mockEnvify);
		task.__set__('mkdirp', mockMkdirp);
		task.__set__('fs', mockFs);
	});

	afterEach(function() {
		mockBrowserify.reset();
		mockWatchify.reset();
		mockEnvify.reset();
		mockMkdirp.reset();
		mockFs.reset();
		mockApi.reset();
	});

	function createMockApi() {
		return {
			errors: {
				TaskError: createCustomError('TaskError')
			},
			utils: {
				log: {
					debug: sinon.spy(function(message) {}),
					info: sinon.spy(function(message) {}),
					warn: sinon.spy(function(message) {}),
					error: sinon.spy(function(message) {}),
					success: sinon.spy(function(message) {})
				}
			},
			reset: function() {
				this.utils.log.debug.reset();
				this.utils.log.info.reset();
				this.utils.log.warn.reset();
				this.utils.log.error.reset();
				this.utils.log.success.reset();
			}
		};

		function createCustomError(type) {
			function CustomError(message) {
				this.message = message;
			}

			CustomError.prototype = Object.create(Error.prototype);
			CustomError.prototype.name = type;

			return CustomError;
		}
	}

	function createMockBrowserify() {
		var mockBrowserify = sinon.spy(function(files, options) {
			var instance = {
				require: sinon.spy(function(file, options) {}),
				external: sinon.spy(function(file) {}),
				ignore: sinon.spy(function(file) {}),
				exclude: sinon.spy(function(file) {}),
				transform: sinon.spy(function(transform, options) {}),
				plugin: sinon.spy(function(plugin, options) {}),
				bundle: sinon.spy(function() {
					var instance = this;
					instance.bundleCount++;
					var hasError = files.some(function(filename) {
						return (path.basename(filename) === 'browserify-error.js') ||
							((path.basename(filename) === 'watchify-error.js') && (instance.bundleCount > 1));
					});
					if (hasError) {
						var error = new Error('Browserify error');
						instance.bundle.error = error;
					}
					var output = error || 'console.log("Hello, world!")';
					var stream = createReadableStream(output);
					stream.pipe = sinon.spy(stream.pipe);
					instance.bundle.output = stream;
					return stream;
				})
			};
			mockBrowserify.instance = instance;
			mockBrowserify.instance.bundleCount = 0;
			return instance;
		});

		mockBrowserify.instance = null;

		var reset = mockBrowserify.reset;
		mockBrowserify.reset = function() {
			reset.call(mockBrowserify);
			mockBrowserify.instance = null;
			mockBrowserify.error = null;
		};

		return mockBrowserify;
	}

	function createMockWatchify() {
		var mockWatchify = sinon.spy(function(browserify, options) {
			var instance = new EventEmitter();
			instance.bundle = function() {
				return browserify.bundle();
			};
			instance.require = function(filename, options) {
				return browserify.require(filename, options);
			};
			instance.external = function(filename) {
				return browserify.external(filename);
			};
			instance.ignore = function(filename) {
				return browserify.ignore(filename);
			};
			instance.exclude = function(filename) {
				return browserify.exclude(filename);
			};
			instance.transform = function(transform, options) {
				return browserify.transform(transform, options);
			};
			instance.plugin = function(plugin, options) {
				return browserify.plugin(plugin, options);
			};
			mockWatchify.instance = instance;
			return instance;
		});

		mockWatchify.args = { cache: {}, packageCache: {} };

		var reset = mockWatchify.reset;
		mockWatchify.reset = function() {
			reset.call(mockWatchify);
			mockWatchify.instance = null;
			mockWatchify.args = { cache: {}, packageCache: {} };
		};

		return mockWatchify;
	}

	function createMockEnvify() {
		var mockEnvify = sinon.spy(function(options) {
			var instance = function() {};
			mockEnvify.instance = instance;
			return instance;
		});

		var reset = mockEnvify.reset;
		mockEnvify.reset = function() {
			reset.call(mockEnvify);
			mockEnvify.instance = null;
		};

		return mockEnvify;
	}

	function createMockMkdirp() {
		return {
			sync: sinon.spy(function(path) {}),
			reset: function() {
				this.sync.reset();
			}
		};
	}

	function createMockFs() {
		var mockFs = {
			createWriteStream: sinon.spy(function(filePath, options) {
				var hasError = (path.basename(filePath) === 'write-error.js');
				var instance = createWritableStream(function(chunk) {
					if (hasError) {
						throw new Error('Write error');
					} else {
						instance.output += chunk;
					}
				});
				instance.output = '';
				mockFs.createWriteStream.instance = instance;
				return instance;
			})
		};

		mockFs.createWriteStream.instance = null;

		mockFs.reset = function() {
			mockFs.createWriteStream.reset();
			mockFs.createWriteStream.instance = null;
		};

		return mockFs;
	}

	function createReadableStream(output) {
		output = output || null;

		function ReadableStream(options) {
			Readable.call(this, options);
		}

		util.inherits(ReadableStream, Readable);

		ReadableStream.prototype._read = function(size) {
			if (output instanceof Error) {
				var self = this;
				setTimeout(function() {
					self.emit.call(self, 'error', output);
				});
			} else {
				this.push(output, 'utf8');
				output = null;
			}
		};

		return new ReadableStream();
	}

	function createWritableStream(callback) {
		function WritableStream(options) {
			Writable.call(this, options);
		}

		util.inherits(WritableStream, Writable);

		WritableStream.prototype._write = function(chunk, enc, done) {
			if (callback) {
				try {
					callback(chunk);
					done(null);
				} catch (error) {
					done(error);
				}
			} else {
				done(null);
			}
		};

		return new WritableStream();
	}

	it('should have a description', function() {
		expect(task.description).to.be.a('string');
	});

	it('should specify default configuration', function() {
		expect(task.defaults).to.eql({
			source: null,
			destination: null,
			options: {
				require: [],
				external: [],
				ignore: [],
				exclude: [],
				transform: [],
				plugin: []
			}
		});
	});

	it('should throw an error if no source path is specified', function() {
		var attempts = [
			function() { return task.call(mockApi, { destination: '/project/dist/app.js', options: {} }); },
			function() { return task.call(mockApi, { source: undefined, destination: '/project/dist/app.js', options: {} }); },
			function() { return task.call(mockApi, { source: null, destination: '/project/dist/app.js', options: {} }); },
			function() { return task.call(mockApi, { source: false, destination: '/project/dist/app.js', options: {} }); }
		];
		attempts.forEach(function(attempt) {
			expect(attempt).to.throw(mockApi.errors.TaskError);
			expect(attempt).to.throw('No source');
		});
	});

	it('should throw an error if no destination path is specified', function() {
		var attempts = [
			function() { task.call(mockApi, { source: ['/project/src/index.js'], options: {} }); },
			function() { task.call(mockApi, { source: ['/project/src/index.js'], destination: undefined, options: {} }); },
			function() { task.call(mockApi, { source: ['/project/src/index.js'], destination: null, options: {} }); },
			function() { task.call(mockApi, { source: ['/project/src/index.js'], destination: false, options: {} }); }
		];
		attempts.forEach(function(attempt) {
			expect(attempt).to.throw(mockApi.errors.TaskError);
			expect(attempt).to.throw('No destination');
		});
	});

	it('should compile source files using Browserify API', function() {
		var stream = task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar'
			}
		});
		expect(stream).to.exist;
		expect(stream).to.equal(mockFs.createWriteStream.instance);
		expect(mockFs.createWriteStream).to.have.been.calledWith(
			'/project/dist/app.js'
		);
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.bundle).to.have.been.calledOnce;
		expect(mockBrowserify.instance.bundle.output.pipe).to.have.been.calledWith(
			mockFs.createWriteStream.instance
		);
		expect(mockMkdirp.sync).to.have.been.calledOnce;
		expect(mockMkdirp.sync).to.have.been.calledWith(
			'/project/dist'
		);
		expect(mockMkdirp.sync).to.have.been.calledBefore(mockFs.createWriteStream);
	});

	it('should call b.require()', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				require: [
					'/project/src/foo.js',
					'/project/src/bar.js',
					{
						file: '/project/src/foobar.js',
						options: { foo: 'bar' }
					}
				]
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.require).to.have.been.calledThrice;
		expect(mockBrowserify.instance.require).to.have.been.calledWith(
			'/project/src/foo.js', null
		);
		expect(mockBrowserify.instance.require).to.have.been.calledWith(
			'/project/src/bar.js', null
		);
		expect(mockBrowserify.instance.require).to.have.been.calledWith(
			'/project/src/foobar.js', { foo: 'bar' }
		);
	});

	it('should call b.external()', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				external: [
					'/project/src/foo.js',
					'/project/src/bar.js',
					'/project/src/foobar.js'
				]
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.external).to.have.been.calledThrice;
		expect(mockBrowserify.instance.external).to.have.been.calledWith(
			'/project/src/foo.js'
		);
		expect(mockBrowserify.instance.external).to.have.been.calledWith(
			'/project/src/bar.js'
		);
		expect(mockBrowserify.instance.external).to.have.been.calledWith(
			'/project/src/foobar.js'
		);
	});

	it('should call b.ignore()', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				ignore: [
					'/project/src/foo.js',
					'/project/src/bar.js',
					'/project/src/foobar.js'
				]
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.ignore).to.have.been.calledThrice;
		expect(mockBrowserify.instance.ignore).to.have.been.calledWith(
			'/project/src/foo.js'
		);
		expect(mockBrowserify.instance.ignore).to.have.been.calledWith(
			'/project/src/bar.js'
		);
		expect(mockBrowserify.instance.ignore).to.have.been.calledWith(
			'/project/src/foobar.js'
		);
	});

	it('should call b.exclude()', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				exclude: [
					'/project/src/foo.js',
					'/project/src/bar.js',
					'/project/src/foobar.js'
				]
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.exclude).to.have.been.calledThrice;
		expect(mockBrowserify.instance.exclude).to.have.been.calledWith(
			'/project/src/foo.js'
		);
		expect(mockBrowserify.instance.exclude).to.have.been.calledWith(
			'/project/src/bar.js'
		);
		expect(mockBrowserify.instance.exclude).to.have.been.calledWith(
			'/project/src/foobar.js'
		);
	});

	it('should call b.transform()', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				transform: [
					'foo',
					'bar',
					{
						transform: 'foobar',
						options: { foo: 'bar' }
					}
				]
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.transform).to.have.been.calledThrice;
		expect(mockBrowserify.instance.transform).to.have.been.calledWith(
			'foo', null
		);
		expect(mockBrowserify.instance.transform).to.have.been.calledWith(
			'bar', null
		);
		expect(mockBrowserify.instance.transform).to.have.been.calledWith(
			'foobar', { foo: 'bar' }
		);
	});

	it('should call b.plugin()', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				plugin: [
					'foo',
					'bar',
					{
						plugin: 'foobar',
						options: { foo: 'bar' }
					}
				]
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockBrowserify.instance.plugin).to.have.been.calledThrice;
		expect(mockBrowserify.instance.plugin).to.have.been.calledWith(
			'foo', null
		);
		expect(mockBrowserify.instance.plugin).to.have.been.calledWith(
			'bar', null
		);
		expect(mockBrowserify.instance.plugin).to.have.been.calledWith(
			'foobar', { foo: 'bar' }
		);
	});

	it('should throw an error if the Browserify API throws an error', function(done) {
		var stream = task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/browserify-error.js'
			],
			destination: '/project/dist/app.js'
		});
		stream.on('error', function(error) {
			done();
		});
		stream.on('finish', function() {
			done(new Error('Expected stream error'));
		});
	});

	it('should throw an error if the file stream throws an error', function(done) {
		var stream = task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/write-error.js'
		});
		stream.on('error', function(error) {
			done();
		});
		stream.on('finish', function() {
			done(new Error('Expected stream error'));
		});
	});

	it('should convert files string into array of files)', function() {
		task.call(mockApi, {
			source: '/project/src/index.js',
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar'
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js'
			],
			{
				foo: 'bar'
			}
		);
	});

	it('should watch source files using Watchify API', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				watch: true
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar',
				cache: {},
				packageCache: {}
			}
		);
		expect(mockWatchify).to.have.been.calledWith(
			mockBrowserify.instance,
			{}
		);

		expect(mockBrowserify.instance.bundle).to.have.been.calledOnce;

		mockBrowserify.instance.bundle.output.pipe.reset();
		mockFs.createWriteStream.instance = null;
		mockFs.createWriteStream.reset();

		mockWatchify.instance.emit('update');

		expect(mockBrowserify.instance.bundle).to.have.been.calledTwice;
		expect(mockFs.createWriteStream).to.have.been.calledWith(
			'/project/dist/app.js'
		);
		expect(mockBrowserify.instance.bundle.output.pipe).to.have.been.calledWith(
			mockFs.createWriteStream.instance
		);
	});

	it('should pass watchify options to Watchify API', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				watch: {
					baz: 'qux'
				}
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar',
				cache: {},
				packageCache: {}
			}
		);
		expect(mockWatchify).to.have.been.calledWith(
			mockBrowserify.instance,
			{
				baz: 'qux'
			}
		);
	});

	it('should log watchify events (success)', function(done) {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				watch: true
			}
		});

		expect(mockApi.utils.log.info).to.have.been.calledOnce;
		expect(mockApi.utils.log.info).to.have.been.calledWith('Watching for changes...');
		expect(mockApi.utils.log.success).not.to.have.been.called;
		expect(mockApi.utils.log.error).not.to.have.been.called;

		mockApi.utils.log.info.reset();
		mockWatchify.instance.emit('update');

		expect(mockApi.utils.log.info).to.have.been.calledOnce;
		expect(mockApi.utils.log.info).to.have.been.calledWith('Rebuilding browserify bundle...');
		expect(mockApi.utils.log.success).not.to.have.been.called;
		expect(mockApi.utils.log.error).not.to.have.been.called;

		mockFs.createWriteStream.instance.on('finish', function() {
			expect(mockApi.utils.log.success).to.have.been.calledOnce;
			expect(mockApi.utils.log.success).to.have.been.calledWith('Browserify bundle rebuilt');
			expect(mockApi.utils.log.error).not.to.have.been.called;
			done();
		});
	});

	it('should log watchify events (failure)', function(done) {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/watchify-error.js'
			],
			destination: '/project/dist/app.js',
			options: {
				watch: true
			}
		});

		expect(mockApi.utils.log.success).not.to.have.been.called;
		expect(mockApi.utils.log.error).not.to.have.been.called;

		mockWatchify.instance.emit('update');

		expect(mockApi.utils.log.success).not.to.have.been.called;
		expect(mockApi.utils.log.error).not.to.have.been.called;

		mockFs.createWriteStream.instance.on('error', function() {
			expect(mockApi.utils.log.success).not.to.have.been.called;
			expect(mockApi.utils.log.error).to.have.been.calledOnce;
			expect(mockApi.utils.log.error).to.have.been.calledWith(mockBrowserify.instance.bundle.error);
			done();
		});
	});

	it('should use envify to set NODE_ENV if env is a string', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				env: 'env'
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockEnvify).to.have.been.calledWith({
			NODE_ENV: 'env'
		});
		expect(mockBrowserify.instance.transform).to.have.been.calledOnce;
		expect(mockBrowserify.instance.transform).to.have.been.calledWith(
			mockEnvify.instance
		);
	});

	it('should use envify to set environment variables if env is an object', function() {
		task.call(mockApi, {
			source: [
				'/project/src/index.js',
				'/project/src/app.js'
			],
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				env: {
					NODE_ENV: 'env',
					FOO: 'bar'
				}
			}
		});
		expect(mockBrowserify).to.have.been.calledWith(
			[
				'/project/src/index.js',
				'/project/src/app.js'
			],
			{
				foo: 'bar'
			}
		);
		expect(mockEnvify).to.have.been.calledWith({
			NODE_ENV: 'env',
			FOO: 'bar'
		});
		expect(mockBrowserify.instance.transform).to.have.been.calledOnce;
		expect(mockBrowserify.instance.transform).to.have.been.calledWith(
			mockEnvify.instance
		);
	});
});
