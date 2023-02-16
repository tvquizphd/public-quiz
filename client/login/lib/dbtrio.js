import { SEP, AsciiTables } from "ascii";
import { decryptQueryMaster } from "decrypt";
import { fromB64urlQuery } from "sock-secret";
import { toB64urlQuery } from "sock-secret";

class DBTrio {

  constructor(params) {
    const { DATA } = params;
    this.at = new AsciiTables({ DATA });
  }

  get trio() {
    return this.at.ascii.split(SEP.TS);
  }

  async encrypt(params) {
    const { to_master, to_session } = params;
    const masters = this.trio.map((text) => {
      return to_master(text);
    });
    const m_trio = await Promise.all(masters);
    const m_str = m_trio.join(SEP.TS);
    const out = await to_session(m_str);
    return fromB64urlQuery(out);
  }

  decryptUser(params, mail) {
    const { command, tree } = mail;
    const mail_text = toB64urlQuery(tree);
    const { from_session } = params;
    return new Promise((resolve, reject) => {
      if (!("ev" in (tree.data || {}))) {
        return reject('No message to decrypt.');
      }
      from_session(mail_text).then(s_str => {
        const installed = fromB64urlQuery(s_str);
        resolve({ command, tree: installed });
      }).catch(e => {
        reject(e);
      })
    });
  }

  decryptSession(params, mail) {
    const { command, tree } = mail;
    const mail_text = toB64urlQuery(tree);
    const { from_master, from_session } = params;
    return new Promise((resolve, reject) => {
      if (!("ev" in (tree.data || {}))) {
        return reject('No message to decrypt.');
      }
      from_session(mail_text).then(s_str => {
        const m_trio = s_str.split(SEP.TS);
        if (m_trio.length !== 3) {
          throw new Error('Invalid mail');
        }
        const masters = m_trio.map((text) => {
          return from_master(text)
        })
        Promise.all(masters).then(trio => {
          const ascii = trio.join(SEP.TS);
          this.at.ascii = ascii;
          resolve({ command, tree: ascii });
        }).catch(() => {
          const msg = 'Master decryption error';
          reject(new Error(msg));
        });
      }).catch(e => {
        console.error('Session decryption error');
        reject(e);
      })
    });
  }
}

const readKey = (key) => {
  return async (search) => {
    if (search === "") return "";
    const args = { search, master_key: key };
    const out = await decryptQueryMaster(args);
    return out.plain_text;
  }
}

class Inbox {
  constructor(data, api) {
    const { dbt } = api;
    this.data = data;
    this.tags = {
      'user': dbt.decryptUser.bind(dbt),
      'session': dbt.decryptSession.bind(dbt),
    };
  }
  get mapper () {
    return this._mapper.bind(this);
  }
  fromKey (from_key) {
    const { master_key } = this.data;
    return { 
      from_master: readKey(master_key),
      from_session: readKey(from_key)
    };
  }
  ignore (tag) {
    const cmd = ['mail', tag].join('__');
    delete this[cmd];
  }
  allow (tag, key) {
    const fn = this.tags[tag];
    if (typeof fn !== 'function') {
      throw new Error(`No inbox tag: ${tag}`);
    }
    const k = this.fromKey(key);
    const cmd = ['mail', tag].join('__');
    this[cmd] = (ct) => fn(k, ct);
  }
  async _mapper(ctli) {
    return await ctli.reduce(async (memo, cti) => {
      const cmd = cti.command;
      const out = await memo;
      if (typeof this[cmd] === "function") {
        try {
          return [...out, await this[cmd](cti)]; 
        }
        catch {
          throw new Error(`Error mapping ${cmd}`);
        }
      }
      const tree = { 'noop': 'noop' };
      return [...out, { ...cti, tree }];
    }, []);
  }
}

export { DBTrio, Inbox };
