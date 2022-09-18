const toB64url = (bytes) => {
  const buffer = Buffer.from(bytes);
  return buffer.toString('base64url');
}

const fromB64url = x => {
  const enc = 'base64url';
  return Buffer.from(x, enc);
}

const toB64val = v => {
  if (ArrayBuffer.isView(v)) {
    return ":" + toB64url(v);
  }
  if (Array.isArray(v)) {
    return v.map(i => toB64urlObj(i));
  }
  if (typeof v === "object") {
    return toB64urlObj(v);
  }
  return v;
}

const toB64urlObj = o => {
  const entries = Object.entries(o);
  return entries.reduce((out, [k, v]) => {
    return {...out, [k]: toB64val(v)}; 
  }, {});
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

const nester = (params) => {
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

const fromB64urlObj = (o, isBuffer = false) => {
  const entries = Object.entries(o);
  return entries.reduce((out, [k, v]) => {
    return {...out, [k]: fromB64val(v, isBuffer)}; 
  }, {});
}

const _toB64urlQuery = (o, pre=[]) => {
  const entries = Object.entries(toB64urlObj(o));
  return entries.reduce((out, [k, v]) => {
    const keys = [...pre, k];
    const key = keys.join('__');
    if (typeof v === "object") {
      const value = _toB64urlQuery(v, keys);
      return `${out}${value}`;
    }
    return `${out}&${key}=${v}`;
  }, '');
}

const toB64urlQuery = o => {
  return _toB64urlQuery(o).replace('&', '?')
}

const fromB64urlQuery = search => {
  const searchParams = new URLSearchParams(search);
  const params = Object.fromEntries(searchParams.entries());
  return fromB64urlObj(nester(params));
}

exports.nester = nester;
exports.toB64url = toB64url;
exports.fromB64url = fromB64url;
exports.toB64urlObj = toB64urlObj;
exports.toB64urlQuery = toB64urlQuery;
exports.fromB64urlQuery = fromB64urlQuery;
exports.fromB64urlObj = fromB64urlObj;
