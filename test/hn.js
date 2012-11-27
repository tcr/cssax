var fs = require('fs');

var cssax = require('../cssax');

var stream = cssax.createStream();
stream.query('td + td').on('match', function (tag, attributes) {
  console.log('match')
  this.readHTML(function (html) {
  	console.log(html);
  })
});

fs.createReadStream(__dirname + '/hn.html').pipe(stream);