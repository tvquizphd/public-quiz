import { toB64urlQuery, fromB64urlQuery } from "project-sock";
import { configureNamespace } from "./config/sock";
import { opId, findOp } from "./util/lookup";
import { addSecret } from "./util/secrets";
import { needKeys } from "./util/keys";
import { toSock } from "./util/socket";
import OP from '@nthparty/opaque';

import type { Git, Op } from "./util/types";
import type { Socket } from "./util/socket";
import type { Namespace } from "./config/sock";
import type { SockInputs } from "./util/socket";
import type { NameInterface } from "./config/sock";

export type Creds = Record<"session", string | void>;
interface Resolver {
  (r: Creds): void;
}
type ConfigIn = {
  delay: number,
  git: Git
}
interface COS {
  (s: Socket, i: NameInterface): Promise<void>;
}
type PepperInputs = NameInterface & {
  Opaque: Op,
  Sock: Socket,
  times: number,
  git: Git
}

const toPepper = async (inputs: PepperInputs) => {
  const { git, times } = inputs;
  const { Opaque, Sock } = inputs;
  const secret_name = "ROOT_PEPPER";
  const secret_str = process.env[secret_name];
  const pepper = fromB64urlQuery(secret_str);
  const peps = "ks ps Ps Pu c".split(" ");
  const op = findOp(inputs, "registered");
  try {
    needKeys(pepper, peps);
  }
  catch {
    Sock.give(opId(inputs, "start"), "start", true);
    const reg = await Opaque.serverRegister(times, op);
    const secret = toB64urlQuery(reg.pepper);
    addSecret({git, secret, secret_name}).then(() => {
      console.log('Saved pepper to secrets.');
    }).catch((e: any) => {
      console.error('Can\'t save pepper to secrets.');
      console.error(e.message);
    })
    return { pepper: reg.pepper };
  }
  console.log('Loaded pepper from secrets.');
  const op_id = opId(inputs, "registered");
  Sock.give(op_id, "registered", true);
  return { pepper };
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

const verify = (config_in: ConfigIn): Promise<Creds> => {
  const namespace: Namespace = configureNamespace();
  const opaque: NameInterface = namespace.opaque;
  const { git, delay } = config_in;
  const { project } = opaque;
  const user = "root";
  const times = 1000;
  const op_inputs = { git, delay, namespace };
  return new Promise((resolve: Resolver) => {
    toOpaqueSock(op_inputs).then(({ Opaque, Sock }) => {
      const pepper_inputs = {
        ...opaque,
        git, times, Opaque, Sock
      };
      // Always listen for reset signal
      Sock.get(opId(opaque, "reset"), "reset").then(() => {
        const reset = () => resolve({ session: undefined });
        Sock.sock.project.finish().then(reset);
      });
      // Authenticate server with opaque sequence
      const op = findOp(opaque, "registered");
      toPepper(pepper_inputs).then(({ pepper }) => {
        const auth = Opaque.serverAuthenticate(user, pepper, op);
        auth.then((session: string) => {
          const finish = () => resolve({ session });
          Sock.sock.project.finish().then(finish);
        });
        console.log('Waiting');
      });
    });
  });
}

export { verify };
