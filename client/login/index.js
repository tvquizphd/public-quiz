import { Inbox, DBTrio } from "dbtrio";
import { templates } from "templates";
import { toEnv } from "environment";
import { toB64urlQuery } from "sock-secret";
import { toSockClient } from "sock-secret";
import { toGitHubDelay, writeFile } from "io";
import { clientLogin } from "io";
import { encryptSecrets } from "encrypt";
import { Workflow } from "workflow";
import { toHash, textToBytes } from "encrypt";
import { encryptQueryMaster } from "encrypt";
import { decryptQuery, toBytes } from "decrypt";
/*
 * Globals needed on window object:
 *
 * reef 
 */
const EMPTY_NEW = [ [""], [""], ["","",""] ];
const EMPTY_TABLES = [ [], [], [] ];

const outage = async (local) => {
  if (local) return [];
  const fault = "GitHub internal outage";
  const matches = (update) => {
    return !!update?.body?.match(/actions/i);
  }
  const api_root = "https://www.githubstatus.com/api/v2";
  const api_url = api_root + "/incidents/unresolved.json";
  const { incidents } = await (await fetch(api_url)).json();
  const action_outages = incidents.filter((outage) => {
    return outage.incident_updates.some(matches)
  });
  return action_outages.map((outage) => {
    const update = outage.incident_updates.find(matches) || {};
    const body = update.body || "Unknown Actions Issue";
    const time = update.updated_at || null;
    const date = new Date(Date.parse(time));
    return { body, date, fault };
  });
}

const noTemplate = () => {
  return `
    <div class="wrap-lines">
      <div class="wrap-shadow">
        Invalid environment configured.
      </div>
    </div>
  `;
}

const runReef = (dev, remote, env) => {

  const passFormId = "pass-form";
  const host = window.location.origin;
  const href = host + window.location.pathname; 
  const {store, component} = window.reef;

  if (!remote || !env) {
    component(`#reef-main`, noTemplate);
    return;
  }

  let HANDLERS = [];
  const NO_LOADING = {
    socket: false,
    mailer: false,
    database: false,
    sending: false
  }
  const DATA = store({
    user_key: null,
    master_key: null,
    local: dev === true,
    session_key: null,
    last_session_string: null,
    delay: toGitHubDelay(dev === true),
    dev_file: "msg.txt",
    vars_file: "vars.txt",
    user_id: "root",
    reset: false,
    modal: null,
    step: 0,
    host,
    href,
    env,
    git: {
      owner_token: "",
      owner: remote[0],
      repo: remote[1]
    },
    loading: {...NO_LOADING},
    newRows: [...EMPTY_NEW],
    tables: [...EMPTY_TABLES]
  });
  const toKey = (to_key) => {
    const { master_key } = DATA;
    return { 
      to_master: writeKey(master_key),
      to_session: writeKey(to_key)
    };
  }
  const readLocal = async () => {
    const headers = {
      "Cache-Control": "no-store",
      "Pragma": "no-cache"
    };
    const pub = [DATA.host, "pub.txt"].join('/');
    const result = await fetch(pub, { headers });
    const txt = await (result).text();
    return txt;
  }
  const toResetPreface = async (pass, old) => {
    const { reset, last_session_string: s } = DATA;
    if ([ pass !== old, reset, s ].every(v => v)) {
      const s = DATA.last_session_string;
      const argon_out = await toHash(s);
      const tree = { session_hash: textToBytes(argon_out) };
      return [{ command: "user__reset", tree }];
    }
    return [];
  }
  const writeLocal = async (text) => {
    const fname = DATA.dev_file;
    await writeFile({ fname, text });
  }
  const writeLocalVars = async (text) => {
    const fname = DATA.vars_file;
    await writeFile({ fname, text });
  }
  const cleanRefresh = () => {
    DATA.loading = {...NO_LOADING};
    DATA.mailer = undefined;
    DATA.step = 0;
  }
  const API = {
    mailer: null,
    dbt: new DBTrio({ DATA })
  }

  const writeKey = (master_key) => {
    return async (plain_text) => {
      const args = { plain_text, master_key };
      return await encryptQueryMaster(args);
    }
  }

  const toOutboxSockIn = ({ local, git, delay, env }) => {
    const secret_out = { git, env };
    const local_out = { write: writeLocalVars };
    const output = local ? local_out : secret_out;
    return { input: null, output, delay };
  }

  const toInboxSockIn = ({ local, inbox, git, delay }) => {
    const { mapper } = inbox;
    const local_in = { read: readLocal }; 
    const input = local ? local_in : { git };
    return { mapper, input, output: null, delay }
  }

  const toOpaqueSockIn = ({ local, git, delay, ...rest }) => {
    const dispatch_out = { git, key: "op" };
    const local_out = { write: writeLocal };
    const local_in = { read: readLocal }; 
    const input = local ? local_in : { git };
    const output = local ? local_out : dispatch_out;
    return { input, output, delay, times: 1000, ...rest };
  }

  const uploadDatabase = async () => {
    DATA.loading.sending = true;
    const { local, git, delay, env } = DATA;
    const sock = await toSockClient(toOutboxSockIn({
      local, git, delay, env
    }));
    const out_key = toKey(DATA.session_key);
    const encrypted = await API.dbt.encrypt(out_key);
    await sock.give("MAIL", "TABLE", encrypted);
    DATA.loading.sending = false;
    console.log('Sent mail.');
    sock.quit();
  }

  const props = { DATA, API, templates };
  const workflow = new Workflow(props);

  const usePasswords = ({ target }) => {
    const passSelect = 'input[type="password"]';
    const passFields = target.querySelectorAll(passSelect);
    const newPass = [...passFields].find((el) => {
      return el.autocomplete === "new-password";
    })?.value;
    const pass = [...passFields].find((el) => {
      return el.autocomplete === "current-password";
    })?.value;
    return { pass, newPass };
  }

  async function decryptWithPassword(inputs) {
    DATA.loading.socket = true;
    const { hash: search } = window.location;
    const pass = inputs.newPass || inputs.pass;
    const result = await decryptQuery(search, inputs.pass);
    DATA.user_key = toBytes(result.plain_text);
    DATA.master_key = result.master_key;
    const inbox = new Inbox(DATA, API);
    inbox.allow('user', DATA.user_key);
    const { local, git, delay, user_id } = DATA;
    const sock = await toSockClient(toInboxSockIn({ 
      local, inbox, git, delay
    }));
    const installed = await sock.get("mail", "user");
    git.owner_token = installed.token;
    sock.update(toInboxSockIn({ 
      local, inbox, git, delay
    }));
    DATA.loading.socket = false;
    DATA.loading.mailer = true;
    const preface = await toResetPreface(pass, inputs.pass);
    const session_string = await clientLogin(toOpaqueSockIn({
      local, git, delay, preface, pass, user_id
    }));
    DATA.session_key = toBytes(session_string);
    if (preface.length > 0) {
      // Use last session as new user key 
      const { last_session_string: s } = DATA;
      DATA.user_key = toBytes(s);
      // Update URL hash after password reset
      const to_encrypt = { password: pass, secret_text: s }
      const encrypted = await encryptSecrets(to_encrypt);
      const query = toB64urlQuery(encrypted);
      const roundtrip = await decryptQuery(query, pass);
      DATA.master_key = roundtrip.master_key;
      // Await for login-close to finish by checking mail
      inbox.ignore('user');
      await sock.get("mail", "session");
      const url = `${DATA.href}${query}`;
      history.pushState(null, '', url);
      // Save DB after password reset
      await uploadDatabase();
      const message = [
        "Updated the master password.",
        "Copy and save new login link."
      ].join(' ');
      DATA.modal = { message, copy: url, simple: true };
      DATA.loading.mailer = false;
      DATA.reset = false;
      return ["Updated Master Password"];
    }
    else {
      // Read the latest database
      DATA.loading.mailer = false;
      DATA.loading.database = true;
      inbox.allow('session', DATA.session_key);
      await sock.get("mail", "session");
      DATA.loading.database = false;
    }
    sock.quit();
    // Update last session string
    DATA.last_session_string = session_string;
    return ["Logged in"];
  }

  function submitHandler (event) {
    event.preventDefault();
    if (event.target.matches(`#${passFormId}`)) {
      outage(DATA.local).then((outages) => {
        if (outages.length < 1) {
          return;
        }
        const { body, date, fault } = outages.pop();
        const message = `${fault}: ${body} (${date})`;
        DATA.modal = { error: true, message };
        cleanRefresh();
      });
      const passwords = usePasswords(event);
      decryptWithPassword(passwords).then((done) => {
        console.log(done.join("\n"));
        workflow.stepNext(true);
      }).catch((e) => {
        console.error(e);
        DATA.modal = {
          error: true,
          message: "Unable to authenticate"
        }
        cleanRefresh();
      });
    }
  }

  // Handle all click events
  function clickHandler (event) {
    for (const handler of HANDLERS) {
      if (event.target.id === handler.id) {
        return handler.fn(event);
      }
    }
    if (event.target.closest('.send-mail')) {
      return uploadDatabase();
    }
  }

  function appTemplate () {
    const { html, handlers } = workflow.render;
    HANDLERS = handlers;
    return `<div class="container">
      <div class="contained">${html}</div>
    </div>`;
  }

  // Create reactive component
  component(`#reef-main`, appTemplate);
  document.addEventListener('submit', submitHandler);
  document.addEventListener('click', clickHandler);
}

export default () => {
  const { hostname } = window.location;
  const hasLocal = hostname === "localhost";
  toEnv('../').then((config) => {
    const { remote, env } = config;
    runReef(hasLocal, remote, env);
    //runReef(null, remote, "INTEGRATION-TEST");
    //runReef(null, remote, "PRODUCTION-LOGIN");
  });
};
