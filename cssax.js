var util = require('util');
var EventEmitter = require('events').EventEmitter;

var sax = require('sax');
var ent = require('ent');

function last (arr, i) {
  return arr[arr.length - 1 - (i || 0)];
}

var CLOSING = [
  "area", "base", "basefont", "br", "col", "frame", "hr",
  "img", "input", "link", "meta", "param"
];

function parseQuery (text) {
  var res = [];
  text.trim().split(/\s+/).forEach(function (token) {
    switch (token) {
      case '>':
        res.push(['child']);
        break;
      case '~':
        res.push(['sibling']);
        break;
      case '':
        break;
      default:
        // Simple selector
        res.push(['simple', token.split(/(?=[.:#]+)/)]);
    }
  })
  return res;
}

/**
 * CssQuery class
 */

util.inherits(CssQuery, EventEmitter);

function CssQuery (text, ss) {
  var query = this;

  var steps = parseQuery(text);
  var state = [];

  function isSimpleMatch (tag, attributes, i) {
    if (steps[i] && steps[i][0] == 'simple') {
      return steps[i][1].every(function (part) {
        switch (part[0]) {
          case '#':
            return attributes.id && attributes.id.trim() == part.substr(1);
          case '.':
            return attributes.class && attributes.class.trim().split(/\s+/).indexOf(part.substr(1)) != -1;
          default:
            return part == tag;
        }
      })
    }
    return false;
  }

  function isChildMatch (tag, attributes, i, d, vd) {
    return steps[i] && steps[i][0] == 'child' && d == vd - 1 && isSimpleMatch(tag, attributes, i + 1); 
  }

  function isSiblingMatch (tag, attributes, i, d, vd) {
    return steps[i - 1] && steps[i - 1][0] == 'sibling' && d == vd && isSimpleMatch(tag, attributes, i); 
  }

  var d = 0;

  function pushDepth (tag, attributes) {
    state.forEach(function (q) {
      if (isSimpleMatch(tag, attributes, q.length)) {
        //console.log('Continuing steps with:', node.name);
        q.push(d);
      } else if (isChildMatch(tag, attributes, q.length, last(q), d)) {
        // console.log('Matching child on:', node.name);
        q.push(d);
        q.push(d);
      } else if (isSiblingMatch(tag, attributes, q.length, last(q), d)) {
        // console.log('Matching child on:', node.name);
        q.push(d);
      }
    });
    if (isSimpleMatch(tag, attributes, 0)) {
      //console.log('Starting steps with:', node.name);
      state.push([d]);
    }
    state.forEach(function (q) {
      var i = q.length;
      if (steps[i] && steps[i][0] == 'sibling') {
        q.push(d - 1);
      }
    });
    if (state.some(function (q) {
      return q.length == steps.length && last(q) == d;
    })) {
      query.emit('match', tag, attributes);
    }
    d++;

    // Emit 'opentag' event.
    query.emit('opentag', tag, attributes);
  }

  function popDepth (tag) {
    d--;
    state.forEach(function (q) {
      while (q.length && q[q.length - 1] >= d) {
        q.pop();
      }
    })
    state = state.filter(function (q) {
      return q.length > 0;
    });

    // Emit 'closetag' event.
    query.emit('closetag', tag);
  }

  // parsing

  ss.on('opentag', function (node) {
    var tag = node.name.toLowerCase();
    pushDepth(tag, node.attributes);

    if (CLOSING.indexOf(tag) != -1) {
      popDepth(tag);
    }
  });

  ss.on('closetag', function (tag) {
    tag = tag.toLowerCase();
    if (CLOSING.indexOf(tag) != -1) {
      return;
    }

    popDepth(tag);
  });

  ss.on('end', function () {
    // Emit 'end' event.
    query.emit('end');
  });

  ss.on('text', function (text) {
    // Emit 'text' event.
    query.emit('text', text);
  });
}

CssQuery.prototype.skip = function (next) {
  var d = 0;
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
};

CssQuery.prototype.readText = function (next) {
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

CssQuery.prototype.readHTML = function (next) {
  var str = [];
  function data (text) {
    str.push(text)
  }
  function opentag (tag, attributes) {
    str.push('<' + tag + Object.keys(attributes).map(function (key) {
      return ' ' + key + '=' + '"' + ent.encode(attributes[key]) + '"';
    }).join('') + '>');
  }
  function closetag (tag) {
    if (CLOSING.indexOf(tag) == -1) {
      str.push('</' + tag + '>');
    }
  }
  this.addListener('text', data);
  this.addListener('opentag', opentag);
  this.addListener('closetag', closetag);
  this.skip(function () {
    this.removeListener('text', data);
    this.removeListener('opentag', opentag);
    this.removeListener('closetag', closetag);
    next.call(this, str.join(''));
  });
};

/**
 * Module API
 */

exports.createStream = function () {
  var stream = sax.createStream(false, {
    lowercase: true
  });
  stream.query = function (text) {
    return new CssQuery(text, this);
  };
  return stream;
};