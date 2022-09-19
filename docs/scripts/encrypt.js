const toB64url = window.base64FromBytes;

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

window.toB64urlQuery = toB64urlQuery;
