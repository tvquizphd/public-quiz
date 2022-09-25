import { configureNamespace } from "./config/sock";
import { encryptQueryMaster } from "./util/encrypt";
import { addSecret } from "./util/secrets";
import { toSock } from "./util/socket";
import { opId } from "./util/lookup";

import type { Git, Trio } from "./util/types";
import type { Creds } from "./verify";

export interface OkCreds extends Creds {
  session: string;
}

type HasSec = Record<"sec", Trio>;
type Inputs = HasSec & {
  creds: OkCreds,
  delay: number,
  git: Git
}

const read_database = ({ sec }: HasSec) => {
  const trio = sec.map((k) => process.env[k]);
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
  const secret_name = "SESSION";
  const subcommand = "from_secret";
  const namespace = configureNamespace();
  const { session: secret } = inputs.creds;
  const { git, sec, delay } = inputs;
  const sock_inputs = { git, delay, namespace };
  const Sock = await toSock(sock_inputs, "mailbox");
  try {
    await addSecret({git, secret, secret_name});
  }
  catch (e: any) {
    console.error("Unable to save new session key.");
    console.error(e?.message);
    return false;
  }
  const master_key = to_bytes(secret);
  const plain_text = read_database({ sec });
  const to_encrypt = { plain_text, master_key };
  const encrypted = encryptQueryMaster(to_encrypt);
  const op_id = opId(namespace.mailbox, subcommand);
  Sock.give(op_id, subcommand, encrypted);
  return true;
}

export {
  outbox
};
