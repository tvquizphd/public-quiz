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
  get paths () {
    const root = "https://github.com";
    const new_app = "installations/new";
    const { local, remote, app_name, wiki_ext } = this.DATA;
    const install_app = `${root}/apps/${app_name}/${new_app}`;
    const wiki = `${root}/${remote}/wiki/${wiki_ext}`;
    const local_text = "public ids to develop.bash";
    const use_wiki = (inputs) => {
      const { what, ...opts } = inputs;
      const text = `${what} to `;
      const sh = "develop.bash";
      if (local) {
        return { ...opts, text: text+sh }
      }
      const link = { text: "Wiki", href: wiki };
      return { ...opts, text, link };
    }
    const items = [{
      go: { text: "Create", href: this.DATA.app_str },
      text: "GitHub App",
    },use_wiki({
      copy: { text: "Copy", copy: this.DATA.pub_str },
      what: "app code"
    }),{
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
    return workflow[index];
  }
  get render() {
    const { nodes, templates } = this;
    const filter = ({ view }) => view in templates;
    const stepNext = this.stepNext.bind(this);
    const hideModal = this.hideModal.bind(this);
    const shared = { stepNext, hideModal };
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
}

export { Workflow }
