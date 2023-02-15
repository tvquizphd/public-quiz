import { toKey } from "to-key";
import { 
  fromB64urlQuery, toB64urlQuery
} from "sock-secret";

const toNumBytes = (n) => {
  const c = window.crypto;
  return c.getRandomValues(new Uint8Array(n));
}

const toUniformUrl = (str) => {
  return str.replaceAll('+','-').replaceAll('/','_');
}

const encrypt = async (key, secret) => {
  const split = 16;
  const alg = 'AES-GCM';
  const iv = toNumBytes(16);
  const tagLength = split * 8;
  const opts = { name: alg, iv, tagLength };
  const out = await window.crypto.subtle.encrypt(opts, key, secret);
  return {
    iv,
    tag: new Uint8Array(out).slice(-split),
    ev: new Uint8Array(out).slice(0, -split),
  }
}

const encryptKey = async (inputs) => {
  const { hash } = inputs.digest;
  const e_key = await toKey(hash, "encrypt");
  return encrypt(e_key, inputs.key);
}

const encryptSecret = async (inputs) => {
  const e_key = await toKey(inputs.key, "encrypt");
  return await encrypt(e_key, inputs.secret);
}

const toHash = async (pass) => {
  const { hash } = window.argon2;
  const salt = toNumBytes(16);
  const argonOpts = {
    pass,
    salt,
    time: 3,
    mem: 4096,
    hashLen: 32,
  }
  return (await hash(argonOpts)).encoded;
}

const digest = async (pass) => {
  const url = await toHash(pass);
  const [s64, h64] = url.split('$').slice(-2);
  const coded = `#salt=:${s64}&hash=:${h64}`;
  const coded_url = toUniformUrl(coded);
  const output = fromB64urlQuery(coded_url);
  if ("hash" in output && "salt" in output) {
    return output;
  }
  throw new Error("Could not digest password");
}

const digestNewPass = async ({ pass }) => {
  const text = pass.normalize('NFC');
  return await digest(text);
}

const textToBytes = (t) => {
  return new TextEncoder().encode(t);
}

const encryptSecrets = async (inputs) => {
  // Creation of hash from password
  const inputs_0 = { pass: inputs.password };
  const digest = await digestNewPass(inputs_0);
  const secret = textToBytes(inputs.secret_text);
  const key = toNumBytes(32);

  // Return encrypted key and secrets
  return {
    salt: digest.salt,
    key: await encryptKey({ digest, key }),
    data: await encryptSecret({ secret, key })
  };
}

const encryptQueryMaster = async (inputs) => {
  const t = inputs.plain_text;
  const key = inputs.master_key;
  const secret = new TextEncoder().encode(t);
  const data = await encryptSecret({ secret, key });
  return toB64urlQuery({ data });
}

export { toHash, encryptSecrets, encryptQueryMaster, textToBytes };
