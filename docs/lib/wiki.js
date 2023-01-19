import { fromB64urlQuery } from "sock-secret";
import { toB64urlQuery } from "sock-secret";

function isForApp(p) {
  return p.client_auth_data;
}

function isForInstall(p) {
  return p.client_auth_result; 
}

function isForAuth(p) {
  return p.salt && p.key && p.data; 
}

const toPastedText = async (props) => {
  const { local, host, git } = props;
  const wiki = `${host}/pub.txt`;
  const headers = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache"
  };
  const opts = { headers };
  if (!local) {
    const result = await fetch(wiki, opts);
    const json = await (result).json();
    return json.body || "";
  }
  const result = await fetch(wiki, opts);
  const txt = await (result).text();
  return txt;
}

const toPasted = async (props) => {
  const text = await toPastedText(props);
  return fromB64urlQuery(text.replaceAll('\n',''));
}

const NO_HANDLERS = {
  'token': [],
  'code': []
}

class WikiMailer {

  constructor(props) {
    this.props = props;
    this.done = true;
    this.handlers = {...NO_HANDLERS};
  }

  async mainLoop () {
    const dt = 1000; // 1 second
    while (!this.done) {
      await new Promise(r => setTimeout(r, dt));
      const pasted = await toPasted(this.props);
      if (isForApp(pasted)) {
        await this.handle('app', pasted);
        this.handlers.app = [];
      }
      else if (isForInstall(pasted)) {
        await this.handle('install', pasted);
        this.handlers.install = [];
        this.handlers.app = [];
      }
      else if (isForAuth(pasted)) {
        const encrypted = toB64urlQuery(pasted);
        await this.handle('auth', { encrypted });
        this.handlers.install = [];
        this.handlers.auth = [];
        this.handlers.app = [];
      }
    }
  }

  async handle(key, v) {
    const handlers = this.handlers[key] || [];
    const proms = [...handlers].map((h) => h(v));
    await Promise.all(proms);
  }

  addHandler(key, handler) {
    const handlers = this.handlers[key] || [];
    const new_handlers = [...handlers, handler];
    this.handlers = {
      ...this.handlers,
      [key]: new_handlers
    }
  }

  start() {
    if (this.done) {
      this.done = false;
      this.mainLoop();
    }
  }

  finish() {
    this.done = true;
    this.handlers = {...NO_HANDLERS};
  }
}

const toNameTree = (s) => {
  if (!s.length) {
    return { command: "", tree: {} }
  }
  const trio = s.split(/(#.*)/s);
  if (trio.length !== 3) {
    throw new Error('Poorly formatted server data');
  }
  const [command, rest] = trio;
  const tree = fromB64urlQuery(rest);
  return { command, tree };
}

const fromNameTree = ({ command, tree }) => {
  return command + toB64urlQuery(tree);
}

export { WikiMailer, toPastedText, toNameTree, fromNameTree }
