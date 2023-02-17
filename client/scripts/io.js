import { OPS, OP } from "opaque-low-io";
import { toSockClient } from "sock-secret";

const SINCE = "last-modified"

async function toOpaqueSock(opts, workflow) {
  const { preface, delay, input, output } = opts;
  if ("key" in output) {
    output.workflow = workflow;
  }
  const since = sessionStorage.getItem(SINCE);
  const sock_in = { preface, delay, input, output };
  if (since) sock_in.persist = { [SINCE]: since };
  const Sock = await toSockClient(sock_in);
  if (Sock === null) {
    throw new Error('Unable to make socket.');
  }
  const Opaque = await OP(Sock);
  return { Opaque, Sock };
}

const toSyncOp = async () => {
  return await OPS();
}

async function clientRegister(opts) {
  const { user_id, pass, times } = opts;
  const c_first = { password: pass, user_id };
  const { Sock, Opaque } = await toOpaqueSock(opts, "call-login-open");
  const reg_out = await Opaque.clientStep(c_first, times, "op");
  Sock.quit();
  return reg_out;
}

async function clientVerify(opts) {
  const { reg_out, times, register } = opts;
  const { Sock, Opaque } = await toOpaqueSock(opts, "call-login-close");
  const c_out = await Opaque.clientStep(reg_out, times, "op");
  // Await for login-close to finish by checking mail
  if ( register === true ) await Sock.get("mail", "session");
  const persist = Sock.quit();
  if (SINCE in persist) {
    sessionStorage.setItem(SINCE, persist[SINCE]);
  }
  return c_out.token;
}

async function clientLogin(opts) {
  const reg_out = await clientRegister(opts);
  return await clientVerify({ ...opts, reg_out });
}

const writeText = async (f, text) => {
  const w = await f.createWritable();
  await w.write(text);
  await w.close();
}

const readFile = async (opts) => {
  const { root, fname } = opts;
  const toF = root.getFileHandle.bind(root);
  const f = await toF(fname, { create: true });
  return await (await f.getFile()).text();
}

const writeFile = async (opts) => {
  const method = 'POST';
  const { fname, text: body } = opts;
  await fetch('/'+fname, { body, method });
}

const toGitHubDelay = (local) => {
  // Return delay in seconds
  return local ? 0.1 : 0.5;
}

export { 
  clientLogin, toSyncOp, writeText, writeFile, readFile,
  toGitHubDelay 
};
