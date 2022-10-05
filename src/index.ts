import { isProduction } from "./util/secrets";
import { graphql } from "@octokit/graphql";
import { undeploy } from "project-sock";
import { activate } from "./activate";
import { isOkCreds } from "./outbox";
import { outbox } from "./outbox";
import { verify } from "./verify";
import { inbox } from "./inbox";
import dotenv from "dotenv";
import fs from "fs";

import type { Creds } from "./outbox";
import type { Git, Trio } from "./util/types";

(async () => {
  const prod = isProduction(process);
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return {};
  }
  const git = {
    owner: "tvquizphd",
    owner_token: args[0],
    repo: "public-quiz-device"
  }
  const delay = 1;
  if (!prod) {
    console.log('DEVELOPMENT\n');
    dotenv.config();
  }
  else {
    console.log('PRODUCTION\n');
  }
  if (args.length >= 3) {
    const msg_a = "with Master Password!";
    console.log(`Activating ${msg_a}`);
    try {
      await activate({
        git,
        delay,
        client_id: args[1],
        master_pass: args[2]
      });
    }
    catch (e: any) {
      console.error("Unable to Activate.");
      console.error(e?.message);
      return { git };
    }
  }
  const pep = "ROOT_PEPPER";
  const creds: Creds = {
    name: "SESSION"
  };
  const session = process.env[creds.name] || '';
  const sec: Trio = [ "SERVERS", "CLIENTS", "SECRETS" ];
  const inbox_args = { git, sec, delay, session };
  try {
    const { trio } = await inbox(inbox_args);
    while (!isOkCreds(creds)) {
      console.log("\nVerifying your credentials:");
      const done = await verify({ git, pep, delay });
      if (done) {
        creds.secret = done;
      }
    }
    console.log("\nVerified your credentials.");
    const outbox_args = { git, trio, delay, creds };
    const exported = await outbox(outbox_args);
    if (exported) {
      console.log("\nExported your secrets.");
    }
  }
  catch (e: any) {
    console.error("Unable to Verify.");
    console.error(e?.message);
    return { git };
  }
  if (!prod) {
    const env_all = [creds.name, pep, ...sec];
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
  return { git };
})().then(async (outputs) => {
  const { git } = outputs;
  if (!!git) {
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
}).catch((e: any) => {
  console.error("Unexpected Error Occured");
  console.error(e?.message);
});
