const { digestNewPass } = require('./password');
const { getRandomValues } = require('crypto');
const { createCipheriv } = require('crypto');

const toNumBytes = (n) => {
  return getRandomValues(new Uint8Array(n));
}

const textToBuffer = (t) => {
  const a = new TextEncoder().encode(t);
  return Buffer.from(a);
}

const encrypt = (key, secret) => {
  const alg = 'AES-256-gcm';
  const iv = Buffer.from(toNumBytes(16));
  const cipher = createCipheriv(alg, key, iv);
  const ev = Buffer.concat([
    cipher.update(secret),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return { tag, ev, iv };
}

const encryptKey = (inputs) => {
  const { hash } = inputs.digest;
  return encrypt(hash, inputs.key);
}

const encryptSecret = (inputs) => {
  return encrypt(inputs.key, inputs.secret);
}

const encryptSecrets = async (inputs) => {
  // Creation of hash from password
  const inputs_0 = { pass: inputs.password };
  const digest = await digestNewPass(inputs_0);
  const secrets = {
    salt: digest.salt
  };
  // Password encryption of random key
  const key = Buffer.from(toNumBytes(32));
  const inputs_1 = { digest, key: key };
  secrets.key = encryptKey(inputs_1);

  // Begin encryption of secret
  const { secret_text } = inputs;
  const secret = textToBuffer(secret_text);
  const inputs_2 = { secret, key };
  secrets.data = encryptSecret(inputs_2);

  // Return encrypted key and secrets
  return secrets;
}

exports.encryptSecrets = encryptSecrets;
