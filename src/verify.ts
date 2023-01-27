import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { toSockServer, fromCommandTreeList } from "sock-secret";
import { setSecret, setSecretText } from "./util/secrets.js";
import { needKeys } from "./util/keys.js";
import { OP, OPS } from "opaque-low-io";
import { isTree } from "./util/pasted.js";
import { fromNameTree, toBytes } from "./util/pasted.js";
import { encryptQueryMaster } from "./util/encrypt.js";
import { isInstallation } from "./create.js";

import type { SockServer } from "sock-secret";
import type { QMI } from "./util/encrypt.js";
import type { Git, Trio } from "./util/types.js";
import type { CommandTreeList, NodeAny, TreeAny } from "sock-secret";
import type { LoginStart, LoginEnd } from "./util/pasted.js";
import type { ServerFinal, ServerOut } from "opaque-low-io";
import type { Io, Op, Ops, Pepper } from 'opaque-low-io';

type CommandKeys = (
  "OPEN_IN" | "OPEN_NEXT" | "OPEN_OUT" |
  "CLOSE_IN" | "CLOSE_USER" | "CLOSE_MAIL"
)
export type Commands = Record<CommandKeys, string> 
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
  reset: boolean,
  login: boolean,
  delay: number,
  pep: string,
  env: string,
  git: Git
}
type RegisterInputs = {
  tree: LoginStart
}
type LoginInputs = {
  tree: LoginEnd
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
  log_in: ConfigIn,
  commands: Commands
}
type InputsFirst = Inputs & RegisterInputs; 
type InputsFinal = Inputs & LoginInputs & {
  final: ServerFinal, trio: Trio, inst: string, ses: string
}; 
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

const toPepper: ToPepper = async (opts) => {
  const { git, env, times, pep } = opts;
  const { Opaque, reset, tree } = opts;
  const { sid, pw } = tree.client_auth_data;
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
  try {
    await setSecret({ 
      git, env, tree: reg.pepper, command: pep
    });
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

const vStart: Start = async (opts) => {
  const { commands, tree } = opts;
  const { git, env, pep, reset } = opts.log_in;
  const { OPEN_IN, OPEN_NEXT, OPEN_OUT } = commands;
  const inputs = [{ command: OPEN_IN, tree }];
  const { Opaque, Sock } = await toUserSock({ inputs });
  const times = 1000;
  const pepper_in = {
    Opaque, times, reset, env, pep, git, tree
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
  const for_next = fromCommandTreeList([ next_out ]);
  const for_pages = fromCommandTreeList([ pages_out ]);
  return { for_next, for_pages }
}

const encryptLine: EncryptLine = async (en, command) => {
  const tree = fromB64urlQuery(await encryptQueryMaster(en));
  return fromNameTree({ command, tree });
}

const vLogin: Login = async (opts) => {
  const { ses, inst, commands, tree, final } = opts;
  const { CLOSE_IN, CLOSE_USER, CLOSE_MAIL } = commands;
  const inputs = [{ command: CLOSE_IN, tree }];
  const { Opaque } = await toUserSock({ inputs });
  // Authorized the client
  const { token } = await Opaque.serverStep(final, "op");
  try {
    const secret = final.token;
    const { git, env } = opts.log_in;
    await setSecretText({ git, secret, env, name: ses });
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
  const text_rows = opts.trio.join('\n');
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
  const user_line = await encryptLine(encrypt_user, CLOSE_USER);
  const session_line = await encryptLine(encrypt_session, CLOSE_MAIL);
  const for_pages = [user_line, session_line].join('/');
  return { for_next: "", for_pages };
}

export { toSyncOp, vStart, vLogin };
