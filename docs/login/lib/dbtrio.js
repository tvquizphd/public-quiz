import { SEP, AsciiTables } from "ascii";
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

export { DBTrio };
