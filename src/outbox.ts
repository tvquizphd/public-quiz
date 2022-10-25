import { configureNamespace } from "./config/sock.js";
import { encryptQueryMaster } from "./util/encrypt.js";
import { fromB64urlQuery } from "project-sock";
import { addSecret } from "./util/secrets.js";
import { toSock } from "./util/socket.js";
import { opId } from "./util/lookup.js";

import type { Git, Trio } from "./util/types.js";

export interface Creds {
  name: string,
  login: boolean,
  registered: boolean,
  secret?: string
}
export interface OkCreds extends Creds {
  secret: string;
}

type HasTrio = Record<"trio", Trio>;
type Inputs = HasTrio & {
  creds: OkCreds,
  delay: number,
  env: string,
  git: Git
}

function isOkCreds(c: Creds): c is OkCreds {
  if (c.login) {
    return !!(c as OkCreds).secret;
  }
  return c.registered;
}

const serialize_trio = ({ trio }: HasTrio) => {
  if (trio.length !== 3) {
    throw new Error('SECRET must be 3 lines');
  }
  return trio.join('\n');
}

const to_bytes = (s: string) => {
  const a: string[] = s.match(/../g) || [];
  const bytes = a.map(h =>parseInt(h,16)); 
  return new Uint8Array(bytes);
}
const outbox = async (inputs: Inputs) => {
  const subcommand = "from_secret";
  const { git, env, trio, delay } = inputs;
  const namespace = configureNamespace(env);
  const { secret, name } = inputs.creds;
  const master_key = to_bytes(secret);
  const sock_inputs = { git, delay, namespace };
  const Sock = await toSock(sock_inputs, "mailbox");
  try {
    await addSecret({git, env, secret, name});
  }
  catch (e: any) {
    console.error("Unable to save new session key.");
    console.error(e?.message);
    return false;
  }
  const plain_text = serialize_trio({ trio });
  const to_encrypt = { plain_text, master_key };
  const encrypted = await encryptQueryMaster(to_encrypt);
  const { data } = fromB64urlQuery(encrypted);
  const op_id = opId(namespace.mailbox, subcommand);
  Sock.give(op_id, subcommand, data);
  Sock.sock.project.call_fifo.push(async () => {
    Sock.sock.project.done = true;
    console.log('Closed outbox.')
  })
  return true;
}

export {
  isOkCreds,
  outbox
};
