import { 
  fromB64urlQuery, toB64urlQuery 
} from "project-sock";
import { DBTrio } from "dbtrio";
import { findSub, opId } from "finders";
import { decryptQueryMaster } from "decrypt";
import { encryptQueryMaster } from "encrypt";

const waiter = (n, delay, check_status) => {
  const tries = [...new Array(n + 1).keys()];
  return tries.reduce((o, i) => {
    if (i === n) {
      return o.then(v => v);
    }
    if (check_status()) {
      return Promise.resolve(true);
    }
    return o.then(() => {
      return new Promise((resolve) => {
        const v = check_status();
        setTimeout(resolve, delay * 1000, v);
      });
    });
  }, Promise.resolve(false));
}

class Mailer {
  constructor(inputs) {
    this.mailbox = inputs.mailbox;
    this.sk = inputs.session_key;
    this.mk = inputs.master_key;
    this.delay = inputs.delay;
    this.mbs = inputs.mbs;
    this.DATA = inputs.DATA;
    const { DATA } = inputs; 
    this.dbt = new DBTrio({ DATA });
    const { project } = this.mbs.sock;
    const check_stop = (p) => p.done;
    const check_start = (p) => !p.done;
    const set_stop = (p, now=false) => {
      p.call_fifo = [
        ...(now ? [] : p.call_fifo),
        async () => p.done = true
      ];
    }
    const set_start = (p) => {
      p.waitMap = new Map();
      p.call_fifo = [];
      p.done = false;
      p.mainLoop();
    }
    this.set_stop = set_stop.bind(null, project);
    this.set_start = set_start.bind(null, project);
    this.check_stop = check_stop.bind(null, project);
    this.check_start = check_start.bind(null, project);
  }

  async to_master_search(plain_text) {
    const args = { plain_text, master_key: this.mk };
    return await encryptQueryMaster(args);
  }
  async from_master_search(search) {
    if (search === "") {
      return "";
    }
    const args = { search, master_key: this.mk };
    return (await decryptQueryMaster(args)).plain_text;
  }
  async to_session_search(plain_text) {
    const args = { plain_text, master_key: this.sk };
    const search = await encryptQueryMaster(args);
    return fromB64urlQuery(search).data;
  }
  async from_session_search(data) {
    const search = toB64urlQuery({ data });
    const args = { search, master_key: this.sk };
    return (await decryptQueryMaster(args)).plain_text;
  }
  get to_session() {
    return this.to_session_search.bind(this);
  }
  get to_master() {
    return this.to_master_search.bind(this);
  }
  get from_master() {
    return this.from_master_search.bind(this);
  }
  get from_session() {
    return this.from_session_search.bind(this);
  }

  stop(now, tries) {
    if (this.check_stop()) {
      return Promise.resolve(true);
    }
    this.set_stop(now);
    const wait = waiter(tries, this.delay, this.check_stop);
    return new Promise((resolve, reject) => {
      wait.then((v) => {
        if (v) {
          resolve(v);
        }
        const e = new Error('Unable to stop socket');
        reject(e);
      });
    });
  }

  async restart(now, tries) {
    await this.stop(now, tries);
    this.set_start();
  }

  async read_database() {
    const message = await this.read_mail();
    await this.stop(false, 5);
    const { dbt, from_master, from_session } = this;
    const d_args = { from_master, from_session };
    await dbt.decrypt(d_args, message);
    return this.DATA.tables;
  }

  async read_mail() {
    const sub = "from_secret";
    const { mbs, mailbox } = this;
    const { subcommand } = findSub(mailbox, sub);
    const op_id = opId(mailbox, subcommand);
    return await mbs.get(op_id, subcommand);
  }

  async send_database() {
    const { dbt, to_master, to_session } = this;
    const e_args = { to_master, to_session };
    const message = await dbt.encrypt(e_args);
    await this.restart(true, 5);
    await this.send_mail(message);
    await this.stop(false, 5);
  }

  async send_mail(mail) {
    const sub = "to_secret";
    const { mbs, mailbox } = this;
    mbs.give(opId(mailbox, sub), sub, mail);
  }

}

export { Mailer };
