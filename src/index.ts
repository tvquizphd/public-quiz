import { isProduction } from "./util/secrets";
import { graphql } from "@octokit/graphql";
import { undeploy } from "project-sock";
import { activate } from "./activate";
import { isOkCreds } from "./outbox";
import { outbox } from "./outbox";
import { verify } from "./verify";
import { inbox } from "./inbox";
import path from 'node:path';
import dotenv from "dotenv";
import fs from "fs";

import type { Creds } from "./outbox";
import type { Git, Trio } from "./util/types";

type Result = {
  success: boolean;
  message: string;
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

(async (): Promise<Result> => {
  const prod = isProduction(process);
  const args = process.argv.slice(2);
  if (args.length < 1) {
    const message = "Missing 1st arg: MY_TOKEN";
    return { success: false, message };
  }
  const tok = "ROOT_TOKEN";
  const pep = "ROOT_PEPPER";
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
  const login = args.length < 2;
  const register = !login;
  if (register) {
    const msg_a = "with new public key!";
    console.log(`Activating ${msg_a}`);
    const client_id = args[1];
    try {
      const act_args = { git, tok, delay, client_id, wiki_config };
      const msg = await activate(act_args);
      console.log(`${msg}\n`);
    }
    catch (e: any) {
      console.error(e?.message);
      const message = "Unable to activate";
      return { success: false, message };
    }
  }
  const creds: Creds = { 
    login,
    name: "SESSION",
    registered: false
  };
  const session = process.env[creds.name] || '';
  const sec: Trio = [ "SERVERS", "CLIENTS", "SECRETS" ];
  const inbox_args = { git, sec, delay, session };
  const login_args = { git, tok, pep, login, delay };
  try {
    const { trio } = await inbox(inbox_args);
    while (!isOkCreds(creds)) {
      console.log("\nVerifying your credentials:");
      const session = await verify(login_args);
      creds.registered = true;
      creds.secret = session;
    }
    if (login && !!creds.secret) {
      console.log("\nVerified your credentials.");
      const outbox_args = { git, trio, delay, creds };
      const exported = await outbox(outbox_args);
      if (exported) {
        console.log("\nExported your secrets.");
      }
    }
  }
  catch (e: any) {
    console.error(e?.message);
    const message = "Unable to verify";
    return { success: false, message };
  }
  if (!prod) {
    const env_all = [creds.name, pep, tok, ...sec];
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
    try {
      const { home } = wiki_config;
      const dev_file = path.join(process.cwd(), 'docs', home);
      fs.writeFileSync(dev_file, "");
      console.log(`Cleared ${home}`);
    } catch (e: any) {
      console.error(e?.message);
    }
  }
  const message = "Verification complete";
  return { success: true, message };
})().then(async (result: Result) => {
  if (result.success) {
    return console.log(result.message);
  }
  return console.error(result.message);
}).catch((e: any) => {
  console.error("Unexpected Error Occured");
  console.error(e?.message);
});
