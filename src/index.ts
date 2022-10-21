import { isGit, gitDecrypt, activation } from "./activate";
import { addSecret, isProduction } from "./util/secrets";
import { graphql } from "@octokit/graphql";
import { undeploy } from "project-sock";
import { verifier } from "./verify";
import dotenv from "dotenv";
import fs from "fs";

import type { Git, Trio } from "./util/types";
import type { SecretInputs } from "./activate"
import type { SecretOutputs } from "./activate"

type Duo = [string, string];
type Result = {
  success: boolean;
  message: string;
}
interface WriteSecretText {
  (g: Git, i: Partial<SecretOutputs>): void;
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

async function lockDeployment(git: Git) {
  const { repo, owner } = git;
  const metadata = { env: "development" };
  const octograph = graphql.defaults({
    headers: {
      authorization: `token ${git.owner_token}`,
    }
  });
  const opts = { repo, owner, octograph, metadata };
  const { success } = await undeploy(opts);
  if (success) {
    return console.log("Successfully undeployed action.");
  }
  console.log("No active action to undeploy");
}

const writeSecretText: WriteSecretText = (git, inputs) => {
  const out_file = "secret.txt";
  const secret = inputs?.for_next || "";
  const for_pages = inputs?.for_pages || "";
  fs.writeFileSync(out_file, for_pages);
  console.log(`Wrote to ${out_file}.`);
  addSecret({ git, secret, name: "STATE" });
  console.log(`Wrote STATE secret.\n`);
}

(async (): Promise<Result> => {
  const prod = isProduction(process);
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
  const git = {
    owner: "tvquizphd",
    owner_token: args[0],
    repo: "public-quiz-device",
    email: "tvquizphd@gmail.com"
  }
  const wiki_config = {
    home: "Home.md",
    tmp: "tmp-wiki"
  }
  const delay = 1;
  if (!prod) {
    console.log('DEVELOPMENT\n');
    dotenv.config();
  }
  else {
    console.log('PRODUCTION\n');
    try {
      await lockDeployment(git);
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to undeploy";
      return { success: false, message };
    }
  }
  const login = isOne(args);
  const v_in = { git, delay };
  const inbox_in = { ...v_in, sec, ses };
  const log_in = { ...v_in, pep, login };
  if (login) {
    try {
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
        writeSecretText(git, out);
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
          writeSecretText(git, {});
          console.error(e?.message);
          const message = "Unable to verify";
          return { success: false, message };
        }
        writeSecretText(git, {});
      }
      else {
        console.log(`Creating GitHub Token.`);
        try {
          const code_outputs = secret_in;
          const core = { code_outputs, tok };
          const out = await toToken({ ...basic, ...core });
          console.log("Created GitHub token.\n");
          writeSecretText(git, out);
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
