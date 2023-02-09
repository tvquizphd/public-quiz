import { hasEncryptionKeys, tryDecryptSecret } from "./decrypt.js";
import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { parseInstall, isInstallation } from "../create.js";
import { toCommandTreeList } from "sock-secret";
import { isObjAny, toSign } from "../create.js";
import { toSockClient } from "sock-secret";
import { isTrio } from "./types.js";
import path from 'node:path';
import fs from 'fs'

import type { ClientOut, NewClientOut } from "opaque-low-io";
import type { Installed } from "../create.js";
import type { TreeAny } from "sock-secret"
import type { UserInstall } from "../create.js";
import type { AppOutput } from "../create.js";
import type { Git, Trio } from "./types.js";
import type { Encrypted, Secrets } from "./encrypt.js";

export type HasGit = { git: Git }
export type DevConfig = {
  vars: string,
  msg: string,
  dir: string
}
export type UserIn = HasGit & {
  delay: number,
  prod: boolean,
  dev_config: DevConfig
}
type HasSessionHash = {
  session_hash: Uint8Array;
}
export type InstallIn = HasGit & {
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
type InboxIn = {
  ses: string,
  table: string
}
type DevInboxIn = InboxIn & {
  dev_config: DevConfig
}
type DevMessageIn = {
  delay: number,
  dev_config: DevConfig
}
type ParseInboxIn = {
  tree: TreeAny,
  shared: string
}
interface ReadUserInstall {
  (u: InstallIn): Promise<UserInstall>;
}
interface ReadUserApp {
  (u: UserIn): Promise<UserApp>;
}
interface ParseInbox {
  (o: ParseInboxIn): Trio;
}
interface ReadInbox {
  (u: InboxIn): Promise<Trio>;
}
interface ReadDevInbox {
  (u: DevInboxIn): Promise<boolean>;
}
interface ReadDevMessage {
  (u: DevMessageIn): Promise<boolean>;
}
interface UseTempFile {
  (i: DevConfig, k: 'msg' | 'vars'): string; 
}
export type NameTree = {
  command: string,
  tree: TreeAny
} 
interface ToNameTree {
  (t: string): NameTree;
}
interface UseGitInstalled {
  (git: Git, i: { installed: Installed }): Git
}
export type HasShared = {
  shared: string 
}
export type LoginStart = {
  client_auth_data: NewClientOut["client_auth_data"]
}

export type LoginEnd = {
  client_auth_result: ClientOut["client_auth_result"]
}

function hasShared(u: TreeAny): u is HasShared {
  if (u.shared && typeof u.shared === "string") {
    return u.shared.length > 0;
  }
  return false;
}

function hasSessionHash(u: TreeAny): u is HasSessionHash {
  if ("session_hash" in (u as HasSessionHash)) {
    return ArrayBuffer.isView(u.session_hash);
  }
  return false;
}

function isEncrypted(d: TreeAny): d is Encrypted {
  const needs = [ d.iv, d.tag, d.ev ];
  return needs.every(v => v instanceof Uint8Array);
}

function hasEncrypted(d: TreeAny): d is Secrets {
  const { salt, key, data } = d;
  if (!isObjAny(key) || !isObjAny(data)) {
    return false;
  }
  const needs = [
    salt instanceof Uint8Array,
    isEncrypted(data), isEncrypted(key)
  ];
  return needs.every(v => v);
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

function isLoginEnd(nt: TreeAny): nt is LoginEnd {
  const o = (nt as LoginEnd).client_auth_result || "";
  if (!isObjAny(o)) return false;
  return o.Au instanceof Uint8Array;
}

const useTempFile: UseTempFile = (dev_config, k) => {
  const dir = dev_config.dir;
  const fname = dev_config[k];
  const tmp_dir = path.relative(process.cwd(), dir);
  return path.join(tmp_dir, fname);
}

const toReadDevMsg = (dev_config: DevConfig) => {
  const src = useTempFile(dev_config, 'msg' as const);
  return async () => {
    return fs.readFileSync(src, { encoding: 'utf-8' });
  }
}

const toReadDevVars = (dev_config: DevConfig) => {
  const src = useTempFile(dev_config, 'vars' as const);
  return async () => {
    return fs.readFileSync(src, { encoding: 'utf-8' });
  }
}

const readUserApp: ReadUserApp = async (user_in) => {
  const { git, prod, delay, dev_config } = user_in;
  const file_in = { read: toReadDevMsg(dev_config) }; 
  const release_in = { git };
  const input = prod ? release_in : file_in;
  const sock = await toSockClient({ input, delay });
  const C = await sock.get("U", "C");
  const S = await sock.get("U", "S");
  sock.quit();
  if (C && hasEncrypted(C) && S && isServerAuthData(S)) {
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

const toBytes = (s: string) => {
  const a: string[] = s.match(/../g) || [];
  const bytes = a.map(h =>parseInt(h,16)); 
  return new Uint8Array(bytes);
}

const useGitInstalled: UseGitInstalled = (git, i) => {
  const { owner, repo } = git;
  const owner_token = i.installed.token;
  return { owner, repo, owner_token };
}

const toInstallation = (inst: string) => {
  const ins_value = process.env[inst] || "";
  const ins_obj = fromB64urlQuery(ins_value);
  if (!isInstallation(ins_obj)) {
    throw new Error(`Secret ${inst} invalid.`);
  }
  return ins_obj;
}

const parseInbox: ParseInbox = ({ tree, shared }) => {
  const key = toBytes(shared);
  if (!tree.data) {
    throw new Error('Missing inbox');
  }
  if (!hasEncryptionKeys(tree.data)) {
    throw new Error('Invalid inbox');
  }
  const { data } = tree;
  const error = "Invalid inbox or session key.";
  const out = tryDecryptSecret({ data, key, error });
  const plain_text = new TextDecoder().decode(out);
  const trio = plain_text.split("\n");
  if (isTrio(trio)) {
    return trio;
  }
  throw new Error('Invalid inbox table');
}

const readInbox: ReadInbox = async (inputs) => {
  const { table, ses } = inputs;
  const ses_str = process.env[ses] || "";
  const session = fromB64urlQuery(ses_str);
  if (!hasShared(session)) {
    return ["", "", ""];
  }
  const { shared } = session;
  const text = process.env[table] || "";
  const tree = fromB64urlQuery(text);
  return parseInbox({ tree, shared });
}

const readDevInbox: ReadDevInbox = async (inputs) => {
  const { dev_config, table, ses } = inputs;
  const ses_str = process.env[ses] || "";
  const session = fromB64urlQuery(ses_str);
  if (!hasShared(session)) {
    return false;
  }
  const { shared } = session;
  const text = await toReadDevVars(dev_config)();
  const found = toCommandTreeList(text).find(ct => {
    return ct.command === table;
  });
  if (!found) {
    return false;
  }
  const { tree } = found;
  try {
    parseInbox({ tree, shared });
    process.env[table] = toB64urlQuery(tree);
  }
  catch {
    throw new Error('Cannot decrypt dev inbox');
  }
  const v_src = useTempFile(dev_config, 'vars' as const);
  fs.truncateSync(v_src, 0);
  return true;
}

const readLoginStart: ReadDevMessage = async (ins) => {
  const input = { read: toReadDevMsg(ins.dev_config) }; 
  const sock = await toSockClient({ input, delay: ins.delay });
  const tree = await sock.get("op:pake", "client_auth_data");
  sock.quit();
  return isLoginStart(tree || {});
}

const readLoginEnd: ReadDevMessage = async (ins) => {
  const input = { read: toReadDevMsg(ins.dev_config) }; 
  const sock = await toSockClient({ input, delay: ins.delay });
  const tree = await sock.get("op:pake", "client_auth_result");
  sock.quit();
  return isLoginEnd(tree || {});
}

const readUserInstall: ReadUserInstall = async (ins) => {
  const k = "install" as const;
  const { owner } = ins.git;
  const app_token = toSign(ins.app);
  const input = { k, owner, app_token };
  const sock = await toSockClient({ input, delay: ins.delay });
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

export { 
  readUserApp, readUserInstall, isEncrypted, hasShared,
  isLoginStart, isLoginEnd, toNameTree, useGitInstalled,
  readLoginStart, readLoginEnd, readDevInbox, toBytes,
  toInstallation, readInbox, hasSessionHash
}
