import { toRandom } from "to-key";
import { encryptSecrets } from "encrypt";
import { toB64urlQuery } from "sock-secret";
import { fromB64urlQuery } from "sock-secret";
import { fromCommandTreeList } from "sock-secret";

const toPub = () => {
  const LOCAL_KEY = "private-state-key";
  const private_state = toRandom(32);
  const old_priv_str = sessionStorage.getItem(LOCAL_KEY);
  if (old_priv_str) {
    return old_priv_str;
  }
  sessionStorage.setItem(LOCAL_KEY, private_state);
  return private_state;
}

const toSharedCache = (shared) => {
  const LOCAL_KEY = "shared-secret";
  if (shared) {
    const out = toB64urlQuery(shared);
    sessionStorage.setItem(LOCAL_KEY, out);
    return shared;
  }
  const out = sessionStorage.getItem(LOCAL_KEY);
  return out ? fromB64urlQuery(out) : null;
}

const clearSharedCache = () => {
  const LOCAL_KEY = "shared-secret";
  return sessionStorage.removeItem(LOCAL_KEY);
}

const toAppPublic = async (code) => {
  const cache = toSharedCache();
  if (!cache) return "";
  const { token } = cache;
  const { server_auth_data: S } = cache;
  if (!code || !S || !token) return "";
  const C = await encryptSecrets({
    password: token, secret_text: code
  });
  const U__C = { command: 'U__C', tree: C };
  const U__S = { command: 'U__S', tree: S };
  return fromCommandTreeList([ U__C, U__S ]);
}

export { 
  toPub,
  toAppPublic,
  toSharedCache,
  clearSharedCache
};
