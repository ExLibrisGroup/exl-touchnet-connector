const frombase64 = ( str ) => Buffer.from(str, 'base64').toString();

module.exports = { frombase64 };