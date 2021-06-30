const jwt = require('jsonwebtoken');
const alma    = require('almarestapi-lib');
const { success, notfound, error, unauthorized, nocontent } = require('./aws-apigateway-responses');
const { fixEvent } = require('utils');
const { getConfig, setConfig, deleteConfig } = require('./configuration');
const { handler: handleLambda } = require('../lambda');

const handler = async (event, context) => {
  fixEvent(event);
  context.callbackWaitsForEmptyEventLoop = false;
  if (event.routeKey.startsWith('OPTIONS')) return success();
  let result;
  const { inst_code } = event.requestContext?.authorizer?.jwt?.claims || {};
  try {
    switch (event.routeKey) {
      case 'GET /config':
        let config = await getConfig(inst_code);
        if (config.alma_apikey) {
          const re = new RegExp(`^.{1,${config.alma_apikey.length-5}}`,"g");
          config.alma_apikey = config.alma_apikey.replace(re, m => "*".repeat(m.length))
        }
        result = success(config);
        break;
      case 'PUT /config':
        result = success(await setConfig(inst_code, JSON.parse(event.body||'{}')));
        break;  
      case 'DELETE /config':
        result = success(await deleteConfig(inst_code));      
        break;
      case 'ANY /{proxy+}':
        result = await connector(event, context);
        break;
      default:
        result = notfound();
    }
  } catch (e) {
    console.error('error', e);
    result = error(e.message);
  }
  return result;
};

const connector = async (event, context) => {
  let institution;
  if (event.queryStringParameters?.jwt) {
    ({ institution } = jwt.decode(event.queryStringParameters.jwt));
  } else if (event.queryStringParameters?.institution && event.requestContext.http.method == 'POST') {
    /* From Touchnet */
    ({ institution } = event.queryStringParameters);
  } else if (event.queryStringParameters?.s) {
    /* Cloud App */
    return handleLambda(event, context);
  } else return unauthorized();
  let config = await getConfig(institution);
  if (Object.keys(config).length == 0) return error('Connector not configured for specified institution');
  Object.entries(config).forEach(([key, value]) => process.env[key.toUpperCase()] = value);
  alma.setOptions(process.env.ALMA_APIKEY);
  return handleLambda(event, context);
}

module.exports = { handler };