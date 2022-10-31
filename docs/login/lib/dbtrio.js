import { SEP, AsciiTables } from "ascii";

class DBTrio {

  constructor(params) {
    const { DATA } = params;
    this.at = new AsciiTables({ DATA });
  }

  get trio() {
    return this.at.ascii.split(SEP.TS);
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
