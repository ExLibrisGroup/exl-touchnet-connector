const request    = require('request');

const frombase64 = ( str ) => Buffer.from(str, 'base64').toString();

const requestp = ( options ) => {
  if (typeof options === 'string') {
    options = {url: options}
  } 
  return new Promise(function (resolve, reject) {
    request(options, function(err, response, body) {
      if (err) reject(err);
      else if (/^[45]/.test(response.statusCode)) reject(new Error(response.statusMessage));
      else resolve(body);
    });
  });  
}

const fixEvent = event => {
  /* Lower case headers */
  Object.keys(event.headers).forEach(h=>{
    if (h!=h.toLowerCase()) {
      event.headers[h.toLowerCase()] = event.headers[h];
      delete event.headers[h];
    }
  })
  /* Fix route */
  event.routeKey = event.routeKey.replace(/[<>]/g, function (c) {
    switch (c) {
        case '<': return '{';
        case '>': return '}';
    }
  });
}


module.exports = { frombase64, requestp, fixEvent };