const toB64url = (bytes) => {
  const buffer = Buffer.from(bytes);
  return buffer.toString('base64url');
}

const fromB64url = x => {
  const enc = 'base64url';
  return Buffer.from(x, enc);
}

exports.toB64url = toB64url;
exports.fromB64url = fromB64url;
