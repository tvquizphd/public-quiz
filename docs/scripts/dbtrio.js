/*
 * Globals needed on window object:
 *
 * AsciiTables, SEP
 */

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

class DBTrio {

  constructor(params) {
    const { DATA } = params;
    this.at = new AsciiTables({ DATA });
  }

  get trio() {
    return this.at.ascii.split(SEP.TS);
  }

  handleClick(d, text="") {
    const { rowIdx, targetKey } = d;
    if (targetKey === 'set-secret-server') {
      this.at.setSecretServer(rowIdx, d.targetIdx);
    }
    else if (targetKey === 'set-secret-client') {
      this.at.setSecretClient(rowIdx, d.targetIdx);
    }
    else if (targetKey === "set-server") {
      this.at.setServer(rowIdx, text);
    }
    else if (targetKey === "set-client") {
      this.at.setClient(rowIdx, text);
    }
    else if (targetKey === "set-secret") {
      this.at.setSecret(rowIdx, text);
    }
    else if (targetKey === "delete-server") {
      this.at.deleteServer(rowIdx);
    }
    else if (targetKey === "delete-client") {
      this.at.deleteClient(rowIdx);
    }
    else if (targetKey === "delete-secret") {
      this.at.deleteSecret(rowIdx);
    }
    else if (targetKey === 'set-new-secret-server') {
      this.at.setNewSecretServer(d.targetIdx);
    }
    else if (targetKey === 'set-new-secret-client') {
      this.at.setNewSecretClient(d.targetIdx);
    }
    else if (targetKey === "set-new-server") {
      this.at.setNewServer(text);
    }
    else if (targetKey === "set-new-client") {
      this.at.setNewClient(text);
    }
    else if (targetKey === "set-new-secret") {
      this.at.setNewSecret(text);
    }
    else if (targetKey === "add-new-server") {
      this.at.addNewServer();
    }
    else if (targetKey === "add-new-client") {
      this.at.addNewClient();
    }
    else if (targetKey === "add-new-secret") {
      this.at.addNewSecret();
    }
  }

  encrypt(params) {
    const { to_master, to_session } = params;
    const masters = this.trio.map((text) => {
      return to_master(text);
    });
    return new Promise((resolve, reject) => {
      Promise.all(masters).then(m_trio => {
        const m_str = m_trio.join(SEP.TS);
        to_session(m_str).then(resolve).catch((e) => {
          console.error('Session encryption error');
          reject(e);
        });
      }).catch((e) => {
        console.error('Master encryption error');
        reject(e);
      });
    });
  }

  decrypt(params, etrio) {
    const { from_master, from_session } = params;
    return new Promise((resolve, reject) => {
      if (!("ev" in (etrio || {}))) {
        console.log('No message to decrypt.');
        return resolve(this.at.DATA.tables);
      }
      from_session(etrio).then(s_str => {
        const m_trio = s_str.split(SEP.TS);
        const masters = m_trio.map((text) => {
          return from_master(text)
        })
        Promise.all(masters).then(trio => {
          this.at.ascii = trio.join(SEP.TS);
          resolve(this.at.DATA.tables);
        }).catch(e => {
          console.error('Master decryption error');
          reject(e);
        });
      }).catch(e => {
        console.error('Session decryption error');
        reject(e);
      })
    });
  }

  render(cls="") {
    return this.at.render(cls);
  }
}

window.DBTrio = DBTrio;
window.itemButtonTag = itemButtonTag;
