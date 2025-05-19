const { Buffer } = require('buffer');

const frombase64 = ( str ) => Buffer.from(str, 'base64').toString();

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


module.exports = { frombase64, fixEvent };