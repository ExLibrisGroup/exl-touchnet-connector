const AWS = require('aws-sdk');

AWS.config.update({region: 'us-east-1'});
const sm = new AWS.SecretsManager();

let config;
const SecretId = process.env.CONFIG_SECRET;

const getConfig = async (instCode) => {
  const config = await retrieveConfig();
  return JSON.parse(config[instCode] || '{}');
}

const setConfig = async (instCode, payload) => {
  await retrieveConfig(true);
  let conf = await getConfig(instCode);
  if (payload.alma_apikey && payload.alma_apikey.startsWith('*')) {
    delete payload.alma_apikey;
  }
  config[instCode] = JSON.stringify(Object.assign(conf, payload));
  await saveConfig();
}

const retrieveConfig = async (force = false) => {
  if (!config || force) {
    let secret = await sm.getSecretValue({ SecretId }).promise();    
    config = JSON.parse(secret.SecretString || '{}');
  }
  return config;
}

const deleteConfig = async (instCode) => {
  await retrieveConfig(true);
  delete config[instCode];
  await saveConfig();
}

const saveConfig = async () => {
  const SecretString = JSON.stringify(config);
  await sm.putSecretValue({ SecretId, SecretString }).promise();
}

module.exports = { getConfig, setConfig, deleteConfig }