// Table Separator
const TS = "\n";
// Record Separator
const RS = "\x1E";
// Field Separator
const FS = "\x1F";

const normalize = (s) => {
  return `${s}`.replace(/\x1F|\x1E|\n/g, " ");
}
const toData = (obj) => {
  return Object.entries(obj).map(([k, v]) => {
    return `data-${k}="${v}"`;
  }).join(' ');
}
const inOpener = (i, idx) => {
  const i_data = toData(idx);
  const b_data = `button ${i_data}`;
  if (i === 0) {
    return `<${b_data} class="active item">`;
  }
  return `<${b_data} class="item">`;
}
const toScroll = (target, at) => {
  const list = at.DATA.tables[target];
  return (onIdx, rowIdx) => {
    const buttons = list.map((value, i) => {
      const idx = {
        "row-idx": rowIdx,
        "target-idx": `${i}`,
        "target-key": `${target}`
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
    const range = [first, ...rest];
    return range.reduce((o, { value, idx }, i) => {
			const open_in = inOpener(i, idx);
      return o + `${open_in}${value}${close_in}`;
    }, open_out) + close_out;
  }
}
const toInput = (text) => {
  const type = "text";
  const props = [
    `type="${type}"`,
    `value="${text}"`
  ].join(" ");
  return `<input ${props}>`;
}
const useRows = (n, idx, at) => {
  const table = at.DATA.tables[idx];
  const toServer = toScroll(0, at);
  const toClient = toScroll(1, at);
  // Special handling for secrets
  if (n === 3) {
    return table.reduce((rows, fields, f) => {
      const [f0, f1, f2] = fields;
      const key_row = [
        toServer(f0, `${f}`), toClient(f1, `${f}`)
      ];
      const val_row = [toInput(f2)];
      return rows.concat([key_row, val_row]);
    }, [])
  }
  // Handle clients and servers
  return table.map((fields) => {
    return fields.map(toInput);
  });
}
const toTableMarkup = (idx, at) => {
  const table = at.DATA.tables[idx];
  const n = table.reduce((o, r) => {
    return Math.max(o, r.length);
  }, 0);
  const tags = ["table", "tr", "td"];
  const open = tags.map((t) => `<${t}>`);
  const close = tags.map((t) => `</${t}>`);
  const rows = useRows(n, idx, at);
  return rows.reduce((o0, row) => {
    const o1 = row.reduce((o2, out) => {
      const o3 = [open[2], out, close[2]].join('');
      return o2 + o3;
    }, open[1]) + close[1];
    return o0 + o1;
  }, open[0]) + close[0];
}

class AsciiTables {
  
  constructor(params) {
    const { DATA } = params;
    this.DATA = DATA;
  }

  updateSecrets(secrets) {
    const [t0, t1, _ ] = this.DATA.tables;
    this.DATA.tables = [t0, t1, secrets];
  }

  get setServer() {
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

  get setClient() {
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

  get ascii() {
    const { tables } = this.DATA;
    return tables.map((records) => {
      return records.map((fields) => {
        return fields.map(normalize).join(FS);
      }).join(RS);
    }).join(TS);
  }

  set ascii(str) {
    const tables = str.split(TS).map((table) => {
      return table.split(RS).map((record) => {
        return record.split(FS);
      })
    })
    this.DATA.tables = tables;
  }

  render(cls="") {
    const open = `<div class=${cls}>`;
    const close = "</div>";
    return [0,1,2].reduce((o, idx) => {
      const tm = toTableMarkup(idx, this);
      return o + `<div>${tm}</div>`;
    }, open) + close;
  }
}

class DBTrio {

  constructor(params) {
    const { DATA } = params;
    this.at = new AsciiTables({ DATA });
  }

  get trio() {
    return this.at.ascii.split(TS);
  }

  setTarget(d) {
    const { rowIdx, targetIdx, targetKey } = d;
    if (targetKey === '0') {
      this.at.setServer(rowIdx, targetIdx);
    }
    else if (targetKey === '1') {
      this.at.setClient(rowIdx, targetIdx);
    }
  }

  encrypt(params) {
    const { to_master, to_session } = params;
    const masters = this.trio.map((text) => {
      return to_master(text);
    });
    return new Promise((resolve, reject) => {
      Promise.all(masters).then(m_trio => {
        const m_str = m_trio.join(TS);
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
        const m_trio = s_str.split(TS);
        const masters = m_trio.map((text) => {
          return from_master(text)
        })
        Promise.all(masters).then(trio => {
          this.at.ascii = trio.join(TS);
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
