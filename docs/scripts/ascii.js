const SEP = (() => {
  // Table Separator
  const TS = "\n";
  // Record Separator
  const RS = "\x1E";
  // Field Separator
  const FS = "\x1F";
  // All Separators
  return { TS, RS, FS };
})();

const normalize = (s) => {
  const { TS, RS, FS } = SEP;
  const seps = [TS, RS, FS].join("|");
  const exp = new RegExp(seps, "g");
  return `${s}`.replace(exp, " ");
}
const toOpen = (tag) => {
  return `<${tag}>`;
}
const toClose = (tag) => {
  return `</${tag.split(' ').shift()}>`;
}
const renderTable = (rows) => {
  return rows.reduce((o0, { row, cls }) => {
    const rowTag = cls ? `tr class=${cls}` : 'tr';
    const o1 = row.reduce((o2, out) => {
      const id = crypto.randomUUID();
      const o3 = [toOpen(`td id="${id}"`), out, toClose('td')];
      return o2 + o3.join('');
    }, toOpen(rowTag)) + toClose(rowTag);
    return o0 + o1;
  }, toOpen('table')) + toClose('table');
}

const useNew = (n, idx, at) => {
  const prefix = 'set-new-secret-';
  const row = at.DATA.newRows[idx];
  const toServer = toScroll(prefix, 0, at);
  const toClient = toScroll(prefix, 1, at);
  // Special handling for secrets
  if (n === 3) {
    const [f0, f1, f2] = row;
    const key_row = {
      cls: "r-pair",
      row: [
        toServer(f0, ''), toClient(f1, '')
      ]
    };
    const val_row = {
      cls: "r-end",
      row: [toNewInput(f2, "secret")]
    };
    return [key_row, val_row];
  }
  // Handle servers and clients
  const f0 = row[0] || '';
  const k = !idx ? 'server' : 'client';
  return [{ row: [toNewInput(f0, k)] }];
}

const toData = (obj) => {
  return Object.entries(obj).map(([k, v]) => {
    return `data-${k}="${v}"`;
  }).join(' ');
}

const itemButtonTag = (i, idx, cls=[]) => {
  const i_data = toData(idx);
  const b_data = `button ${i_data}`;
  if (i === 0) {
    const c_on = "active";
    const c_str = [...cls, c_on].join(' ');
    return `<${b_data} class="${c_str}">`;
  }
  const c_str = cls.join(' ');
  return `<${b_data} class="${c_str}">`;
}



const toScroll = (prefix, target, at) => {
  const list = at.DATA.tables[target];
  const keys = ['server', 'client'];
  return (onIdx, rowIdx) => {
    const buttons = list.map((value, i) => {
      const targetKey = prefix + keys[target];
      const idx = {
        "row-idx": rowIdx,
        "target-idx": `${i}`,
        "target-key": targetKey
      };
      return { value, idx };
    });
    const first = buttons[parseInt(onIdx)];
    const rest = buttons.filter((_, i) => {
      return `${i}` !== onIdx;
    });
    const close_out = `</div>`;
    const close_in = `</button>`;
    const open_out = `<div class="scroll-wrapper">`;
    const range = (first ? [first] : []).concat(rest);
    return range.reduce((o, { value, idx }, i) => {
			const open_in = itemButtonTag(i, idx, ['item']);
      return o + `${open_in}${value}${close_in}`;
    }, open_out) + close_out;
  }
}

const toNewInput = (text, key) => {
  const type = "text";
  const props = [
    `type="${type}"`,
    `value="${text}"`
  ].join(" ");
  const i_idx = {
    "target-key": `set-new-${key}`
  }
  const b_idx = {
    "target-key": `add-new-${key}`
  };
  const cls = ["item", "b-add"];
  const close = toClose("button");
  const open = itemButtonTag(0, b_idx, cls);
  const i_data = toData(i_idx);
  const id = `input-${key}-new`;
  const entity = {
    "server": "Site",
    "client": "User",
  }[key] || "Pass";
  return `
    <div class="text-input-wrapper">
      <input id="${id}" ${props} ${i_data}>
      ${open}Add ${entity}${close}
    </div>
  `;
}

const toInput = (text, key, r) => {
  const type = "text";
  const props = [
    `type="${type}"`,
    `value="${text}"`
  ].join(" ");
  const i_idx = {
    "row-idx": `${r}`,
    "target-key": `set-${key}`
  }
  const b_idx = {
    "row-idx": `${r}`,
    "target-key": `delete-${key}`
  };
  const cls = ["item", "b-delete"];
  const close = toClose("button");
  const open = itemButtonTag(0, b_idx, cls);
  const i_data = toData(i_idx);
  const id = `input-${key}-${r}`;
  return `
    <div class="text-input-wrapper">
      <input id="${id}" ${props} ${i_data}>
      ${open}Delete${close}
    </div>
  `;
}
const useRows = (n, idx, at) => {
  const prefix = 'set-secret-';
  const table = at.DATA.tables[idx];
  const toServer = toScroll(prefix, 0, at);
  const toClient = toScroll(prefix, 1, at);
  // Special handling for secrets
  if (n === 3) {
    return table.reduce((rows, row, r) => {
      const [f0, f1, f2] = row;
      const key_row = {
        cls: "r-pair",
        row: [
          toServer(f0, `${r}`), toClient(f1, `${r}`)
        ]
      };
      const val_row = {
        cls: "r-end",
        row: [toInput(f2, "secret", r)]
      };
      return rows.concat([key_row, val_row]);
    }, []);
  }
  // Handle servers and clients
  const k = !idx ? 'server' : 'client';
  return table.map((row, r) => {
    const f0 = row[0] || '';
    return { row: [toInput(f0, k, r)] };
  });
}

const toTableNew = (idx, at) => {
  const n = [1, 1, 3][idx];
  const rows = useNew(n, idx, at);
  return renderTable(rows);
}

const toTableMarkup = (idx, at) => {
  const n = [1, 1, 3][idx];
  const rows = useRows(n, idx, at);
  return renderTable(rows);
}

function noSame(list) {
  const regex = /^(.*) #\d+$/;
  const repeats = new Map();
  return list.map(([_s]) => {
    const s = _s.replace(/\s+$/, " ");
    const match = s.match(regex) || [s, s];
    const text = match.slice(1).shift();
    const t_key = text.replaceAll(' ', '');
    const reps = repeats.get(t_key);
    if (reps) {
      repeats.set(t_key, reps + 1);
      return [`${text} #${reps}`];
    }
    repeats.set(t_key, 1);
    return [ text ];
  });
}

class AsciiTables {
  
  constructor(params) {
    const { DATA } = params;
    this.DATA = DATA;
  }

  updateNewServer(server) {
    const [_, t1, t2 ] = this.DATA.newRows;
    this.DATA.newRows = [server, t1, t2];
  }

  updateNewClient(client) {
    const [t0, _, t2 ] = this.DATA.newRows;
    this.DATA.newRows = [t0, client, t2];
  }

  updateNewSecret(secret) {
    const [t0, t1, _ ] = this.DATA.newRows;
    this.DATA.newRows = [t0, t1, secret];
  }

  updateServers(servers) {
    const [_, t1, t2 ] = this.DATA.tables;
    this.DATA.tables = [noSame(servers), t1, t2];
  }

  updateClients(clients) {
    const [t0, _, t2 ] = this.DATA.tables;
    this.DATA.tables = [t0, noSame(clients), t2];
  }

  updateSecrets(secrets) {
    const [t0, t1, _ ] = this.DATA.tables;
    this.DATA.tables = [t0, t1, secrets];
  }

  get setServer() {
    return (serverIdx, text) => {
      const { tables } = this.DATA;
      const servers = tables[0].map((row, r) => {
        if (`${r}` === serverIdx) {
          if (text) {
            return [text];
          }
          const empty = crypto.randomUUID().split('-');
          return [`server ${empty.shift()}`];
        }
        return row;
      });
      this.updateServers(servers);
    }
  }

  get setClient() {
    return (clientIdx, text) => {
      const { tables } = this.DATA;
      const clients = tables[1].map((row, r) => {
        if (`${r}` === clientIdx) {
          if (text) {
            return [text];
          }
          const empty = crypto.randomUUID().split('-');
          return [`client ${empty.shift()}`];
        }
        return row;
      });
      this.updateClients(clients);
    }
  }

  get setSecret() {
    return (rowIdx, text) => {
      const { tables } = this.DATA;
      const secrets = tables[2].map((row, r) => {
        const [f0, f1, _] = row;
        if (`${r}` === rowIdx) {
          return [f0, f1, text];
        }
        return row;
      })
      this.updateSecrets(secrets);
    }
  }

  get setSecretServer() {
    return (rowIdx, serverIdx) => {
      const { tables } = this.DATA;
      const secrets = tables[2].map((row, r) => {
        const [_, f1, f2] = row;
        if (`${r}` === rowIdx) {
          return [serverIdx, f1, f2];
        }
        return row;
      })
      this.updateSecrets(secrets);
    }
  }

  get setSecretClient() {
    return (rowIdx, clientIdx) => {
      const { tables } = this.DATA;
      const secrets = tables[2].map((row, r) => {
        const [f0, _, f2] = row;
        if (`${r}` === rowIdx) {
          return [f0, clientIdx, f2];
        }
        return row;
      })
      this.updateSecrets(secrets);
    }
  }

  get deleteServer() {
    return (serverIdx) => {
      const { tables } = this.DATA;
      const servers = tables[0].filter((_, r) => {
        return `${r}` !== serverIdx;
      });
      const secrets = tables[2].filter((row) => {
        return `${row[0]}` !== serverIdx;
      }).map((row) => {
        const [f0, f1, f2] = row;
        const old_f0 = parseInt(f0);
        const update = +(old_f0 > serverIdx);
        const new_f0 = [old_f0, old_f0 - 1][update];
        return [`${new_f0}`, f1, f2];
      });
      this.updateSecrets(secrets);
      this.updateServers(servers);
    }
  }

  get deleteClient() {
    return (clientIdx) => {
      const { tables } = this.DATA;
      const clients = tables[1].filter((_, r) => {
        return `${r}` !== clientIdx;
      });
      const secrets = tables[2].filter((row) => {
        return `${row[1]}` !== clientIdx;
      }).map((row) => {
        const [f0, f1, f2] = row;
        const old_f1 = parseInt(f1);
        const update = +(old_f1 > clientIdx);
        const new_f1 = [old_f1, old_f1 - 1][update];
        return [f0, `${new_f1}`, f2];
      });
      this.updateSecrets(secrets);
      this.updateClients(clients);
    }
  }

  get deleteSecret() {
    return (secretIdx) => {
      const { tables } = this.DATA;
      const secrets = tables[2].filter((_, r) => {
        return `${r}` !== secretIdx;
      });
      this.updateSecrets(secrets);
    }
  }

  get setNewSecretServer() {
    return (serverIdx) => {
      const [_, f1, f2] = this.DATA.newRows[2];
      this.updateNewSecret([serverIdx, f1, f2]);
    }
  }
  get setNewSecretClient() {
    return (clientIdx) => {
      const [f0, _, f2] = this.DATA.newRows[2];
      this.updateNewSecret([f0, clientIdx, f2]);
    }
  }
  get setNewServer() {
    return (text) => {
      this.updateNewServer([text]);
    }
  }
  get setNewClient() {
    return (text) => {
      this.updateNewClient([text]);
    }
  }
  get setNewSecret() {
    return (text) => {
      const [f0, f1, _] = this.DATA.newRows[2];
      this.updateNewSecret([f0, f1, text]);
    }
  }
  get addNewServer() {
    return () => {
      const servers = this.DATA.tables[0];
      const server = this.DATA.newRows[0];
      if (server) {
        this.updateServers([...servers, server]);
        this.updateNewServer(['']);
      }
    }
  }
  get addNewClient() {
    return () => {
      const clients = this.DATA.tables[1];
      const client = this.DATA.newRows[1];
      if (client) {
        this.updateClients([...clients, client]);
        this.updateNewClient(['']);
      }
    }
  }
  get addNewSecret() {
    return () => {
      const secrets = this.DATA.tables[2];
      const secret = this.DATA.newRows[2];
      if (secret[2]) {
        this.updateSecrets([...secrets, secret]);
        this.updateNewSecret(['', '', '']);
      }
    }
  }

  get ascii() {
    const { TS, RS, FS } = SEP;
    const { tables } = this.DATA;
    return tables.map((records) => {
      return records.map((fields) => {
        return fields.map(normalize).join(FS);
      }).join(RS);
    }).join(TS);
  }

  set ascii(str) {
    const { TS, RS, FS } = SEP;
    const f1 = (r) => r.split(FS).slice(0,1);
    const rn = (r) => r ? r.split(RS) : [];
    const t3 = (t) => {
      return (`${t}${TS}${TS}`).split(TS).slice(0, 3);
    }
    const f3 = (f) => {
      return (`${f}${FS}${FS}`).split(FS).slice(0, 3);
    }
    const tables = t3(str).map((r, i) => {
      return rn(r).map(i < 2 ? f1 : f3);
    })
    this.DATA.tables = tables;
  }

  render(cls="") {
    const open = `<div class=${cls}>`;
    const close = "</div>";
    const headers = [
      'Sites to access',
      'Your usernames',
      'Your passwords'
    ]
    return [0,1,2].reduce((o, idx) => {
      const tn = toTableNew(idx, this);
      const tm = toTableMarkup(idx, this);
      return o + `
        <div class="table-header">
          <h2>${headers[idx]}</h2>
        </div>
        <div class="bg-highlight">${tn}</div>
        <div>${tm}</div>
      `;
    }, open) + close;
  }
}

export { SEP, AsciiTables, itemButtonTag };
