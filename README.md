# rápidorápido

¡An experiment in front-end HTTP(S) proxying+caching! ¡Rapido! ¡Rapido!


## Installation

1. Install `rapidorapido` from npm:

    ```
    npm install rapidorapido
    ```

    Or if installing from master via GitHub:

    ```
    git clone https://github.com/cvan/rapidorapido.git
    cd rapidorapido
    npm install
    ```

2. Then create and edit your settings file:

    ```
    cp settings.json.dist settings.json
    ```

## Usage

    rapidorapido [options]


## Options

    -h, --help        Output usage information
    -p, --port        Port to listen on


## Requirements

* redis (via [homebrew](http://brew.sh/))

    ```
    brew install redis
    ```

* node
    ```
    curl https://npmjs.org/install.sh | sh
    ```


## How it works

### Sample `settings.json`

```json
{
    "host": "http://api.yolo.com",
    "expire": "60",
    "methods": ["GET", "OPTIONS"]
}
```

<dl>
<dt><code>host</code></dt>
<dd>the URL of your host</dd>
<dt><code>expire</code> (optional)</dt>
<dd>the time to live (TTL) for the response in redis;
    if omitted, responses will be cached without expiry</dd>
<dt><code>methods</code> (optional)</dt>
<dd>the allowed methods for proxying and caching;
    if omitted, allowed methods will be <code>["GET", "HEAD", "OPTIONS"]</code></dd>
</dl>

### Sample usage

If you have an endpoint at http://api.yolo.com/api/v1/search then request
http://localhost:8080/api/v1/search

Upon the first time anyone accesses this URL, the request will be proxied and its response is then cached (in redis) for 60 seconds (the TTL/`expire`).

The responses for any subsequent requests (until 60 seconds has elapsed) will be retrieved from the cache and delievered immediately; asynchronously the cache is refreshed (if the content has changed) with that URL's response set to expire again in 60 seconds.
