const _sodium = require('libsodium-wrappers');
const { needKeys } = require("./util/keys");
const { toProject } = require("project-sock");
const { printSeconds } = require("./util/time");
const { encryptSecrets } = require("./encrypt");
const { toB64urlQuery } = require("./b64url");
const { Octokit } = require("octokit");

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
  const { git } = inputs;
  const inputs_1 = ({
    owner: git.owner,
    title: inputs.title,
    token: inputs.MY_TOKEN
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
  const { git } = inputs;
  const inputs_1 = ({
    owner: git.owner,
    title: inputs.title,
    token: inputs.MY_TOKEN
  })
  const project = await toProject(inputs_1);
  const e_token_query = inputs.ENCRYPTED_TOKEN;
  const client_root = ROOT + "/login";
  const client_login = client_root + e_token_query;
  const body = `# [Log in](${client_login})`;
  const title = 'Password Manager Login';
  await project.clear();
	await project.addItem(title, body);
  return project;
}

const sodiumize = async (o, id, env, value) => {
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

const addLoginSecret = async (inputs) => {
  const { git } = inputs;
  const octokit = new Octokit({
    auth: inputs.MY_TOKEN
  })
  const env = 'secret-tv-access';
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await octokit.request(`GET ${get_api}`, git);
  const { id } = get_r.data;
  const pepper = "TODO PEPPER SECRET TODO"; //TODO
  const e_pepper = await sodiumize(octokit, id, env, pepper);
  const api_root = `/repositories/${id}/environments/${env}`;
  const api_url = `${api_root}/secrets/PEPPER`;
  await octokit.request(`PUT ${api_url}`, {
    repository_id: id,
    environment_name: env,
    secret_name: 'PEPPER',
    key_id: e_pepper.key_id,
    encrypted_value: e_pepper.ev,
  })
}

const updateRepos = (inputs) => {
  const title = "Login";
  const to_public = "on GitHub Public Repo";
  return new Promise((resolve, reject) => {
    const login_inputs = { ...inputs, title};
    addLoginProject(login_inputs).then((proj) => {
      console.log("Added Login Project");
      addLoginSecret(inputs).then(() => {
        console.log(`Added PEPPER Secret ${to_public}`);
        const info = `Log in with '${title}' project:`
        const end_url = toProjectUrl(inputs.git, proj);
        proj.finish();
        resolve(`${info}\n${end_url}\n`);
      }).catch((e) => {
        console.error(`Unable to add PEPPER Secret ${to_public}`);
        proj.finish();
        reject(e.message);
      });
    }).catch((e) => {
      console.error("Unable to add Login Project");
      reject(e.message);
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
  const gtxt = toB64urlQuery(encrypted); 
  console.log('Encrypted GitHub access token');
  return {
    TOKEN: inputs.access_token,
    MY_TOKEN: inputs.my_token,
    ENCRYPTED_TOKEN: gtxt,
  };
}

const main = () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing 1st arg: MY_TOKEN');
    return;
  }
  if (args.length < 2) {
    console.error('Missing 2st arg: CLIENT_ID');
    return;
  }
  if (args.length < 3) {
    console.error('Missing 3rd arg: MASTER_PASS');
    return;
  }
  const config_in = {
    my_token: args[0],
    client_id: args[1],
    master_pass: args[2]
  };
  const git = {
    owner: "tvquizphd",
    repo: "public-quiz-device"
  }
  const { master_pass, my_token } = config_in;
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
      MY_TOKEN: my_token,
      title: code_title,
      git
    });
    const proj_url = toProjectUrl(git, code_proj);
    const info = `Open '${code_title}' project:`;
    console.log(`${info}\n${proj_url}\n`);
    // Wait for user to visit link
    askUser(outputs).then((verdict) => {
      const token_in = {
        ...verdict,
        my_token: my_token,
        password: master_pass
      }
      handleToken(token_in).then((token_out) => {
        const to_update = { ...token_out, git };
        updateRepos(to_update).then(async (done) => {
          code_proj.finish();
          console.log(done);
        }).catch((error) => {
          console.error('Unable to update private repo.');
          console.error(error.message)
          code_proj.finish();
        })
      }).catch((error) => {
        console.error('Error issuing token or verifier.');
        console.error(error.message)
        code_proj.finish();
      });
    }).catch((error) => {
      console.error('Not Authorized by User');
      console.error(error.message)
      code_proj.finish();
    });
  }).catch((error) => {
    console.error('Device is Not Configured');
    console.error(error.message)
  });
}
main();
