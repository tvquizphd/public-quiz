import { simpleGit } from 'simple-git';
import { needKeys } from "./util/keys.js";
import { printSeconds } from "./util/time.js";
import { addSecret } from "./util/secrets.js";
import { fromB64urlQuery, toB64urlQuery } from "project-sock";
import { encryptQueryMaster } from "./util/encrypt.js";
import { isBytes } from "./util/decrypt.js";
import * as eccrypto from "eccrypto";
import { Octokit } from "octokit";
import path from 'node:path';
import fs from 'fs'

import type { Git } from "./util/types.js";
import type { Encrypted } from "./util/encrypt.js";

type HasData = {
  data: Encrypted
}
type HasClient = {
  client_id: string
}
type HasGit = {
  git: Git
}
type BasicInputs = HasClient & HasGit; 
type CoreInputs = HasGit & {
  wiki_config: WikiConfig,
  prod: boolean,
  delay: number
}
type AskInputs = HasClient & {
  interval: number,
  device_code: string
}
type MainCodeInputs = BasicInputs & CoreInputs;
type MainTokenInputs = BasicInputs & {
  code_outputs: CodeOutputs,
  env: string,
  tok: string,
};
type WikiConfig = {
  home: string,
  tmp: string
}
type HasInterval = {
  interval: number
}
type HasDevice = {
  device_code: string
}
type Configuration = HasInterval & HasDevice & {
  user_code: string,
}
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
  (i: HasClient): Promise<Configuration>;
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
type CodeOutputs = HasDevice & HasPubMaster;
type TokenInputs = AuthSuccess & CodeOutputs;
type TokenOutputs = {
  encrypted: string,
  secret: string
}
type ToEncryptPublic = HasPubMaster & {
  plain_text: string,
  label: string
} 
type Obj = Record<string, any>;
export type SecretInputs = Git | CodeOutputs;
type GitInputs = HasGit & {
  secret: string  
}
export type SecretOutputs = {
  for_pages: string,
  for_next: string,
}
interface ToPasted {
  (s: string) : Promise<Partial<Pasted>>
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
interface DoGit {
  (i: CoreInputs): Promise<void> 
}
interface ActivateCode {
  (i: MainCodeInputs): Promise<SecretOutputs>
}
interface ActivateToken {
  (i: MainTokenInputs): Promise<SecretOutputs>
}
interface GitEncrypt {
  (i: GitInputs): Promise<string>
}
interface GitDecrypt {
  (i: GitInputs): Promise<SecretInputs>
}
type Activation = [
  ActivateCode, ActivateToken 
];

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
  const { owner, repo } = git;
  const { tmp, home } = wiki_config;
  const login = `git@github.com`;
  const wiki = `${repo}.wiki`;
  const repo_url = `https://${login}/${owner}/${wiki}.git`;
  const tmp_dir = path.relative(process.cwd(), tmp);
  const tmp_file = path.join(tmp_dir, wiki, home);
  return { repo_url, tmp_dir, tmp_file };
}

const cloneGit: DoGit = async (input) => {
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

const pullGit: DoGit = async (input) => {
  const { tmp_file, tmp_dir } = useGit(input);
  const wiki_dir = path.dirname(tmp_file);
  const git_opts = {
    binary: 'git',
    baseDir: tmp_dir
  }
  const github = simpleGit(git_opts);
  await github.cwd(wiki_dir);
  await github.pull();
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

function isGit(a: SecretInputs): a is Git {
  const keys = 'repo owner owner_token';
  const g = a as Git;
  try {
    needKeys(g, keys.split(' '));
  }
  catch (e: any) {
    return false;
  }
  return true;
}

function isCodeOutputs(a: SecretInputs): a is CodeOutputs {
  const g = a as CodeOutputs;
  if (isBytes(g.pub) && isBytes(g.master_key)) {
    return typeof g.device_code == "string";
  }
  return false
}

function isSecretInputs(a: Obj): a is SecretInputs {
  const g = a as SecretInputs;
  return isCodeOutputs(g) || isGit(g);
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
  const { configurable, headers } = getConfigurable(inputs);
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

const askUserOnce: AskUserOnce = async (inputs, timestamp) => {
  const { interval } = inputs;
  const dt = 1000 * interval + 100;
  const { askable, headers } = getAskable(inputs);
  await new Promise(r => setTimeout(r, dt));
  const step1 = { headers, method: 'POST' };
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
      return { interval };
    }
    return { interval };
  }
  else {
    return result;
  }
}

const askUser: AskUser = async (inputs) => {
  let total_time = 0;
  console.log(`Polling interval ${inputs.interval}+ s`);
  let result: AskOutputs = { interval: inputs.interval };
  while (!isAuthSuccess(result)) {
    total_time += inputs.interval;
    if (inputs.interval != result.interval) {
      inputs.interval = result.interval;
      console.log(`Polling interval now ${inputs.interval}+ s`);
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

const toPasted: ToPasted = async (src) => {
  const encoding = 'utf-8';
  const txt = fs.readFileSync(src, { encoding });
  const text = txt.replaceAll('\n', '');
  return fromB64urlQuery(text) as Partial<Pasted>;
}

const awaitPasted: AwaitPasted = async (input) => {
  let tries = 0;
  const dt = input.delay * 1000;
  const max_tries = 15*60/input.delay;
  const { tmp_file: src } = useGit(input);
  if (input.prod) {
    await cloneGit(input);
  }
  while (tries < Math.ceil(max_tries)) {
    await new Promise(r => setTimeout(r, dt));
    const pasted = await toPasted(src);
    if (isPasted(pasted)) {
      return pasted;
    }
    if (input.prod) {
      await pullGit(input);
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
  const { git } = core_in;
  let enp: ToEncryptPublic; 
  let secret: string;
  const outputs = {
    for_pages: "",
    for_next: "",
  };
  try {
    const pasted = await awaitPasted(core_in); 
    const { priv, pub } =  await toKeyPair();
    const config = await configureDevice({ client_id });
    const master_key = await derive(priv, pasted.pub);
    const device_code = config.device_code;
    const plain_text = config.user_code;
    secret = toB64urlQuery({ pub, master_key, device_code });
    enp = {
      master_key, pub, plain_text, label: "code"
    }
  }
  catch (e: any) {
    console.error('Unable to read public key.');
    throw e;
  }
  try {
    const encrypted = await encryptPublic(enp);
    console.log("Encrypted code.\n");
    outputs.for_pages = encrypted;
  }
  catch (e: any) {
    console.error('Error using public key.');
    throw e;
  }
  try {
    const encrypted = await gitEncrypt({ git, secret });
    console.log("Encrypted secret output.\n");
    outputs.for_next = encrypted;
  }
  catch (e: any) {
    console.error('Error encrypting secret.');
    throw e;
  }
  return outputs;
}

const gitEncrypt: GitEncrypt = async (inputs) => { //TODO remove
  return inputs.secret;
}

const gitDecrypt: GitDecrypt = async (inputs) => { //TODO rename
  const plain_text = inputs.secret.replaceAll('\n', '');
  const decoded = fromB64urlQuery(plain_text);
  if (isSecretInputs(decoded)) {
    return decoded;
  }
  throw new Error('Poorly formated secret input.');
}

const activateToken: ActivateToken = async (inputs) => {
  const { tok, code_outputs, client_id } = inputs;
  let token_in: TokenInputs;
  let token_out: TokenOutputs;
  const { device_code } = code_outputs;
  const ask = { client_id, device_code, interval: 5 };
  const outputs = {
    for_pages: "",
    for_next: "",
  }
  try {
    const verdict = await askUser(ask);
    token_in = { ...verdict, ...code_outputs };
  }
  catch (e: any) {
    console.error('Not authorized by the user.');
    throw e;
  }
  try {
    token_out = await handleToken(token_in);
  }
  catch (e: any) {
    console.error('Error issuing token.');
    throw e;
  }
  const user_git = { 
    ...inputs.git,
    owner_token: token_out.secret
  };
  const add_inputs = { 
    name: tok,
    git: user_git,
    env: inputs.env,
    secret: token_out.secret
  };
  try {
    const octokit = new Octokit({
      auth: user_git.owner_token
    });
    const api_url = [
      "/repos", user_git.owner, user_git.repo,
      "environments", inputs.env
    ].join("/")
    await octokit.request(`PUT ${api_url}`);
  }
  catch (e: any) {
    console.error('Unable to make environment.');
    throw e;
  }
  try {
    await addSecret(add_inputs);
    console.log("Encrypted user token.\n");
    outputs.for_pages = token_out.encrypted;
  }
  catch (e: any) {
    console.error('Unable to add secret.');
    throw e;
  }
  try {
    const { git } = inputs;
    const secret = toB64urlQuery(user_git);
    const encrypted = await gitEncrypt({ git, secret });
    console.log("Encrypted secret git token.\n");
    outputs.for_next = encrypted;
  }
  catch (e: any) {
    console.error('Error encrypting secret git token.');
    throw e;
  }
  return outputs;
}

const activation: Activation = [
  activateCode,
  activateToken,
];

export {
  isGit,
  gitDecrypt,
  activation,
}
