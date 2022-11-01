import { fromB64urlQuery } from "project-sock";

function isPastedCode(p) {
  return !!p.pub && !!p.code;
}

function isPastedToken(p) {
  return !!p.pub && !!p.token;
}

const toPasted = async (url) => {
  const wiki = `${url}/Home.md`;
  const headers = {
    "Cache-Control": "no-store",
    "Pragma": "no-cache"
  };
  const opts = { headers };
  const result = await fetch(wiki, opts);
  const text = await (result).text();
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
      'token': [],
      'code': []
    };
  }

  async mainLoop () {
    const dt = 5000; // 5 seconds
    while (!this.done) {
      await new Promise(r => setTimeout(r, dt));
      const pasted = await toPasted(this.host);
      if (isPastedToken(pasted)) {
        const { token: data, pub } = pasted;
        this.handle('token', { data, pub });
        this.handlers.code = [];
      }
      else if (isPastedCode(pasted)) {
        const { code: data, pub } = pasted;
        this.handle('code', { data, pub });
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
