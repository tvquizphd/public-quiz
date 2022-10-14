import { needKeys } from "./util/keys";
import { printSeconds } from "./util/time";
import { simpleGit, CleanOptions } from 'simple-git';
import { fromB64urlQuery, toB64urlQuery } from "project-sock";
import { encryptQueryMaster } from "./util/encrypt";
import * as eccrypto from "eccrypto";
import { Octokit } from "octokit";
import path from 'node:path';
import fs from 'fs'

import type { Git } from "./util/types";
import type { Encrypted } from "./util/encrypt";

type HasData = {
  data: Encrypted
}
type ConfigureInputs = {
  git: Git,
  delay: number,
  client_id: string
}
type HasInterval = {
  interval: number
}
type AskInputs = ConfigureInputs & HasInterval & {
  user_code: string,
  device_code: string
}; 
type AuthError = {
  error: string;
  error_description: string;
}
type GoodAuthError = AuthError & HasInterval; 
type AuthSuccess = {
  access_token: string,
  token_type: string,
  scope: string
}
type AuthVerdict = AuthError | AuthSuccess;
type AskOutputs = HasInterval | AuthSuccess;

interface Configure {
  (i: ConfigureInputs): Promise<AskInputs>;
}
interface AskUser {
  (i: AskInputs): Promise<AuthSuccess>;
}
interface AskUserOnce {
  (i: AskInputs, ts: string): Promise<AskOutputs>;
}
type HasMaster = {
  master_key: Uint8Array 
}
type Pasted = {
  pub: Uint8Array 
}
type HasPubMaster = Pasted & HasMaster;
type TokenInputs = AuthSuccess & HasPubMaster;
type HasGit = {
  git: Git
}
type ToEncryptPublic = HasPubMaster & {
  plain_text: string,
  label: string
} 
interface ToPagesSite {
  (i: HasGit) : Promise<string>
}
interface ToPasted {
  (i: string) : Promise<Partial<Pasted>>
}
interface AwaitPasted {
  (i: HasGit) : Promise<Pasted>
}
interface HandleToken {
  (i: TokenInputs): Promise<string>
}
interface EncryptPublic {
  (i: ToEncryptPublic): Promise<string>
}
const SCOPES = [
  'repo_deployment', 'project'
];

function hasData(d: Partial<HasData>): d is HasData {
  return !!d.data?.tag && !!d.data?.ev && !!d.data?.iv;
}

function isPasted(p: Partial<Pasted>): p is Pasted {
  const n_keys = Object.keys(p).length;
  return !!p.pub && n_keys === 1;
}

const encryptPublic: EncryptPublic = async (inputs) => {
  const { plain_text } = inputs;
  const { pub, master_key, label } = inputs;
  const encrypted = await encryptQueryMaster({
    master_key, plain_text 
  });
  const decoded = fromB64urlQuery(encrypted);
  if (!hasData(decoded)) {
    throw new Error("Invalid public encryption")
  }
  const { data } = decoded;
  return toB64urlQuery({ [label]: data, pub });
}

const useGit = (git: Git, fname: string) => {
  const cwd = process.cwd();
  const { owner, owner_token, repo } = git;
  const wiki = `${repo}.wiki`;
  const login = `${owner}:${owner_token}@github.com`;
  const repo_url = `https://${login}/${owner}/${wiki}.git`;
  const tmp_dir = path.relative(cwd, 'tmp-wiki');
  const tmp_file = path.join(tmp_dir, wiki, fname);
  const rf = { recursive: true, force: true };
  if (fs.existsSync(tmp_dir)){
    fs.rmSync(tmp_dir, rf);
  }
  fs.mkdirSync(tmp_dir);
  return { repo_url, tmp_dir, tmp_file };
}

const updateWiki = async (git: Git, data: string) => {
  const fname = "Home.md";
  const { repo_url, tmp_dir, tmp_file } = useGit(git, fname);
  const wiki_dir = path.dirname(tmp_file);
  const git_opts = {
    binary: 'git',
    baseDir: tmp_dir
  }
  const { owner, email } = git;
  const github = simpleGit(git_opts);
  await github.clean(CleanOptions.FORCE);
  await github.clone(repo_url);
  await github.cwd(wiki_dir);
  await github.addConfig("user.name", owner, false, "local");
  await github.addConfig("user.email", email, false, "local");
  await github.add([ fname ]);
  fs.writeFileSync(tmp_file, data);
  const msg = `Updated ${fname}`;
  await github.commit(msg, [ fname ]);
  await github.push();
}

const toPrivate = () => {
  return eccrypto.generatePrivate();
}

const toKeyPair = async () => {
  const b_priv = await toPrivate();
  const priv = new Uint8Array(b_priv);
  const pub = new Uint8Array(eccrypto.getPublic(b_priv));
  return { priv, pub };
}

function isBadAuthError(a: AuthError): boolean {
  const good_errors = [
    'authorization_pending', 'slow_down'
  ];
  return !good_errors.includes(a.error);
}

function isGoodAuthError(a: AuthVerdict): a is GoodAuthError {
  return 'interval' in (a as GoodAuthError);
}

function isAuthError(a: AuthVerdict): a is AuthError {
  return 'error_description' in (a as AuthError);
}

function isAuthSuccess(a: AskOutputs): a is AuthSuccess {
  const keys = 'access_token token_type scope' 
  try {
    needKeys((a as AuthSuccess), keys.split(' '));
  }
  catch (e: any) {
    return false;
  }
  return true;
}

class PollingFails extends Error {
  constructor(error: AuthError) {
    const message = error.error_description;
    super(message);
    this.name = "PollingFails";
  }
}

const getConfigurable = (inputs: ConfigureInputs) => {
  const { client_id } = inputs;
  const scope = SCOPES.join(',');
  const keys = { client_id, scope }
  const authPath = 'github.com/login/device/code';
  const deviceParameters = new URLSearchParams(keys);
  const configurable = `https://${authPath}?${deviceParameters}`;
  const headers = { 'Accept': 'application/json' };
  return { configurable, headers };
}

const configureDevice: Configure = async (inputs) => {
  const step0 = getConfigurable(inputs);
  const { configurable, headers } = step0;
  const step1 = { headers, method: 'POST' };
  const step2 = await fetch(configurable, step1); 
  const keys = 'interval device_code user_code';
  const result = await step2.json();
  needKeys(result, keys.split(' '));
  return {...inputs, ...result};
};

const getAskable = (inputs: AskInputs) => {
  const { client_id, device_code } = inputs;
  const grant_type = [
    'urn:ietf:params:oauth',
    'grant-type:device_code'
  ].join(':');
  const keys = { client_id, device_code, grant_type };
  const authPath = 'github.com/login/oauth/access_token';
  const deviceParameters = new URLSearchParams(keys);
  const askable = `https://${authPath}?${deviceParameters}`;
  const headers = { 'Accept': 'application/json' };
  return { askable, headers };
}

const askUserOnce: AskUserOnce = (inputs, timestamp) => {
  const step0 = getAskable(inputs);
  const { askable, headers } = step0;
  const step1 = { headers, method: 'POST' };
  const dt = 1000 * inputs.interval + 100;
  return new Promise((resolve) => {
    setTimeout(async () => { 
      const step2 = await fetch(askable, step1); 
      const result: AuthVerdict = await step2.json();
      if (isAuthError(result)) {
        if (isBadAuthError(result)) {
          throw new PollingFails(result);
        }
        const message = result.error_description;
        console.warn(`${timestamp}: ${message}`);
        if (isGoodAuthError(result)) {
          const { interval } = result;
          resolve({...inputs, interval});
        }
        resolve(inputs);
      }
      else {
        resolve(result);
      }
    }, dt);
  });
}

const askUser: AskUser = async (inputs) => {
  let total_time = 0;
  let interval = inputs.interval;
  console.log(`Polling interval ${interval}+ s`);
  let result: AskOutputs = { interval };
  while (!isAuthSuccess(result)) {
    total_time += interval;
    if (interval != result.interval) {
      console.log(`Polling interval now ${interval}+ s`);
      interval = result.interval;
    }
    const timestamp = printSeconds(total_time);
    result = await askUserOnce(inputs, timestamp);
  }
  return result;
}

const handleToken: HandleToken = async (inputs) => {
  const { pub, scope, token_type } = inputs;
  const scope_set = new Set(scope.split(','));
  if (!SCOPES.every(x => scope_set.has(x))) {
    throw new Error(`Need project scope, not '${scope}'`);
  }
  if (token_type != 'bearer') {
    throw new Error(`Need bearer token, not '${token_type}'`);
  }
  console.log('Authorized by User');
  const { master_key, access_token } = inputs;
  const e_token_query = await encryptPublic({
    pub, master_key, label: "token",
    plain_text: access_token 
  });
  console.log('Encrypted GitHub access token');
  return e_token_query;
}

const toPagesSite: ToPagesSite = async ({ git }) => {
  const { owner_token: auth, owner, repo } = git;
  const octokit = new Octokit({ auth });
  const opts = { owner, repo };
  const api_url = `/repos/${owner}/${repo}/pages`;
  const out = await octokit.request(`GET ${api_url}`, opts);
  return out.data.html_url;
}

const toPasted: ToPasted = async (url) => {
  const wiki = `${url}/Home.md`;
  const text = await (await fetch(wiki)).text();
  return fromB64urlQuery(text) as Partial<Pasted>;
}

const awaitPasted: AwaitPasted = async ({ git }) => {
  let tries = 0;
  const delay = 1;
  const dt = delay * 1000;
  const max_tries = 15*60/delay;
  const url = await toPagesSite({ git });
  while (tries < Math.ceil(max_tries)) {
    await new Promise(r => setTimeout(r, dt));
    const pasted = await toPasted(url);
    if (isPasted(pasted)) {
      return pasted;
    }
    tries += 1;
  }
  throw new Error("Timeout waiting for wiki");
}

const derive = async (priv: Uint8Array, pub: Uint8Array) => {
  const b_priv = Buffer.from(priv);
  const b_pub = Buffer.from(pub);
  const b_key = eccrypto.derive(b_priv, b_pub);
  return new Uint8Array(await b_key);
}

const activate = (config_in: ConfigureInputs) => {
  const { git } = config_in;
  return new Promise((resolve, reject) => {
    awaitPasted({git}).then(async (pasted) => {
      const { priv, pub } =  await toKeyPair();
      const master_key = await derive(priv, pasted.pub);
      const outputs = await configureDevice(config_in);
      console.log('Device Configured');
      const { user_code } = outputs;
      const e_code_query = await encryptPublic({
        pub, master_key, label: "code",
        plain_text: user_code 
      });
      // Create activation link
      await updateWiki(git, e_code_query);
      console.log("Posted code to wiki");
      // Wait for user to visit link
      askUser(outputs).then((verdict) => {
        const token_in = { ...verdict, pub, master_key };
        handleToken(token_in).then((token_out) => {
          updateWiki(git, token_out).then(() => {
            resolve('Posted token to wiki');
          }).catch((e: any) => {
            console.error('Unable to update private repo.');
            reject(e);
          })
        }).catch((e: any) => {
          console.error('Error issuing token or verifier.');
          reject(e);
        });
      }).catch((e: any) => {
      console.error('Not authorized by the user.');
        reject(e);
      });
    }).catch((e: any) => {
      console.error('Unable to read public key.');
      reject(e);
    })
  });
}

export {
  activate
}
