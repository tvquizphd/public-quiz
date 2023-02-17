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
      socket: "Registering...",
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
      const { env } = this.DATA;
      const text = "Skipping step in";
      const act = { act: "noop", text };
      return { act, text: env }
    }
    const root = "https://github.com";
    const { copied, pub_str: target } = this.DATA;
    const latest = (({ remote, version }) => {
      const release = `${root}/${remote}/releases`;
      if (!version) return `${release}/latest/`;
      return `${release}/edit/${version}/`;
    })(this.DATA);
    const act = { copied, act: "copy", text: "Copy", target };
    const link = { text: "Release", href: latest };
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
    }];
    const to_install = [{
      items, view: "list"
    }];
    const to_issue = [{
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
    return [ to_app, to_install, to_issue, to_master, done ];
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
    const setCopied = this.setCopied.bind(this);
    const hideModal = this.hideModal.bind(this);
    const stepNext = this.stepNext.bind(this);
    const shared = { stepNext, hideModal, setCopied };
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

  setCopied(bool) {
    this.DATA.copied = bool;
  }
}

export { Workflow }
