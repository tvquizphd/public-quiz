import { toB64urlQuery, fromB64urlQuery } from "project-sock";
import { configureNamespace } from "./config/sock";
import { opId, findOp } from "./util/lookup";
import { addSecret } from "./util/secrets";
import { needKeys } from "./util/keys";
import { toSock } from "./util/socket";
import OP from '@nthparty/opaque';

import type { Git } from "./util/types";
import type { TreeAny } from 'project-sock';
import type { Socket } from "./util/socket";
import type { Namespace } from "./config/sock";
import type { SockInputs } from "./util/socket";
import type { NameInterface } from "./config/sock";
import type { Op, Pepper } from '@nthparty/opaque';

type ConfigIn = {
  login: boolean,
  delay: number,
  pep: string,
  tok: string,
  git: Git
}
interface COS {
  (s: Socket, i: NameInterface): Promise<void>;
}
type PepperInputs = NameInterface & {
  Opaque: Op,
  Sock: Socket,
  times: number,
  pep: string,
  git: Git
}
type HasPepper = Record<"pepper", Pepper>
interface ToPepper {
  (i: PepperInputs): Promise<HasPepper> 
}
type Output = string;
interface Resolver {
  (o: Output): void;
}
interface Verify {
  (i: ConfigIn): Promise<Output>
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
  const { git, times, pep } = inputs;
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
  addSecret({git, secret, name: pep}).then(() => {
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
  const { git, tok, pep, login, delay } = config_in;
  const namespace: Namespace = configureNamespace();
  const opaque: NameInterface = namespace.opaque;
  const user = "root";
  const times = 1000;
  const owner_token = process.env[tok] || '';
  const user_git = { ...git, owner_token };
  const user_inputs = { git: user_git, delay, namespace };
  return new Promise((resolve: Resolver) => {
    toOpaqueSock(user_inputs).then(({ Opaque, Sock }) => {
      const pepper_inputs = {
        ...opaque, git: user_git,
        pep, times, Opaque, Sock
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

export { verify };
