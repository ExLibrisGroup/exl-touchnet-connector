const express = require('express');
const jwt     = require('jsonwebtoken');
const alma    = require('almarestapi-lib');
const TouchnetWS = require('./touchnet');
const responses = require('./responses');
const dom = require('xmldom').DOMParser;
const { requestp, frombase64 } = require('./utils');
const fs = require('fs');

const http = require('http');
const https = require('https');
let privateKey, certificate, credentials;
if (process.env.CERTIFICATE_KEY_FILE) {
  privateKey  = fs.readFileSync(process.env.CERTIFICATE_KEY_FILE, 'utf8');
  certificate = fs.readFileSync(process.env.CERTIFICATE_CRT_FILE, 'utf8');
  credentials = {key: privateKey, cert: certificate};
}

let touchnet;
const init = async () => {
  if (!touchnet) {
    console.log('Initializing Touchnet');
    touchnet = await TouchnetWS.init(process.env.TOUCHNET_WS_URL);
  }
}

const PORT = process.env.PORT || 3002;
const SECURE_PORT = process.env.SECURE_PORT || 3003;
const app = express();
app.use(express.urlencoded({extended: true}));

app.get('/', (request, response) => {
  response.send('Touchnet connector');
})

app.get('/touchnet', async (request, response) => {
  const protocol = request.get('x-forwarded-proto') || request.protocol;
  const host = request.get('x-forwarded-host') || request.get('host');
  const returnUrl = (protocol + '://' + host + request.originalUrl.split("?").shift()).replace(/\/$/, "");;
  const referrer = request.query.returnUrl || request.header('Referer');

  try {
    const resp = await get(request.query, returnUrl, referrer);
    response.send(resp);
  } catch(e) {
    return response.status(400).send(e.message);
  }
})

const get = async (qs, returnUrl, referrer) => {
  await init();
  let user_id, total_sum, upay_site_id, upay_site_url, post_message = 'false';
  if (qs.s) { 
    /* From CloudApp */
    ({ user_id, total_sum, upay_site_id, upay_site_url } = JSON.parse(frombase64(qs.s)));
    post_message = 'true';
  } else if (qs.jwt) { 
    /* From Primo VE */
    try {
      user_id = jwt.decode(qs.jwt).userName;
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      throw new Error('Cannot retrieve user details information.');
    }
  } else if (qs.pds_handle) {
    /* From Primo Classic */
    try {
      const ref = new URL(referrer);
      const url = `${ref.protocol}//${ref.host}/primo_library/libweb/webservices/rest/PDSUserInfo?institute=${qs.institution}&pds_handle=${qs.pds_handle}`;
      console.log('retrieving borinfo from', url);
      const borinfo = await requestp({url});
      const node = require('xpath').select('/bor/bor_id/id', new dom().parseFromString(borinfo));
      user_id = node.length > 0 ? node[0].firstChild.data : null;
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      throw new Error('Cannot retrieve user details information.');
    }
  }

  if (!user_id || total_sum <= 0) throw new Error('Nothing to pay');

  try {
    let ticket = await touchnet.generateTicket(user_id, {
      amount: total_sum,
      success: returnUrl + '/success',
      error: returnUrl + '/error',
      cancel: referrer,
      referrer: referrer,
      post_message: post_message
    });
    console.log('Successfully created ticket', ticket);
    return responses.redirectForm(ticket, user_id, upay_site_id, upay_site_url);
  } catch (e) {
    console.error("Error in setting up payment:", e.message)
    throw new Error('Cannot prepare payment information.');
  }
}

app.post('/touchnet/success', async (request, response) => {
  try {
    const resp = await success(request.body);
    response.send(resp);
  } catch(e) {
    return response.status(400).send(e.message);
  }
})

const success = async body => {
  await init();
  const amount = body.pmt_amt;
  let receipt, user_id, referrer, post_message;
  try {
    ({ receipt, user_id, referrer, post_message } = await touchnet.authorize(body.session_identifier));
    referrer = decodeURIComponent(referrer);
  } catch(e) {
    console.error("Error while authorizing payment:", e.message);
    throw new Error('Could not authorize payment.')
  }

  try {
    if (post_message === 'true') {
      return responses.returnToReferrer(referrer, { amount: amount, external_transaction_id: receipt, user_id: user_id });
    } else {    
      await alma.postp(`/users/${user_id}/fees/all?op=pay&amount=${amount}&method=ONLINE&external_transaction_id=${receipt}`, null);
      console.log('Payment posted to Alma. Returning to referrer', referrer);
      return responses.returnToReferrer(referrer);
    }
  } catch (e) {
    console.error("Error in posting payment to Alma:", e.message);
    throw new Error('Could not post payment to Alma')
  }
}

app.get('/touchnet/error', (request, response) => {
  response.status(400).send('An error has occurred');
})

// app.listen(PORT);
http.createServer(app).listen(PORT);
if (credentials) https.createServer(credentials, app).listen(SECURE_PORT);

module.exports = { get, success };