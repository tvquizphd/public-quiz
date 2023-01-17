import { toKey } from "to-key";
import { fromB64urlQuery } from "sock-secret";

const decrypt = (key, ev, iv, tag) => {
  const alg = 'AES-GCM';
  const tagLength = tag.length * 8;
  const opts = { name: alg, iv, tagLength };
  const coded = new Uint8Array([...ev, ...tag]);
  return window.crypto.subtle.decrypt(opts, key, coded);
}

const decryptKey = async ({ hash, key }) => {
  const buffers = [key.ev, key.iv, key.tag];
  const master = await toKey(hash, "decrypt");
  return decrypt(master, ...buffers);
}

const decryptSecret = async ({ key, data }) => {
  const buffers = [data.ev, data.iv, data.tag];
  const master = await toKey(key, "decrypt");
  return decrypt(master, ...buffers);
}

const decryptQueryMaster = async (inputs) => {
  const { master_key: key, search } = inputs;
  const { data } = fromB64urlQuery(search);
  const out = await decryptSecret({ data, key });
  return {
    master_key: new Uint8Array(key),
    plain_text: new TextDecoder().decode(out)
  }
}

const decryptQuery = async (search, pass) => {
  const inputs = fromB64urlQuery(search);
  const { salt, key } = inputs;
  const argonOpts = {
    pass,
    salt,
    time: 3,
    mem: 4096,
    hashLen: 32,
  };
  const { hash } = await window.argon2.hash(argonOpts);
  const master_key = await decryptKey({ hash, key });
  return decryptQueryMaster({ search, master_key });
}

const toBytes = (s) => {
  const a = s.match(/../g) || [];
  const bytes = a.map(h =>parseInt(h,16)); 
  return new Uint8Array(bytes);
}

export { toBytes, decryptQuery, decryptQueryMaster };
