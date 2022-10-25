import { Octokit } from "octokit";
import _sodium from 'libsodium-wrappers';
import type { Git } from "./types.js";

type AddInputs = {
  secret: string,
  name: string,
  env: string,
  git: Git
}
type Ev = Record<"key_id" | "ev", string>;
interface Sodiumize {
  (o: Octokit, id: number, env: string, value: string): Promise<Ev>
}

const isProduction = (env: string) => {
  return env.slice(0, 4) === "PROD";
}

const sodiumize: Sodiumize = async (o, id, env, value) => {
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/public-key`;
  const get_r = await o.request(`GET ${api_url}`, {
    repository_id: id,
    environment_name: env
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

const addSecret = async (inputs: AddInputs) => {
  const { git, env, secret, name } = inputs;
  if (!isProduction(env)) {
    process.env[name] = secret;
    return;
  }
  const octokit = new Octokit({
    auth: git.owner_token
  })
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await octokit.request(`GET ${get_api}`, git);
  const { id } = get_r.data;
  const e_secret = await sodiumize(octokit, id, env, secret);
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/${name}`;
  await octokit.request(`PUT ${api_url}`, {
    secret_name: name,
    repository_id: id,
    environment_name: env,
    key_id: e_secret.key_id,
    encrypted_value: e_secret.ev,
  })
}

export {
  addSecret, isProduction
}
