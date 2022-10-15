const toKey = async (key, usage) => {
  const fmt = "raw";
  const alg = 'AES-GCM';
  const usages = [ usage ];
  const k_i = [fmt, key, alg, false, usages];
  return await window.crypto.subtle.importKey(...k_i);
}
export { toKey };
