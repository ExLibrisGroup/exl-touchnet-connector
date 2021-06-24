const redirectForm = (ticket, user_id, upay_site_id, upay_site_url) => {
  return `
    <form method="post" action="${upay_site_url || process.env.UPAY_SITE_URL}" name="touchnet">
      <input type="hidden" name="UPAY_SITE_ID" value="${upay_site_id || process.env.UPAY_SITE_ID}">
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

const returnToReferrer = (referrer, message) => {
  let form = '<p>Payment successfully processed.</p>';
  if (message) {
    form += `
    <p>Returning...</p>
    <script>
      window.opener.postMessage(${JSON.stringify(message)}, "*");
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

module.exports = { redirectForm, returnToReferrer };