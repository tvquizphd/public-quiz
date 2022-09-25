import { configureNamespace } from "./config/sock";
import { decryptQueryMaster } from "./util/decrypt";
import { addSecret } from "./util/secrets";
import { needKeys } from "./util/keys";
import { toSock } from "./util/socket";
import { findSub } from "./util/lookup";
import { opId } from "./util/lookup";

import type { QMI } from "./util/decrypt";
import type { Git, Trio } from "./util/types";

type HasPlain = Record<"plain_text", string>;
type HasSec = Record<"sec", Trio>;
type Inputs = HasSec & {
  session: string,
  delay: number,
  git: Git
}
type Secrets = Record<string, string>;
type SaveInputs = HasSec & {
  secrets: Secrets,
  git: Git
}
interface WriteDB {
  (i: HasSec & HasPlain): Secrets;
}

const write_database: WriteDB = ({ sec, plain_text }) => {
  const trio = plain_text.split('\n');
  if (trio.length !== 3) {
    throw new Error('SECRET must be 3 lines');
  }
  const pairs = sec.map((k, i) => [k, trio[i]]);
  return Object.fromEntries(pairs);
}

const saveSecrets = async (inputs: SaveInputs) => {
  const { git, sec, secrets } = inputs;
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
  const promises = entries.map(([secret_name, secret]) => {
    return new Promise((resolve, reject) => {
      addSecret({git, secret, secret_name}).then(() => {
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

const inbox = async (inputs: Inputs) => {
  const namespace = configureNamespace();
  const { git, sec, delay, session } = inputs;
  const dt = 1000 * delay + 500;
  const timeout = "timeout";
  // Check for existing saved secrets
  const load = findSub(namespace.mailbox, "to_secret");
  const sock_inputs = { git, delay, namespace };
  const Sock = await toSock(sock_inputs, "mailbox");
  const promise = new Promise((resolve, reject) => {
    const { text, subcommand: sub } = load;
    const { project } = Sock.sock;
    setTimeout(() => {
      project.waitMap.delete(text);
      reject(new Error(timeout));
    }, dt);
    const op_id = opId(namespace.mailbox, sub);
    Sock.get(op_id, sub).then(resolve).catch(reject);
  });
  try {
    const { plain_text } = decryptQueryMaster((await promise) as QMI);
    const secrets = write_database({ sec, plain_text });
    return await saveSecrets({ git, sec, secrets });
  }
  catch (e: any) {
    if (e?.message != timeout) {
      console.error(e?.message);
    }
  }
  return false;
}

export {
  inbox
}
