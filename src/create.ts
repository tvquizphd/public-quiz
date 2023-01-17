import { request } from "@octokit/request";
import { createPrivateKey } from "crypto";
import { isTree, isObj } from "./util/pasted.js";
import type { Git } from "./util/types.js";
import { sign } from 'jws';

import type { Header } from 'jws';
import type { NodeAny } from "sock-secret"

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
  id: number,
  pem: string
}
export type AppOutput = AppStrings & {
  id: string,
  jwk: JWK
}
interface ToApp {
  (i: ToAppInput): Promise<AppOutput>;
}
type HasToken = {
  token: string
}
type InstalledRaw = HasToken & {
  expires_at: string
}
export type Installed = HasToken & {
  expiration: string
}
export type Installation = {
  installed: Installed,
  app: AppOutput,
  shared: string
}
export type UserInstallRaw = {
  id: number,
  permissions: Record<string, string>
}
export type UserInstall = UserInstallRaw & {
  git: Git,
  app: AppOutput,
}
interface ToInstall {
  (i: UserInstall): Promise<Installed>;
}
type Obj = Record<string, unknown>;
type Payload = {
  iss: number,
  iat: number,
  exp: number
}

function hasTokenDate (o: Obj): o is InstalledRaw {
  const needs = [
    typeof o.token === "string",
    typeof o.expires_at === "string",
  ]
  return needs.every(v => v);
}

function hasTokenTime(o: Obj): o is Installed {
  const needs = [
    typeof o.token === "string",
    typeof o.expiration === "string",
  ]
  return needs.every(v => v);
}

function isInstallation (o: NodeAny): o is Installation {
  if (!isTree(o)) return false;
  const { installed, app, shared } = o;
  if (!isTree(installed) || !isTree(app)) {
    return false;
  }
  const needs = [
    hasTokenTime(installed),
    typeof shared === "string",
    isAppOutput(app)
  ]
  return needs.every(v => v);
}

function isJWK (o: Obj): o is JWK {
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
    typeof o.id === "number",
    typeof o.pem === "string",
    typeof o.client_id === "string",
    typeof o.client_secret === "string"
  ];
  return needs.every(v => v);
}

function isAppOutput (o: Obj): o is AppOutput {
  const { jwk } = o;
  if (!isObj(jwk)) {
    return false;
  }
  const needs = [
    isJWK(jwk),
    typeof o.id === "string",
    typeof o.client_id === "string",
    typeof o.client_secret === "string"
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
    id: `${out.data.id}`,
    jwk: toJWK(out.data.pem),
    client_id: out.data.client_id,
    client_secret: out.data.client_id
  }
  return output;
}

const toInstall: ToInstall = async (ins) => {
  const { permissions, id, git } = ins;
  const authorization = 'bearer ' + toSign(ins.app);
  const api_url = `/app/installations/${id}/access_tokens`;
  const out = await request(`POST ${api_url}`, {
    headers: { authorization },
    repository: git.repo,
    permissions
  });
  if(!hasTokenDate(out.data)) {
    throw new Error('Unable to create Token');
  }
  const ms = Date.parse(out.data.expires_at);
  if (isNaN(ms)) {
    throw new Error('Unable to create Token');
  }
  return {
    token: out.data.token,
    expiration: `${Math.floor(ms / 1000)}`
  };
};


const toNow = (d: number) => {
  return Math.floor(Date.now() / 1000) + d;
}

const toPayload = (iss: string): Payload => {
  const o = {
    iat: toNow(-60),
    exp: toNow(10 * 60),
    iss: parseInt(iss),
  }
  if (isNaN(o.iss)) {
    throw new Error("Invalid JWT Payload");
  }
  return o;
}

const toSign = (app: AppOutput) => {
  const payload = toPayload(app.id);
  const privateKey = toPEM(app.jwk);
  const header: Header = { alg: 'RS256' };
  const to_sign = { privateKey, header, payload };
  const authorization = sign(to_sign);
  return authorization;
}

export { toPEM, isJWK, toSign, toApp, toInstall, isInstallation };
