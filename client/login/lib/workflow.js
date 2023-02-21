
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
    const { reset } = this.DATA;
    const labels = {
      socket: "Connecting...",
      mailer: "Authorizing...",
      database: "Loading...",
      sending: "Saving...",
    }
    const title = labels[loading[0]?.[0]];
    switch(loading.length) {
      case 0:
        return ["Welcome", "Reset Master?"][+reset];
      case 1:
        return title || "Processing...";
      default:
        return "Processing";
    }
  }

  get nodes () {
    const { tables, newRows } = this.DATA;
    const { step, reset, modal } = this.DATA;
    const [ sites, users, passwords ] = tables;
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
    const resetter = async (i) => {
      if (i !== 1) return;
      this.DATA.reset = true;
    }
    const roots = [
      [{
        reset,
        view: "form",
        title: this.loader,
        loading: this.loading.length > 0,
      }],
      [{
        resetter, view: "nav", labels: ["Welcome", "Reset Master?"]
      },{
        view: "display",
        items: [{
          text: `Add, update or view passwords.`
        }]
      },{
        view: "buttons",
        keys: ["NEW-NEXT", "PASTE-NEXT", "READ-NEXT"]
      },{
        view: "save",
        title: this.loader,
        loading: this.loading.length > 0,
      }]
    ];
    const branch = [
      [{
        view: "nav", labels: ["Home"]
      },{
        view: "display",
        items: [{
          text: `Add password for which provider?`,
        }]
      },{
        view: "write", key: "sites", table: sites
      }],
      [{
        view: "nav", labels: ["Home"]
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
        view: "nav", labels: ["Home", view_site]
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
        view: "nav", labels: ["Home", view_site]
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
        view: "nav", labels: ["Home", view_site, view_user]
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
        view: "nav", labels: ["Home", view_site, view_user]
      },{
        view: "display",
        items: [{
          text: `"${view_user}" has password at "${view_site}"`
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
    ]).map(nodes => {
      const main = nodes.map((node) => {
        const uuid = crypto.randomUUID();
        return { ...node, uuid };
      });
      const tail = [];
      if (modal) {
        const view = "modal";
        const uuid = crypto.randomUUID();
        tail.push({...modal, uuid, view });
      }
      return main.concat(tail);
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
    const hideModal = this.hideModal.bind(this);
    const shared = { 
      api, stepBack, stepNext, stepHome, hideModal 
    };
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
  stepHome() {
    this.DATA.step = 1;
  }
  stepBack() {
    const { step, last_session_string } = this.DATA;
    if (step === 1) {
      if (!last_session_string) return;
      this.DATA.reset = true;
    }
    this.DATA.step = Math.floor(step/2);
  }
  stepNext(bool) {
    const { step } = this.DATA;
    this.DATA.step = 2 * step + bool;
  }
}

export { Workflow }
