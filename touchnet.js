const request    = require('request');
const xpath      = require('xpath');
const dom        = require('xmldom').DOMParser;

const select     = xpath.useNamespaces(
  {
    soapenv: "http://schemas.xmlsoap.org/soap/envelope/",
    tn: "http://types.secureLink.touchnet.com"
  }
)

class TouchnetWS {
  constructor(uri) {
    requestp({
      url: "http://eu-st01.ext.exlibrisgroup.com/delivery/touchnet/settings.json", 
      json:true
    })
    .then( data => {
      this.uri = uri || data.TOUCHNET_WS_URL;
      this.auth = data.TOUCHNET_WS_AUTH; 
    })
    .catch( err => { 
      console.error('Error creating TouchetWS client', err); 
      process.exit(1) 
    })
  }

  async generateTicket(user_id, options ) {
    let response = await touchnetRequest(this.uri, this.auth, generateTicketBody(user_id, options));
    return getSingleNode('/soapenv:Envelope/soapenv:Body/tn:generateSecureLinkTicketResponse/tn:ticket', response);
  }

  async authorize(session_id) {
    let response = await touchnetRequest(this.uri, this.auth, authorizeBody(session_id));
    return {
      receipt:  getSingleNode('/soapenv:Envelope/soapenv:Body/tn:authorizeAccountResponse/tn:creditResponse/tn:receiptNumber', response),
      user_id:  getSingleNode('/soapenv:Envelope/soapenv:Body/tn:authorizeAccountResponse/tn:ticketName', response),
      referrer: getSingleNode('/soapenv:Envelope/soapenv:Body/tn:authorizeAccountResponse/tn:nameValuePairs[tn:name="REFERRER"]/tn:value', response),
      post_message: getSingleNode('/soapenv:Envelope/soapenv:Body/tn:authorizeAccountResponse/tn:nameValuePairs[tn:name="POST_MESSAGE"]/tn:value', response)
    }
  }
}

module.exports = TouchnetWS;

const touchnetRequest = (uri, auth, xml) => {
  let options = {
    url: uri,
    method: 'POST',
    body: xml,
    headers: {
      'Content-Type':'text/xml;charset=utf-8',
      'Authorization': 'Basic ' + auth,
      'Content-Length':xml.length,
      'SOAPAction':""
    }
  };
  return requestp(options);
}

const generateTicketBody = (ticketName, options) => {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://types.secureLink.touchnet.com">
  <soapenv:Header/>
  <soapenv:Body>
    <typ:generateSecureLinkTicketRequest>
      <typ:ticketName>${ticketName}</typ:ticketName>
      <typ:nameValuePairs>
          <typ:name>AMT</typ:name>
          <typ:value>${options.amount}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>SUCCESS_LINK</typ:name>
          <typ:value>${options.success}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>ERROR_LINK</typ:name>
          <typ:value>${options.error}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>CANCEL_LINK</typ:name>
          <typ:value>${options.cancel}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>REFERRER</typ:name>
          <typ:value>${options.referrer}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>POST_MESSAGE</typ:name>
          <typ:value>${options.post_message}</typ:value>
      </typ:nameValuePairs>
    </typ:generateSecureLinkTicketRequest>
  </soapenv:Body>
</soapenv:Envelope>`
}

const authorizeBody = (session_id) => { 
  return `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:typ="http://types.secureLink.touchnet.com">
    <soapenv:Header/>
    <soapenv:Body>
        <typ:authorizeAccountRequest>
          <typ:session>${session_id}</typ:session>
        </typ:authorizeAccountRequest>
    </soapenv:Body>
  </soapenv:Envelope>
`;
}

const getSingleNode = (path, doc) => {
  const document = typeof doc === 'string' ? new dom().parseFromString(doc) : doc;
  const node = select(path, document);
  return node.length > 0 ? node[0].firstChild.data : null;
}

const requestp = ( options ) => {
  if (typeof options === 'string') {
    options = {url: options}
  } 
  return new Promise(function (resolve, reject) {
    request(options, function(err, response, body) {
      if (err) reject(err);
      else if (/^[45]/.test(response.statusCode)) reject(new Error(response.statusMessage));
      else resolve(body);
    });
  });  
}