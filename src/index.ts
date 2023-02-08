import { isLoginStart, isLoginEnd, toInstallation } from "./util/pasted.js";
import { hasShared, readLoginStart, readLoginEnd } from "./util/pasted.js";
import { readUserApp, readUserInstall, isEncrypted } from "./util/pasted.js";
import { readInbox, readDevInbox } from "./util/pasted.js";
import { useGitInstalled, hasSessionHash } from "./util/pasted.js";
import { toB64urlQuery, fromB64urlQuery } from "sock-secret";
import { toCommandTreeList, fromCommandTreeList } from "sock-secret";
import { setSecret, isProduction } from "./util/secrets.js";
import { vStart, vLogin, vMail, updateUser, toSyncOp } from "./verify.js";
import { encryptSecrets } from "./util/encrypt.js";
import { decryptQuery } from "./util/decrypt.js";
import { isFive, isQuad, isTrio, isDuo } from "./util/types.js";
import { isObjAny, isJWK, toApp, toInstall } from "./create.js";
import { vShare } from "./util/share.js";
import { getRandomValues } from "crypto";
import dotenv from "dotenv";
import argon2 from 'argon2';
import fs from "fs";

import type { Commands } from "./verify.js";
import type { HasShared, DevConfig, LoginEnd } from "./util/pasted.js";
import type { AppOutput, Installation } from "./create.js";
import type { NewClientOut } from "opaque-low-io";
import type { TreeAny, NameTree, CommandTreeList } from "sock-secret"
import type { ServerFinal } from "opaque-low-io";

type Log = "log" | "error";
type Result = {
  success: boolean,
  message: string
}
type SecretOutputs = {
  for_pages: string,
  for_next: string,
}
type StageKeys = (
  "PUB" | "STEP" | "APP" | "OUT"
)
type Stages = Record<StageKeys, string> 
type Found = NameTree | undefined
interface CanResetUser {
  (o: { shared: string, ct: Found }): Promise<boolean>;
}
interface WriteSecretText {
  (i: Partial<SecretOutputs>): void;
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

function isNumber(u: unknown): u is number {
  return typeof u === "number";
}

function isServerFinal(o: TreeAny): o is ServerFinal {
  const needs = [
    o.Au instanceof Uint8Array,
    typeof o.token === "string"
  ];
  return needs.every(v => v);
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

const writeSecretText: WriteSecretText = (inputs) => {
  const out_file = "secret.txt";
  const a = inputs?.for_pages || "";
  const b = inputs?.for_next || "";
  fs.writeFileSync(out_file, `${a}\n${b}`);
  console.log(`Wrote to ${out_file}.`);
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

const toGitToken = (prod: boolean, inst: string) => {
  if (!prod) return "";
  try {
    const { installed } = toInstallation(inst);
    return installed.token;
  }
  catch {
    return process.env.GITHUB_TOKEN || '';
  }
}

const toEnvCommands = (sl: string[]): CommandTreeList => {
  return sl.filter(s => s in process.env).map((s) => {
    const tree = fromB64urlQuery(process.env[s] || "");
    return { command: s, tree };
  })
}

(async (): Promise<Result> => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    const message = "Missing 1st arg: MY_TOKEN";
    return { success: false, message };
  }
  const commands: Commands = {
    OPEN_IN: "op:pake__client_auth_data",
    OPEN_OUT: "op:pake__server_auth_data",
    CLOSE_IN: "op:pake__client_auth_result",
    OPEN_NEXT: "SERVER__FINAL",
    NEW_SHARED: "NEW__USER",
    RESET: "user__reset"
  }
  const final_env = [
    commands.OPEN_NEXT, commands.NEW_SHARED
  ];
  const NOOP = "noop";
  const table = "MAIL__TABLE";
  const ses = "ROOT__SESSION";
  const pep = "ROOT__PEPPER";
  const inst = "ROOT__INSTALLATION";
  const env_all = [ses, pep, table, inst, ...final_env];
  const remote = process.env.REMOTE?.split("/") || [];
  const env = process.env.DEPLOYMENT || "";
  const prod = isProduction(env);
  if (!isDuo(remote)) {
    const message = "Invalid env: REMOTE";
    return { success: false, message };
  }
  if (env.length < 1) {
    const message = "Invalid env: DEPLOYMENT";
    return { success: false, message };
  }
  if (![isFive, isQuad, isTrio, isDuo].some(fn => fn(args))) {
    const message = "2 to 5 arguments required";
    return { success: false, message };
  }
  const git = {
    repo: remote[1],
    owner: remote[0],
    owner_token: toGitToken(prod, inst),
  }
  const dev_config: DevConfig = {
    vars: "vars.txt",
    msg: "msg.txt",
    dir: "tmp-dev"
  }
  const delay = 0.2; // 200ms sec
  if (!prod) {
    console.log('DEVELOPMENT\n');
    dotenv.config();
  }
  else {
    console.log('PRODUCTION\n');
  }
  const v_in = { git, env };
  const share = isFive(args) && args[0] === "SHARE";
  const login = isQuad(args) && args[0] === "LOGIN";
  const setup = isTrio(args) && args[0] === "SETUP";
  const update = isTrio(args) && args[0] === "UPDATE";
  const dev = isDuo(args) && args[0] === "DEV";
  const log_in = { ...v_in, pep, reset: false };
  const user_in = { git, prod, delay, dev_config };
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
        console.warn("Unexpected public text.");
      }
      const found = toCommandTreeList(args[2]).find((ct) => {
        return ct.command === SESSION;
      });
      const preface: CommandTreeList = [];
      if (found && isObjAny(found.tree.data)) {
        if (!isEncrypted(found.tree.data)) {
          console.warn("Unusual mail in public text.");
        }
        else {
          preface.push(found);
        }
      }
      else {
        console.warn("No mail in public text.");
      }
      try {
        const old_installation = toInstallation(inst);
        const { app, shared } = old_installation;
        const install_in = { git, app, delay };
        const install = await readUserInstall(install_in);
        const installed = await toInstall(install);
        const igit = useGitInstalled(git, installed);
        const installation: Installation = { 
          installed, shared, app
        };
        await setSecret({
          delay, git: igit, env, tree: installation, command: inst
        });
        const mail_in = { 
          installation, mail_types, preface 
        }
        writeSecretText(await updateUser(mail_in));
        console.log('Updated App installation.');
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to update";
        return { success: false, message };
      }
    }
  }
  else if (dev) {
    try {
      if (args[1] === "INBOX") {
        await readDevInbox({ user_in, ses, table });
      }
      if (args[1] === "OPEN") {
        await readLoginStart(user_in);
      }
      else if (args[1] === "CLOSE") {
        await readLoginEnd(user_in);
      }
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to verify";
      return { success: false, message };
    }
  }
  else if (share) {
    const git_token = args[1];
    const release_id = parseInt(args[2]);
    const body = [args[3], args[4]].join('\n\n');
    const basic_git = { 
      repo: git.repo,
      owner: git.owner,
      owner_token: git_token
    }
    try {
      if (isNaN(release_id)) {
        throw new Error('Invalid Release ID');
      }
      await vShare({ git: basic_git, body, release_id });
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to share";
      return { success: false, message };
    }
  }
  else if (login) {
    try {
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
          throw new Error('No login open command.');
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
          reset, shared, log_in, delay,
          commands, tree, pub_ctli
        };
        writeSecretText(await vStart(start_in));
        console.log('Began to verify user.\n');
      }
      else if (args[1] === "CLOSE") {
        const trio = await readInbox({ ses, table });
        const found = toCommandTreeList(args[3]).find((ct) => {
          return ct.command === commands.CLOSE_IN;
        });
        const opened = toEnvCommands(final_env).find((ct) => {
          return ct.command === commands.OPEN_NEXT;
        });
        const found_shared = toEnvCommands(final_env).find((ct) => {
          return ct.command === commands.NEW_SHARED;
        });
        if (!found || !isLoginEnd(found.tree)) {
          throw new Error('Invalid workflow inputs.');
        }
        if (!opened || !isServerFinal(opened.tree)) {
          throw new Error('Invalid server inputs.');
        }
        const final = opened.tree;
        const { tree } = found;
        const end_in = { 
          final, log_in, delay, commands, tree, ses,
        };
        const { token } = await vLogin(end_in);
        const installation = toInstallation(inst);
        // Update the shared key as instructed
        if (found_shared && hasShared(found_shared.tree)) {
          const { installed } = installation;
          const igit = useGitInstalled(git, installed);
          installation.shared = found_shared.tree.shared;
          await setSecret({ 
            delay, git: igit, env, tree: installation, command: inst
          });
          console.log('Updated shared user key.');
        }
        const mail_in = { 
          git, delay, env, table,
          installation, mail_types, token, trio
        }
        const payload = await vMail(mail_in);
        writeSecretText(payload);
        console.log('Verified user.\n');
      }
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to verify";
      return { success: false, message };
    }
  }
  else if (setup) {
    const user_id = "root";
    const Opaque = await toSyncOp();
    const { toNewClientAuth, toClientSecret } = Opaque;
    const stages: Stages = {
      PUB: "app__in",
      STEP: "step__in",
      APP: "app__out",
      OUT: "app__auth"
    };
    if (args[1] === "PUB") {
      const password = toNewPassword();
      const client_in = { user_id, password };
      console.log(`Creating new secure public channel.`);
      try {
        const new_client = toNewClientAuth(client_in);
        console.log("Created secure public channel.\n");
        writeSecretText(toNew(stages, new_client));
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Error making secure public channel.";
        return { success: false, message };
      }
    }
    const times = 1000;
    if (args[1] === "APP") {
      const found = toCommandTreeList(args[2]).find((ct) => {
        return ct.command === stages.STEP;
      });
      if (!found || !isClientState(found.tree)) {
        const message = "Can't create App.";
        return { success: false, message };
      }
      console.log(`Creating GitHub App.`);
      const { r, xu, mask } = found.tree;
      try {
        const user_out = await readUserApp(user_in);
        const { C, S: server_auth_data } = user_out;
        const client_in = { r, xu, mask, server_auth_data };
        const secret_out = toClientSecret(client_in, times);
        if (isNumber(secret_out)) {
          const msg = `Opaque error code: ${secret_out}`;
          throw new Error(`Error Making App. ${msg}`);
        }
        const shared = secret_out.token;
        const c = decryptQuery(toB64urlQuery(C), shared);
        const code = (await c).plain_text;
        const app_out = await toApp({ code });
        console.log("Created GitHub App.\n");
        writeSecretText(useSecrets(stages, secret_out, app_out));
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub App.";
        return { success: false, message };
      }
    }
    if (args[1] === "TOKEN") {
      const found = toCommandTreeList(args[2]).find((ct) => {
        return ct.command === stages.STEP;
      });
      if (!found || !isTokenInputs(found.tree)) {
        const message = "Can't create Token.";
        return { success: false, message };
      }
      console.log(`Creating GitHub Token.`);
      const { shared, app } = found.tree;
      try {
        const install_in = { git, app, delay };
        const install = await readUserInstall(install_in);
        const installed = await toInstall(install);
        const igit = useGitInstalled(git, installed);
        const installation = { installed, shared, app };
        await setSecret({ 
          delay, git: igit, env, tree: installation, command: inst
        });
        const tree = await encryptSecrets({
          secret_text: igit.owner_token,
          password: shared
        });
        const command = stages.OUT;
        console.log("Created GitHub Token.\n");
        const { client_auth_result } = found.tree;
        const prev = { client_auth_result };
        const for_pages = fromCommandTreeList([
          { command: stages.APP, tree: prev },
          { command, tree }
        ]);
        writeSecretText({ for_pages, for_next: "" });
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub Token.";
        return { success: false, message };
      }
    }
  }
  else {
    const message = "Unable to match action\n";
    return { success: false, message };
  }
  if (!prod) {
    const env_vars = env_all.filter((v) => {
      return process.env[v];
    });
    const new_env = env_vars.map((v) => {
      return `${v}="${process.env[v]}"`;
    }).join('\n');
    try {
      fs.writeFileSync('.env', new_env);
      console.log('Wrote new .env file.');
    } catch (e: any) {
      console.error(e?.message);
    }
  }
  const message = "Action complete!\n";
  return { success: true, message };
})().then(({ success, message }: Result) => {
  const fn: Log = success ? "log": "error";
  process.exitCode = success ? 0 : 1;
  console[fn](message);
}).catch((e: any) => {
  if (e instanceof Error) console.error(e.message);
  else console.error("Unexpected Error Occured");
  process.exitCode = 1;
});
