const express = require('express');
const jwt     = require('jsonwebtoken');
const alma    = require('almarestapi-lib');
const nconf   = require('nconf');
const TouchnetWS = require('./touchnet');
const responses = require('./responses');
const dom = require('xmldom').DOMParser;
const { requestp } = require('./utils');
const { frombase64 } = require('./utils');
const fs = require('fs');

nconf.env().file('config', './config.json');

const http = require('http');
const https = require('https');
let privateKey, certificate, credentials;
if (process.env.CERTIFICATE_KEY_FILE) {
  privateKey  = fs.readFileSync(process.env.CERTIFICATE_KEY_FILE, 'utf8');
  certificate = fs.readFileSync(process.env.CERTIFICATE_CRT_FILE, 'utf8');
  credentials = {key: privateKey, cert: certificate};
}

let touchnet;
TouchnetWS.init(nconf.get('TOUCHNET_WS_URL')).then(t=>touchnet=t);

const PORT = process.env.PORT || 3002;
const SECURE_PORT = process.env.SECURE_PORT || 3003;
const app = express();
app.use(express.urlencoded({extended: true}));

app.get('/', (request, response) => {
  response.send('Touchnet connector');
})

app.get('/touchnet', async (request, response) => {
  const returnUrl = (request.protocol + '://' + request.get('host') + request.originalUrl.split("?").shift()).replace(/\/$/, "");;
  const referrer = request.header('Referer');

  let user_id, total_sum, upay_site_id, upay_site_url, post_message = '';
  if (request.query.s) { 
    /* From CloudApp */
    ({ user_id, total_sum, upay_site_id, upay_site_url } = JSON.parse(frombase64(request.query.s)));
    post_message = 'true';
  } else if (request.query.jwt) { 
    /* From Primo VE */
    try {
      user_id = jwt.decode(request.query.jwt).userName;
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      return response.status(400).send('Cannot retrieve user details information.');
    }
  } else if (request.query.pds_handle) {
    /* From Primo Classic */
    try {
      const ref = new URL(referrer);
      const url = `${ref.protocol}//${ref.host}/primo_library/libweb/webservices/rest/PDSUserInfo?institute=${request.query.institution}&pds_handle=${request.query.pds_handle}`;
      console.log('retrieving borinfo from', url);
      const borinfo = await requestp({url});
      const node = require('xpath').select('/bor/bor_id/id', new dom().parseFromString(borinfo));
      user_id = node.length > 0 ? node[0].firstChild.data : null;
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in retrieving user information:", e.message)
      return response.status(400).send('Cannot retrieve user details information.');
    }
  }

  if (!user_id || total_sum <= 0) return response.status(400).send('Nothing to pay');

  try {
    let ticket = await touchnet.generateTicket(user_id, {
      amount: total_sum,
      success: returnUrl + '/success',
      error: returnUrl + '/error',
      cancel: referrer,
      referrer: referrer,
      post_message: post_message
    });
    response.send(responses.redirectForm(ticket, user_id, upay_site_id, upay_site_url))
  } catch (e) {
    console.error("Error in setting up payment:", e.message)
    return response.status(400).send('Cannot prepare payment information.');
  }
})

app.post('/touchnet/success', async (request, response) => {
  const amount = request.body.pmt_amt;

  let receipt, user_id, referrer, post_message;
  try {
    ({ receipt, user_id, referrer, post_message } = await touchnet.authorize(request.body.session_identifier));
  } catch(e) {
    console.error("Error while authorizing payment:", e.message);
    return response.status(400).send('Could not authorize payment.')
  }

  try {
    if (post_message) {
      response.send(responses.returnToReferrer(referrer, { amount: amount, external_transaction_id: receipt, user_id: user_id }));
    } else {    
      await alma.postp(`/users/${user_id}/fees/all?op=pay&amount=${amount}&method=ONLINE&external_transaction_id=${receipt}`, null);
      console.log('Payment posted to Alma. Returning to referrer', referrer);
      response.send(responses.returnToReferrer(referrer));
    }
  } catch (e) {
    console.error("Error in posting payment to Alma:", e.message);
    return response.status(400).send('Could not post payment to Alma')
  }
})

app.get('/touchnet/error', (request, response) => {
  response.status(400).send('An error has occurred');
})

// app.listen(PORT);
http.createServer(app).listen(PORT);
if (credentials) https.createServer(credentials, app).listen(SECURE_PORT);
