var cssax = require('..')
  , rem = require('rem');

var css = cssax.createStream();

css.query('#statuses a').on('match', function (tag, attrs) {
	this.readText(function (text) {
		console.log(attrs.href, text);
	})
})

rem.stream('http://httpstatus.es').get().pipe(css);