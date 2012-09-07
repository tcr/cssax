var fs = require('fs');

var cssax = require('../cssax');

var stream = cssax.createStream();
stream.query('[class*=e]').on('match', function (tag, attributes) {
  console.log(tag);
});

fs.createReadStream(__dirname + '/hn.html').pipe(stream);