import { configureNamespace } from "./config/sock";
import { decryptQueryMaster } from "./util/decrypt";
import { toB64urlQuery } from "project-sock";
import { addSecret } from "./util/secrets";
import { needKeys } from "./util/keys";
import { toSock } from "./util/socket";
import { findSub } from "./util/lookup";
import { opId } from "./util/lookup";

import type { Git, Trio } from "./util/types";
import type { Encrypted } from "./util/encrypt";

type HasPlain = Record<"plain_text", string>;
type HasSec = Record<"sec", Trio>;
export type Inputs = HasSec & {
  ses: string,
  env: string,
  delay: number,
  git: Git
}
type HasSecrets = {
  secrets: Record<string, string>
}
type SaveInputs = HasSec & HasSecrets & {
  env: string,
  git: Git
}
type Output = {
  trio: Trio
}
interface FromTrio {
  (i: HasSec & HasPlain): Output & HasSecrets;
}
interface Inbox {
  (i: Inputs): Promise<Output>
}

function isTrio(trio: string[]): trio is Trio {
  return trio.length === 3;
}

const deserialize_trio: FromTrio = ({ sec, plain_text }) => {
  const trio = plain_text.split('\n');
  if (!isTrio(trio)) {
    throw new Error('SECRET must be 3 lines');
  }
  const pairs = sec.map((k, i) => [k, trio[i]]);
  const secrets = Object.fromEntries(pairs);
  return { trio, secrets }
}

const saveSecrets = async (inputs: SaveInputs) => {
  const { git, sec, env, secrets } = inputs;
  try {
    needKeys(secrets, sec);
  }
  catch (e: any) {
    console.error(`Need ${sec.join(", ")}`);
    console.error(e?.message);
    return false;
  }
  const entries = Object.entries(secrets).filter(([name]) => {
    return sec.includes(name);
  })
  const promises = entries.map(([name, secret]) => {
    return new Promise((resolve, reject) => {
      const add_args = {git, secret, name, env}
      addSecret(add_args).then(() => {
        resolve(null);
      }).catch((e) => {
        reject(e);
      });
    })
  }) 
  const info = "from last session";
  try {
    await Promise.all(promises);
    console.log(`Saved secrets ${info}`);
    return true;
  }
  catch (e: any) {
    console.error(`Can't save secrets ${info}`);
    console.error(e?.message);
    return false;
  }
}

const inbox: Inbox = async (inputs) => {
  const wait_extra_ms = 2000;
  const namespace = configureNamespace();
  const { git, sec, env, delay, ses } = inputs;
  const dt = 1000 * delay + wait_extra_ms;
  const timeout = "timeout";
  // Check for existing saved secrets
  const load = findSub(namespace.mailbox, "to_secret");
  const sock_inputs = { git, delay, namespace };
  const Sock = await toSock(sock_inputs, "mailbox");
  const { project } = Sock.sock;
  const clean_up = () => {
    project.done = true;
    console.log('Closed inbox.')
  };
  const session = process.env[ses] || '';
  const master_buffer = Buffer.from(session, "hex");
  const master_key = new Uint8Array(master_buffer);
  const promise = new Promise((resolve, reject) => {
    const { text, subcommand: sub } = load;
    setTimeout(() => {
      project.waitMap.delete(text);
      reject(new Error(timeout));
    }, dt);
    const op_id = opId(namespace.mailbox, sub);
    Sock.get(op_id, sub).then(resolve).catch(reject);
  });
  try {
    const data = await promise as Encrypted;
    const search = toB64urlQuery({ data });
    const query_input = { master_key, search };
    const { plain_text } = decryptQueryMaster(query_input);
    const { secrets, trio } = deserialize_trio({ sec, plain_text });
    const done = await saveSecrets({ git, sec, env, secrets });
    clean_up();
    if (done) {
      console.log("\nImported secrets.");
      return { trio };
    }
  }
  catch (e: any) {
    if (e?.message != timeout) {
      console.error(e?.message);
    }
  }
  clean_up();
  console.log("\nNo new secrets.");
  const trio = sec.map((name) => {
    return process.env[name] || '';
  });
  if (!isTrio(trio)) {
    throw new Error("Error reading secrets.");
  }
  return { trio };
}

export {
  inbox
}
