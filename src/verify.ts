import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { toSockServer, fromCommandTreeList } from "sock-secret";
import { useGitInstalled } from "./util/pasted.js";
import { setSecret } from "./util/secrets.js";
import { needKeys } from "./util/keys.js";
import { OP, OPS } from "opaque-low-io";
import { toBytes } from "./util/pasted.js";
import { encryptQueryMaster } from "./util/encrypt.js";
import { isObjAny } from "./create.js";

import type { SockServer } from "sock-secret";
import type { QMI } from "./util/encrypt.js";
import type { Git, Trio } from "./util/types.js";
import type { Installation, HasToken } from "./create.js";
import type { NameTree, CommandTreeList } from "sock-secret";
import type { NodeAny, TreeAny } from "sock-secret";
import type { LoginStart, LoginEnd } from "./util/pasted.js";
import type { ServerFinal, ServerOut } from "opaque-low-io";
import type { Io, Op, Ops, Pepper } from 'opaque-low-io';

type CommandKeys = (
  "RESET" | "OPEN_IN" | "OPEN_NEXT" | "OPEN_OUT" |
  "CLOSE_IN" | "NEW_SHARED"
)
type MailKeys = (
  "USER" | "SESSION" 
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
type SecretOut = {
  for_pages: string,
  for_next: string
}
type ConfigIn = {
  pep: string,
  env: string,
  git: Git
}
type RegisterInputs = {
  tree: LoginStart,
  delay: number
}
type PepperInputs = RegisterInputs & {
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
  delay: number,
  log_in: ConfigIn,
  commands: Commands
}
type InputsFirst = Inputs & RegisterInputs & {
  pub_ctli: CommandTreeList,
  shared: string,
  reset: boolean,
}; 
type InputsFinal = Inputs & {
  final: ServerFinal, tree: LoginEnd, ses: string
}; 
type InputsUpdateUser = {
  mail_types: MailTypes,
  preface: CommandTreeList,
  installation: Installation
}
type InputsMail = HasToken & {
  git: Git,
  table: string,
  delay: number,
  env: string,
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
  const { git, env, times, pep } = opts;
  const { Opaque, reset, tree, delay } = opts;
  const { sid, pw } = tree.client_auth_data;
  const secret_str = process.env[pep] || '';
  const pepper = fromB64urlQuery(secret_str);
  if (reset) {
    console.log('Authorized Password reset!!');
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
  try {
    const command = pep;
    const tree = reg.pepper;
    await setSecret({ git, env, delay, tree, command });
    console.log('Saved pepper to secrets.');
  }
  catch (e: any) {
    console.error('Can\'t save pepper to secrets.');
    console.error(e.message);
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

interface ToResetOut {
  (a: string, b: boolean, c: string): CommandTreeList;
}

const toResetOut: ToResetOut = (command, reset, shared) => {
  if (reset && shared.length) {
    return [{ command, tree: { shared } }];
  }
  return [] as CommandTreeList;
}

const vStart: Start = async (opts) => {
  const { delay, reset, tree } = opts;
  const { commands, pub_ctli } = opts;
  const { git, env, pep } = opts.log_in;
  const { OPEN_IN, OPEN_OUT } = commands;
  const { OPEN_NEXT, NEW_SHARED } = commands;
  const inputs = [{ command: OPEN_IN, tree }];
  const { Opaque, Sock } = await toUserSock({ inputs });
  const times = 1000;
  const pepper_in = {
    Opaque, times, delay, reset, env, pep, git, tree
  };
  const reg = await toPepper(pepper_in);
  const next_tree = await Opaque.serverStep(reg, "op");
  const next_out = { command: OPEN_NEXT, tree: next_tree };
  const pages_out = Sock.quit().find(nt => {
    return nt.command === OPEN_OUT;
  });
  if (!pages_out || !isServerOut(pages_out.tree)) {
    throw new Error('Cannot send invalid data.');
  }
  const reset_out = toResetOut(NEW_SHARED, reset, opts.shared);
  const ctli = [ next_out, ...reset_out ];
  await Promise.all(ctli.map(async ({ command, tree }) => {
    await setSecret({ git, env, delay, tree, command });
  }));
  const for_next = fromCommandTreeList(ctli);
  const old_out = pub_ctli.filter((ct) => {
    return ct.command !== pages_out.command;
  });
  const for_pages = fromCommandTreeList([ ...old_out, pages_out ]);
  return { for_next, for_pages }
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
  const { ses, commands } = opts;
  const { delay, tree, final } = opts;
  const { CLOSE_IN } = commands;
  const inputs = [{ command: CLOSE_IN, tree }];
  const { Opaque } = await toUserSock({ inputs });
  // Authorized the client
  const { token } = await Opaque.serverStep(final, "op");
  try {
    const command = ses;
    const { git, env } = opts.log_in;
    const tree = { shared: final.token };
    await setSecret({ git, env, delay, tree, command });
    console.log('Saved session to secrets.');
  }
  catch (e: any) {
    console.error('Can\'t save session to secrets.');
  }
  return { token };
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
  return { for_next: "", for_pages };
}

const vMail: Mail = async (opts) => {
  const command = opts.table;
  const { git, delay, env } = opts;
  const { mail_types, token } = opts;
  const { installation, trio } = opts;
  const { installed, shared } = installation;
  const igit = useGitInstalled(git, installed);
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
  await setSecret({ git: igit, delay, env, command, tree });
  const for_pages = fromCommandTreeList(outbox);
  return { for_next: "", for_pages };
}


export { toSyncOp, vStart, vLogin, vMail, updateUser };
