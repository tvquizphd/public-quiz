import { simpleGit } from 'simple-git';
import { needKeys } from "./util/keys";
import { printSeconds } from "./util/time";
import { addSecret } from "./util/secrets";
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
type HasClient = {
  client_id: string
}
type BasicInputs = {
  wiki_config: WikiConfig,
  git: Git
}
type CoreInputs = BasicInputs & {
  prod: boolean,
  delay: number
}
type MainInputs = CoreInputs & HasClient;
type MainTokenInputs = HasClient & {
  git: Git,
  tok: string
}
type WikiConfig = {
  home: string,
  tmp: string
}
type HasInterval = {
  interval: number
}
type AskInputs = HasInterval & HasClient & {
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
  (i: HasClient): Promise<string>;
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
type UpdateStepInput = {
  encrypted: string
}
interface ToPagesSite {
  (i: CoreInputs) : Promise<string>
}
interface ToPasted {
  (s: string, p: boolean) : Promise<Partial<Pasted>>
}
interface AwaitPasted {
  (i: CoreInputs) : Promise<Pasted>
}
interface HandleToken {
  (i: TokenInputs): Promise<TokenOutputs>
}
interface EncryptPublic {
  (i: ToEncryptPublic): Promise<string>
}
interface UseGit {
  (i: CoreInputs): GitOutput
}
interface CloneGit {
  (i: CoreInputs): Promise<void> 
}
interface ActivateCode {
  (i: MainInputs): Promise<boolean>
}
interface ActivateToken {
  (i: MainTokenInputs): Promise<boolean>
}
interface Cleanup {
  (): Promise<boolean>
}
interface Activate {
  (t: string, i: MainInputs): Promise<Cleanup>
}
const SCOPES = [
  'repo', 'project'
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

const updateStepOutput = (input: UpdateStepInput) => {
  process.env.STEP_OUTPUT = input.encrypted;
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

const getConfigurable = (inputs: HasClient) => {
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
  return result;
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
  const { delay } = input;
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

const activateCode: ActivateCode = async (main_in) => {
  const { client_id, ...core_in} = main_in;
  const en: ToEncryptPublic = {
    master_key: new Uint8Array(),
    pub: new Uint8Array(),
    plain_text: "",
    label: "code"
  };
  try {
    const pasted = await awaitPasted(core_in); 
    const { priv, pub } =  await toKeyPair();
    en.plain_text = await configureDevice({ client_id });
    en.master_key = await derive(priv, pasted.pub);
    en.pub = pub;
  }
  catch (e: any) {
    console.error('Unable to read public key.');
    console.error(e?.message);
    return false;
  }
  try {
    const encrypted = await encryptPublic(en);
    updateStepOutput({ encrypted });
    console.log("Encrypted code.\n");
  }
  catch (e: any) {
    console.error('Error using public key.');
    console.error(e?.message);
    return false;
  }
  return true;
}

const activateToken: ActivateToken = async (inputs) => {
  const { git, tok, client_id } = inputs;
  const master_key = new Uint8Array();
  const pub = new Uint8Array();
  const ask: AskInputs = {
    device_code: "",
    user_code: "",
    interval: 1,
    client_id
  };
  const token_in: TokenInputs = {
    master_key, pub,
    access_token: "",
    token_type: "",
    scope: ""
  }; 
  try {
    const verdict = await askUser(ask);
    token_in.access_token = verdict.access_token;
    token_in.token_type = verdict.token_type;
    token_in.scope = verdict.scope;
  }
  catch (e: any) {
    console.error('Not authorized by the user.');
    console.error(e?.message);
    return false;
  }
  const token_out: TokenOutputs = {
    encrypted: "",
    secret: "" 
  }
  try {
    const result = await handleToken(token_in);
    token_out.encrypted = result.encrypted;
    token_out.secret = result.secret;
  }
  catch (e: any) {
    console.error('Error issuing token.');
    console.error(e?.message);
    return false;
  }
  const add_inputs = { 
    git: { 
      ...git,
      owner_token: token_out.secret
    },
    secret: token_out.secret,
    name: tok
  };
  try {
    //set_token(secret);
    await addSecret(add_inputs);
    updateStepOutput(token_out);
    console.log("Encrypted user token.\n");
    return true;
  }
  catch (e: any) {
    console.error('Unable to add secret.');
    console.error(e?.message);
    return false;
  }
}

const cleanup: Cleanup = () => {
  const encrypted = "";
  try {
    updateStepOutput({ encrypted });
    return Promise.resolve(true);
  }
  catch (e: any) {
    console.error(e?.message);
    return Promise.resolve(false);
  }
}

const activate: Activate = async (tok, main_in) => {
  const { git, client_id } = main_in;
  await activateCode(main_in);
  await activateToken({ tok, git, client_id });
  return cleanup;
}

const activation = [
  activateCode,
  activateToken,
  cleanup
];

export {
  activation,
  activate
}
