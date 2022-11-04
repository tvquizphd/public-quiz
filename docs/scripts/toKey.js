const toKey = async (key, usage) => {
  const fmt = "raw";
  const alg = 'AES-GCM';
  const usages = [ usage ];
  const k_i = [fmt, key, alg, false, usages];
  return await window.crypto.subtle.importKey(...k_i);
}
const toRandom = (n) => {
  const empty = new Uint8Array(Math.ceil(n / 2));
  const bytes = [...crypto.getRandomValues(empty)];
  const to_pair = x => {
    const [p0, p1] = x.toString(36).padStart(2,'0');
    const P0 = Math.random() > 0.5 ? p0.toUpperCase() : p0;
    const P1 = Math.random() > 0.5 ? p1.toUpperCase() : p1;
    const sep = Math.random() > 0.5 ? '' : '-';
    return [P0, P1].join(sep);
  }
  return bytes.map(to_pair).join('');
}
export { toKey, toRandom };
