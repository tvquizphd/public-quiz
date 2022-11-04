import { readUserApp, readUserInstall, isTree } from "./util/pasted.js";
import { fromB64urlQuery, toB64urlQuery } from "project-sock";
import { addSecret, isProduction } from "./util/secrets.js";
import { toSyncOp, verifier } from "./verify.js";
import { encryptSecrets } from "./util/encrypt.js";
import { decryptQuery } from "./util/decrypt.js";
import { isJWK, toApp, toInstall } from "./create.js";
import dotenv from "dotenv";
import argon2 from 'argon2';
import fs from "fs";

import type { AppOutput } from "./create.js";
import type { TreeAny } from "project-sock"
import type { HasGit } from "./util/pasted.js";
import type { WikiConfig } from "./util/pasted.js";
import type { Git, Trio } from "./util/types.js";

type Env = Record<string, string | undefined>;
type Duo = [string, string];
type Result = {
  success: boolean,
  message: string
}
type SecretOutputs = {
  for_pages: string,
  for_next: string,
}
interface WriteSecretText {
  (i: Partial<SecretOutputs>): void;
}
type MayReset = {
  OLD_HASH: string,
  SESSION: string
}
type ClientState = {
  r: Uint8Array,
  xu: Uint8Array,
  mask: Uint8Array,
}
type ClientAuthData = {
  alpha: Uint8Array,
  Xu: Uint8Array
}
type PubStepPub = {
  register: {sid: string, pw: Uint8Array },
  client_auth_data: ClientAuthData 
}
type NewClientAuthOut = ClientState & PubStepPub;
type ClientAuthResult = { Au: Uint8Array };
type ClientSecretOut = {
  token: string,
  client_auth_result: ClientAuthResult
};
type TokenIn = {
  app: AppOutput
  shared: string
};

function isNumber(u: unknown): u is number {
  return typeof u === "number";
}

function isGit(o: TreeAny): o is Git {
  const needs = [ 
    typeof o.repo === "string",
    typeof o.owner === "string",
    typeof o.owner_token === "string"
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

function isTokenInputs (o: TreeAny): o is TokenIn {
  if (!isTree(o.app)) {
    return false;
  }
  if (!isTree(o.app.jwk)) {
    return false;
  }
  const needs = [ 
    typeof o.shared === "string",
    typeof o.app.client_secret === "string",
    typeof o.app.client_id === "string",
    isJWK(o.app.jwk)
  ];
  return needs.every(v => v);
}

function isAuthInputs (o: TreeAny): o is HasGit {
  if (!isTree(o.git)) {
    return false;
  }
  const needs = [ isGit(o?.git) ];
  return needs.every(v => v);
}

const canReset = async (inputs: MayReset) => {
  const { OLD_HASH, SESSION } = inputs;
  if (!OLD_HASH || !SESSION) {
    return false;
  }
  return await argon2.verify(OLD_HASH, SESSION);
}

function mayReset(env: Env): env is MayReset {
  const vars = [env.OLD_HASH, env.SESSION];
  return vars.every(s => typeof s === "string" && s.length > 0);
} 

function isTrio(args: string[]): args is Trio {
  return args.length === 3;
} 

function isDuo(args: string[]): args is Duo {
  return args.length === 2;
}

const toNewPassword = () => {
  const empty = new Uint8Array(3*23);
  const bytes = [...crypto.getRandomValues(empty)];
  return (Buffer.from(bytes)).toString('base64');
}

const writeSecretText: WriteSecretText = (inputs) => {
  const out_file = "secret.txt";
  const a = inputs?.for_pages || "";
  const b = inputs?.for_next || "";
  console.log(`${a}\n${b}`); // TODO
  fs.writeFileSync(out_file, `${a}\n${b}`);
  console.log(`Wrote to ${out_file}.`);
}

const toNew = (opts: NewClientAuthOut) => {
  const { register, client_auth_data, ...rest } = opts;
  const pub_obj = { register, client_auth_data };
  return {
    for_pages: toB64urlQuery(pub_obj),
    for_next: toB64urlQuery(rest)
  }
}

const useSecrets = (out: ClientSecretOut, app: AppOutput) => {
  const { token: shared, client_auth_result } = out;
  const pub_obj = { client_auth_result };
  const next_obj = { 
    shared: shared,
    app: {
      jwk: app.jwk,
      client_id: app.client_id,
      client_secret: app.client_secret
    },
  };
  return {
    for_pages: toB64urlQuery(pub_obj),
    for_next: toB64urlQuery(next_obj)
  }
}

(async (): Promise<Result> => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    const message = "Missing 1st arg: MY_TOKEN";
    return { success: false, message };
  }
  const ses = "SESSION"
  const pep = "ROOT_PEPPER";
  const inst = "INSTALLATION";
  const sec: Trio = [ "SERVERS", "CLIENTS", "SECRETS" ];
  const env_all = [ses, pep, inst, "STATE", ...sec];
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
  if (!isDuo(args) && !isTrio(args)) {
    const message = "2 or 3 arguments required";
    return { success: false, message };
  }
  const git = {
    repo: remote[1],
    owner: remote[0],
    owner_token: args[1],
  }
  const wiki_config: WikiConfig = {
    home: "Home.md",
    tmp: "tmp-wiki"
  }
  const delay = 0.25;
  if (!prod) {
    console.log('DEVELOPMENT\n');
    dotenv.config();
  }
  else {
    console.log('PRODUCTION\n');
  }
  const login = isDuo(args);
  const v_in = { git, env, delay };
  const inbox_in = { ...v_in, sec, ses };
  const log_in = { ...v_in, pep, login, reset: false };
  if (login) {
    try {
      if (mayReset(process.env)) {
        log_in.reset = await canReset(process.env);
      }
      await verifier({ inbox_in, log_in });
      console.log('Verified user.\n');
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to verify";
      return { success: false, message };
    }
  }
  else if (isTrio(args)) {
    const user_id = "root";
    const Opaque = await toSyncOp();
    const { toNewClientAuth, toClientSecret } = Opaque;
    const user_in = { git, prod, delay, wiki_config };
    if (args[0] === "PUB") {
      const password = toNewPassword();
      const client_in = { user_id, password };
      console.log(`Creating new secure public channel.`);
      try {
        const new_client = toNewClientAuth(client_in);
        console.log("Created secure public channel.\n");
        writeSecretText(toNew(new_client));
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Error making secure public channel.";
        return { success: false, message };
      }
    }
    const times = 1000;
    const secret_in = fromB64urlQuery(args[2]);
    if (args[0] === "APP") {
      if (!isClientState(secret_in)) {
        const message = "Can't create App.";
        return { success: false, message };
      }
      console.log(`Creating GitHub App.`);
      const { r, xu, mask } = secret_in;
      try {
        const user_out = await readUserApp(user_in);
        const { server_auth_data } = user_out;
        const client_in = { r, xu, mask, server_auth_data };
        const secret_out = toClientSecret(client_in, times);
        if (isNumber(secret_out)) {
          const msg = `Opaque error code: ${secret_out}`;
          throw new Error(`Error Making App. ${msg}`);
        }
        const shared = secret_out.token;
        const code = (await decryptQuery(user_out.code, shared)).plain_text;
        const app_out = await toApp({ code });
        console.log("Created GitHub App.\n");
        writeSecretText(useSecrets(secret_out, app_out));
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub App.";
        return { success: false, message };
      }
    }
    if (args[0] === "TOKEN") {
      if (!isTokenInputs(secret_in)) {
        const message = "Can't create Token.";
        return { success: false, message };
      }
      console.log(`Creating GitHub Token.`);
      const { shared, app } = secret_in;
      try {
        const user_out = await readUserInstall(user_in);
        const code = (await decryptQuery(user_out.code, shared)).plain_text;
        const installed = await toInstall({ app, code });
        const new_git = {
          repo: git.repo,
          owner: git.owner,
          owner_token: installed.access_token
        }
        const created = `${Math.floor(Date.now() / 1000)}`;
        const secret = toB64urlQuery({
          installed, created, shared, app
        });
        await addSecret({ git, env, secret, name: inst });
        const for_pages = toB64urlQuery(await encryptSecrets({
          secret_text: new_git.owner_token,
          password: shared
        }));
        const for_next = toB64urlQuery({ git: new_git });
        console.log("Created GitHub Token.\n");
        writeSecretText({ for_pages, for_next });
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub Token.";
        return { success: false, message };
      }
    }
    if (args[0] === "AUTH") {
      if (!isAuthInputs(secret_in)) {
        const message = "Can't begin Auth.";
        return { success: false, message };
      }
      console.log(`Using GitHub Token.`);
      try {
        log_in.git = { ...secret_in.git };
        inbox_in.git = { ...secret_in.git };
        await verifier({ inbox_in, log_in });
        console.log('Verified user.');
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to verify";
        return { success: false, message };
      }
    }
  }
  if (!prod) {
    const env_vars = env_all.filter((v) => {
      return process.env[v];
    });
    const new_env = env_vars.map((v) => {
      // set in non-production addSecret call
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
})().then((result: Result) => {
  if (result.success) {
    return console.log(result.message);
  }
  return console.error(result.message);
}).catch((e: any) => {
  console.error("Unexpected Error Occured");
  console.error(e?.message);
});
