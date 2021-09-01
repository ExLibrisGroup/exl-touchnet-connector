const xpath      = require('xpath');
const dom        = require('@xmldom/xmldom').DOMParser;
const { requestp } = require('./utils');

const select     = xpath.useNamespaces(
  {
    soapenv: "http://schemas.xmlsoap.org/soap/envelope/",
    tn: "http://types.secureLink.touchnet.com"
  }
)

class TouchnetWS {
  constructor() { }

  static async init(uri) {
    const o = new TouchnetWS();
    await o._init(uri);
    return o;
  }

  async _init(uri) {
    let data;
    try {
      data = await requestp({
        url: "http://eu-st01.ext.exlibrisgroup.com/delivery/touchnet/settings.json", 
        json:true
      });
    } catch(e) {
      console.error('Error creating TouchetWS client', e); 
      process.exit(1) 
    }
    this.uri = uri || data.TOUCHNET_WS_URL;
    this.auth = data.TOUCHNET_WS_AUTH; 
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
          <typ:value>${options.amount.toFixed(2)}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>SUCCESS_LINK</typ:name>
          <typ:value>${options.success}?institution=${options.institution}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>ERROR_LINK</typ:name>
          <typ:value>${options.error}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>CANCEL_LINK</typ:name>
          <typ:value>${encodeURIComponent(cacheBust(options.cancel))}</typ:value>
      </typ:nameValuePairs>
      <typ:nameValuePairs>
          <typ:name>REFERRER</typ:name>
          <typ:value>${encodeURIComponent(cacheBust(options.referrer))}</typ:value>
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

const cacheBust = uri => {
  if (!uri) return '';
  let param = uri.indexOf('?') == -1 ? '?' : '';
  return uri + param + '&rand=' + Math.floor(Math.random() * Math.floor(1000000));
}
