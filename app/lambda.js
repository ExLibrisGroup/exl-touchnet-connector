const jwt     = require('jsonwebtoken');
const alma    = require('almarestapi-lib');
const nconf   = require('nconf');
const { parse }       = require('querystring');
const TouchnetWS      = require('./touchnet');
const responses       = require('./responses');
const { frombase64 }  = require('./utils');

let touchnet;

exports.handler = async (event, context) => {
  touchnet = await TouchnetWS.init(nconf.get('TOUCHNET_WS_URL'));
  const { resource, httpMethod } = event;
  let response;
  if (resource == '/touchnet' && httpMethod == 'GET') {
    response = connector(event);
  } else if (resource == '/touchnet/success' && httpMethod == 'POST') {
    response = success(event);
  } else if (resource == '/touchnet/error') {
    console.error("An error has occurred in the Touchnet process");
    return { statusCode: 400, body: 'An error has occurred in the Touchnet processing.' };
  }
  return response;
};

const connector = async (event) => {
  const url = `${event.headers['X-Forwarded-Proto']}://${event.headers.Host}${event.resource}`;
  const referrer = event.headersReferer;
  const queryStringParameters = event.queryStringParameters;

  let user_id, total_sum, upay_site_id, upay_site_url, post_message = '';
  if (queryStringParameters.s) { 
    /* From CloudApp */
    ({ user_id, total_sum, upay_site_id, upay_site_url } = JSON.parse(frombase64(request.query.s)));
    post_message = 'true';
  } else if (queryStringParameters.jwt) { 
    /* From Primo */
    try {
      user_id = jwt.decode(queryStringParameters.jwt).userName;
      user_id = 'exl_impl';
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in receiving user information:", e.message)
      return { statusCode: 400, body: 'Cannot receive user details information.' };
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
  const { amount, session_identifier } = parse(event.body);

  let receipt, user_id, referrer, post_message;
  try {
    ({ receipt, user_id, referrer, post_message } = await touchnet.authorize(session_identifier));
  } catch(e) {
    console.error("Error while authorizing payment:", e.message);
    return  { statusCode: 400, body: 'Could not authorize payment.' };
  }

  try {
    if (post_message) {
      response.send(responses.returnToReferrer(referrer, { amount: amount, external_transaction_id: receipt, user_id: user_id }));
    } else {    
      await alma.postp(`/users/${user_id}/fees/all?op=pay&amount=${amount}&method=ONLINE&external_transaction_id=${receipt}`, null);
      response.send(responses.returnToReferrer(referrer));
    }
  } catch (e) {
    console.error("Error in posting payment to Alma:", e.message);
    return  { statusCode: 400, body: 'Could not post payment to Alma' };
  }
}

