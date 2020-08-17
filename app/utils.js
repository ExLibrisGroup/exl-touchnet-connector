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

module.exports = { frombase64, requestp };