import { toRandom } from "to-key";
import { encryptSecrets } from "encrypt";
import { toB64urlQuery } from "project-sock";

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
    sessionStorage.setItem(LOCAL_KEY, server_auth_data);
    return server_auth_data;
  }
  return sessionStorage.getItem(LOCAL_KEY);
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

const toAppPublic = async (code) => {
  const password = toShared();
  const out = {
    code: toAppCode(code),
    server_auth_data: toServerAuth()
  }
  if (out.code && out.server_auth_data && password) {
    const secret_text = toB64urlQuery(out);
    const encrypted = await encryptSecrets({
      password, secret_text
    });
    return toB64urlQuery(encrypted);
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

const toInstallPublic = async (code) => {
  const password = toShared();
  const out = {
    code: toInstallCode(code),
  }
  if (out.code && password) {
    const secret_text = toB64urlQuery(out);
    const encrypted = await encryptSecrets({
      password, secret_text
    });
    return toB64urlQuery(encrypted);
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
