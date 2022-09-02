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
  const keys = { client_id, scope: 'repo' }
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

const handleToken = async () => {
  const {scope, token_type} = verdict;
  if (scope != 'repo') {
    throw new Error(`Need repo scope, not '${scope}'`);
  }
  if (token_type != 'bearer') {
    throw new Error(`Need bearer token, not '${token_type}'`);
  }
  const { access_token } = verdict;
  console.log('Authorized by User');
  return 'ok'
}

const main = () => {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Missing first argument: CLIENT_ID');
    return;
  }
  const inputs = {
    client_id: args[0]
  };
  configureDevice(inputs).then((outputs) => {
    const { device_code, user_code } = outputs;
    console.log('Device Configured');
    askUser(outputs).then((verdict) => {
      handleToken(verdict).then((winner) => {
        console.log(winner);
      }).catch((error) => {
        console.error('Incorrect scope or token type.');
        console.error(error.message)
      });
    }).catch((error) => {
      console.error('Not Authorized by User');
      console.error(error.message)
    });
  }).catch((error) => {
    console.error('Device Not Configured');
    console.error(error.message)
  });
}
main();
