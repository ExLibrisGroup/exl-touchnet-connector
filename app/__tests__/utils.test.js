const { frombase64, fixEvent } = require('../utils');

describe('utils', () => {
  describe('frombase64', () => {
    it('should decode a base64 string', () => {
      const encoded = Buffer.from('hello world', 'utf-8').toString('base64');
      const result = frombase64(encoded);
      expect(result).toBe('hello world');
    });

    it('should handle empty string', () => {
      const encoded = Buffer.from('', 'utf-8').toString('base64');
      const result = frombase64(encoded);
      expect(result).toBe('');
    });

    it('should decode special characters', () => {
      const encoded = Buffer.from('foo@bar.com', 'utf-8').toString('base64');
      const result = frombase64(encoded);
      expect(result).toBe('foo@bar.com');
    });
  });

  describe('fixEvent', () => {
    it('should convert header keys to lowercase', () => {
      const event = {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'value'
        },
        routeKey: 'GET /test'
      };
      fixEvent(event);
      expect(event.headers['content-type']).toBe('application/json');
      expect(event.headers['x-custom-header']).toBe('value');
      expect(event.headers['Content-Type']).toBeUndefined();
      expect(event.headers['X-Custom-Header']).toBeUndefined();
    });

    it('should replace angle brackets in routeKey', () => {
      const event = {
        headers: {},
        routeKey: 'POST /api/<id>/details'
      };
      fixEvent(event);
      expect(event.routeKey).toBe('POST /api/{id}/details');
    });

    it('should handle mixed case headers and route parameters', () => {
      const event = {
        headers: {
          'Authorization': 'Bearer token',
          'content-type': 'text/plain'
        },
        routeKey: 'GET /resource/<resourceId>'
      };
      fixEvent(event);
      expect(event.headers['authorization']).toBe('Bearer token');
      expect(event.headers['content-type']).toBe('text/plain');
      expect(event.routeKey).toBe('GET /resource/{resourceId}');
    });
  });
});
