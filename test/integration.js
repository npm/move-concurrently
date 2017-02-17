'use strict'
var fs = require('fs')
var path = require('path')
var test = require('tap').test
var move = require('../move.js')
var Tacks = require('tacks')
var loadFromDir = require('tacks/load-from-dir')
var areTheSame = require('tacks/tap.js').areTheSame
var File = Tacks.File
var Symlink = Tacks.Symlink
var Dir = Tacks.Dir

var basedir = path.join(__dirname, path.basename(__filename, '.js'))

function testdir (dir) {
  return path.join(basedir, dir)
}

var testContent = {
  test: 'this'
}

var fixture = new Tacks(Dir({
  'test-dir': Dir({
    subdir: Dir({
      'file1.json': File(testContent),
      'file2.json': File(testContent)
    }),
    subdir2: Dir({
      'linky': Symlink(path.join('..', 'subdir')),
      'file2.json': File(testContent),
      subsub: Dir({
        'aaaa': Symlink('bbbb'),
        'bbbb': Dir(),
        'zzzz.json': File(testContent)
      })
    })
  }),
  'test-dir-symlink': Symlink('test-dir'),
  'test-file.json': File(testContent),
  'test-symlink.json': Symlink('test-file.json'),
  'existing': File('')
}))

function readFile (file) {
  return JSON.parse(fs.readFileSync(testdir(file)))
}
function readSymlink (file) {
  return path.relative(basedir, path.resolve(basedir, fs.readlinkSync(testdir(file))))
}

var testDirContent

test('setup', function (t) {
  fixture.remove(basedir)
  fixture.create(basedir)
  testDirContent = loadFromDir(testdir('test-dir'))
  t.done()
})

test('move', function (t) {
  t.plan(4)
  move(testdir('test-file.json'), testdir('move-test-file.json')).then(function () {
    t.isDeeply(readFile('move-test-file.json'), testContent, 'moved file content')
  }).catch(t.fail)
  move(testdir('test-symlink.json'), testdir('move-test-symlink.json')).then(function () {
    t.is(readSymlink('move-test-symlink.json'), 'test-file.json', 'moved symlink')
  }).catch(t.fail)
  move(testdir('test-dir-symlink'), testdir('move-test-dir-symlink')).then(function () {
    t.is(readSymlink('move-test-dir-symlink'), 'test-dir', 'moved dir symlink')
  }).catch(t.fail)
  move(testdir('test-dir'), testdir('move-test-dir')).then(function () {
    return move(testdir('move-test-dir'), testdir('test-dir')).then(function () {
      var moved = loadFromDir(testdir('test-dir'))
      areTheSame(t, moved, testDirContent, 'moved test directory')
    })
  }).catch(t.fail)
})

test('cleanup', function (t) {
  fixture.remove(basedir)
  t.done()
})
