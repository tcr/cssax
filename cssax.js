var fs = require('fs');
var util = require('util');
var sax = require('sax');
var EventEmitter = require('events').EventEmitter;

  function last (arr, i) {
    return arr[arr.length - 1 - (i || 0)];
  }

var query = [
  ['tag', 'head'],
  ['child', null],
  ['tag', 'title']
]


var CLOSING = ["area", "base", "basefont", "br", "col", "frame", "hr", "img", "input", "link", "meta", "param"];

/*
cssStream
  'opentag', tag, attributes
  'closetag', tag
  'data'
  'end'
*/

util.inherits(CssStream, EventEmitter);

function CssStream (query, stream) {
  this.query = query;

  var state = [];

  function isTagMatch (tag, i) {
    return query[i] && query[i][0] == 'tag' && query[i][1] == tag.toLowerCase();
  }

  function isChildMatch (tag, i, d, vd) {
    return query[i] && query[i][0] == 'child' && d == vd - 1 && isTagMatch(tag, i + 1); 
  }

  var csss = this;
  function checkQueries (tag, attributes) {
    state.forEach(function (q) {
      if (q.length == query.length) {
        csss.emit('match', tag, attributes);
      }
    });
    state = state.filter(function (q) {
      return q.length > 0;
    });
  }

  var d = 0;

  // parsing

  var ss = require("sax").createStream(false);

  ss.on('error', function (e) {
    console.error(e);
  });

  ss.on('opentag', function (node) {
    var tag = node.name.toLowerCase();
    if (isTagMatch(node.name, 0)) {
      //console.log('Starting query with:', node.name);
      state.push([d]);
    }
    state.forEach(function (q) {
      if (isTagMatch(tag, q.length)) {
        //console.log('Continuing query with:', node.name);
        q.push(d);
      } else if (isChildMatch(node.name, q.length, last(q), d)) {
        // console.log('Matching child on:', node.name);
        q.push(d);
        q.push(d);
      }
    });
    checkQueries(tag, node.attributes);
    d++;
    cssStream.emit('opentag', tag, node.attributes);
      //console.log(tag, state)
    if (CLOSING.indexOf(tag) != -1) {
          d--;
      state.forEach(function (q) {
        while (q.length && q[q.length - 1] == d) {
          //console.log('poppin');
          q.pop();
        }
      })
      checkQueries();
      cssStream.emit('closetag', tag);
    }
  });

  ss.on('closetag', function (tag) {
    tag = tag.toLowerCase();
    if (CLOSING.indexOf(tag) != -1) {
      return;
    }
    //console.log(tag);
    state.forEach(function (q) {
      while (q.length && q[q.length - 1] == d) {
        q.pop();
      }
    })
    checkQueries();
    cssStream.emit('closetag', tag);
    d--;
  });

  ss.on('end', function () {
    cssStream.emit('end');
  });

  ss.on('text', function (text) {
    cssStream.emit('text', text);
  });

  stream.pipe(ss);
}

CssStream.prototype.skip = function (next) {
  var d = 1;
  function into () {
    d++;
  }
  function outof () {
    d--;
    if (d == 0) {
      this.removeListener('opentag', into);
      this.removeListener('closetag', outof);
      next.call(this);
    }
  }
  this.addListener('opentag', into);
  this.addListener('closetag', outof);
}

CssStream.prototype.readText = function (next) {
  var str = [];
  function data (text) {
    str.push(text)
  }
  this.addListener('text', data);
  this.skip(function () {
    this.removeListener('text', data);
    next.call(this, str.join(''));
  });
};

var cssStream = new CssStream(query, fs.createReadStream('index.html'));
cssStream.on('match', function (tag) {
  console.log('matched', tag);
  this.readText(function (text) {
    console.log(JSON.stringify(text));
  });
});