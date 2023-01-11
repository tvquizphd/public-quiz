import { toB64urlQuery, fromB64urlQuery } from "project-sock";
import { addSecret } from "./util/secrets.js";
import { needKeys } from "./util/keys.js";
import { OP, OPS } from "opaque-low-io";
import { toSockServer } from "sock-secret";
import { toPasted, useGit, isTree } from "./util/pasted.js";
import { encryptQueryMaster } from "./util/encrypt.js";

import type { SockServer } from "sock-secret";
import type { UserIn } from "./util/pasted.js";
import type { Git, Trio } from "./util/types.js";
import type { TreeAny } from "project-sock";
import type { ServerFinal, ServerOut } from "opaque-low-io";
import type { Io, Op, Ops, Pepper } from 'opaque-low-io';

type Need = "first" | "last";
type Needs = Record<Need, string[]>;
type SockInputs = {
  git: Git,
  env: string,
  secrets: string,
  lister?: Lister | null,
  needs: Partial<Needs>
}
type UserOutputs = {
  Sock: SockServer,
  Opaque: Op
}
interface ToUserSock {
  (i: SockInputs): Promise<UserOutputs>;
}
interface ToSyncOp {
  (): Promise<Ops>;
}
type SecretOut = {
  for_pages: string,
  for_next: string
}
type ConfigIn = {
  reset: boolean,
  login: boolean,
  delay: number,
  pep: string,
  env: string,
  git: Git
}
type Register = {
  sid: string,
  pw: Uint8Array
}
type PepperInputs = Register & {
  Opaque: Op,
  times: number,
  reset: boolean,
  env: string,
  pep: string,
  git: Git
}
type HasPepper = Record<"pepper", Pepper>
interface ToPepper {
  (i: PepperInputs): Promise<HasPepper> 
}
type Inputs = {
  prefix: string,
  secrets: string,
  user_in: UserIn,
  log_in: ConfigIn
}
type InputsFirst = Inputs & Register; 
type InputsFinal = Inputs & ServerFinal & {
  sec: Trio, ses: string
}; 
type Lister = {
  (): Promise<string[]>;
}
interface ReadNames {
  (p: string, i: UserIn): Promise<string[]>;
}
interface ToList {
  (p: string, i: UserIn): Lister;
}
interface Start {
  (i: InputsFirst): Promise<SecretOut>
}
interface Login {
  (i: InputsFinal): Promise<SecretOut>
}
interface RemovePrefix {
  (p: string, t: TreeAny): string;
}

const isServerOut = (o: TreeAny): o is ServerOut => {
  const t = (o as ServerOut).server_auth_data;
  if (!t || !isTree(t)) {
    return false;
  }
  const { beta, Xs, As, c } = t;
  if (c && c.pu && c.Pu && c.Ps) {
    const keys = [ 
      c.pu.mac_tag, c.Pu.mac_tag, c.Ps.mac_tag,
      c.pu.body, c.Pu.body, c.Ps.body
    ];
    return [ ...keys, beta, Xs, As ].every(v => {
      return v.constructor === Uint8Array;
    });
  }
  return false
}

const isPepper = (t: TreeAny): t is Pepper => {
  const pepperKeys = 'ks ps Ps Pu c'.split(' '); 
  try {
    needKeys(t, pepperKeys);
  }
  catch {
    return false;
  }
  return true
}

const toPepper: ToPepper = async (inputs) => {
  const { git, env, times, pep } = inputs;
  const { Opaque, reset, sid, pw } = inputs;
  const secret_str = process.env[pep] || '';
  const pepper = fromB64urlQuery(secret_str);
  if (reset) {
    console.log('Allowing password reset!');
  }
  if (!reset && isPepper(pepper)) {
    console.log('Loaded pepper from secrets.');
    return { pepper };
  }
  const pep_in = { sid, pw };
  const reg = await Opaque.toServerPepper(pep_in, times);
  if (!isPepper(reg.pepper)) {
    throw new Error('Unable to register Opaque client');
  }
  const secret = toB64urlQuery(reg.pepper);
  const add_inputs = { git, secret, env, name: pep };
  try {
    await addSecret(add_inputs);
    console.log('Saved pepper to secrets.');
  }
  catch (e: any) {
    console.error('Can\'t save pepper to secrets.');
    console.error(e.message);
  }
  return { pepper: reg.pepper };
}

const toUserSock: ToUserSock = async (inputs) => {
  const Sock = await toSockServer(inputs);
  if (Sock === null) {
    throw new Error('Unable to make socket.');
  }
  const Opaque = await OP(Sock as Io);
  return { Opaque, Sock };
}

const toSyncOp: ToSyncOp = async () => {
  return await OPS();
}

const readNames: ReadNames = async (prefix, ins) => {
  const { tmp_file: src } = useGit(ins);
  const text = await toPasted(src);
  const pasted = fromB64urlQuery(text);
  return Object.keys(pasted).map(n => prefix + n);
}

const toList: ToList = (prefix, ins) => {
  return async () => {
    return await readNames(prefix, ins);
  }
}

const to_bytes = (s: string) => {
  const a: string[] = s.match(/../g) || [];
  const bytes = a.map(h =>parseInt(h,16)); 
  return new Uint8Array(bytes);
}

const removePrefix: RemovePrefix = (prefix, tree) => {
  const output: TreeAny =  {};
  for (const key in tree) {
    const t = tree[key];
    const pre_key = key.replace(prefix, "");
    if (isTree(t) && pre_key in t) {
      output[pre_key] = t[pre_key];
    }
  }
  return toB64urlQuery(output);
}

const vStart: Start = async (inputs) => {
  const { git, env, pep, reset } = inputs.log_in;
  const { sid, pw, user_in, secrets, prefix } = inputs;
  const { prod } = user_in;
  const first = ["client_auth_data"].map(n => prefix + n);
  const needs = { first, last: [] };
  const lister = prod ? null : toList(prefix, user_in);
  const sock_in = { git, env, needs, lister, secrets };
  const { Opaque, Sock } = await toUserSock(sock_in);
  const times = 1000;
  const pepper_in = {
    Opaque, times, reset, env, pep, git, sid, pw
  };
  const reg = await toPepper(pepper_in);
  const out = await Opaque.serverStep(reg, "op");
  const sent = await Sock.quit();
  const server_out = fromB64urlQuery(sent);
  const for_pages = removePrefix(prefix, server_out);
  if (!isServerOut(fromB64urlQuery(for_pages))) {
    throw new Error('Cannot send invalid data.');
  }
  return {
    for_next: toB64urlQuery(out),
    for_pages: for_pages 
  }
}

const vLogin: Login = async (inputs) => {
  const { secrets, prefix, Au, ses } = inputs;
  const { token: secret } = inputs;
  const master_key = to_bytes(secret);
  const { git, env } = inputs.log_in;
  const step = { token: secret, Au };
  const first = ["client_auth_result"].map(n => prefix + n);
  const needs = { first, last: [] };
  const sock_in = { git, env, needs, secrets };
  const { Sock, Opaque } = await toUserSock(sock_in);
  // Authorized the client
  await Opaque.serverStep(step, "op");
  await Sock.quit();
  const add_inputs = { git, secret, env, name: ses };
  try {
    await addSecret(add_inputs);
    console.log('Saved session to secrets.');
  }
  catch (e: any) {
    console.error('Can\'t save session to secrets.');
    console.error(e.message);
  }
  const plain_text = inputs.sec.map((name: string) => {
    return process.env[name] || '';
  }).join('\n');
  const to_encrypt = { plain_text, master_key };
  const for_pages = await encryptQueryMaster(to_encrypt);
  return { for_next: "", for_pages };
}

export { toUserSock, toSyncOp, vStart, vLogin };
