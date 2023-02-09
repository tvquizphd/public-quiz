import { toB64urlQuery } from "sock-secret";
import { toSockClient } from "sock-secret";
import { isDuo } from "./types.js";

import type { Git } from "./types.js";
import type { NameTree } from "./pasted.js";

export type SecretInputs = {
  delay: number,
  env: string,
  git: Git
}
export type SetInputs = SecretInputs & NameTree; 

const isProduction = (env: string) => {
  return env.slice(0, 4) === "PROD";
}

const setSecret = async (inputs: SetInputs) => {
  const { git, delay, env, command, tree } = inputs;
  if (!isProduction(env)) {
    process.env[command] = toB64urlQuery(tree);
    return;
  }
  const output = { env, git, delay, tries: 3 };
  const sock = await toSockClient({ output });
  const split = command.split('__');
  if (!isDuo(split)) {
    throw new Error('Invalid secret name');
  }
  await sock.give(split[0], split[1], tree);
  sock.quit();
}

export {
  setSecret, isProduction
}
