const { getRandomValues, randomInt } = require('crypto');
const { hash, argon2d } = require('argon2');
const { toB64url } = require('./b64url');

const toBuffer = x => {
  const enc = 'base64url';
  return Buffer.from(x, enc);
}

const toNumBytes = (n) => {
  return getRandomValues(new Uint8Array(n));
}

const toNumPaddedBytes = (n) => {
  const first = new Uint8Array([randomInt(1, 256)]);
  // First byte will never be zero
  const vals = toNumBytes(n);
  vals.set(first);
  return vals;
}

const toNewPassword = (n) => {
  const K = 3;
  const n_bytes = K * n;
  const bytes = toNumPaddedBytes(n_bytes);
  const idx = [...new Array(n).keys()];
  // Generate n * 3 bytes of base64url text
  return idx.reduce((o, i) => {
    const range = [i, i + 1].map(_ => _ * K);
    const three_bytes = bytes.slice(...range);
    return o + toB64url(three_bytes);
  }, '')
}

const digest = async (text, opts) => {
  const options = {...opts, type: argon2d };
  const url = await hash(text, options);
  const [s64, h64] = url.split('$').slice(-2);
  return {
    hash: toBuffer(h64),
    salt: toBuffer(s64)
  }
}

const digestPass = async ({ pass, salt }) => {
  const text = pass.normalize('NFC');
  return await digest(text, { salt });
}

const digestNewPass = async ({ pass }) => {
  const text = pass.normalize('NFC');
  return await digest(text, {});
}

exports.toNewPassword = toNewPassword;
exports.digestNewPass = digestNewPass;
exports.digestPass = digestPass;
