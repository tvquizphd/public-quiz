import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { toSockServer, fromCommandTreeList } from "sock-secret";
import { needKeys } from "./util/keys.js";
import { OP, OPS } from "opaque-low-io";
import { hasShared, toBytes } from "./util/pasted.js";
import { encryptQueryMaster } from "./util/encrypt.js";
import { isObjAny } from "./create.js";

import type { SockServer } from "sock-secret";
import type { QMI } from "./util/encrypt.js";
import type { Trio } from "./util/types.js";
import type { Installation, HasToken } from "./create.js";
import type { NameTree, CommandTreeList } from "sock-secret";
import type { NodeAny, TreeAny } from "sock-secret";
import type { LoginStart, LoginEnd, HasShared } from "./util/pasted.js";
import type { ServerFinal, ServerOut } from "opaque-low-io";
import type { Io, Op, Ops, Pepper } from 'opaque-low-io';

type CommandKeys = (
  "RESET" | "OPEN_IN" | "OPEN_NEXT" | "OPEN_OUT" |
  "CLOSE_IN"
)
type MailKeys = (
  "USER" | "SESSION" 
)
type HasNewUser = {
  user: HasShared
}
type HasServerFinal = {
  final: ServerFinal;
}
type LastStep =  (
  Partial<HasNewUser> & HasServerFinal
)
export type Commands = Record<CommandKeys, string> 
export type MailTypes = Record<MailKeys, string> 
type SockInputs = {
  inputs: CommandTreeList 
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
export type SecretOut = {
  secrets: CommandTreeList,
  for_pages: string,
  for_next: string
}
type RegisterInputs = {
  pep: string,
  tree: LoginStart,
}
type PepperInputs = RegisterInputs & {
  Opaque: Op,
  times: number,
  reset: boolean,
  pep: string
}
type HasPepper = Record<"pepper", Pepper>
interface ToPepper {
  (i: PepperInputs): Promise<HasPepper> 
}
type Inputs = {
  commands: Commands
}
type InputsFirst = Inputs & RegisterInputs & {
  pub_ctli: CommandTreeList,
  shared: string,
  reset: boolean
}; 
type InputsFinal = Inputs & {
  final: ServerFinal, tree: LoginEnd
}; 
type InputsUpdateUser = {
  mail_types: MailTypes,
  preface: CommandTreeList,
  installation: Installation
}
type InputsMail = HasToken & {
  table: string,
  trio: Trio,
  mail_types: MailTypes,
  installation: Installation
}
type Enc = [QMI, string];
interface EncryptLine {
  (line: Enc): Promise<NameTree>;
}
interface EncryptLines {
  (lines: Enc[]): Promise<CommandTreeList>;
}
interface Start {
  (i: InputsFirst): Promise<SecretOut>
}
interface Login {
  (i: InputsFinal): Promise<HasToken>
}
interface Mail {
  (i: InputsMail): Promise<SecretOut>
}
interface UpdateUser {
  (i: InputsUpdateUser): Promise<SecretOut>
}

function hasNewUser(o: TreeAny): o is HasNewUser {
  if (!isObjAny(o.user)) return false;
  return hasShared(o.user);
}

function isServerFinal(o: TreeAny): o is ServerFinal {
  const needs = [
    o.Au instanceof Uint8Array,
    typeof o.token === "string"
  ];
  return needs.every(v => v);
}

function hasServerFinal(o: TreeAny): o is HasServerFinal {
  if (!isObjAny(o.final)) return false;
  return isServerFinal(o.final);
}

const isServerOut = (o: NodeAny): o is ServerOut => {
  const t = (o as ServerOut).server_auth_data;
  if (!t || !isObjAny(t)) {
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

const toPepper: ToPepper = async (opts) => {
  const { times, pep } = opts;
  const { Opaque, reset, tree } = opts;
  const { sid, pw } = tree.client_auth_data;
  const secret_str = process.env[pep] || '';
  const pepper = fromB64urlQuery(secret_str);
  if (!reset && isPepper(pepper)) {
    return { pepper };
  }
  const pep_in = { sid, pw };
  const reg = await Opaque.toServerPepper(pep_in, times);
  if (!isPepper(reg.pepper)) {
    throw new Error('Unable to register Opaque client');
  }
  return { pepper: reg.pepper };
}

const toUserSock: ToUserSock = async (opts) => {
  const Sock = await toSockServer(opts);
  if (Sock === null) {
    throw new Error('Unable to make socket.');
  }
  const Opaque = await OP(Sock as Io);
  return { Opaque, Sock };
}

const toSyncOp: ToSyncOp = async () => {
  return await OPS();
}

const vStart: Start = async (opts) => {
  const { reset, tree, pep } = opts;
  const { commands, pub_ctli } = opts;
  const { OPEN_IN, OPEN_OUT } = commands;
  const { OPEN_NEXT } = commands;
  const inputs = [{ command: OPEN_IN, tree }];
  const { Opaque, Sock } = await toUserSock({ inputs });
  const times = 1000;
  const pepper_in = {
    Opaque, times, reset, pep, tree
  };
  const reg = await toPepper(pepper_in);
  const pep_out = { command: pep, tree: reg.pepper };
  const final = await Opaque.serverStep(reg, "op");
  const pages_out = Sock.quit().find(nt => {
    return nt.command === OPEN_OUT;
  });
  if (!pages_out || !isServerOut(pages_out.tree)) {
    throw new Error('Unable to initialize opaque');
  }
  const next_tree: LastStep = { final };
  if (reset && opts.shared.length) {
    const { shared } = opts;
    next_tree.user = { shared };
  }
  const next_out = { command: OPEN_NEXT, tree: next_tree };
  const for_next = fromCommandTreeList([ next_out ]);
  const secrets = [ pep_out, next_out ];
  const old_out = pub_ctli.filter((ct) => {
    return ct.command !== pages_out.command;
  });
  const for_pages = fromCommandTreeList([ ...old_out, pages_out ]);
  return { for_next, for_pages, secrets }
}

const encryptLine: EncryptLine = async ([en, command]) => {
  const tree = fromB64urlQuery(await encryptQueryMaster(en));
  return { command, tree };
}

const encryptLines: EncryptLines = async (lines) => {
  const ctli = lines.map(encryptLine);
  return await Promise.all(ctli);
}

const vLogin: Login = async (opts) => {
  const { commands } = opts;
  const { tree, final } = opts;
  const { CLOSE_IN } = commands;
  const inputs = [{ command: CLOSE_IN, tree }];
  const { Opaque } = await toUserSock({ inputs });
  // Authorized the client
  return await Opaque.serverStep(final, "op");
}

const updateUser: UpdateUser = async (opts) => {
  const { mail_types, installation, preface } = opts;
  const { installed, shared } = installation;
  const ins_text = toB64urlQuery(installed);
  const user_key = toBytes(shared);
  const en = {
    plain_text: ins_text, 
    master_key: user_key
  }
  const encrypted = await encryptQueryMaster(en);
  const tree = fromB64urlQuery(encrypted);
  const for_pages = fromCommandTreeList([
    { command: mail_types.USER, tree }, ...preface
  ]);
  return { secrets: [], for_next: "", for_pages };
}

const vMail: Mail = async (opts) => {
  const command = opts.table;
  const { mail_types, token } = opts;
  const { installation, trio } = opts;
  const { installed, shared } = installation;
  const ins_text = toB64urlQuery(installed);
  const text_rows = trio.join('\n');
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
  const outbox = await encryptLines([
    [encrypt_user, mail_types.USER],
    [encrypt_session, mail_types.SESSION]
  ]);
  const { tree } = await encryptLine([encrypt_session, command]);
  const secrets = [{ command, tree }];
  const for_pages = fromCommandTreeList(outbox);
  return { for_next: "", for_pages, secrets };
}


export { 
  toSyncOp, vStart, vLogin, vMail, updateUser,
  hasNewUser, hasServerFinal
};
