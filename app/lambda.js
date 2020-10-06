const jwt     = require('jsonwebtoken');
const alma    = require('almarestapi-lib');
const nconf   = require('nconf');
const { parse }       = require('querystring');
const TouchnetWS      = require('./touchnet');
const responses       = require('./responses');
const dom = require('xmldom').DOMParser;
const { requestp } = require('./utils');
const { frombase64 }  = require('./utils');

let touchnet;
/* global URL */

exports.handler = async (event, context) => {
  touchnet = await TouchnetWS.init(nconf.get('TOUCHNET_WS_URL'));
  const { path, method } = event.requestContext.http;
  let response;
  if (path.startsWith('/touchnet/success') && method == 'POST') {
    response = success(event);
  } else if (path.startsWith('/touchnet/error')) {
    console.error("An error has occurred in the Touchnet process");
    return { statusCode: 400, body: 'An error has occurred in the Touchnet processing.' };
  } else if (path.startsWith('/touchnet') && method == 'GET') {
    response = connector(event);
  }
  return response;
};

const connector = async (event) => {
  const url = `${event.headers['x-forwarded-proto']}://${event.headers.host}${event.requestContext.http.path}`;
  const referrer = event.headers['referer'];
  const queryStringParameters = event.queryStringParameters;

  if (!queryStringParameters) return { statusCode: 400, body: 'No parameters provided.' }
  let user_id, total_sum, upay_site_id, upay_site_url, post_message = '';
  if (queryStringParameters.s) { 
    /* From CloudApp */
    ({ user_id, total_sum, upay_site_id, upay_site_url } = JSON.parse(frombase64(queryStringParameters.s)));
    post_message = 'true';
  } else if (queryStringParameters.jwt) { 
    /* From Primo VE */
    try {
      user_id = jwt.decode(queryStringParameters.jwt).userName;
      user_id = 'exl_impl';
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      return { statusCode: 400, body: 'Cannot retrieve user details information.' };
    } 
  } else if (queryStringParameters.pds_handle) {
    /* From Primo Classic */
    try {
      const ref = new URL(referrer);
      const url = `${ref.protocol}//${ref.host}/primo_library/libweb/webservices/rest/PDSUserInfo?institute=${queryStringParameters.institution}&pds_handle=${queryStringParameters.pds_handle}`;
      console.log('retrieving borinfo from', url);
      const borinfo = await requestp({url});
      const node = require('xpath').select('/bor/bor_id/id', new dom().parseFromString(borinfo));
      user_id = node.length > 0 ? node[0].firstChild.data : null;
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      return { statusCode: 400, body: 'Cannot retrieve user details information.' };
    }
  }

  if (!user_id || total_sum <= 0) return { statusCode: 400, body: 'Nothing to pay.' };

  try {
    let ticket = await touchnet.generateTicket(user_id, {
      amount: total_sum,
      success: url + '/success',
      error: url + '/error',
      cancel: referrer,
      referrer: referrer,
      post_message: post_message
    });
    console.log('Successfully created ticket', ticket);
    return { 
      statusCode: 200, 
      headers: { 'Content-type': 'text/html' },
      body: responses.redirectForm(ticket, user_id, upay_site_id, upay_site_url)
    };
  } catch (e) {
    console.error("Error in setting up payment:", e.message)
    return  { statusCode: 400, body: 'Cannot prepare payment information.' };
  }  
}

const success = async (event) => {
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
  const { pmt_amt, session_identifier } = parse(body);

  let receipt, user_id, referrer, post_message;
  try {
    ({ receipt, user_id, referrer, post_message } = await touchnet.authorize(session_identifier));
  } catch(e) {
    console.error("Error while authorizing payment:", e.message);
    return  { statusCode: 400, body: 'Could not authorize payment.' };
  }

  try {
    if (post_message) {
      return { 
        statusCode: 200, 
        headers: { 'Content-type': 'text/html' },
        body: responses.returnToReferrer(referrer, { amount: pmt_amt, external_transaction_id: receipt, user_id: user_id })
      }
    } else {    
      await alma.postp(`/users/${user_id}/fees/all?op=pay&amount=${pmt_amt}&method=ONLINE&external_transaction_id=${receipt}`, null);
      return { 
        statusCode: 200, 
        headers: { 'Content-type': 'text/html' },
        body: responses.returnToReferrer(referrer)
      }
    }
  } catch (e) {
    console.error("Error in posting payment to Alma:", e.message);
    return  { statusCode: 400, body: 'Could not post payment to Alma' };
  }
}

