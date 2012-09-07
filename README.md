# CSS Querying Sax Parser

For HTML/XML.

```
npm install cssax
```

Then:

```
var cssax = require('../cssax');

var stream = cssax.createStream();
stream.query('title').on('match', function (tag, attributes) {
  this.readText(function (text) {
    console.log(JSON.stringify(text));
  });
});

require('fs').createReadStream('file.html').pipe(stream);
```

Supported selectors:

* \*
* E
* E F
* E > F
* E + F
* E ~ F
* E.class
* E#id
* E[attr]
* E[attr=value]
* E[attr*=value]
* E[attr^=value]
* E[attr$=value]
* E[attr|=value]
* E[attr~=value]
* E:nth-child(an+b)