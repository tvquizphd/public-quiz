import { request } from "@octokit/request";
import { createPrivateKey } from "crypto";

interface ToAppInput {
  code: string;
}
type AppStrings = {
  client_id: string,
  client_secret: string
}
type JWK = {
  kty: 'RSA', 
  n: string
  e: string
  d: string
  p: string
  q: string
  dp: string
  dq: string
  qi: string
}
type AppRaw = AppStrings & {
  pem: string
}
export type AppOutput = AppStrings & {
  jwk: JWK
}
interface ToApp {
  (i: ToAppInput): Promise<AppOutput>;
}
interface ToInstallInput {
  code: string;
  app: AppOutput;
}
type InStrings = {
  scope: string,
  access_token: string,
  refresh_token: string
}
type InstalledRaw = InStrings & {
  expires_in: number,
  refresh_token_expires_in: number
}
export type Installed = InStrings & {
  expires_in: string,
  refresh_token_expires_in: string
}
interface ToInstall {
  (i: ToInstallInput): Promise<Installed>;
}

function isJWK (o: JsonWebKey): o is JWK {
  if (o.kty !== 'RSA') {
    return false;
  }
  const needs = [
    o.n, o.e, o.d,
    o.p, o.q, o.dp, o.dq, o.qi
  ];
  return needs.every(v => typeof v === "string");
}

function isApp (o: Record<string, any>): o is AppRaw {
  const needs = [
    typeof o.pem === "string",
    typeof o.client_id === "string",
    typeof o.client_secret === "string"
  ];
  return needs.every(v => v);
}

function isInstalled (a: unknown): a is InstalledRaw {
  if (!a || typeof a !== "object") {
    return false;
  }
  const u = a as Installed;
  const needs = [
    typeof u.scope === "string",
    typeof u.expires_in === "number",
    typeof u.access_token === "string",
    typeof u.refresh_token === "string",
    typeof u.refresh_token_expires_in === "number"
  ];
  return needs.every(v => v);
}

const toPEM = (key: JWK): string => {
  const priv = createPrivateKey({
    key, format: 'jwk'
  });
  const pem = priv.export({
    type: 'pkcs1', format: 'pem'
  });
  if (typeof pem !== "string") {
    throw new Error('Invalid private key');
  }
  return pem;
}

const toJWK = (key: string): JWK => {
  const priv = createPrivateKey({
    key, format: 'pem'
  });
  const jwk = priv.export({
    format: 'jwk'
  });
  if (!isJWK(jwk)) {
    throw new Error('Invalid private key');
  }
  return jwk;
}

const toApp: ToApp = async (inputs) => {
  const { code } = inputs;
  const api_url = "/app-manifests/{code}/conversions";
  const out = await request(`POST ${api_url}`, {
    code: code,
  });
  if(!isApp(out.data)) {
    throw new Error('Unable to create App');
  }
  const output = {
    jwk: toJWK(out.data.pem),
    client_id: out.data.client_id,
    client_secret: out.data.client_id
  }
  return output;
}

const toInstall: ToInstall = async (inputs) => {
  const { code, app } = inputs;
  const { client_id, client_secret } = app;
  const api_url = "/login/oauth/access_token";
  const out = await request(`POST ${api_url}`, {
    code, client_id, client_secret
  });
  if(!isInstalled(out.data)) {
    throw new Error('Unable to create App');
  }
  return {
    scope: out.data.scope,
    access_token: out.data.access_token,
    refresh_token: out.data.refresh_token,
    expires_in: `${out.data.expires_in}`,
    refresh_token_expires_in: `${out.data.refresh_token_expires_in}`
  };
};

export { toPEM, isJWK, toApp, toInstall };
