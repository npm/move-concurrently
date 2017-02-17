'use strict'
var stream = require('stream')

var test = require('tap').test
var validate = require('aproba')

var extend = Object.assign || require('util')._extend

function assign () {
  var args = [].slice.call(arguments)
  var base = args.shift()
  while (args.length) {
    base = extend(base, args.shift())
  }
  return base
}

var move = require('../move.js')

function enoent () {
  var err = new Error('ENOENT')
  err.code = 'ENOENT'
  return err
}
function eexist () {
  var err = new Error('EEXIST')
  err.code = 'EEXIST'
  return err
}
function eperm () {
  var err = new Error('EPERM')
  err.code = 'EPERM'
  return err
}
function exdev () {
  var err = new Error('EXDEV')
  err.code = 'EXDEV'
  return err
}

var isNothing = {
  isDirectory: function () { return false },
  isSymbolicLink: function () { return false },
  isFile: function () { return false },
  isBlockDevice: function () { return false },
  isCharacterDevice: function () { return false },
  isFIFO: function () { return false },
  isSocket: function () { return false }
}
var fileExists = assign({}, isNothing, {isFile: function () { return true }})

function nextTick (fn) {
  var args = [].slice.call(arguments, 1)
  process.nextTick(function () {
    fn.apply(null, args)
  })
}

function rejects (t, code, msg, promise) {
  promise.then(function () { t.fail(msg) }).catch(function (err) {
    t.is(err.code, code, msg)
  })
}

function resolves (t, msg, promise) {
  promise.then(function () { t.pass(msg) }).catch(function (err) {
    t.ifError(err, msg)
  })
}

test('rename', function (t) {
  t.plan(5)
  var mockFs = {
    rename: function (from, to, cb) {
      validate('SSF', arguments)
      if (from === 'src:rename-ok') {
        nextTick(cb)
      } else if (from === 'src:dest-exists') {
        nextTick(cb, eexist())
      } else if (from === 'src:dest-perm') {
        nextTick(cb, eperm())
      } else if (from === 'src:src-does-not-exist') {
        nextTick(cb, enoent())
      } else if (from === 'src:exdev') {
        nextTick(cb, exdev())
      } else {
        t.fail('unexpected rename ' + from + ' → ' + to)
        nextTick(cb, enoent())
      }
    },
    lstat: function (to, cb) {
      validate('SF', arguments)
      if (to === 'src:rename-ok') {
        nextTick(cb, enoent())
      } else if (to === 'dest:src-does-not-exist') {
        nextTick(cb, enoent())
      } else if (to === 'src:exdev') {
        nextTick(cb, null, fileExists)
      } else if (to === 'dest:exdev') {
        nextTick(cb, enoent())
      } else {
        t.fail('unexpected lstat ' + to)
        nextTick(cb, enoent())
      }
    },
    unlink: function (to, cb) {
      validate('SF', arguments)
      if (to === 'src:exdev') {
        nextTick(cb, eperm())
      } else {
        t.fail('unexpected unlink ' + to)
        nextTick(cb, enoent())
      }
    },
    createReadStream: function () {
      var read = new stream.PassThrough()
      read.end('content')
      return read
    }
  }
  var mocks = {
    fs: mockFs,
    writeStreamAtomic: function (to, opts) {
      validate('SO', arguments)
      var write = new stream.PassThrough()
      write.on('data', function (chunk) { t.comment('WROTE: ' + chunk) })
      write.on('finish', function () { write.emit('close') })
      return write
    }
  }
  resolves(t, 'basic rename', move('src:rename-ok', 'dest:rename-ok', mocks))
  rejects(t, 'ENOENT', 'source missing', move('src:src-does-not-exist', 'dest:src-does-not-exist', mocks))
  rejects(t, 'EEXIST', 'dest exists', move('src:dest-exists', 'dest:dest-exists', mocks))
  rejects(t, 'EPERM', 'dest perm error', move('src:dest-perm', 'dest:dest-perm', mocks))
  resolves(t, 'fallback to copy', move('src:exdev', 'dest:exdev', mocks))
})
