'use strict';

var chai = require('chai');
var expect = chai.expect;
var chaiAsPromised = require('chai-as-promised');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var rewire = require('rewire');
var util = require('util');
var path = require('path');
var Readable = require('stream').Readable;
var Writable = require('stream').Writable;

chai.use(chaiAsPromised);
chai.use(sinonChai);

describe('task:browserify', function() {
	var mockApi;
	var mockBrowserify;
	var mockMkdirp;
	var mockFs;
	var task;
	before(function() {
		mockApi = createMockApi();
		mockBrowserify = createMockBrowserify();
		mockMkdirp = createMockMkdirp();
		mockFs = createMockFs();
		task = rewire('../../lib/tasks/browserify');
		task.__set__('browserify', mockBrowserify);
		task.__set__('mkdirp', mockMkdirp);
		task.__set__('fs', mockFs);
	});

	afterEach(function() {
		mockBrowserify.reset();
		mockMkdirp.reset();
		mockFs.reset();
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
					errror: sinon.spy(function(message) {})
				}
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
					var hasError = files.some(function(filename) {
						return path.basename(filename) === 'browserify-error.js';
					});
					var output = hasError ? new Error('Program error') : 'console.log("Hello, world!")';
					var stream = createReadableStream(output);
					stream.pipe = sinon.spy(stream.pipe);
					mockBrowserify.instance.bundle.output = stream;
					return stream;
				}),
				output: null
			};
			mockBrowserify.instance = instance;
			return instance;
		});

		mockBrowserify.instance = null;

		var reset = mockBrowserify.reset;
		mockBrowserify.reset = function() {
			reset.call(mockBrowserify);
			mockBrowserify.instance = null;
		};

		return mockBrowserify;
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
				plugins: []
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
				plugins: [
					'foo',
					'bar',
					{
						plugin: 'foobar',
						options: { foo: 'bar' }
					}
				]
			}
		});
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
			destination: '/project/dist/app.js',
			options: {
				foo: 'bar',
				plugins: [
					'foo',
					'bar',
					{
						plugin: 'foobar',
						options: { foo: 'bar' }
					}
				]
			}
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
			destination: '/project/dist/write-error.js',
			options: {
				foo: 'bar',
				plugins: [
					'foo',
					'bar',
					{
						plugin: 'foobar',
						options: { foo: 'bar' }
					}
				]
			}
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
});