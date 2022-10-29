class Workflow  {

  constructor ({ DATA, API, templates }) {
    this.templates = templates;
    this.DATA = DATA;
    this.api = API;
  }
  get loader () {
    const loaders = Object.entries(this.DATA.loading);
    const loading = loaders.filter(([_, v]) => v);
    switch(loading.length) {
      case 0:
        return "Welcome";
      case 1:
        return loading[0][0];
      default:
        return "Processing";
    }
  }
  get nodes () {
    const { step, tables, newRows } = this.DATA;
    const [ sites, users ] = tables;
    const nav_write = "New Password";
    const nav_read = "Passwords";
    const new_site = newRows[0][0];
    const new_user = newRows[1][0];
    const new_pass = newRows[2][2];
    const no_branch = [[], []];
    const no_leaf = [];
    const roots = [
      [{
        view: "form",
        title: this.loader,
      }],
      [{
        view: "nav", labels: ["Home"]
      },{
        view: "buttons",
        keys: ["PASTE-NEXT", "NEW-NEXT", "READ-NEXT"]
      }]
    ];
    const branch = [
      [{
        view: "nav", labels: [nav_write]
      },{
        view: "write", table: sites
      }],
      [{
        view: "nav", labels: [nav_read]
      },{ 
        view: "read", table: sites
      }],
    ]
    const branch_0 = [
      [{
        view: "nav", labels: [nav_write, new_site]
      },{
        view: "write", table: users
      }],
      no_leaf
    ]
    const branch_1 = [
      [{
        view: "nav", labels: [nav_read, new_site]
      },{
        view: "read", table: users
      }],
      no_leaf
    ]
    const branch_0_0 = [
      [{
        view: "nav", labels: [nav_write, new_site, new_user]
      },{
        view: "display",
        items: [{
          text: `Store this for ${new_user} at ${new_site}?`,
        },{
          strength: 2,
          text: new_pass
        }]
      },{
        view: "buttons",
        keys: ["PASTE", "NEW", "WRITE-DONE"]
      }],
      no_leaf
    ]
    const branch_1_0 = [
      [{
        view: "nav", labels: [nav_read, new_site, new_user]
      },{
        view: "display",
        items: [{
          text: `What to do for ${new_user} at ${new_site}?`
        }]
      },{
        view: "buttons",
        keys: ["ERASE-DONE", "PASTE-DONE", "COPY-DONE"]
      }],
      no_leaf
    ]
    const branch_0_1 = no_branch;
    const branch_1_1 = no_branch;
    const tree = [].concat(...[
      roots, branch, branch_0, branch_1,
      branch_0_0, branch_0_1, branch_1_0, branch_1_1
    ]).map(branch => {
      const uuid = crypto.randomUUID();
      return branch.map((node) => ({...node, uuid}))
    });
    const len = tree.length;
    const idx = Math.max(0, step);
    return tree[Math.min(idx, len)];
  }
  get render() {
    const { nodes, api, templates } = this;
    const filter = ({ view }) => view in templates;
    const stepBack = this.stepBack.bind(this);
    const stepNext = this.stepNext.bind(this);
    const stepHome = this.stepHome.bind(this);
    const shared = { api, stepBack, stepNext, stepHome };
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
  stepHome() {
    this.DATA.step = 1;
  }
  stepBack() {
    const { step } = this.DATA;
    this.DATA.step = Math.floor(step/2);
  }
  stepNext(bool) {
    const { step } = this.DATA;
    this.DATA.step = 2 * step + bool;
  }
}

export { Workflow }
