#!/usr/bin/env node

var fs = require('fs');
var http = require('http');
var urlparse = require('url').parse;

var program = require('commander');
var redis = require('redis');
var request = require('request');

// Connect to redis.
var redisURL = urlparse(process.env.REDIS_URL ||
                        process.env.REDISCLOUD_URL ||
                        process.env.REDISTOGO_URL ||
                        '');
redisURL.hostname = redisURL.hostname || 'localhost';
redisURL.port = redisURL.port || 6379;
var redisClient = require('redis').createClient(redisURL.port, redisURL.hostname);
if (redisURL.auth) {
    redisClient.auth(redisURL.auth.split(':')[1]);
}

// Command-line signature.
program.version('0.0.1')
       .usage('[options]')
       .option('-p, --port [port]', 'Port to listen on')
       .parse(process.argv);

var settings = {};
try {
    settings = JSON.parse(fs.readFileSync(__dirname + '/settings.json', 'utf8'));
    // Strip trailing slash.
    settings.host = settings.host.replace(/\/$/, '');
} catch (e) {
}
// Reasonable defaults.
if (typeof settings.expire === 'undefined') {
    settings.expire || 60 * 5;  // Default: 5 minutes
}
if (!settings.methods || !settings.methods.length) {
    settings.methods = ['GET', 'HEAD', 'OPTIONS'];
}


function fetch(req, res, url_) {
    console.log('Fetching URL:', url_);
    var output = {};
    return request.get({
        url: url_,
        // headers: req.headers
    }, function(error, response, body) {
        if (error) {
            var msg = 'Could not get URL:', error;
            console.error(msg);
            res.end(msg);
            return;
        }
        console.log('Proxying response');
        redisClient.get('url:' + url_, function(error, data) {
            output = JSON.stringify({
                body: body,
                date: new Date().toString(),
                headers: JSON.stringify(response.headers),
                statusCode: response.statusCode,
            });
            if (body && data === output) {
                console.log('Data unchanged');
            } else {
                console.log('Data changed');
                // TODO: Set size restrictions.
                redisClient.sadd('urls', url_, redis.print);
                redisClient.set('url:' + url_, output, redis.print);
                if (settings.expire) {
                    redisClient.expire('url:' + url_, settings.expire, redis.print);
                }
            }
        });
    });
}

function output(req, res, data) {
    data = JSON.parse(data);
    data.headers = JSON.parse(data.headers);
    res.writeHead(data.statusCode, data.headers);
    res.end(data.body);
}

var port = program.port || 8080;
http.createServer(function(req, res) {
    if (settings.methods.indexOf(req.method) === -1) {
        res.writeHead(405);
        return res.end(req.method + ' requests are forbidden');
    }

    // List all the cached URLs.
    if (req.url.indexOf('?list') !== -1) {
        return redisClient.smembers('urls', function(error, data) {
            res.writeHead(200);
            res.end(data.join('\n'));
        });
    }

    // Flush all the cached URLs.
    if (req.url.indexOf('?flush') !== -1) {
        redisClient.smembers('urls', function(error, data) {
            // Delete all the `url:{url}` keys.
            var keys = data.map(function(v) {
                return 'url:' + v;
            });
            // Delete the `urls` set.
            keys.push('urls');
            redisClient.del(keys, redis.print);
        });
        res.writeHead(200);
        return res.end('Cache flushed');
    }

    var url_ = settings.host + req.url;
    console.log('\n' + url_);

    redisClient.get('url:' + url_, function(error, data) {
        if (data === null) {
            console.log('Cache miss:', url_);
            req.pipe(fetch(req, res, url_)).pipe(res);
        } else {
            console.log('Cache hit:', url_);
            console.log('Fetching URL from cache:', url_);
            output(req, res, data);
            setTimeout(function() {
                // Fetch asynchronously to update its cache.
                console.log('Repopulating cache:', url_);
                fetch(req, res, url_);
            }, 0);
        }
    });
}).listen(port, '0.0.0.0');

console.log('Server running at http://0.0.0.0:' + port + '/');
