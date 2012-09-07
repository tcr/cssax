var fs = require('fs');

var cssax = require('../cssax');

var stream = cssax.createStream();
stream.query('td.title ~ td ~ td.title > a').on('match', function (tag, attributes) {
  this.readText(function (text) {
    console.log(JSON.stringify(text));
  });
});

fs.createReadStream(__dirname + '/hn.html').pipe(stream);