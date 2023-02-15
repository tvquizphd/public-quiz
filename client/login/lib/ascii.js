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
}

export { SEP, AsciiTables };
