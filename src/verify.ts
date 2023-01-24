import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { addSecret } from "./util/secrets.js";
import { needKeys } from "./util/keys.js";
import { OP, OPS } from "opaque-low-io";
import { toSockServer } from "sock-secret";
import { toPastedText, isTree } from "./util/pasted.js";
import { toNameTree, fromNameTree, toBytes } from "./util/pasted.js";
import { encryptQueryMaster } from "./util/encrypt.js";
import { isInstallation } from "./create.js";

import type { SockServer } from "sock-secret";
import type { QMI } from "./util/encrypt.js";
import type { UserIn } from "./util/pasted.js";
import type { Git, Trio } from "./util/types.js";
import type { NodeAny, TreeAny } from "sock-secret";
import type { ServerFinal, ServerOut } from "opaque-low-io";
import type { Io, Op, Ops, Pepper } from 'opaque-low-io';

type Need = "first" | "last";
type Needs = Record<Need, string[]>;
type SockInputs = {
  git: Git,
  env: string,
  secrets: TreeAny,
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
  finish: string,
  command: string,
  tree: TreeAny,
  user_in: UserIn,
  log_in: ConfigIn
}
type InputsFirst = Inputs & Register; 
type InputsFinal = Inputs & ServerFinal & {
  sec: Trio, inst: string, ses: string
}; 
type Lister = {
  (): Promise<string[]>;
}
interface ReadNames {
  (i: UserIn): Promise<string[]>;
}
interface ToList {
  (i: UserIn): Lister;
}
interface EncryptLine {
  (e: QMI, c: string): Promise<string>;
}
interface Start {
  (i: InputsFirst): Promise<SecretOut>
}
interface Login {
  (i: InputsFinal): Promise<SecretOut>
}

const isServerOut = (o: NodeAny): o is ServerOut => {
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

const readNames: ReadNames = async (ins) => {
  const text = await toPastedText(ins);
  const { command } = toNameTree(text);
  return [ command ];
}

const toDevList: ToList = (ins) => {
  return async () => {
    return await readNames(ins);
  }
}

const vStart: Start = async (inputs) => {
  const { git, env, pep, reset } = inputs.log_in;
  const { command, finish, tree } = inputs;
  const { sid, pw, user_in } = inputs;
  const { prod } = user_in;
  const secrets = { [command]: tree };
  const needs = { first: [command], last: [] };
  const lister = prod ? null : toDevList(user_in);
  const sock_in = { git, env, needs, lister, secrets };
  const { Opaque, Sock } = await toUserSock(sock_in);
  const times = 1000;
  const pepper_in = {
    Opaque, times, reset, env, pep, git, sid, pw
  };
  const reg = await toPepper(pepper_in);
  const out = await Opaque.serverStep(reg, "op");
  const tree_out = await Sock.quit([]);
  if (!(finish in tree_out)) {
    throw new Error('Cannot send missing data.');
  }
  if (!isServerOut(tree_out[finish])) {
    throw new Error('Cannot send invalid data.');
  }
  const out_args = { command: finish, tree: tree_out };
  const for_next = toB64urlQuery(out);
  const for_pages = fromNameTree(out_args);
  return { for_next, for_pages  }
}

const encryptLine: EncryptLine = async (en, command) => {
  const tree = fromB64urlQuery(await encryptQueryMaster(en));
  return fromNameTree({ command, tree });
}

const vLogin: Login = async (inputs) => {
  const { token: secret } = inputs;
  const { Au, ses, inst, finish } = inputs;
  //const master_key = toBytes(secret);
  const { git, env } = inputs.log_in;
  const { prod } = inputs.user_in;
  const { command, tree } = inputs;
  const secrets = { [command]: tree };
  const step = { token: secret, Au };
  const needs = { first: [command], last: [] };
  const sock_in = { git, env, needs, secrets };
  const { Sock, Opaque } = await toUserSock(sock_in);
  // Authorized the client
  const { token } = await Opaque.serverStep(step, "op");
  await Sock.quit([]);
  const add_inputs = { git, secret, env, name: ses };
  try {
    await addSecret(add_inputs);
    console.log('Saved session to secrets.');
  }
  catch (e: any) {
    console.error('Can\'t save session to secrets.');
    console.error(e.message);
  }
  const ins_value = process.env[inst] || "";
  const ins_obj = fromB64urlQuery(ins_value);
  if (!isInstallation(ins_obj)) {
    throw new Error(`Secret ${inst} invalid.`);
  }
  const { installed, shared } = ins_obj;
  const ins_text = toB64urlQuery(installed);
  const text_rows = inputs.sec.map((k: string) => {
    if (!prod) {
      return process.env[k] || "";
    }
  }).join('\n');
  const user_command = "mail__user";
  const session_key = toBytes(token);
  const user_key = toBytes(shared);
  const encrypt_user = {
    plain_text: ins_text, 
    master_key: user_key
  }
  const encrypt_session = {
    plain_text: text_rows, 
    master_key: session_key
  };
  const user_line = await encryptLine(encrypt_user, user_command);
  const session_line = await encryptLine(encrypt_session, finish);
  const for_pages = [user_line, session_line].join('+++TODO+++');
  return { for_next: "", for_pages };
}

export { toUserSock, toSyncOp, vStart, vLogin };
