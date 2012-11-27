// http://coding.smashingmagazine.com/2009/08/17/taming-advanced-css-selectors/

var util = require('util');
var EventEmitter = require('events').EventEmitter;

var sax = require('sax');
var ent = require('ent');

String.prototype.startsWith = function (str) {
    return this.slice(0, str.length) == str;
};

String.prototype.endsWith = function (str) {
    return this.slice(-str.length) == str;
};

function last (arr, i) {
  return arr[arr.length - 1 - (i || 0)];
}

var CLOSING = [
  "area", "base", "basefont", "br", "col", "frame", "hr",
  "img", "input", "link", "meta", "param"
];

function parseQuery (text) {
  var res = [];
  text.trim().split(/\s+/).filter(function (token) {
    return token;
  }).forEach(function (token) {
    switch (token) {
      case '>':
        res.push(['child']);
        break;
      case '+':
        res.push(['sibling']);
        break;
      case '~':
        res.push(['adjacent']);
        break;
      default:
        // Simple selector
        res.push(['simple', token.split(/(?=[.:#\[]+)/)]);
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

  // Forward useful events.

  ss.setMaxListeners(100);

  ss.on('end', function () {
    query.emit('end');
  });

  ss.on('text', function (text) {
    query.emit('text', ent.decode(text));
  });

  ss.on('script', function (text) {
    query.emit('text', text);
  });

  // Parse querie(s)

  // TODO match flag to not repeat on multiple queries

  text.trim().split(/\s*,\s*/).forEach(function (text) {

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
            case '[':
              var parts = part.substr(1, part.length - 2).match(/^([a-z\-_0-9A-Z]+)([=~*|^$]+)?(.*)?$/);
              if (!Object.prototype.hasOwnProperty.call(attributes, parts[1])) {
                return false;
              }
              if (parts[2]) {
                var against = parts[3].replace(/^['"]|['"]$/g, '');
                switch (parts[2]) {
                  case '=':
                    return against == attributes[parts[1]];
                  case '^=':
                    return attributes[parts[1]].startsWith(against);
                  case '$=':
                    return attributes[parts[1]].endsWith(against);
                  case '*=':
                    return attributes[parts[1]].indexOf(against) != -1;
                  case '|=':
                    return against == attributes[parts[1]] || attributes[parts[1]].startsWith(against + '-');
                  case '~=':
                    return attributes[parts[1]].trim().split(/\s+/).indexOf(against) != -1;
                  default:
                    return false;
                }
              }
              return true;
            case ':':
              var parts = part.substr(1).match(/^([a-z\-]+)\((.*)\)$/);
              switch (parts[1]) {
                case 'nth-child':
                  var nthparts = parts[2].match(/^(\d+)(n)?(\+\d+)?$/);
                  if (nthparts[2]) {
                    return (last(sibling) + 1) % Number(nthparts[1]) == Number(nthparts[3] || 0);
                  } else {
                    return Number(nthparts[1]) == last(sibling) + 1;
                  }
              }
              return false;
            default:
              return part == tag || part == '*';
          }
        })
      }
      return false;
    }

    function isChildMatch (tag, attributes, i, depth, vd) {
      return steps[i] && steps[i][0] == 'child' && depth == vd - 1 && isSimpleMatch(tag, attributes, i + 1); 
    }

    function isAdjacentMatch (tag, attributes, i, depth, vd) {
      return steps[i] && steps[i][0] == 'adjacent' && depth == vd && isSimpleMatch(tag, attributes, i + 1); 
    }

    function isSiblingMatch (tag, attributes, i, depth, vd, j, sib) {
      return steps[i] && steps[i][0] == 'sibling' && depth == vd && j == sib + 1 && isSimpleMatch(tag, attributes, i + 1); 
    }

    var depth = 0, sibling = [0];

    function pushDepth (tag, attributes) {
      state.forEach(function (q) {
        if (isSimpleMatch(tag, attributes, q.length)) {
          q.push([depth, last(sibling)]);
        } else if (isChildMatch(tag, attributes, q.length, last(q)[0], depth)) {
          q.push([depth, last(sibling)]);
          q.push([depth, last(sibling)]);
        } else if (isAdjacentMatch(tag, attributes, q.length, last(q)[0], depth)) {
          q.push([depth, last(sibling)]);
          q.push([depth, last(sibling)]);
        } else if (isSiblingMatch(tag, attributes, q.length, last(q)[0], depth, last(sibling), last(q)[1])) {
          q.push([depth, last(sibling)]);
          q.push([depth, last(sibling)]);
        }
      });
      if (isSimpleMatch(tag, attributes, 0)) {
        //console.log('Starting steps with:', node.name);
        state.push([[depth, last(sibling)]]);
      }
      if (state.some(function (q) {
        return q.length == steps.length && last(q)[0] == depth;
      })) {
        query.emit('match', tag, attributes);
      }
      depth++;

      // Emit 'opentag' event.
      query.emit('opentag', tag, attributes);
    }

    function popDepth (tag) {
      depth--;
      state.forEach(function (q) {
        while (q.length && q[q.length - 1][0] >= depth) {
          if (steps[q.length] && q[q.length - 1][0] == depth && ['sibling', 'adjacent'].indexOf(steps[q.length][0]) != -1
            && (steps[q.length][0] != 'sibling' || q[q.length - 1][1] == last(sibling) - 1)) {
            break;
          }
          q.pop();
        }
      })
      state = state.filter(function (q) {
        return q.length > 0;
      });

      // Emit 'closetag' event.
      query.emit('closetag', tag);
    }

    // Parse content.

    ss.on('opentag', function (node) {
      var tag = node.name.toLowerCase();
      pushDepth(tag, node.attributes);
      sibling.push(0);

      if (CLOSING.indexOf(tag) != -1) {
        sibling.pop();
        sibling[sibling.length - 1]++;
        popDepth(tag);
      }
    });

    ss.on('closetag', function (tag) {
      tag = tag.toLowerCase();
      if (CLOSING.indexOf(tag) != -1) {
        return;
      }
      sibling.pop();
      sibling[sibling.length - 1]++;
      popDepth(tag);
    });
  });
}

// Call a function after the following element.

CssQuery.prototype.skip = function (next) {
  var depth = 0;
  function into () {
    depth++;
  }
  function outof () {
    depth--;
    if (depth == 0) {
      this.removeListener('opentag', into);
      this.removeListener('closetag', outof);
      next.call(this);
    }
  }
  this.addListener('opentag', into);
  this.addListener('closetag', outof);
};

// Read text for the next element.

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

// Read HTML for the next element.

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