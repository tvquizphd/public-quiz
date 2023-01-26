import { OPS, OP } from "opaque-low-io";
import { toPastedText } from "wiki";
import { toSockClient } from "sock-secret";
import { toNameTree, fromNameTree } from "wiki";
import { fromB64urlQuery } from "sock-secret";
import { toB64urlQuery } from "sock-secret";

const toSender = ({ local, send, workflow }) => {
  if (!send) {
    if (local) console.error('Missing local sender?');
    return null;
  }
  return (kv) => {
    const { name: command, secret } = kv;
    const tree = fromB64urlQuery(secret);
    send(fromNameTree({ command, tree }), workflow);
  }
}

const toOpaqueSeeker = ({ local, host, git, delay }) => {
  const dt = delay * 1000;
  return async () => {
    await new Promise(r => setTimeout(r, dt));
    const text = await toPastedText({ local, host, git });
    const nt = toNameTree(text);
    return nt.tree;
  }
}

async function toOpaqueSock(inputs, send, workflow) {
  const { git, local, env, delay, host } = inputs;
  const sender = toSender({ local, send, workflow });
  const seeker = toOpaqueSeeker({ local, host, git, delay });
  const sock_in = { git, env, seeker, sender };
  const Sock = await toSockClient(sock_in);
  if (Sock === null) {
    throw new Error('Unable to make socket.');
  }
  const Opaque = await OP(Sock);
  return { Opaque, Sock };
}

const toCommandTreeList = (text) => {
  const list = text.split('/');
  return list.map(line => {
    return toNameTree(line);
  });
}

const toMailLine = async (ctree, key_in) => {
  const { command, tree } = ctree;
  const { from_session } = key_in;
  if (!command) {
    return ['error', {}];
  }
  try {
    const mail_text = toB64urlQuery(tree);
    const s_str = await from_session(mail_text);
    return [ command, tree ];
  }
  catch {
    const e_name = `error_${command}`;
    if (command.slice(0, 2) !== "op") {
      console.error({[e_name]: tree}); //TODO
    }
    return [ e_name, tree ];
  }
}

const toMailSeeker = ({ local, host, git, delay, key_in }) => {
  const dt = delay * 1000;
  return async () => {
    await new Promise(r => setTimeout(r, dt));
    const text = await toPastedText({ local, host, git });
    const ctrees = toCommandTreeList(text);
    return await ctrees.reduce(async (memo, ctree) => {
      const [ k, v ] = await toMailLine(ctree, key_in);
      const o = await memo;
      o[k] = v;
      return o;
    }, {});
  }
}

async function toMailSock(inputs) {
  const { key_in, send, user_in } = inputs;
  const { git, local, env, delay, host } = user_in;
  const seeker = toMailSeeker({ local, host, git, delay, key_in });
  const sender = toSender({ local, send, workflow: "noop" });
  const sock_in = { git, env, seeker, sender };
  const Sock = await toSockClient(sock_in);
  if (Sock === null) {
    throw new Error('Unable to make socket.');
  }
  return { Sock };
}

const toSyncOp = async () => {
  return await OPS();
}

async function clientRegister(inputs) {
  const { user_in, user_id, pass, times } = inputs;
  const c_first = { password: pass, user_id };
  const { Sock, Opaque } = await toOpaqueSock(user_in, inputs.send, "call-login-open");
  const reg_out = await Opaque.clientStep(c_first, times, "op");
  Sock.quit();
  return reg_out;
}

async function clientVerify(inputs) {
  const { user_in, reg_out, times } = inputs;
  const { Sock, Opaque } = await toOpaqueSock(user_in, inputs.send, "call-login-close");
  const c_out = await Opaque.clientStep(reg_out, times, "op");
  Sock.quit();
  return c_out.token;
}

async function clientLogin(inputs) {
  const { user_in, send, times } = inputs;
  const reg_out = await clientRegister(inputs);
  const ver_in = { user_in, send, reg_out, times };
  const token = await clientVerify(ver_in);
  return token;
}

const writeText = async (f, text) => {
  const w = await f.createWritable();
  await w.write(text);
  await w.close();
}

const writeFile = async (inputs) => {
  const opts = { create: true };
  const { root, fname, text } = inputs;
  const f = await root.getFileHandle(fname, opts);
  await writeText(f, text);
  return f;
}

export { clientLogin, toSyncOp, toMailSock, writeText, writeFile };
