const toKey = async (key, usage) => {
  const fmt = "raw";
  const alg = 'AES-GCM';
  const usages = [ usage ];
  const k_i = [fmt, key, alg, false, usages];
  return await window.crypto.subtle.importKey(...k_i);
}

const decrypt = (key, ev, iv, tag) => {
  const alg = 'AES-GCM';
  const tagLength = tag.length * 8;
  const opts = { name: alg, iv, tagLength };
  const coded = new Uint8Array([...ev, ...tag]);
  return window.crypto.subtle.decrypt(opts, key, coded);
}

window.decryptKey = async ({ hash, key }) => {
  const buffers = [key.ev, key.iv, key.tag];
  const d_key = await toKey(hash, "decrypt");
  return decrypt(d_key, ...buffers);
}

window.decryptSecret = async ({ key, data }) => {
  const buffers = [data.ev, data.iv, data.tag];
  const d_key = await toKey(key, "decrypt");
  return decrypt(d_key, ...buffers);
}
