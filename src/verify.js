const { 
  toProjectSock, toB64urlQuery, fromB64urlQuery
} = require("project-sock");
const { addSecret } = require("./util/secrets");
const { needKeys } = require("./util/keys");
const OP = require('@nthparty/opaque');

const toPepper = async (inputs) => {
  const { git, times, v } = inputs;
  const { Opaque, Sock } = inputs;
  const secret_name = "ROOT_PEPPER";
  const secret_str = process.env[secret_name];
  const pepper = fromB64urlQuery(secret_str);
  const peps = "ks ps Ps Pu c".split(" ");
  try {
    needKeys(pepper, peps);
  }
  catch {
    const reg = await Opaque.serverRegister(times, v);
    const secret = toB64urlQuery(reg.pepper);
    addSecret({git, secret, secret_name}).then(() => {
      console.log('Saved pepper to secrets.');
    }).catch((e) => {
      console.error('Can\'t save pepper to secrets.');
      console.error(e.message);
    })
    return { pepper: reg.pepper };
  }
  console.log('Loaded pepper from secrets.');
  Sock.give('registered', true);
  return { pepper };
}

const verify = (config_in) => {
  const { git } = config_in;
  const user = "root";
  const times = 1000;
  const v = "v";
  const inputs = {
    scope: v,
    title: "verify",
    owner: git.owner,
    token: git.owner_token
  };
  return new Promise(async (resolve) => {
    const Sock = await toProjectSock(inputs);
    const Opaque = await OP(Sock);
    const pepper_inputs = {
      git, times, v, Opaque, Sock
    };
  	const { pepper } = await toPepper(pepper_inputs);
    Opaque.serverAuthenticate(user, pepper, v).then((token) => {
      Sock.sock.project?.finish().then(() => {
        resolve('Verified');
      });
    });
    console.log('Waiting');
  });
}

exports.verify = verify;
