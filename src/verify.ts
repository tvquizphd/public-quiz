import { toB64urlQuery, fromB64urlQuery } from "project-sock";
import { configureNamespace } from "./config/sock.js";
import { opId, findOp } from "./util/lookup.js";
import { outbox, isOkCreds } from "./outbox.js";
import { addSecret } from "./util/secrets.js";
import { needKeys } from "./util/keys.js";
import { toSock } from "./util/socket.js";
import { inbox } from "./inbox.js";
import OP from '@nthparty/opaque';

import type { Git } from "./util/types.js";
import type { TreeAny } from 'project-sock';
import type { Socket } from "./util/socket.js";
import type { Namespace } from "./config/sock.js";
import type { SockInputs } from "./util/socket.js";
import type { NameInterface } from "./config/sock.js";
import type { Op, Pepper } from '@nthparty/opaque';
import type { Inputs as InIn } from "./inbox.js";
import type { Creds } from "./outbox.js";

type ConfigIn = {
  login: boolean,
  delay: number,
  pep: string,
  env: string,
  git: Git
}
interface COS {
  (s: Socket, i: NameInterface): Promise<void>;
}
type PepperInputs = NameInterface & {
  Opaque: Op,
  Sock: Socket,
  times: number,
  env: string,
  pep: string,
  git: Git
}
type HasPepper = Record<"pepper", Pepper>
interface ToPepper {
  (i: PepperInputs): Promise<HasPepper> 
}
type Output = string;
type Inputs = {
  inbox_in: InIn,
  log_in: ConfigIn
}
interface Resolver {
  (o: Output): void;
}
interface Verify {
  (i: ConfigIn): Promise<Output>
}
interface Verifier {
  (i: Inputs): Promise<void>
}

const isPepper = (t: TreeAny): t is Pepper => {
  const pepperKeys = 'ks ps Ps Pu c'.split(' '); 
  try {
    needKeys(t, pepperKeys);
  }
  catch {
    return false;
  }
  return true
}

const toPepper: ToPepper = async (inputs) => {
  const { git, env, times, pep } = inputs;
  const { Opaque, Sock } = inputs;
  const secret_str = process.env[pep] || '';
  const pepper = fromB64urlQuery(secret_str);
  const op = findOp(inputs, "registered");
  if (isPepper(pepper)) {
    console.log('Loaded pepper from secrets.');
    const op_id = opId(inputs, "registered");
    Sock.give(op_id, "registered", true);
    return { pepper };
  }
  const reg = await Opaque.serverRegister(times, op);
  if (!isPepper(reg.pepper)) {
    throw new Error('Unable to register Opaque client');
  }
  const secret = toB64urlQuery(reg.pepper);
  const add_inputs = {git, secret, env, name: pep};
  addSecret(add_inputs).then(() => {
    console.log('Saved pepper to secrets.');
  }).catch((e: any) => {
    console.error('Can\'t save pepper to secrets.');
    console.error(e.message);
  })
  return { pepper: reg.pepper };
}

const clearOpaqueServer: COS = (Sock, inputs) => {
  const { commands } = inputs;
  const client_subs = ['sid', 'pw'];
  const toClear = commands.filter((cmd) => {
    return !client_subs.includes(cmd.subcommand);
  });
  return Sock.sock.project.clear({ commands: toClear });
}

const toOpaqueSock = async (inputs: SockInputs) => {
  const opaque: NameInterface = inputs.namespace.opaque;
  const Sock = await toSock(inputs, "opaque");
  await clearOpaqueServer(Sock, opaque);
  const Opaque = await OP(Sock);
  return { Opaque, Sock };
}

const verify: Verify = (config_in) => {
  const { git, env, pep, login, delay } = config_in;
  const namespace: Namespace = configureNamespace(env);
  const opaque: NameInterface = namespace.opaque;
  const user = "root";
  const times = 1000;
  const user_inputs = { git, delay, namespace };
  return new Promise((resolve: Resolver) => {
    toOpaqueSock(user_inputs).then(({ Opaque, Sock }) => {
      const pepper_inputs = {
        ...opaque, git, env, pep, times, Opaque, Sock
      };
      // Authenticate server with opaque sequence
      const op = findOp(opaque, "registered");
      toPepper(pepper_inputs).then(({ pepper }) => {
        if (!login) {
          const finish = () => resolve("");
          Sock.sock.project.finish().finally(finish);
        }
        const auth = Opaque.serverAuthenticate(user, pepper, op);
        auth.then((session: string) => {
          const finish = () => resolve(session);
          Sock.sock.project.finish().finally(finish);
        });
        console.log('Waiting');
      });
    });
  });
}

const verifier: Verifier = async (inputs) => {
  const { inbox_in, log_in } = inputs;
  const { trio } = await inbox(inbox_in);
  const creds: Creds = { 
    login: log_in.login,
    name: inbox_in.ses,
    registered: false
  };
  while (!isOkCreds(creds)) {
    console.log("\nVerifying your credentials:");
    const session = await verify(log_in);
    creds.registered = true;
    creds.secret = session;
  }
  if (creds.login && !!creds.secret) {
    const { git, env, delay } = inbox_in;
    console.log("\nVerified your credentials.");
    const outbox_in = { git, env, delay, creds, trio };
    const exported = await outbox(outbox_in);
    if (exported) {
      console.log("\nExported your secrets.");
    }
  }
}

export { verifier };
