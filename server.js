var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var _ = require('lodash');
var crypto = require('crypto');
app.use(bodyParser.json());

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

var data = {};

app.get('/', function (req, res) {
  var prepped = _.map(data, function(d, k) {
    return {
      user: d.envVars.USER,
      id: k,
      files: _.map(d.files, function (d, k) { return k; }),
      envVarCount: _.keys(d.envVars).length
    }
  });
  res.send(_.map(prepped, function (item) {
    return '<article>'
        + '<h1>' + item.user + '</h1>'
        + '<p>' + item.envVarCount + ' environment variables</p>'
        + '<h4>Files</h4>'
        + '<ul><li>' + item.files.join('</li><li>') + '</li></ul>'
        '</article>'
  }).join(''));
});

app.post('/info', function (req, res) {
  var body = req.body;
  data[md5(JSON.stringify(body))] = body;
  res.send('Thanks.');
});

var port = process.env.PORT || 3000;
app.listen(port);
console.log('started on port ', port);