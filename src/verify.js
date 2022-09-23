const { 
  toProjectSock, toB64urlQuery, fromB64urlQuery
} = require("project-sock");
const { configureNamespace } = require("./config/sock");
const { addSecret } = require("./util/secrets");
const { needKeys } = require("./util/keys");
const OP = require('@nthparty/opaque');


// TODO: package and distribute 3 fns

function findSub (inputs, sub) {
  return inputs.commands.filter((c) => {
    return c.subcommand == sub;
  }).pop();
}

function findOp (inputs, sub) {
  const command = findSub(inputs, sub);
  return inputs.sockets.find(({ text }) => {
    return text == command.prefix;
  }).suffix;
}

function opId (inputs, sub) {
  const command = findSub(inputs, sub);
  const op = findOp(inputs, sub);
  return op + command.command;
}

const toPepper = async (inputs) => {
  const { git, times } = inputs;
  const { Opaque, Sock } = inputs;
  const secret_name = "ROOT_PEPPER";
  const secret_str = process.env[secret_name];
  const pepper = fromB64urlQuery(secret_str);
  const peps = "ks ps Ps Pu c".split(" ");
  const op = findOp(inputs, "registered");
  try {
    needKeys(pepper, peps);
  }
  catch {
    await Sock.give(opId(inputs, "start"), "start", true);
    const reg = await Opaque.serverRegister(times, op);
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
  const op_id = opId(inputs, "registered");
  await Sock.give(op_id, "registered", true);
  return { pepper };
}

const clearOpaqueServer = (Sock, { commands }) => {
  const client_subs = ['sid', 'pw'];
  const toClear = commands.filter((cmd) => {
    return !client_subs.includes(cmd.subcommand);
  });
  return Sock.sock.project.clear({ commands: toClear });
}

const verify = (config_in) => {
  const { opaque } = configureNamespace();
  const { git, delay } = config_in;
  const { project } = opaque;
  const user = "root";
  const times = 1000;
  const inputs = {
    delay: delay,
    owner: git.owner,
    title: project.title,
    scope: project.prefix,
    token: git.owner_token
  };
  return new Promise(async (resolve) => {
    const Sock = await toProjectSock(inputs);
    await clearOpaqueServer(Sock, opaque);
    const Opaque = await OP(Sock);
    const pepper_inputs = {
      ...opaque,
      git, times, Opaque, Sock
    };
    // Always listen for reset signal
    Sock.get(opId(opaque, "reset"), "reset").then(() => {
      Sock.sock.project.finish().then(() => resolve(false));
    });
    // Authenticate server with opaque sequence 
  	const { pepper } = await toPepper(pepper_inputs);
    const op = findOp(opaque, "registered");
    Opaque.serverAuthenticate(user, pepper, op).then((token) => {
      Sock.sock.project.finish().then(() => resolve(true));
    });
    console.log('Waiting');
  });
}

exports.verify = verify;
