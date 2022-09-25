import { needKeys } from "./util/keys";
import { printSeconds } from "./util/time";
import { Project, toProject, toB64urlQuery } from "project-sock";
import { encryptSecrets } from "./util/encrypt";
import { deleteSecret } from "./util/secrets";

import type { Git } from "./util/types";
import type { Secrets } from "./util/encrypt";

interface ToProjectUrl {
  (o: { owner: string }, n: { number: number }): string
}

type ConfigureInputs = {
  git: Git,
  delay: number,
  client_id: string,
  master_pass: string
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
type CodeInputs = { 
  ENCRYPTED_CODE: Secrets,
  title: string,
  delay: number,
  git: Git
}
type TokenInputs = AuthSuccess & {
  password: string
}
type TokenQuery = {
  e_token_query: string
}
type GitTokenInput = TokenQuery & {
  git: Git
}
type GitLoginInputs = GitTokenInput & {
  title: string
}
interface HandleToken {
  (i: TokenInputs): Promise<TokenQuery>
}
const ROOT = "https://pass.tvquizphd.com";

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
  const scope = [
    'public_repo', 'project'
  ].join(',');
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
  while (true) {
    total_time += interval;
    const timestamp = printSeconds(total_time);
    const result = await askUserOnce(inputs, timestamp);
    if (isAuthSuccess(result)) {
      return result;
    }
    if (interval != result.interval) {
      console.log(`Polling interval now ${interval}+ s`);
    }
    interval = result.interval;
  }
}

const toProjectUrl: ToProjectUrl = ({ owner }, { number }) => {
  const git_str = `${owner}/projects/${number}`;
  return `https://github.com/users/${git_str}`;
}

const addCodeProject = async (inputs: CodeInputs): Promise<Project> => {
  const { git, delay } = inputs;
  const inputs_1 = ({
    delay: delay,
    owner: git.owner,
    title: inputs.title,
    token: git.owner_token
  })
  const e_code = inputs.ENCRYPTED_CODE;
  const project = await toProject(inputs_1);
  if (!project) {
    throw new Error("Unable to find Activation Project");
  }
  const e_code_query = toB64urlQuery(e_code);
  const client_root = ROOT + "/activate";
  const client_activate = client_root + e_code_query;
  const body = `# [Get 2FA Code](${client_activate})`;
  const title = 'Activate with GitHub Code';
  await project.clear();
	await project.addItem(title, body);
  return project;
}

const addLoginProject = async (inputs: GitLoginInputs) => {
  const { e_token_query, git } = inputs;
  const inputs_1 = ({
    owner: git.owner,
    title: inputs.title,
    token: git.owner_token
  })
  const project = await toProject(inputs_1);
  if (!project) {
    throw new Error("Unable to find Login Project");
  }
  const client_root = ROOT + "/login";
  const client_login = client_root + e_token_query;
  const body = `# [Log in](${client_login})`;
  const title = 'Password Manager Login';
  await project.clear();
	await project.addItem(title, body);
  return project;
}

const deleteMasterPass = (inputs: GitTokenInput) => {
  const secret_name = 'MASTER_PASS';
  return deleteSecret({...inputs, secret_name})
}

const updateRepos = (inputs: GitTokenInput) => {
  const title = "Login";
  const to_public = "on GitHub Public Repo";
  return new Promise((resolve, reject) => {
    const login_inputs = { ...inputs, title};
    addLoginProject(login_inputs).then(async (proj) => {
      console.log("Added Login Project");
      const info = `Log in with '${title}' project:`
      const login_url = toProjectUrl(inputs.git, proj);
      console.log(`${info}\n${login_url}\n`);
      await proj.finish();
      resolve(null);
    }).catch((e) => {
      console.error("Unable to add Login Project");
      reject(e);
    });
  });
}

const handleToken: HandleToken = async (inputs) => {
  const {scope, token_type} = inputs;
  const scope_set = new Set(scope.split(','));
  const scope_needs = ['public_repo', 'project'];
  if (!scope_needs.every(x => scope_set.has(x))) {
    throw new Error(`Need project scope, not '${scope}'`);
  }
  if (token_type != 'bearer') {
    throw new Error(`Need bearer token, not '${token_type}'`);
  }
  console.log('Authorized by User');
  const to_encrypt = {
    password: inputs.password,
    secret_text: inputs.access_token
  }
  const encrypted = await encryptSecrets(to_encrypt);
  const e_token_query = toB64urlQuery(encrypted); 
  console.log('Encrypted GitHub access token');
  return {
    e_token_query,
  };
}

const activate = (config_in: ConfigureInputs) => {
  const { git, delay } = config_in;
  const { master_pass } = config_in;
  return new Promise((resolve, reject) => {
    configureDevice(config_in).then(async (outputs: AskInputs) => {
      console.log('Device Configured');
      const { user_code } = outputs;
      const e_code = await encryptSecrets({
        password: master_pass,
        secret_text: user_code 
      })
      // Create activation link
      const code_title = "Activate";
      const code_proj = await addCodeProject({ 
        ENCRYPTED_CODE: e_code,
        title: code_title,
        delay,
        git
      });
      const proj_url = toProjectUrl(git, code_proj);
      const info = `Open '${code_title}' project:`;
      console.log(`${info}\n${proj_url}\n`);
      // Wait for user to visit link
      askUser(outputs).then((verdict) => {
        const token_in = {
          ...verdict,
          password: master_pass
        }
        handleToken(token_in).then((token_out) => {
          const git_input = { ...token_out, git };
          updateRepos(git_input).then(async () => {
            await code_proj.finish();
            deleteMasterPass(git_input).then(async () => {
              await code_proj.finish();
              console.error('Deleted master password.');
              resolve('Activated User!');
            }).catch(async (error) => {
              // TODO -- confirm Master Password already deleted?
              await code_proj.finish();
              resolve('Activated User!');
            })
          }).catch(async (error) => {
            console.error('Unable to update private repo.');
            await code_proj.finish();
            reject(error);
          })
        }).catch(async (error) => {
          console.error('Error issuing token or verifier.');
          await code_proj.finish();
          reject(error);
        });
      }).catch(async (e: any) => {
      console.error('Not Authorized by User');
        await code_proj.finish();
        reject(e);
      });
    }).catch((e: any) => {
      console.error('Device is Not Configured');
      reject(e);
    });
  });
}

export {
  activate
}
