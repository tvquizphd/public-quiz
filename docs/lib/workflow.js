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

class Workflow  {

  constructor ({ DATA, templates }) {
    this.templates = templates;
    this.DATA = DATA;
  }
  get loading () {
    const loaders = Object.entries(this.DATA.loading);
    return loaders.filter(([_, v]) => v);
  }
  get loader () {
    const { loading } = this;
    const labels = {
      socket: "Connecting...",
      finish: "Finishing..."
    }
    const title = labels[loading[0]?.[0]];
    switch(loading.length) {
      case 0:
        return "Welcome";
      case 1:
        return title || "Processing...";
      default:
        return "Processing";
    }
  }

  get firstAction () {
    if (this.DATA.local) {
      const text = "Allow";
      const { dev_root } = this.DATA;
      const target = "filesystem access";
      const act = { act: "open", text, target };
      return { act, text: dev_root || "/" }
    }
    const root = "https://github.com";
    const { wiki_ext: ext, remote } = this.DATA;
    const { pub_str: target } = this.DATA;
    const wiki = `${root}/${remote}/wiki/${ext}`;
    const act = { act: "copy", text: "Copy", target };
    const link = { text: "Wiki", href: wiki };
    return { act, text: `app code to `, link };
  }

  get paths () {
    const root = "https://github.com";
    const new_app = "installations/new";
    const { app_name, app_str } = this.DATA;
    const install_app = `${root}/apps/${app_name}/${new_app}`;
    const local_text = "public ids to develop.bash";

    const items = [{
      act: { act: "go", text: "Create", target: app_str },
      text: "GitHub App"
    },
    this.firstAction,
    {
      text: "Install the ",
      link: { text: "GitHub App", href: install_app }
    }, {
      text: "Choose master password"
    }];
    const to_app = [{
      items, view: "list"
    },{
      view: "app",
      title: "Create GitHub App"
    }];
    const to_install = [{
      items, view: "list"
    }];
    const to_wiki = [{
      items, view: "list"
    }];
    const to_master = [{
      items, view: "list"
    },{
      view: "form",
      title: this.loader,
      loading: this.loading.length > 0,
    }];
    const done  = [{
      view: "ready",
      text: "Registered! Use this link from now on:",
      link: {
        text: this.DATA.login,
        href: this.DATA.login,
      }
    }]
    return [ to_app, to_install, to_wiki, to_master, done ];
  }
  get nodes () {
    const { step, modal } = this.DATA;
    const paths = this.paths;
    const len = paths.length;
    const idx = Math.max(0, step);
    const index = Math.min(idx, len);
    const workflow = paths.map(nodes => {
      const main = nodes.map((node) => {
        const uuid = crypto.randomUUID();
        return { ...node, uuid, index };
      });
      const tail = [];
      if (modal) {
        const view = "modal";
        const uuid = crypto.randomUUID();
        tail.push({...modal, uuid, view });
      }
      return main.concat(tail);
    });
    const total = workflow.length;
    return workflow[index];
  }
  get render() {
    const { nodes, templates } = this;
    const filter = ({ view }) => view in templates;
    const setDevHandle = this.setDevHandle.bind(this);
    const hideModal = this.hideModal.bind(this);
    const stepNext = this.stepNext.bind(this);
    const shared = { stepNext, hideModal, setDevHandle };
    return nodes.filter(filter).reduce((out, node) => {
      const template = templates[node.view];
      const o = template({ ...shared, node });
      const { html, handlers } = out;
      return { 
        html: `${html}\n${o.html}`,
        handlers: handlers.concat(o.handlers)
      }
    }, { html: "", handlers: []});
  }
  hideModal() {
    this.DATA.modal = null;
  }
  stepNext(n=0) {
    const { step } = this.DATA;
    this.DATA.step = Math.max(step + 1, n);
  }
  async setDevHandle(root) {
    const { pub_str, dev_file } = this.DATA;
    const text = this.DATA.pub_str;
    const fname = this.DATA.dev_file;
    const write_in = { root, fname, text };
    const f = await writeFile(write_in); 
    this.DATA.dev_handle = f;
  }
}

export { Workflow, writeText }
