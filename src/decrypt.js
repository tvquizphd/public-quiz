const { digestPass } = require('./password');
const { createDecipheriv } = require('crypto');

const textFromBuffer = (b) => {
  return b.toString('utf8');
}

const decrypt = (key, ev, iv, tag) => {
  const alg = 'AES-256-gcm';
  const decipher = createDecipheriv(alg, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ev),
    decipher.final()
  ]);
}

const decryptKey = ({ digest, key }) => {
  const buffers = [key.ev, key.iv, key.tag];
  return decrypt(digest.hash, ...buffers);
}

const decryptSecret = ({ key, secret }) => {
  const buffers = [secret.ev, secret.iv, secret.tag];
  return decrypt(key, ...buffers);
}

const decryptSecrets = async (inputs) => {
  const secrets = {}; 
  const inputs_0 = { 
    salt: inputs.salt,
    pass: inputs.password 
  };
  // Creation of hash from password
  const digest = await digestPass(inputs_0);

  // Password decryption of random key
  const inputs_1 = { digest, key: inputs.key };
  const key = decryptKey(inputs_1);

  // Begin decryption of secret
  const inputs_2 = { key, secret: inputs.data };
  const secretBuffer = decryptSecret(inputs_2);
  secrets.data = textFromBuffer(secretBuffer);
  return secrets;
}

exports.decryptSecrets = decryptSecrets;
