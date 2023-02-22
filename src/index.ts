import { isLoginStart, isLoginEnd, toInstallation } from "./util/pasted.js";
import { hasShared, readLoginStart, readLoginEnd } from "./util/pasted.js";
import { readUserApp, readUserInstall, isEncrypted } from "./util/pasted.js";
import { readInbox, readDevInbox } from "./util/pasted.js";
import { useGitInstalled, hasSessionHash } from "./util/pasted.js";
import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { toCommandTreeList, fromCommandTreeList } from "sock-secret";
import { setSecret, isProduction } from "./util/secrets.js";
import { 
  vStart, vLogin, vMail, updateUser, toSyncOp,
  hasServerFinal, hasNewUser
} from "./verify.js";
import { encryptSecrets } from "./util/encrypt.js";
import { decryptQuery } from "./util/decrypt.js";
import { isFive, isQuad, isTrio, isDuo } from "./util/types.js";
import { isObjAny, isJWK, toApp, toInstall } from "./create.js";
import { vShare } from "./util/share.js";
import { getRandomValues } from "crypto";
import dotenv from "dotenv";
import argon2 from 'argon2';
import fs from "fs";

import type { Git, Duo } from "./util/types.js";
import type { SetInputs } from "./util/secrets.js";
import type { SecretOut, Commands } from "./verify.js";
import type {
  InstallIn, HasShared, DevConfig, LoginEnd, UserIn
} from "./util/pasted.js";
import type { AppOutput, Installation } from "./create.js";
import type { NewClientOut } from "opaque-low-io";
import type { TreeAny, NameTree, CommandTreeList } from "sock-secret"

type Result = {
  logs: LogItem[]
}
type StageKeys = (
  "PUB" | "STEP" | "APP" | "OUT"
)
type Stages = Record<StageKeys, string> 
type Found = NameTree | undefined
type NewAppIn = {
  user_in: UserIn,
  client_state: ClientState
}
type NewAppOut = {
  code: string,
  secret_out: ClientSecretOut
}
interface ToNewApp {
  (i: NewAppIn): Promise<NewAppOut | number>;
}
interface ToNewInst {
  (i: HasShared & InstallIn): Promise<Installation>;
}
interface CanResetUser {
  (o: { shared: string, ct: Found }): Promise<boolean>;
}
interface WriteOut {
  (i: Partial<SecretOut>): void;
}
type ClientState = {
  r: Uint8Array,
  xu: Uint8Array,
  mask: Uint8Array,
}
type ClientSecretOut = LoginEnd & {
  token: string
};
type TokenIn = HasShared & LoginEnd & {
  app: AppOutput
};
interface UseError {
  (l: ErrorLevel, m: unknown): ErrorItem;
}
interface ToError {
  (l: ErrorLevel, m: string): ErrorItem;
}
interface ToDebug {
  (l: DebugLevel, m: string): DebugItem;
}
type ErrorLevel = Log.error | Log.fatal;
type DebugLevel = Log.trace | Log.debug | Log.info;
enum Log {
  trace, debug, info, error, fatal
}
type ErrorItem = {
  level: ErrorLevel,
  obj: Error
}
type DebugItem = {
  level: DebugLevel,
  obj: { message: string, date: Date }
}
type LogItem = ErrorItem | DebugItem;

function isErrorItem(u: LogItem): u is ErrorItem {
  return (u as ErrorItem).obj instanceof Error;
}
function isNumber(u: unknown): u is number {
  return typeof u === "number";
}
const useError: UseError = (level, obj) => {
  if (obj instanceof Error) return { level, obj };
  return { level, obj: new Error("Unknown Error") };
}
const toError: ToError = (level, message) => {
  return useError(level, new Error(message));
}
const toDebug: ToDebug = (level, message) => {
  return { level, obj: { message, date: new Date() } };
}

function isClientState (o: TreeAny): o is ClientState {
  const needs = [
    o.r instanceof Uint8Array,
    o.xu instanceof Uint8Array,
    o.mask instanceof Uint8Array
  ]
  return needs.every(v => v);
}

function isTokenInputs (u: TreeAny): u is TokenIn {
  const o = u as TokenIn;
  if (!isLoginEnd(o)) {
    return false;
  }
  if (!isObjAny(o.app)) {
    return false;
  }
  if (!isObjAny(o.app.jwk)) {
    return false;
  }
  const needs = [ 
    typeof o.shared === "string",
    typeof o.app.client_secret === "string",
    typeof o.app.client_id === "string",
    typeof o.app.id === "string",
    isJWK(o.app.jwk)
  ];
  return needs.every(v => v);
}

const toNewApp: ToNewApp = async (opts) => {
  const { user_in, client_state } = opts;
  const user_out = await readUserApp(user_in);
  const { C, S: server_auth_data } = user_out;
  const { r, xu, mask } = client_state;
  const times = 1000; //Must match client
  const { toClientSecret } = await toSyncOp();
  const client_in = { r, xu, mask, server_auth_data };
  const secret_out = toClientSecret(client_in, times);
  if (isNumber(secret_out)) {
    return secret_out;
  }
  const shared = secret_out.token;
  const c = decryptQuery(toB64urlQuery(C), shared);
  const code = (await c).plain_text;
  return { code, secret_out };
}

const toNewInst: ToNewInst = async (install_in) => {
  const install = await readUserInstall(install_in);
  const installed = await toInstall(install);
  const { shared, app } = install_in;
  return { installed, shared, app };
}

const canResetUser: CanResetUser = async ({ shared, ct }) => {
  if (!ct || !hasSessionHash(ct.tree)) {
    return false;
  }
  const { session_hash: s_bytes } = ct.tree;
  const s = new TextDecoder().decode(s_bytes);
  return await argon2.verify(s, shared);
}

const toNewPassword = () => {
  const empty = new Uint8Array(3*23);
  const bytes = [...getRandomValues(empty)];
  return (Buffer.from(bytes)).toString('base64');
}

const writeOut: WriteOut = (inputs) => {
  const out_file = "secret.txt";
  const a = inputs?.for_pages || "";
  const b = inputs?.for_next || "";
  fs.writeFileSync(out_file, `${a}\n${b}`);
}

const toNew = (stages: Stages, opts: NewClientOut) => {
  const { client_auth_data, ...rest } = opts;
  const { STEP: step, PUB: command } = stages;
  const next_step = { command: step, tree: rest };
  const tree = { client_auth_data };
  return {
    for_pages: fromCommandTreeList([{ command, tree }]),
    for_next: fromCommandTreeList([next_step])
  }
}

const useSecrets = (stages: Stages, out: ClientSecretOut, app: AppOutput) => {
  const { token: shared, client_auth_result } = out;
  const tree = { client_auth_result };
  const next_obj = { 
    ...tree,
    shared,
    app: {
      id: app.id,
      jwk: app.jwk,
      client_id: app.client_id,
      client_secret: app.client_secret
    },
  };
  const { STEP: step, APP: command } = stages;
  const next_step = {
    command: step,
    tree: next_obj
  }
  return {
    for_pages: fromCommandTreeList([{ command, tree }]),
    for_next: fromCommandTreeList([next_step])
  }
}

const useGitFromEnv = (remote: Duo): Git => {
  return {
    repo: remote[1],
    owner: remote[0],
    owner_token: process.env.GITHUB_TOKEN || ''
  }
}

const toEnvCommands = (sl: string[]): CommandTreeList => {
  return sl.filter(s => s in process.env).map((s) => {
    const tree = fromB64urlQuery(process.env[s] || "");
    return { command: s, tree };
  })
}

(async (): Promise<Result> => {
  const logs: LogItem[] = [];
  const out: [Git, CommandTreeList][] = [];
  const args = process.argv.slice(2);
  if (args.length < 1) {
    const message = "Input is missing arguments.";
    logs.push(toError(Log.error, message));
    return { logs };
  }
  const commands: Commands = {
    OPEN_IN: "op:pake__client_auth_data",
    OPEN_OUT: "op:pake__server_auth_data",
    CLOSE_IN: "op:pake__client_auth_result",
    OPEN_NEXT: "LAST__STEP",
    RESET: "user__reset"
  }
  const final_env = [
    commands.OPEN_NEXT
  ];
  const NOOP = "noop";
  const table = "MAIL__TABLE";
  const ses = "ROOT__SESSION";
  const pep = "ROOT__PEPPER";
  const inst = "ROOT__INSTALLATION";
  const remote = process.env.REMOTE?.split("/") || [];
  const env = process.env.DEPLOYMENT || "";
  const prod = isProduction(env);
  if (!isDuo(remote)) {
    const message = "Invalid env: REMOTE";
    logs.push(toError(Log.error, message));
    return { logs };
  }
  if (env.length < 1) {
    const message = "Invalid env: DEPLOYMENT";
    logs.push(toError(Log.error, message));
    return { logs };
  }
  if (![isFive, isQuad, isTrio, isDuo].some(fn => fn(args))) {
    const message = "2 to 5 arguments required";
    logs.push(toError(Log.error, message));
    return { logs };
  }
  const egit = useGitFromEnv(remote);
  const dev_config: DevConfig = {
    vars: "vars.txt",
    msg: "msg.txt",
    dir: "tmp-dev"
  }
  const delay = 0.2; // 200ms sec
  if (!prod) {
    logs.push(toDebug(Log.debug, 'DEVELOPMENT'));
    dotenv.config({ override: true, path: '.env' });
  }
  else {
    logs.push(toDebug(Log.debug, 'PRODUCTION'));
  }
  const share = isFive(args) && args[0] === "SHARE";
  const login = isQuad(args) && args[0] === "LOGIN";
  const setup = isTrio(args) && args[0] === "SETUP";
  const update = isTrio(args) && args[0] === "UPDATE";
  const dev = isDuo(args) && args[0] === "DEV";
  const mail_types = {
    SESSION: "mail__session", USER: "mail__user"
  };
  if (update) {
    if(args[1] === "TOKEN") {
      const { SESSION, USER } = mail_types;
      const pub_ctli = toCommandTreeList(args[2]);
      const mail_ctli = pub_ctli.filter((ct) => {
        return [ SESSION, USER, NOOP ].includes(ct.command);
      });
      if (mail_ctli.length !== pub_ctli.length) {
        const message = 'Unexpected public text.';
        logs.push(toError(Log.error, message));
      }
      const found = toCommandTreeList(args[2]).find((ct) => {
        return ct.command === SESSION;
      });
      const preface: CommandTreeList = [];
      if (found && isObjAny(found.tree.data)) {
        if (!isEncrypted(found.tree.data)) {
          const message = 'Unencrypted mail in public text.';
          logs.push(toError(Log.error, message));
        }
        else {
          preface.push(found);
        }
      }
      else {
        const message = 'No mail in public text.';
        logs.push(toDebug(Log.info, message));
      }
      try {
        const old_installation = toInstallation(inst);
        const { app, shared } = old_installation;
        const inst_in = { shared, app, git: egit, delay };
        const installation = await toNewInst(inst_in);
        const igit = useGitInstalled(egit, installation);
        const secrets = [{ command: inst, tree: installation }];
        out.push([igit, secrets]);
        const mail_in = { 
          installation, mail_types, preface 
        }
        writeOut(await updateUser(mail_in));
        const message = 'Updated App installation.';
        logs.push(toDebug(Log.info, message));
      }
      catch (e) {
        logs.push(useError(Log.error, e));
      }
    }
  }
  else if (dev && !prod) {
    try {
      if (args[1] === "INBOX") {
        const dev_inbox_in = { dev_config, ses, table };
        const copied = await readDevInbox(dev_inbox_in);
        const message = 'Found no dev inbox to copy.';
        if (!copied) logs.push(toDebug(Log.info, message));
        else logs.push(toDebug(Log.debug, 'Copied dev inbox.'))
      }
      if (args[1] === "OPEN") {
        await readLoginStart({ dev_config, delay });
      }
      else if (args[1] === "CLOSE") {
        await readLoginEnd({ dev_config, delay });
      }
    }
    catch (e) {
      logs.push(useError(Log.error, e));
    }
  }
  else if (share) {
    const release_id = parseInt(args[2]);
    const body = [args[3], args[4]].join('\n\n');
    const git = { ...egit, owner_token: args[1] };
    try {
      if (isNaN(release_id)) {
        throw new Error('Invalid Release ID');
      }
      await vShare({ git, body, release_id });
    }
    catch (e) {
      logs.push(useError(Log.error, e));
    }
  }
  else if (login) {
    if (args[1] === "OPEN") {
      const pub_ctli = toCommandTreeList(args[2]).filter((ct) => {
        return [ mail_types.USER ].includes(ct.command);
      });
      const found_op = toCommandTreeList(args[3]).find((ct) => {
        return ct.command === commands.OPEN_IN;
      });
      const found_reset = toCommandTreeList(args[3]).find((ct) => {
        return ct.command === commands.RESET;
      });
      if (!found_op || !isLoginStart(found_op.tree)) {
        const message = 'No login open command.';
        logs.push(toError(Log.error, message));
        return { logs };
      }
      const ses_str = process.env[ses] || "";
      const session = fromB64urlQuery(ses_str);
      const shared = (() => {
        if (!hasShared(session)) return "";
        return session.shared;
      })();
      const reset = await (async () => {
        const ct = found_reset;
        if (!shared.length) return false;
        return await canResetUser({ shared, ct });
      })();
      const { tree } = found_op;
      const start_in = {
        reset, shared, pep, commands, tree, pub_ctli
      };
      try {
        const payload = await vStart(start_in);
        const installation = toInstallation(inst);
        const igit = useGitInstalled(egit, installation);
        out.push([igit, payload.secrets]);
        writeOut(payload);
        const verb_level = reset ? Log.info : Log.debug;
        const verb = reset ? 'Resetting' : 'Using';
        const message = `${verb} user credentials`;
        logs.push(toDebug(verb_level, message));
      }
      catch (e) {
        logs.push(useError(Log.error, e));
      }
    }
    else if (args[1] === "CLOSE") {
      const found = toCommandTreeList(args[3]).find((ct) => {
        return ct.command === commands.CLOSE_IN;
      });
      const opened = toEnvCommands(final_env).find((ct) => {
        return ct.command === commands.OPEN_NEXT;
      });
      if (!found || !isLoginEnd(found.tree)) {
        const message = 'Invalid workflow inputs.';
        logs.push(toError(Log.error, message));
        return { logs };
      }
      if (!opened || !hasServerFinal(opened.tree)) {
        const message = 'Invalid server inputs.';
        logs.push(toError(Log.error, message));
        return { logs };
      }
      const { tree } = found;
      const { final } = opened.tree;
      const end_in = { final, commands, tree };
      const { token } = await vLogin(end_in);
      const secrets = [{ tree: { shared: token }, command: ses }];
      const installation = toInstallation(inst);
      const igit = useGitInstalled(egit, installation);
      out.push([igit, secrets]);
      // Update the shared key as instructed
      if (hasNewUser(opened.tree)) {
        installation.shared = opened.tree.user.shared;
        const secrets = [{ tree: installation, command: inst }];
        out.push([igit, secrets]);
        const message = 'Updated shared user key.';
        logs.push(toDebug(Log.debug, message));
      }
      try {
        const trio = await readInbox({ ses, table });
        const mail_in = { 
          table, installation, mail_types, token, trio
        }
        const igit = useGitInstalled(egit, installation);
        const payload = await vMail(mail_in);
        out.push([igit, payload.secrets]);
        writeOut(payload);
        logs.push(toDebug(Log.info, 'Login ok.'));
      }
      catch (e) {
        logs.push(useError(Log.error, e));
      }
    }
  }
  else if (setup) {
    const user_id = "root";
    const stages: Stages = {
      PUB: "app__in",
      STEP: "step__in",
      APP: "app__out",
      OUT: "app__auth"
    };
    if (args[1] === "PUB") {
      const password = toNewPassword();
      const client_in = { user_id, password };
      const message = 'Creating new secure public channel.';
      logs.push(toDebug(Log.debug, message));
      const Opaque = await toSyncOp();
      try {
        const new_client = Opaque.toNewClientAuth(client_in);
        const message = 'Created secure public channel.';
        logs.push(toDebug(Log.info, message));
        writeOut(toNew(stages, new_client));
      }
      catch (e) {
        logs.push(useError(Log.error, e));
      }
    }
    if (args[1] === "APP") {
      const found = toCommandTreeList(args[2]).find((ct) => {
        return ct.command === stages.STEP;
      });
      if (!found || !isClientState(found.tree)) {
        const message = "Can't create App.";
        logs.push(toError(Log.error, message));
        return { logs };
      }
      const message = 'Creating GitHub App.';
      logs.push(toDebug(Log.debug, message));
      const client_state = found.tree;
      const user_in = { git: egit, prod, delay, dev_config };
      const new_app = await toNewApp({ user_in, client_state })
      if (isNumber(new_app)) {
        const message = `App Opaque error: ${new_app}`;
        logs.push(toError(Log.error, message));
        return { logs };
      }
      try {
        const { secret_out, code } = new_app;
        const app_out = await toApp({ code });
        const message = 'Created GitHub App.';
        logs.push(toDebug(Log.info, message));
        writeOut(useSecrets(stages, secret_out, app_out));
      }
      catch (e) {
        logs.push(useError(Log.error, e));
      }
    }
    if (args[1] === "TOKEN") {
      const found = toCommandTreeList(args[2]).find((ct) => {
        return ct.command === stages.STEP;
      });
      if (!found || !isTokenInputs(found.tree)) {
        const message = "Can't create Token.";
        logs.push(toError(Log.error, message));
         return { logs };
      }
      const message = 'Creating GitHub Token.';
      logs.push(toDebug(Log.debug, message));
      const { shared, app } = found.tree;
      try {
        const inst_in = { shared, app, git: egit, delay };
        const installation = await toNewInst(inst_in);
        const igit = useGitInstalled(egit, installation);
        const secrets = [{ tree: installation, command: inst }];
        out.push([igit, secrets]);
        const tree = await encryptSecrets({
          secret_text: igit.owner_token,
          password: shared
        });
        const command = stages.OUT;
        const message = 'Created GitHub Token.';
        logs.push(toDebug(Log.info, message));
        const { client_auth_result } = found.tree;
        const prev = { client_auth_result };
        const for_pages = fromCommandTreeList([
          { command: stages.APP, tree: prev },
          { command, tree }
        ]);
        writeOut({ for_pages, for_next: "" });
      }
      catch (e) {
        logs.push(useError(Log.error, e));
      }
    }
  }
  else {
    const message = "Unable to match action";
    logs.push(toError(Log.error, message));
  }
  const unzipped = out.reduce((o, [ git, ctli ]) => {
    return ctli.reduce((o, { tree, command }) => {
      return [...o, { git, env, delay, tree, command }];
    }, o);
  }, [] as SetInputs[]);
  try {
    await Promise.all(unzipped.map(setSecret));
  }
  catch {
    const message = "Unable to set secrets";
    logs.push(toError(Log.error, message));
  }
  if (!prod) {
    const env_all = [ses, pep, table, inst, ...final_env];
    const env_vars = env_all.filter((v) => {
      return process.env[v];
    });
    const new_env = env_vars.map((v) => {
      return `${v}="${process.env[v]}"`;
    }).join('\n');
    try {
      fs.writeFileSync('.env', new_env);
      const message = 'Wrote new .env file.';
      logs.push(toDebug(Log.debug, message));
    } catch (e) {
      logs.push(useError(Log.error, e));
    }
  }
  return { logs };
})().then(({ logs }: Result) => {
  const fail_if = (x: LogItem) => x.level >= Log.error;
  //const log_if = (x: LogItem) => x.level >= Log.trace;
  const log_if = (x: LogItem) => x.level >= Log.info;
  const errs = logs.reduce((list, item) => {
    if (isErrorItem(item) && fail_if(item)) {
      return [...list, item.obj];
    }
    else if (log_if(item)) {
      console.log('Action:', item.obj.message);
    }
    return list;
  }, [] as Error[]);
  if (errs.length > 0) {
    throw new AggregateError(errs, 'ACTION: FAILURE.');
  }
}).catch((e: any) => {
  if (e instanceof AggregateError) {
    console.error(e.message);
    e.errors.forEach(e => console.error(e));
  }
  else if (e instanceof Error) console.error(e);
  else console.error("Unknown Error Occured");
  process.exitCode = 1;
});
