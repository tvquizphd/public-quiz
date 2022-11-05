import { fromB64urlQuery } from "project-sock";

function isForApp(p) {
  return p.register && p.client_auth_data;
}

function isForInstall(p) {
  return p.client_auth_result; 
}

function isForAuth(p) {
  return p.salt && p.key && p.data; 
}

const toPasted = async (url) => {
  const wiki = `${url}/pub.txt`;
  const headers = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache"
  };
  const opts = { headers };
  const result = await fetch(wiki, opts);
  const text = await (result).text();
  return fromB64urlQuery(text.replaceAll('\n',''));
}

const NO_HANDLERS = {
  'token': [],
  'code': []
}

class WikiMailer {

  constructor(host) {
    this.host = host;
    this.done = true;
    this.handlers = {...NO_HANDLERS};
  }

  async mainLoop () {
    const dt = 1000; // 1 second
    while (!this.done) {
      await new Promise(r => setTimeout(r, dt));
      const pasted = await toPasted(this.host);
      if (isForApp(pasted)) {
        const { register, client_auth_data } = pasted;
        this.handle('app', { register, client_auth_data });
        this.handlers.app = [];
      }
      else if (isForInstall(pasted)) {
        const { client_auth_result } = pasted;
        this.handle('install', { client_auth_result });
        this.handlers.install = [];
        this.handlers.app = [];
      }
      else if (isForAuth(pasted)) {
        const encrypted = pasted;
        this.handle('auth', { encrypted });
        this.handlers.install = [];
        this.handlers.auth = [];
        this.handlers.app = [];
      }
    }
  }

  handle(key, value) {
    const handlers = this.handlers[key] || [];
    [...handlers].forEach((handler) => {
      handler(value);
    });
    this.handlers[key] = [];
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

export { WikiMailer }
