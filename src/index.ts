import { isGit, gitDecrypt, activation } from "./activate.js";
import { isProduction } from "./util/secrets.js";
import { verifier } from "./verify.js";
import dotenv from "dotenv";
import argon2 from 'argon2';
import fs from "fs";

import type { Trio } from "./util/types.js";
import type { SecretInputs } from "./activate.js"
import type { SecretOutputs } from "./activate.js"

type Env = Record<string, string | undefined>;
type Duo = [string, string];
type Result = {
  success: boolean,
  message: string
}
interface WriteSecretText {
  (i: Partial<SecretOutputs>): void;
}
type MayReset = {
  OLD_HASH: string,
  SESSION: string
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

function isOne(args: string[]): args is [string] {
  return args.length === 1;
} 

const writeSecretText: WriteSecretText = (inputs) => {
  const out_file = "secret.txt";
  const a = inputs?.for_pages || "";
  const b = inputs?.for_next || "";
  fs.writeFileSync(out_file, `${a}\n${b}`);
  console.log(`Wrote to ${out_file}.`);
}

(async (): Promise<Result> => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    const message = "Missing 1st arg: MY_TOKEN";
    return { success: false, message };
  }
  const ses = "SESSION"
  const tok = "ROOT_TOKEN";
  const pep = "ROOT_PEPPER";
  const sec: Trio = [ "SERVERS", "CLIENTS", "SECRETS" ];
  const env_all = [ses, tok, pep, "STATE", ...sec];
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
  const git = {
    repo: remote[1],
    owner: remote[0],
    owner_token: args[0],
  }
  const wiki_config = {
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
  const login = isOne(args);
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
  else if (isDuo(args) || isTrio(args)) {
    const basic = { git, client_id: args[1] };
    const [toCode, toToken] = activation;
    if (isDuo(args)) {
      try {
        console.log(`Generating initial GitHub code.`);
        const core = { prod, delay, wiki_config };
        const out = await toCode({ ...basic, ...core });
        console.log("Created GitHub code.\n");
        writeSecretText(out);
      }
      catch (e: any) {
        console.error(e?.message);
        const message = "Unable to make GitHub code.";
        return { success: false, message };
      }
    }
    else {
      let secret_in: SecretInputs;
      try {
        const decrypt_in = {git, secret: args[2]};
        secret_in = await gitDecrypt(decrypt_in);
      }
      catch(e: any) {
        console.error(e?.message);
        const message = "Bad 3rd argument";
        return { success: false, message };
      }
      if (isGit(secret_in)) {
        console.log(`Using GitHub Token.`);
        try {
          log_in.git = secret_in;
          inbox_in.git = secret_in;
          await verifier({ inbox_in, log_in });
          console.log('Verified user.');
        }
        catch (e: any) {
          writeSecretText({});
          console.error(e?.message);
          const message = "Unable to verify";
          return { success: false, message };
        }
        writeSecretText({});
      }
      else {
        console.log(`Creating GitHub Token.`);
        try {
          const code_outputs = secret_in;
          const core = { code_outputs, tok, env };
          const out = await toToken({ ...basic, ...core });
          console.log("Created GitHub token.\n");
          writeSecretText(out);
        }
        catch (e: any) {
          console.error(e?.message);
          const message = "Unable to make GitHub token.";
          return { success: false, message };
        }
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
