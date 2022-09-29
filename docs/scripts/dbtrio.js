// Table Separator
const TS = "\n";
// Record Separator
const RS = "\x1E";
// Field Separator
const FS = "\x1F";

const normalize = (s) => {
  return `${s}`.replace(/\x1F|\x1E|\n/g, " ");
}
const toTableMarkup = (s) => {
  const start = "<table><tr><td>";
  const end = "</td></tr></table>";
  return [...s].reduce((o, c) => {
    return o + ({
      [RS]: "</td></tr><tr><td>",
      [FS]: "</td><td>",
    }[c] || c);
  }, start) + end;
}

class AsciiTables {
  
  constructor(params) {
    const { tables } = params;
    this.tables = tables;
  }

  get ascii() {
    const { tables } = this;
    return tables.map((records) => {
      return records.map((fields) => {
        return fields.map(normalize).join(FS);
      }).join(RS);
    }).join(TS);
  }

  set ascii(str) {
    this.tables = str.split(TS).map((table) => {
      return table.split(RS).map((record) => {
        return record.split(FS);
      })
    })
  }

  render(cls="") {
    const { ascii } = this;
    const ts = ascii.split(TS);
    const start = `<div class=${cls}>`;
    const end = "</div>";
    return ts.reduce((o, t) => {
      const tm = toTableMarkup(t);
      return o + `<div>${tm}</div>`;
    }, start) + end;
  }
}

class DBTrio {

  constructor(params) {
    const { tables } = params;
    this.at = new AsciiTables({ tables });
  }

  get trio() {
    return this.at.ascii.split(TS);
  }

  get tables() {
    return this.at.tables;
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
        return resolve(this.at.tables);
      }
      from_session(etrio).then(s_str => {
        const m_trio = s_str.split(TS);
        const masters = m_trio.map((text) => {
          return from_master(text)
        })
        Promise.all(masters).then(trio => {
          this.at.ascii = trio.join(TS);
          resolve(this.at.tables);
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
