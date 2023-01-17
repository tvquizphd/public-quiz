import { SEP, AsciiTables } from "ascii";
import { fromB64urlQuery } from "project-sock";
import { toB64urlQuery } from "project-sock";

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
    const etree = mail.data;
    const mail_text = toB64urlQuery(mail);
    const { from_master, from_session } = params;
    return new Promise((resolve, reject) => {
      if (!("ev" in (etree || {}))) {
        console.log('No message to decrypt.');
        return resolve(this.at.DATA.tables);
      }
      from_session(mail_text).then(s_str => {
        const installed = fromB64urlQuery(s_str);
        resolve({ installed });
      }).catch(e => {
        console.error('Session decryption error');
        reject(e);
      })
    });
  }

  decryptSession(params, mail) {
    const etree = mail.data;
    const mail_text = toB64urlQuery(mail);
    const { from_master, from_session } = params;
    return new Promise((resolve, reject) => {
      if (!("ev" in (etree || {}))) {
        console.log('No message to decrypt.');
        return resolve(this.at.DATA.tables);
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
          this.at.ascii = trio.join(SEP.TS);
          const { ascii } = this.at;
          resolve({ ascii });
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
