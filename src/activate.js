const { needKeys } = require("./util/keys");
const { 
  toProject, toB64urlQuery
} = require("project-sock");
const { printSeconds } = require("./util/time");
const { encryptSecrets } = require("./util/encrypt");
const { deleteSecret } = require("./util/secrets");

const ROOT = "https://pass.tvquizphd.com";

class PollingFails extends Error {
  constructor(error) {
    const message = error.error_description;
    super(message);
    this.name = "PollingFails";
  }
}

const getConfigurable = (inputs) => {
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

const configureDevice = async (inputs) => {
  const step0 = getConfigurable(inputs);
  const { configurable, headers } = step0;
  const step1 = { headers, method: 'POST' };
  const step2 = await fetch(configurable, step1); 
  const keys = 'interval device_code user_code';
  const result = await step2.json();
  needKeys(result, keys.split(' '));
  return {...inputs, ...result};
};

const getAskable = (inputs) => {
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

const askUserOnce = (inputs, timestamp) => {
  const step0 = getAskable(inputs);
  const { askable, headers } = step0;
  const step1 = { headers, method: 'POST' };
  const dt = 1000 * inputs.interval + 100;
  return new Promise((resolve) => {
    setTimeout(async () => { 
      const step2 = await fetch(askable, step1); 
      const result = await step2.json();
      if ('error_description' in result) {
        const good_errors = [
          'authorization_pending', 'slow_down'
        ];
        const is_ok = good_errors.includes(result.error);
        if (!is_ok) {
          throw new PollingFails(result);
        }
        const message = result.error_description;
        console.warn(`${timestamp}: ${message}`);
        if ('interval' in result) {
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

const askUser = async (inputs) => {
  let total_time = 0;
  let interval = inputs.interval;
  console.log(`Polling interval ${interval}+ s`);
  const keys = 'access_token token_type scope' 
  while (true) {
    total_time += interval;
    const params = {...inputs, interval}
    const timestamp = printSeconds(total_time);
    const result = await askUserOnce(params, timestamp);
    if ('interval' in result) {
      if (interval != result.interval) {
        console.log(`Polling interval now ${interval}+ s`);
      }
      interval = result.interval;
    }
    try {
      needKeys(result, keys.split(' '));
      return result;
    }
    catch (error) {
      continue;
    }
  }
}

const toProjectUrl = ({ owner }, { number }) => {
  const git_str = `${owner}/projects/${number}`;
  return `https://github.com/users/${git_str}`;
}

const addCodeProject = async (inputs) => {
  const { git, delay } = inputs;
  const inputs_1 = ({
    delay: delay,
    owner: git.owner,
    title: inputs.title,
    token: git.owner_token
  })
  const e_code = inputs.ENCRYPTED_CODE;
  const project = await toProject(inputs_1);
  const e_code_query = toB64urlQuery(e_code);
  const client_root = ROOT + "/activate";
  const client_activate = client_root + e_code_query;
  const body = `# [Get 2FA Code](${client_activate})`;
  const title = 'Activate with GitHub Code';
  await project.clear();
	await project.addItem(title, body);
  return project;
}

const addLoginProject = async (inputs) => {
  const { e_token_query, git } = inputs;
  const inputs_1 = ({
    owner: git.owner,
    title: inputs.title,
    token: git.owner_token
  })
  const project = await toProject(inputs_1);
  const client_root = ROOT + "/login";
  const client_login = client_root + e_token_query;
  const body = `# [Log in](${client_login})`;
  const title = 'Password Manager Login';
  await project.clear();
	await project.addItem(title, body);
  return project;
}

const deleteMasterPass = (inputs) => {
  const secret_name = 'MASTER_PASS';
  return deleteSecret({...inputs, secret_name})
}

const updateRepos = (inputs) => {
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
      resolve();
    }).catch((e) => {
      console.error("Unable to add Login Project");
      reject(e);
    });
  });
}

const handleToken = async (inputs) => {
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

const activate = (config_in) => {
  const { git, delay } = config_in;
  const { master_pass } = config_in;
  return new Promise((resolve, reject) => {
    configureDevice(config_in).then(async (outputs) => {
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
          git,
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
      }).catch(async (error) => {
        console.error('Not Authorized by User');
        await code_proj.finish();
        reject(error);
      });
    }).catch((error) => {
      console.error('Device is Not Configured');
      reject(error);
    });
  });
}

exports.activate = activate;
