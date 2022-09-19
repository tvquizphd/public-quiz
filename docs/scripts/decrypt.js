(() => {
const fromB64url = x => {
  return base64ToBytes(x);
}

const fromB64val = (v, isBuffer) => {
  if (typeof v === "string" && v[0] === ":") {
    const val = v.slice(1);
    if (!val.match(/[^0-9a-zA-Z=_\-]/)) {
      const buff = fromB64url(val, isBuffer);
      return isBuffer ? buff : new Uint8Array(buff);
    }
  }
  if (Array.isArray(v)) {
    return v.map(i => fromB64urlObj(i, isBuffer));
  }
  if (typeof v === "object") {
    return fromB64urlObj(v, isBuffer);
  }
  if (v == "true") {
    return true;
  }
  if (v == "false") {
    return false;
  }
  return v;
}

window.fromB64urlObj = (o, isBuffer = false) => {
  const entries = Object.entries(o);
  return entries.reduce((out, [k, v]) => {
    return {...out, [k]: fromB64val(v, isBuffer)};
  }, {});
}

window.nester = (params) => {
  const keyLists = Object.keys(params).map(k => {
    const l = k.split('__');
    return {k, l, len: l.length};
  });
  const keys = keyLists.sort((a, b) => a.len - b.len);
  return keys.reduce((o, {k, l, len}) => {
    let node = o;
    for (let i = 0; i < len - 1; i++) {
      if (!(l[i] in node)) {
        node[l[i]] = {};
      }
      node = node[l[i]];
    }
    const last = l.slice(-1);
    node[last] = params[k];
    return o;
  }, {});
}

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

const fromB64urlQuery = search => {
  const searchParams = new URLSearchParams(search);
  const params = Object.fromEntries(searchParams.entries());
  return fromB64urlObj(nester(params));
}

window.fromB64urlQuery = fromB64urlQuery;
})();
