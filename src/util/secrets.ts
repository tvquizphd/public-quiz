import { Octokit } from "octokit";
import _sodium from 'libsodium-wrappers';
import type { Git } from "./types";

type Inputs = {
  secret_name: string,
  git: Git
}
type AddInputs = Inputs & {
  secret: string 
}
type Ev = Record<'key_id' | "ev", string>;
interface Sodiumize {
  (o: Octokit, id: number, env: string, value: string): Promise<Ev>
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

const deleteSecret = async (inputs: Inputs) => {
  const { git, secret_name } = inputs;
  const octokit = new Octokit({
    auth: git.owner_token
  })
  const env = 'secret-tv-access';
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await octokit.request(`GET ${get_api}`, git);
  const { id } = get_r.data;
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/${secret_name}`;
  await octokit.request(`DELETE ${api_url}`)
}

const addSecret = async (inputs: AddInputs) => {
  const { git, secret, secret_name } = inputs;
  const octokit = new Octokit({
    auth: git.owner_token
  })
  const env = 'secret-tv-access';
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await octokit.request(`GET ${get_api}`, git);
  const { id } = get_r.data;
  const e_secret = await sodiumize(octokit, id, env, secret);
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/${secret_name}`;
  await octokit.request(`PUT ${api_url}`, {
    repository_id: id,
    environment_name: env,
    secret_name: secret_name,
    key_id: e_secret.key_id,
    encrypted_value: e_secret.ev,
  })
}

export {
  deleteSecret, addSecret
}
