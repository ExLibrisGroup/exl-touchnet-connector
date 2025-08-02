'use strict';

const process = require('process');

const API_PATH = process.env.ALMA_APIPATH || 'https://api-na.hosted.exlibrisgroup.com/almaws/v1';
let API_KEY  = process.env.ALMA_APIKEY;

const almaRequest = async function (endpoint, method = 'GET') {
  if (!API_KEY)
    throw new Error('No API key provided.');

  const headers = {
    'Authorization': 'apikey ' + API_KEY,
    'Accept': 'application/json'
  };

  const uri = (endpoint.substring(0,4) === 'http' ? '' : API_PATH) + endpoint;

  let body;
  if (method === 'POST') {
    body = '';
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = 0;
  }

  const res = await fetch(uri, {
    method: method,
    headers: headers,
    body: body
  });

  return res.json();
}

const getFees = async (user_id, library = null) => {
  const fees = await almaRequest(`/users/${user_id}/fees`, 'GET');
  if (library) {
    fees.fee = fees.fee.filter(f => f.owner && f.owner.value == library);
    fees.total_sum = fees.fee.reduce((p, c) => p + c.balance, 0);
    fees.total_record_count = fees.fee.length;
  }
  return fees;
}

const payFees = async (user_id, amount, transaction_id, library = null) => {
  if (!library) 
    return await almaRequest(`/users/${user_id}/fees/all?op=pay&amount=${amount}&method=ONLINE&external_transaction_id=${transaction_id}`, 'POST');
  
  const fees = await getFees(user_id, library);
  for (let i = 0; i < fees.fee.length; i++) {
    if (amount <= 0) break;
    const fee = fees.fee[i];
    const to_pay = Math.min(amount, fee.balance);
    await almaRequest(`${fee.link}?op=pay&amount=${to_pay}&method=ONLINE&external_transaction_id=${transaction_id}`, 'POST');
    amount = amount - to_pay;
  }
}

const setOptions = function(apiKey) {
  API_KEY = apiKey;
}

module.exports = { getFees, payFees, setOptions }