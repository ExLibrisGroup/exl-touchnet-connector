const express = require('express');
const jwt     = require('jsonwebtoken');
const alma    = require('almarestapi-lib');
const nconf   = require('nconf');
const TouchnetWS = require('./touchnet.js');

nconf.env().file('config', './config.json');

const touchnet = new TouchnetWS(nconf.get('TOUCHNET_WS_URL'));

const PORT = process.env.PORT || 3002;
const app = express();
app.use(express.urlencoded({extended: true}));

app.get('/', (request, response) => {
  response.send('Touchnet connector');
})

app.get('/touchnet', async (request, response) => {
  const url = request.protocol + '://' + request.get('host') + request.originalUrl.split("?").shift();
  const referrer = request.header('Referer');

  let user_id, total_sum, upay_site_id, upay_site_url, post_message = '';
  if (request.query.s) { 
    /* From CloudApp */
    ({ user_id, total_sum, upay_site_id, upay_site_url } = JSON.parse(frombase64(request.query.s)));
    post_message = 'true';
  } else if (request.query.jwt) { 
    /* From Primo */
    try {
      user_id = jwt.decode(request.query.jwt).userName;
      ({ total_sum } = await alma.getp(`/users/${user_id}/fees`));
    } catch (e) {
      console.error("Error in receiving user information:", e.message)
      return response.status(400).send('Cannot receive user details information.');
    }
  }

  if (!user_id || total_sum <= 0) return response.status(400).send('Nothing to pay');

  try {
    let ticket = await touchnet.generateTicket(user_id, {
      amount: total_sum,
      success: url + '/success',
      error: url + '/error',
      cancel: referrer,
      referrer: referrer,
      post_message: post_message
    });
    response.send(redirectForm(ticket, user_id, upay_site_id, upay_site_url))
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
      response.send(returnToReferrer(referrer, { amount: amount, external_transaction_id: receipt, user_id: user_id }));
    } else {    
      await alma.postp(`/users/${user_id}/fees/all?op=pay&amount=${amount}&method=ONLINE&external_transaction_id=${receipt}`, null);
      response.send(returnToReferrer(referrer));
    }
  } catch (e) {
    console.error("Error in posting payment to Alma:", e.message);
    return response.status(400).send('Could not post payment to Alma')
  }
})

app.get('/touchnet/error', (request, response) => {
  response.status(400).send('An error has occurred');
})

app.listen(PORT);

function redirectForm(ticket, user_id, upay_site_id, upay_site_url) {
  return `
    <form method="post" action="${upay_site_url || nconf.get('UPAY_SITE_URL')}" name="touchnet">
      <input type="hidden" name="UPAY_SITE_ID" value="${upay_site_id || nconf.get('UPAY_SITE_ID')}">
      <input type="hidden" name="TICKET" value="${ticket}">
      <input type="hidden" name="TICKET_NAME" value="${user_id}">
    </form>
    Redirecting to payment site.
    <script>
    window.onload = function(){
      document.forms['touchnet'].submit();
    }
    </script>
  `
}

function returnToReferrer(referrer, message) {
  let form = '<p>Payment successfully processed.</p>';
  if (message) {
    form += `
    <p>Returning...</p>
    <script>
      window.opener.postMessage(${JSON.stringify(message)}, "${referrer ? referrer : "*"}");
      window.close();
    </script>
    `    
  } else if (referrer) {
    form += `
      <p>Redirecting...</p>
      <script>
        setInterval(() => { window.location.href = "${referrer}"; }, 2000);
      </script>
    `
  }
  return form;
}

const frombase64 = ( str ) => Buffer.from(str, 'base64').toString();