import { fromB64urlQuery, toB64urlQuery } from "sock-secret";
import { hasEncryptionKeys, decryptSecret } from "./decrypt.js";
import { parseInstall, isInstallation } from "../create.js";
import { isObjAny, toSign } from "../create.js";
import { toSockClient } from "sock-secret";
import { request } from "@octokit/request";
import { isTrio } from "./types.js";
import path from 'node:path';
import fs from 'fs'

import type { ClientOut, NewClientOut } from "opaque-low-io";
import type { UserInstallRaw } from "../create.js";
import type { TreeAny } from "sock-secret"
import type { UserInstall } from "../create.js";
import type { AppOutput } from "../create.js";
import type { Git, Trio } from "./types.js";
import type { Secrets } from "./encrypt.js";

export type HasGit = { git: Git }
export type DevConfig = {
  home: string,
  tmp: string
}
export type UserIn = HasGit & {
  delay: number,
  prod: boolean,
  dev_config: DevConfig
}
type InstallIn = HasGit & {
  delay: number,
  app: AppOutput
}
type ItemInC = {
  "body": Uint8Array,
  "mac_tag": Uint8Array
}
type ServerAuthData = {
  As: Uint8Array,
  Xs: Uint8Array,
  beta: Uint8Array,
  c: Record<"pu" | "Pu" | "Ps", ItemInC>
}
export type UserApp = {
  C: Secrets,
  S: ServerAuthData
}
type DevInboxIn = {
  user_in: UserIn,
  inst: string,
  sec: Trio
}
interface ToUserInstall {
  (u: InstallIn): Promise<UserInstallRaw>;
}
interface ReadUserInstall {
  (u: InstallIn): Promise<UserInstall>;
}
interface ReadUserApp {
  (u: UserIn): Promise<UserApp>;
}
interface ReadInbox {
  (u: DevInboxIn): Promise<Trio>;
}
interface ReadLoginStart {
  (u: UserIn): Promise<boolean>;
}
interface ReadLoginEnd {
  (u: UserIn): Promise<boolean>;
}
type Tries = {
  max_tries: number,
  dt: number
}
interface ToTries {
  (u: number): Tries; 
}
interface UseTempFile {
  (i: DevConfig): string; 
}
export type NameTree = {
  command: string,
  tree: TreeAny
} 
interface ToNameTree {
  (t: string): NameTree;
}
interface FromNameTree {
  (t: NameTree): string;
}

function isEncrypted(d: TreeAny): d is Secrets {
  const { salt, key, data } = d;
  if (!isObjAny(key) || !isObjAny(data)) {
    return false;
  }
  const needs = [
    data.iv, data.tag, data.ev,
    salt, key.iv, key.tag, key.ev
  ];
  return needs.every(v => v instanceof Uint8Array);
}

export type LoginStart = {
  client_auth_data: NewClientOut["client_auth_data"]
}
function isLoginStart (nt: TreeAny): nt is LoginStart {
  const o = (nt as LoginStart).client_auth_data || "";
  if (!isObjAny(o)) return false;
  const needs = [
    typeof o.sid === "string",
    o.pw instanceof Uint8Array,
    o.Xu instanceof Uint8Array,
    o.alpha instanceof Uint8Array,
  ]
  return needs.every(v => v);
}

export type LoginEnd = {
  client_auth_result: ClientOut["client_auth_result"]
}
function isLoginEnd(nt: TreeAny): nt is LoginEnd {
  const o = (nt as LoginEnd).client_auth_result || "";
  if (!isObjAny(o)) return false;
  return o.Au instanceof Uint8Array;
}

const useTempFile: UseTempFile = (dev_config) => {
  const { tmp, home } = dev_config;
  const tmp_dir = path.relative(process.cwd(), tmp);
  return path.join(tmp_dir, home);
}

const toReader = (dev_config: DevConfig) => {
  const src = useTempFile(dev_config);
  const encoding = 'utf-8';
  return async () => {
    const txt = fs.readFileSync(src, { encoding });
    return txt.replaceAll('\n', '');
  }
}

const readUserApp: ReadUserApp = async (user_in) => {
  const { git, prod, delay, dev_config } = user_in;
  const file_in = { read: toReader(dev_config) }; 
  const issue_in = { git, issues: 1 };
  const input = prod ? issue_in : file_in;
  const sock = await toSockClient({ input, delay });
  const C = await sock.get("U", "C");
  const S = await sock.get("U", "S");
  sock.quit();
  if (C && isEncrypted(C) && S && isServerAuthData(S)) {
    return { C, S };
  }
  throw new Error('User pasted invalid App input');
}

function isServerAuthData(d: TreeAny): d is ServerAuthData {
  if (!isObjAny(d.c)) {
    return false;
  }
  if (!isObjAny(d.c.pu) || !isObjAny(d.c.Pu) || !isObjAny(d.c.Ps)) {
    return false;
  }
  const needs = [
    d.beta, d.Xs, d.As,
    d.c.pu.body, d.c.Pu.body, d.c.Ps.body,
    d.c.pu.mac_tag, d.c.Pu.mac_tag, d.c.Ps.mac_tag
  ];
  return needs.every(v => v instanceof Uint8Array);
}

const toTries: ToTries = (delay) => {
  const min15 = 60 * 15;
  const dt = delay * 1000;
  const max_tries = min15 / delay;
  return { dt, max_tries };
}

const toBytes = (s: string) => {
  const a: string[] = s.match(/../g) || [];
  const bytes = a.map(h =>parseInt(h,16)); 
  return new Uint8Array(bytes);
}

const toInstallation = (inst: string) => {
  const ins_value = process.env[inst] || "";
  const ins_obj = fromB64urlQuery(ins_value);
  if (!isInstallation(ins_obj)) {
    throw new Error(`Secret ${inst} invalid.`);
  }
  return ins_obj;
}

const readInbox: ReadInbox = async (inputs) => {
  const { user_in, inst, sec } = inputs;
  if (!user_in.prod) {
    return sec.map((k: string) => {
      return process.env[k] || "";
    }) as Trio;
  }
  const { shared } = toInstallation(inst);
  const key = toBytes(shared);
  try {
    const text = process.env["MAIL__TABLE"];
    const tree = fromB64urlQuery(text || "");
    const data = tree.data || "";
    if (hasEncryptionKeys(data)) {
      const out = decryptSecret({ data, key });
      const plain_text = new TextDecoder().decode(out);
      const trio = plain_text.split("\n");
      if (isTrio(trio)) {
        return trio;
      }
    }
    else {
      console.log('Missing dev inbox');
    }
  }
  catch {
    console.log('No passwords in dev inbox');
  }
  return ["", "", ""];
}

const readDevInbox: ReadInbox = async (inputs) => {
  const { user_in, inst, sec } = inputs;
  if (user_in.prod) {
    throw new Error('This command is not available in production.');
  }
  const { shared } = toInstallation(inst);
  const key = toBytes(shared);
  try {
    const { dev_config } = user_in
    const text = await toReader(dev_config)();
    const { command, tree } = toNameTree(text);
    const ok_command = command === "mail__table";
    const data = tree.data || "";
    if (ok_command && hasEncryptionKeys(data)) {
      const out = decryptSecret({ data, key });
      const plain_text = new TextDecoder().decode(out);
      const trio = plain_text.split("\n");
      if (isTrio(trio)) {
        sec.map((k: string, i: number) => {
          process.env[k] = trio[i];
        });
        return trio;
      }
    }
    else {
      console.log('Missing dev inbox');
    }
  }
  catch {
    console.log('No passwords in dev inbox');
  }
  return ["", "", ""];
}

const readLoginStart: ReadLoginStart = async (ins) => {
  if (ins.prod) {
    throw new Error('This command is not available in production.');
  }
  const input = { read: toReader(ins.dev_config) }; 
  const sock = await toSockClient({ input, delay: ins.delay });
  const tree = await sock.get("op:pake", "client_auth_data");
  sock.quit();
  return isLoginStart(tree || {});
}

const readLoginEnd: ReadLoginEnd = async (ins) => {
  if (ins.prod) {
    throw new Error('This command is not available in production.');
  }
  const input = { read: toReader(ins.dev_config) }; 
  const sock = await toSockClient({ input, delay: ins.delay });
  const tree = await sock.get("op:pake", "client_auth_result");
  sock.quit();
  return isLoginEnd(tree || {});
}

const toUserInstall: ToUserInstall = async (ins) => {
  const authorization = 'bearer ' + toSign(ins.app);
  const api_url = '/users/{username}/installation';
  const out = await request(`GET ${api_url}`, {
    username: ins.git.owner,
    headers: { authorization }
  })
  return parseInstall(out.data);
}

const toInstallReader = (ins: InstallIn) => {
  const command = "install__ready";
  return async () => {
    try {
      const install = await toUserInstall(ins);
      const { id, permissions } = install;
      const tree = { id: `${id}`, permissions };
      return fromNameTree({ command, tree });
    }
    catch (e: any) {
      if (e?.status !== 404) {
        console.error(e?.message);
        throw new Error("Error getting user installation");
      }
    }
    return "";
  }
}

const readUserInstall: ReadUserInstall = async (ins) => {
  const input = { read: toInstallReader(ins) }; 
  const sock = await toSockClient({ input, delay: ins.delay });
  console.log('Awaiting app installation...');
  const tree = await sock.get("install", "ready");
  const install = parseInstall(tree || {});
  sock.quit();
  return {
    git: ins.git,
    app: ins.app,
    id: install.id,
    permissions: install.permissions
  };
}

const toNameTree: ToNameTree = (s) => {
  const trio = s.split(/(#.*)/s);
  if (!s.length) {
    return { command: "", tree: {} }
  }
  if (!isTrio(trio)) {
    throw new Error('Poorly formatted workflow inputs');
  }
  const [command, rest] = trio;
  const tree = fromB64urlQuery(rest);
  return { command, tree };
}

const fromNameTree: FromNameTree = ({ command, tree }) => {
  return command + toB64urlQuery(tree);
}

export { 
  readUserApp, readUserInstall, toTries,
  isLoginStart, isLoginEnd, toNameTree, fromNameTree,
  readLoginStart, readLoginEnd, readDevInbox, toBytes,
  toInstallation, readInbox
}
