import { fromB64urlQuery } from "project-sock";

function isPastedPub(p) {
  const n_keys = Object.keys(p).length;
  return !!p.pub && n_keys === 1;
}

function isPastedCode(p) {
  return !!p.pub && !!p.code;
}

function isPastedToken(p) {
  return !!p.pub && !!p.token;
}

const toPasted = async (url) => {
  const wiki = `${url}/Home.md`;
  const text = await (await fetch(wiki)).text();
  return fromB64urlQuery(text.replaceAll('\n',''));
}

class WikiMailer {

  constructor({ host, git }) {
    this.git = {
      owner: git.owner,
      repo: git.repo
    };
    this.host = host;
    this.done = true;
    this.handlers = {
      'wiki': [],
      'code': []
    };
  }

  async mainLoop () {
    const dt = 1000; // 1 second
    while (!this.done) {
      await new Promise(r => setTimeout(r, dt));
      const pasted = await toPasted(this.host);
      if (isPastedToken(pasted)) {
        const { token: data, pub } = pasted;
        this.handle('token', { data, pub });
        this.handlers.code = [];
        this.handlers.wiki = [];
      }
      else if (isPastedCode(pasted)) {
        const { code: data, pub } = pasted;
        this.handle('code', { data, pub });
        this.handlers.wiki = [];
      }
      else if (isPastedPub(pasted)) {
        this.handle('wiki', pasted);
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
  }
}

export { WikiMailer }
