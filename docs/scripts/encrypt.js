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

const encryptSecret = async (inputs) => {
  const d_key = await toKey(inputs.key, "encrypt");
  return await encrypt(d_key, inputs.secret);
}

window.encryptQueryMaster = async (inputs) => {
  const t = inputs.plain_text;
  const key = inputs.master_key;
  const secret = new TextEncoder().encode(t);
  const data = await encryptSecret({ secret, key });
  return toB64urlQuery({ data });
}
