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

const toServerAuthCache = (server_auth_data) => {
  const LOCAL_KEY = "server-auth-data";
  if (server_auth_data) {
    const server_auth_str = toB64urlQuery(server_auth_data);
    sessionStorage.setItem(LOCAL_KEY, server_auth_str);
    return server_auth_data;
  }
  const server_auth_str = sessionStorage.getItem(LOCAL_KEY);
  return fromB64urlQuery(server_auth_str);
}

const toSharedCache = (shared) => {
  const LOCAL_KEY = "shared-secret";
  if (shared) {
    sessionStorage.setItem(LOCAL_KEY, shared);
    return shared;
  }
  return sessionStorage.getItem(LOCAL_KEY);
}

const toAppCode = (code) => {
  const LOCAL_KEY = "new-app-code";
  if (code) {
    sessionStorage.setItem(LOCAL_KEY, code);
    return code;
  }
  return sessionStorage.getItem(LOCAL_KEY);
}

const toAppPublic = async (code_in) => {
  const password = toSharedCache();
  const S = toServerAuthCache();
  const code = toAppCode(code_in);
  if (code && S && password) {
    const C = await encryptSecrets({
      password, secret_text: code
    });
    const U__C = { command: 'U__C', tree: C };
    const U__S = { command: 'U__S', tree: S };
    return fromCommandTreeList([ U__C, U__S ]);
  }
  return "";
}

export { 
  toPub,
  toSharedCache,
  toServerAuthCache,
  toAppPublic,
};
