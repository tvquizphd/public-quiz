import { activate } from "./activate";
import { inbox } from "./inbox";
import { verify } from "./verify";
import { outbox } from "./outbox";
import { Octokit } from "octokit";

import type { Git, Trio } from "./util/types";
import type { OkCreds } from "./outbox";
import type { Creds } from "./verify";

function isOkCreds(c: Creds): c is OkCreds {
  return !!(c as OkCreds).session;
}

function unStar(git: Git) {
  const octokit = new Octokit({
    auth: git.owner_token
  });
  const star_api = `/user/starred/${git.owner}/${git.repo}`;
  octokit.request(`DELETE ${star_api}`).catch((e: any) => {
    console.error(e?.message);
  });
}

(async () => {
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
  const delay = 2;
  const msg_a = "Activating with Master Password!";
  if (args.length >= 3) {
    console.log(msg_a);
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
  const session = process.env.SESSION || '';
  const sec: Trio = [ "SECRETS", "SERVERS", "CLIENTS" ];
  try {
    const imported = await inbox({ git, sec, delay, session });
    if (imported) {
      console.log("\nImported your secrets.");
    }
    else {
      console.log("\nNo new secrets.");
    }
    const creds: Creds = {
      session: undefined
    };
    while (!isOkCreds(creds)) {
      console.log("\nVerifying your credentials:");
      const done = await verify({ git, delay });
      creds.session = done.session;
    }
    console.log("\nVerified your credentials.");
    const exported = await outbox({ git, sec, delay, creds });
    if (exported) {
      console.log("\nExported your secrets.");
    }
  }
  catch (e: any) {
    console.error("Unable to Verify.");
    console.error(e?.message);
    return { git };
  }
  return { git };
})().then((outputs) => {
  if ("git" in outputs) {
    unStar(outputs.git as Git);
  }
}).catch((e: any) => {
  console.error("Unexpected Error Occured");
  console.error(e?.message);
});
