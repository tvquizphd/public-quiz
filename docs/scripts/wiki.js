import { fromB64urlQuery } from "https://cdn.skypack.dev/project-sock";

function isPastedPub(p) {
  return !!p.pub;
}

function isPastedData(p) {
  return !!p.pub && !!p.data;
}

const toPasted = async ({ git }) => {
  const root = "https://raw.githubusercontent.com/wiki";
  const wiki = `${root}/${git.owner}/${git.repo}/Home.md`;
  const text = await (await fetch(wiki)).text();
  return fromB64urlQuery(text);
}

class WikiMailer {

  constructor({ git }) {
    this.git = {
      owner: git.owner,
      repo: git.repo
    };
    this.done = true;
    this.handlers = {
      'wiki': [],
      'code': []
    };
  }

  async mainLoop () {
    const { git } = this;
    const dt = 1000; // 1 second
    while (!this.done) {
      await new Promise(r => setTimeout(r, dt));
      const pasted = await toPasted({ git });
      if (isPastedData(pasted)) {
        this.handle('code', pasted);
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
