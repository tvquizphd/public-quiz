const _sodium = require('libsodium-wrappers');
const { graphql } = require("@octokit/graphql");
const { encryptSecrets } = require("./encrypt.js");
const { toB64urlQuery } = require("./b64url.js");
const { toB64urlText } = require("./b64url.js");
const { toPepper } = require("./opaque.js");
const { Octokit } = require("octokit");

class PollingFails extends Error {
  constructor(error) {
    const message = error.error_description;
    super(message);
    this.name = "PollingFails";
  }
}

const needKeys = (obj, keys) => {
  const obj_keys = Object.keys(obj).join(' ');
  for (key of keys) {
    if (!(key in obj)) {
      throw new Error(`${key} not in [${obj_keys}]`);
    }
  }
}

const getConfigurable = (inputs) => {
  const { client_id } = inputs;
	const scope = [
		'public_repo', 'project'
	].join(' ');
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

const scaleInterval = (interval) => {
  const scale = 1000 + 100;
  return scale * interval;
}

const printSeconds = (secs) => {
  const dt = scaleInterval(secs);
  const date = new Date(dt);
  const iso = date.toISOString();
  const mm_ss = iso.substring(14, 19);
  const m = parseInt(mm_ss.slice(0, 2));
  const s = parseInt(mm_ss.slice(3));
  return `PT${m}M${s}S`
}

const askUserOnce = (inputs, timestamp) => {
  const step0 = getAskable(inputs);
  const { askable, headers } = step0;
  const step1 = { headers, method: 'POST' };
  const dt = scaleInterval(inputs.interval);
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

const addLoginProject = async (inputs, git) => {
  const octokit = new Octokit({
    auth: inputs.MY_TOKEN
  })
  const octograph = graphql.defaults({
    headers: {
      authorization: `token ${inputs.MY_TOKEN}`,
    },
  });
  const e_token_txt = inputs.ENCRYPTED_TOKEN;
  const e_token_obj = JSON.parse(e_token_txt);
  const e_token_query = toB64urlQuery(e_token_obj);
  const client_root = "https://www.tvquizphd.com/login";
  const client_login = `${client_root}${e_token_query}`;
  const api_url = `/repos/${git.owner}/${git.repo}/issues`;
  await octokit.request(`POST ${api_url}`, {
    owner: git.owner, 
    repo: git.repo,
    title: 'Password Manager Login',
    body: `[Login here](${client_login})`,
    milestone: null,
    assignees: [],
    labels: []
  })
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

const addLoginSecret = async (inputs, git) => {
  const octokit = new Octokit({
    auth: inputs.MY_TOKEN
  })
  const env = 'secret-tv-access';
  const get_api = `/repos/${git.owner}/${git.repo}`;
  const get_r = await octokit.request(`GET ${get_api}`, git);
  const { id } = get_r.data;
  const pepper = inputs.OPAQUE_PEPPER;
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
  const git = {
    owner: "tvquizphd",
    repo: "secret-tv-device"
  }
  const to_public = "on GitHub Public Repo";
  return new Promise((resolve, reject) => {
    addLoginProject(inputs, git).then(() => {
      const repo = "public-quiz-device";
      console.log("Added Login Project");
      addLoginSecret(inputs, {...git, repo}).then(() => {
        console.log(`Added PEPPER Secret ${to_public}`);
        const git_str = `${git.owner}?tab=projects`;
        const end_url = `https://github.com/${git_str}`;
        resolve(`\n${end_url}\n`);
      }).catch((e) => {
        console.error(`Unable to add PEPPER Secret ${to_public}`);
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
  const gtxt = toB64urlText(encrypted); 
  console.log('Encrypted GitHub access token');
  const to_verify = {
    password: inputs.password,
    user: 'root'
  }
  const pepper = await toPepper(to_verify);
  const ptxt = toB64urlText(pepper);
  console.log('Encrypted verifier');
  return {
    TOKEN: inputs.access_token,
    MY_TOKEN: inputs.my_token,
    ENCRYPTED_TOKEN: gtxt,
    OPAQUE_PEPPER: ptxt
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
  const { master_pass, my_token } = config_in;
  const client_root = "https://www.tvquizphd.com/activate";
  configureDevice(config_in).then(async (outputs) => {
    console.log('Device Configured');
    const { user_code } = outputs;
    const e_code = await encryptSecrets({
      password: master_pass,
      secret_text: user_code 
    })
    const e_code_query = toB64urlQuery(e_code);
    console.log(`\n${client_root}${e_code_query}\n`);
    askUser(outputs).then((verdict) => {
      const token_in = {
        ...verdict,
        my_token: my_token,
        password: master_pass
      }
      handleToken(token_in).then((to_update) => {
        updateRepos(to_update).then((done) => {
          console.log(done);
        }).catch((error) => {
          console.error('Unable to update private repo.');
          console.error(error.message)
        })
      }).catch((error) => {
        console.error('Error issuing token or verifier.');
        console.error(error.message)
      });
    }).catch((error) => {
      console.error('Not Authorized by User');
      console.error(error.message)
    });
  }).catch((error) => {
    console.error('Device is Not Configured');
    console.error(error.message)
  });
}
main();
