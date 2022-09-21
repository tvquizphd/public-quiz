const { getRandomValues, randomInt } = require('crypto');
const { fromB64urlQuery } = require('project-sock');
const { hash, argon2d } = require('argon2');

const toUniformUrl = (str) => {
  return str.replaceAll('+','-').replaceAll('/','_');
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

const digest = async (text, opts) => {
  const options = {...opts, type: argon2d };
  const url = await hash(text, options);
  const [s64, h64] = url.split('$').slice(-2);
  const coded = `?salt=:${s64}&hash=:${h64}`;
  const coded_url = toUniformUrl(coded);
  return fromB64urlQuery(coded_url);
}

const digestNewPass = async ({ pass }) => {
  const text = pass.normalize('NFC');
  return await digest(text, {});
}

exports.digestNewPass = digestNewPass;
