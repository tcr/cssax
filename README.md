# CSS Sax Parsing

For HTML/XML.

```
var csss = new CSSStream('title', fs.createReadStream('index.html'));
csss.on('match', function (tag, attributes) {
  csss.readText(function (title) {
    console.log(title);
  });
});
```
