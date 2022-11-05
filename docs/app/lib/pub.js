import { toRandom } from "to-key";
import { encryptSecrets } from "encrypt";
import { toB64urlQuery } from "project-sock";
import { fromB64urlQuery } from "project-sock";

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

const toServerAuth = (server_auth_data) => {
  const LOCAL_KEY = "server-auth-data";
  if (server_auth_data) {
    const server_auth_str = toB64urlQuery(server_auth_data);
    sessionStorage.setItem(LOCAL_KEY, server_auth_str);
    return server_auth_data;
  }
  const server_auth_str = sessionStorage.getItem(LOCAL_KEY);
  return fromB64urlQuery(server_auth_str);
}

const toShared = (shared) => {
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
  const password = toShared();
  const S = toServerAuth();
  const code = toAppCode(code_in);
  if (code && S && password) {
    const C = await encryptSecrets({
      password, secret_text: code
    });
    return toB64urlQuery({ C, S });
  }
  return "";
}

const toInstallCode = (code) => {
  const LOCAL_KEY = "app-install-code";
  if (code) {
    sessionStorage.setItem(LOCAL_KEY, code);
    return code;
  }
  return sessionStorage.getItem(LOCAL_KEY);
}

const toInstallPublic = async (in_code) => {
  const password = toShared();
  const code = toInstallCode(in_code);
  if (code && password) {
    const C = await encryptSecrets({
      password, secret_text: code
    });
    return toB64urlQuery({ C });
  }
  return "";
}

export { 
  toPub,
  toShared,
  toServerAuth,
  toInstallPublic,
  toAppPublic,
};
