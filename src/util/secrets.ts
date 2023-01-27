import _sodium from 'libsodium-wrappers';
import { request } from "@octokit/request";
import { toB64urlQuery } from "sock-secret";

import type { Git } from "./types.js";
import type { NameTree } from "./pasted.js";

type Inputs = {
  env: string,
  git: Git
}
type SetTextInputs = Inputs & {
  secret: string,
  name: string,
}
type SetInputs = Inputs & NameTree; 
type Ev = Record<"key_id" | "ev", string>;
interface Sodiumize {
  (auth: string, id: number, env: string, value: string): Promise<Ev>
}

const isProduction = (env: string) => {
  return env.slice(0, 4) === "PROD";
}

const sodiumize: Sodiumize = async (auth, id, env, value) => {
  const headers = { 
    authorization: auth,
    accept: "application/vnd.github+json",
  };
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/public-key`;
  const get_r = await request(`GET ${api_url}`, {
    headers
  })
  const { key, key_id } = get_r.data;
  const buff_key = Buffer.from(key, 'base64');
  const buff_in = Buffer.from(value);
  await _sodium.ready;
  const seal = _sodium.crypto_box_seal;
  const encryptedBytes = seal(buff_in, buff_key);
  const buff_out = Buffer.from(encryptedBytes);
  const ev = buff_out.toString('base64');
  return { key_id, ev };
}

const setSecretText = async (inputs: SetTextInputs) => {
  const { git, env, secret, name } = inputs;
  if (!isProduction(env)) {
    process.env[name] = secret;
    return;
  }
  const authorization = 'bearer ' + git.owner_token;
  const headers = { authorization };
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await request(`GET ${get_api}`);
  const { id } = get_r.data;
  const e_secret = await sodiumize(authorization, id, env, secret);
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/${name}`;
  await request(`PUT ${api_url}`, {
    headers,
    secret_name: name,
    repository_id: id,
    environment_name: env,
    key_id: e_secret.key_id,
    encrypted_value: e_secret.ev,
  })
}

const setSecret = (inputs: SetInputs) => {
  const { git, env, command, tree } = inputs;
  const secret = toB64urlQuery(tree);
  const text_inputs = {
    git, env, secret, name: command
  };
  return setSecretText(text_inputs);
}

export {
  setSecretText, setSecret, isProduction
}
