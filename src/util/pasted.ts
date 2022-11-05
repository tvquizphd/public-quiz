import { fromB64urlQuery } from "project-sock";
import { simpleGit } from 'simple-git';
import path from 'node:path';
import fs from 'fs'

import type { TreeAny, NodeAny } from "project-sock"
import type { Secrets } from "./encrypt.js";
import type { Git } from "./types.js";

export type HasGit = { git: Git }
export type WikiConfig = {
  home: string,
  tmp: string
}
export type UserIn = HasGit & {
  delay: number,
  prod: boolean,
  wiki_config: WikiConfig
}
type ItemInC = {
  "body": Uint8Array,
  "mac_tag": Uint8Array
}
type ServerAuthData = {
  As: Uint8Array,
  Xs: Uint8Array,
  beta: Uint8Array,
  c: Record<"pu" | "Pu" | "Ps", ItemInC>
}
export type UserInstall = {
  C: Secrets 
}
export type UserApp = UserInstall & {
  S: ServerAuthData
}
export type Pasted = UserInstall & {
  S?: ServerAuthData
}
interface ReadUserInstall {
  (u: UserIn): Promise<UserInstall>;
}
interface ReadUserApp {
  (u: UserIn): Promise<UserApp>;
}
interface ToPasted {
  (s: string) : Promise<TreeAny>
}
type GitOutput = {
  repo_url: string,
  tmp_dir: string,
  tmp_file: string
}
interface DoGit {
  (i: UserIn): Promise<void> 
}
interface UseGit {
  (i: UserIn): GitOutput
}

export function isTree(u: NodeAny): u is TreeAny {
  return u != null && typeof u === "object";
}

function hasCode(o: TreeAny): o is Pasted {
  if (!isTree(o.C)) {
    return false;
  }
  const { salt, key, data } = o.C;
  if (!isTree(key) || !isTree(data)) {
    return false;
  }
  const needs = [
    data.iv, data.tag, data.ev,
    salt, key.iv, key.tag, key.ev
  ];
  return needs.every(v => v instanceof Uint8Array);
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

const toPasted: ToPasted = async (src) => {
  const encoding = 'utf-8';
  const txt = fs.readFileSync(src, { encoding });
  const text = txt.replaceAll('\n', '');
  return fromB64urlQuery(text);
}

function isForApp(o: Pasted): o is UserApp {
  const d = o?.S;
  if (!d || !isTree(d)) {
    return false;
  }
  if (!isTree(d.c)) {
    return false;
  }
  if (![d.c.pu, d.c.Pu, d.c.Ps].every(isTree)) {
    return false;
  }
  const needs = [
    d.beta, d.Xs, d.As,
    d.c.pu.body, d.c.Pu.body, d.c.Ps.body,
    d.c.pu.mac_tag, d.c.Pu.mac_tag, d.c.Ps.mac_tag
  ];
  return needs.every(v => v instanceof Uint8Array);
}

function isForInstall(o: Pasted): o is UserInstall {
  return Object.keys(o).length === 1;
}

async function awaitPasted(ins: UserIn, step: 0): Promise<UserApp>;
async function awaitPasted(ins: UserIn, step: 1): Promise<UserInstall>;
async function awaitPasted(ins: UserIn, step: 0 | 1): Promise<Pasted> {
  let tries = 0;
  const min15 = 60 * 15;
  const dt = ins.delay * 1000;
  const max_tries = min15 / ins.delay;
  const { tmp_file: src } = useGit(ins);
  if (ins.prod) {
    await cloneGit(ins);
  }
  while (tries < Math.ceil(max_tries)) {
    await new Promise(r => setTimeout(r, dt));
    const pasted = await toPasted(src);
    if (hasCode(pasted)) {
      const fn = [isForApp, isForInstall][step];
      if (fn(pasted)) return pasted;
    }
    if (ins.prod) {
      await pullGit(ins);
    }
    tries += 1;
  }
  throw new Error("Timeout waiting for wiki");
}

const readUserApp: ReadUserApp = async (user_in) => {
  return await awaitPasted(user_in, 0); 
}

const readUserInstall: ReadUserInstall = async (user_in) => {
  return await awaitPasted(user_in, 1); 
}

export { readUserApp, readUserInstall }
