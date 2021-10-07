const alma    = require('almarestapi-lib');

const getFees = async (user_id, library = null) => {
  const fees = await alma.getp(`/users/${user_id}/fees`);
  if (library) {
    fees.fee = fees.fee.filter(f => f.owner && f.owner.value == library);
    fees.total_sum = fees.fee.reduce((p, c) => p + c.balance, 0);
    fees.total_record_count = fees.fee.length;
  }
  return fees;
}

const payFees = async (user_id, amount, transaction_id, library = null) => {
  if (!library) 
    return await alma.postp(`/users/${user_id}/fees/all?op=pay&amount=${amount}&method=ONLINE&external_transaction_id=${transaction_id}`, null);
  
  const fees = await getFees(user_id, library);
  for (i = 0; i < fees.fee.length; i++) {
    if (amount <= 0) break;
    const fee = fees.fee[i];
    const to_pay = Math.min(amount, fee.balance);
    await alma.postp(`${fee.link}?op=pay&amount=${to_pay}&method=ONLINE&external_transaction_id=${transaction_id}`, null);
    amount = amount - to_pay;
  }
}


module.exports = { getFees, payFees }