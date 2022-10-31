class Workflow  {

  constructor ({ DATA, API, templates }) {
    this.templates = templates;
    this.DATA = DATA;
    this.api = API;
  }
  get loading () {
    const loaders = Object.entries(this.DATA.loading);
    return loaders.filter(([_, v]) => v);
  }
  get loader () {
    const { loading } = this;
    const labels = {
      socket: "Connecting...",
      mailer: "Authorizing...",
      database: "Loading...",
      sending: "Saving...",
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
  get nodes () {
    const { step, tables, newRows } = this.DATA;
    const [ sites, users, passwords ] = tables;
    const nav_write = "Create";
    const nav_read = "Find";
    const view_idx_0 = parseInt(newRows[2][0]);
    const view_idx_1 = parseInt(newRows[2][1]);
    const view_site = sites[view_idx_0]?.[0] || "";
    const view_user = users[view_idx_1]?.[0] || "";
    const view_pass = newRows[2][2];
    const no_branch = [[], []];
    const no_leaf = [];
    const matches = passwords.filter(([sid]) => {
      return sid === `${view_idx_0}`;
    }).map(([_, uid]) => parseInt(uid));
    const old_combo = (_, u_id) => {
      return matches.includes(u_id);
    }
    const new_combo = (_, u_id) => {
      return !matches.includes(u_id);
    };
    const roots = [
      [{
        view: "form",
        title: this.loader,
        loading: this.loading.length > 0,
      }],
      [{
        view: "nav", labels: ["Home"]
      },{
        view: "display",
        items: [{
          text: `Add random or pasted password, or view passwords.`
        }]
      },{
        view: "buttons",
        keys: ["NEW-NEXT", "PASTE-NEXT", "READ-NEXT"]
      },{
        view: "save"
      }]
    ];
    const branch = [
      [{
        view: "nav", labels: [nav_write]
      },{
        view: "display",
        items: [{
          text: `Add password for which provider?`,
        }]
      },{
        view: "write", key: "sites", table: sites
      }],
      [{
        view: "nav", labels: [nav_read]
      },{
        view: "display",
        items: [{
          text: `Search for which provider?`,
        }]
      },{ 
        view: "read", key: "sites", table: sites,
        empty: "No sites found. Return Home?"
      }],
    ]
    const branch_0 = [
      [{
        view: "nav", labels: [nav_write, view_site]
      },{
        view: "display",
        items: [{
          text: `Add which username at "${view_site}"?`,
        }]
      },{
        view: "write", key: "users",
        table: users, filter: new_combo
      }],
      no_leaf
    ]
    const branch_1 = [
      [{
        view: "nav", labels: [nav_read, view_site]
      },{
        view: "display",
        items: [{
          text: `Find which username at "${view_site}"?`,
        }]
      },{
        view: "read", key: "users",
        table: users, filter: old_combo,
        empty: "No users found. Return Home?"
      }],
      no_leaf
    ]
    const branch_0_0 = [
      [{
        view: "nav", labels: [nav_write, view_site, view_user]
      },{
        view: "display",
        items: [{
          text: `Store this for ${view_user} at ${view_site}?`,
        },{
          strength: 2,
          text: view_pass
        }]
      },{
        view: "buttons",
        keys: ["NEW", "PASTE", "WRITE-DONE"]
      }],
      no_leaf
    ]
    const pass_idx = passwords.findIndex(([sid, uid]) => {
      const s = parseInt(sid);
      const u = parseInt(uid);
      return view_idx_0 === s && view_idx_1 === u;
    });
    const pass_now = passwords[pass_idx]?.[2];
    const branch_1_0 = [
      [{
        view: "nav", labels: [nav_read, view_site, view_user]
      },{
        view: "display",
        items: [{
          text: `What to do for ${view_user} at ${view_site}?`
        },{
          strength: 1,
          text: `Current password is "${pass_now}"`
        }]
      },{
        view: "buttons",
        data: {
          idx: `${pass_idx}`,
          password: pass_now || ""
        },
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
    if ( step > 1 ) {
      this.DATA.step = Math.floor(step/2);
    }
  }
  stepNext(bool) {
    const { step } = this.DATA;
    this.DATA.step = 2 * step + bool;
  }
}

export { Workflow }
