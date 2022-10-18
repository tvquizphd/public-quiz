import { simpleGit } from 'simple-git';
import { needKeys } from "./util/keys";
import { printSeconds } from "./util/time";
import { addSecret, isProduction } from "./util/secrets";
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
  tok: string,
  delay: number,
  client_id: string,
  wiki_config: WikiConfig
}
type WikiConfig = {
  home: string,
  tmp: string
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
type GitOutput = {
  repo_url: string,
  tmp_dir: string,
  tmp_file: string
}

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
type TokenOutputs = {
  encrypted: string,
  secret: string
}
type ToEncryptPublic = HasPubMaster & {
  plain_text: string,
  label: string
} 
type GitInput = {
  wiki_config: WikiConfig
  prod: boolean,
  git: Git,
}
type UpdateInput = GitInput & {
  encrypted: string
}
interface ToPagesSite {
  (i: GitInput) : Promise<string>
}
interface ToPasted {
  (s: string, p: boolean) : Promise<Partial<Pasted>>
}
interface AwaitPasted {
  (i: GitInput) : Promise<Pasted>
}
interface HandleToken {
  (i: TokenInputs): Promise<TokenOutputs>
}
interface EncryptPublic {
  (i: ToEncryptPublic): Promise<string>
}
interface UseGit {
  (i: GitInput): GitOutput
}
interface CloneGit {
  (i: GitInput): Promise<void> 
}
interface Cleanup {
  (): Promise<void>
}
interface Activate {
  (i: ConfigureInputs): Promise<Cleanup>
}
const SCOPES = [
  'repo_deployment', 'public_repo', 'project'
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

const useGit: UseGit = ({ git, wiki_config }) => {
  const { owner, owner_token, repo } = git;
  const { tmp, home } = wiki_config;
  const wiki = `${repo}.wiki`;
  const login = `${owner}:${owner_token}@github.com`;
  const repo_url = `https://${login}/${owner}/${wiki}.git`;
  const tmp_dir = path.relative(process.cwd(), tmp);
  const tmp_file = path.join(tmp_dir, wiki, home);
  return { repo_url, tmp_dir, tmp_file };
}

const cloneGit: CloneGit = async (input) => {
  const { repo_url, tmp_dir } = useGit(input);
  const git_opts = {
    binary: 'git',
    baseDir: tmp_dir
  }
  if (fs.existsSync(tmp_dir)){
    const rf = { recursive: true, force: true };
    fs.rmSync(tmp_dir, rf);
  }
  fs.mkdirSync(tmp_dir);
  const github = simpleGit(git_opts);
  await github.clone(repo_url);
}

const updateWiki = async (input: UpdateInput) => {
  const { tmp_dir, tmp_file } = useGit(input);
  const wiki_dir = path.dirname(tmp_file);
  const { home } = input.wiki_config;
  const { prod } = input;
  const git_opts = {
    binary: 'git',
    baseDir: tmp_dir
  }
  const github = simpleGit(git_opts);
  const { owner, email } = input.git;
  await github.cwd(wiki_dir);
  await github.addConfig("user.name", owner, false, "local");
  await github.addConfig("user.email", email, false, "local");
  await github.add([ home ]);
  fs.writeFileSync(tmp_file, input.encrypted);
  const msg = `Updated ${home}`;
  if (prod) {
    await github.commit(msg, [ home ]);
    await github.push();
  }
  else {
    const dev_file = path.join(process.cwd(), 'docs', home);
    fs.copyFileSync(tmp_file, dev_file);
  }
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
  const encrypted = await encryptPublic({
    pub, master_key, label: "token",
    plain_text: access_token 
  });
  console.log('Encrypted GitHub access token');
  return { encrypted, secret: access_token };
}

const toPagesSite: ToPagesSite = async (input) => {
  const { owner_token: auth, owner, repo } = input.git;
  const { home } = input.wiki_config;
  const octokit = new Octokit({ auth });
  const opts = { owner, repo };
  const api_url = `/repos/${owner}/${repo}/pages`;
  const out = await octokit.request(`GET ${api_url}`, opts);
  return out.data.html_url + `/${home}`;
}

const toPasted: ToPasted = async (src, prod) => {
  if (prod) {
    const txt = await (await fetch(src)).text();
    const text = txt.replaceAll('\n', '');
    return fromB64urlQuery(text) as Partial<Pasted>;
  }
  const encoding = 'utf-8';
  const txt = fs.readFileSync(src, { encoding });
  const text = txt.replaceAll('\n', '');
  return fromB64urlQuery(text) as Partial<Pasted>;
}

const awaitPasted: AwaitPasted = async (input) => {
  let tries = 0;
  const delay = 1;
  const dt = delay * 1000;
  const max_tries = 15*60/delay;
  const { tmp_file } = useGit(input);
  const url = await toPagesSite(input);
  const src = input.prod ? url : tmp_file;
  await cloneGit(input);
  while (tries < Math.ceil(max_tries)) {
    await new Promise(r => setTimeout(r, dt));
    const pasted = await toPasted(src, input.prod);
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

const activate: Activate = (config_in) => {
  const { git, tok, wiki_config } = config_in;
  const prod = isProduction(process);
  const opts = { git, prod, wiki_config };
  const clean_opts = { ...opts, encrypted: "" };
  const cleanup = () => updateWiki(clean_opts);
  return new Promise((resolve, reject) => {
    awaitPasted(opts).then(async (pasted) => {
      const { priv, pub } =  await toKeyPair();
      const master_key = await derive(priv, pasted.pub);
      const outputs = await configureDevice(config_in);
      console.log('Device Configured');
      const { user_code } = outputs;
      const encrypted = await encryptPublic({
        pub, master_key, label: "code",
        plain_text: user_code 
      });
      // Create activation link
      await updateWiki({ ...opts, encrypted });
      console.log("Posted code to wiki");
      // Wait for user to visit link
      askUser(outputs).then((verdict) => {
        const token_in = { ...verdict, pub, master_key };
        handleToken(token_in).then(async (token_out) => {
          const { encrypted, secret } = token_out;
          try {
            await addSecret({ git, secret, name: tok });
            await updateWiki({ ...opts, encrypted });
            console.log('Posted token to wiki\n');
            resolve(cleanup);
          }
          catch (e: any) {
            console.error('Unable to update wiki.');
            reject(e);
          }
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
