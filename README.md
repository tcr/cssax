# CSS Querying Sax Parser

For HTML/XML.

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
