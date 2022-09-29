import { Octokit } from "octokit";
import _sodium from 'libsodium-wrappers';
import type { Git } from "./types";

type Inputs = {
  name: string,
  git: Git
}
type AddInputs = Inputs & {
  secret: string 
}
type Ev = Record<"key_id" | "ev", string>;
interface Sodiumize {
  (o: Octokit, id: number, env: string, value: string): Promise<Ev>
}

const isProduction = ({ argv }: NodeJS.Process) => {
  const dev_exe = "ts-node/dist/bin.js";
  const exe = argv[0].slice(-dev_exe.length);
  return exe !== dev_exe;
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
  const { git, name } = inputs;
  if (!isProduction(process)) {
    delete process.env[name];
  }
  const octokit = new Octokit({
    auth: git.owner_token
  })
  const env = 'secret-tv-access';
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await octokit.request(`GET ${get_api}`, git);
  const { id } = get_r.data;
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/${name}`;
  await octokit.request(`DELETE ${api_url}`)
}

const addSecret = async (inputs: AddInputs) => {
  const { git, secret, name } = inputs;
  if (!isProduction(process)) {
    process.env[name] = secret;
  }
  const octokit = new Octokit({
    auth: git.owner_token
  })
  const env = 'secret-tv-access';
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
  deleteSecret, addSecret, isProduction
}
