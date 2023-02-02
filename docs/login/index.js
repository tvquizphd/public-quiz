import { DBTrio } from "dbtrio";
import { templates } from "templates";
import { toEnv } from "environment";
import { toB64urlQuery } from "sock-secret";
import { toSockClient } from "sock-secret";
import { toCommandTreeList } from "sock-secret";
import { toGitHubDelay, writeText } from "io";
import { toMailMapper, clientLogin } from "io";
import { encryptSecrets } from "encrypt";
import { Workflow } from "workflow";
import { toHash, textToBytes } from "encrypt";
import { encryptQueryMaster } from "encrypt";
import { decryptQueryMaster } from "decrypt";
import { decryptQuery, toBytes } from "decrypt";
/*
 * Globals needed on window object:
 *
 * reef 
 */
const EMPTY_NEW = [ [""], [""], ["","",""] ];
const EMPTY_TABLES = [ [], [], [] ];

const outage = async () => {
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
    local: dev !== null,
    last_session_string: null,
    delay: toGitHubDelay(dev !== null),
    dev_root: dev?.dev_root,
    dev_file: "dev.txt",
    dev_handle: null,
    user_id: "root",
    pub_str: "",
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
  const fromKey = (from_key) => {
    const { master_key } = DATA;
    return { 
      from_master: readKey(master_key),
      from_session: readKey(from_key)
    };
  }
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
    return await (result).text();
  }
  const toResetPreface = async (user_reset_ok) => {
    if (!user_reset_ok) return "";
    const command = "user__reset";
    const s = DATA.last_session_string;
    const argon_out = await toHash(s);
    const tree = { session_hash: textToBytes(argon_out) };
    return [{ command, tree }];
  }
  const toLocalPreface = async () => {
    const current = await (await DATA.dev_handle.getFile()).text();
    return toCommandTreeList(current);
  }
  const writeLocal = (text) => {
    const f = DATA.dev_handle;
    if (f) writeText(f, text);
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

  const readKey = (master_key) => {
    return async (search) => {
      if (search === "") return "";
      const args = { search, master_key };
      const out = await decryptQueryMaster(args);
      return out.plain_text;
    }
  }

  const uploadDatabase = async (preface) => {
    const { env, git, local, delay, user_key } = DATA;
    const { dbt } = API;
    DATA.loading.sending = true;
    const secret_out = { git, env };
    const local_out = { write: writeLocal };
    const mail_out = local ? local_out : secret_out;
    const mail_sock_in = { 
      preface, input: null, output: mail_out, delay
    };
    const sock = await toSockClient(mail_sock_in);
    const encrypted = await dbt.encrypt(toKey(user_key));
    sock.give("mail", "table", encrypted);
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
    const result = await decryptQuery(search, inputs.pass);
    const pass = inputs.newPass || inputs.pass;
    const master_key = result.master_key;
    const shared = result.plain_text;
    const user_key = toBytes(shared);
    const user = fromKey(user_key);
    DATA.master_key = master_key;
    DATA.user_key = user_key;
    const times = 1000;
    const { dbt } = API;
    const { git, local } = DATA;
    const { user_id, delay } = DATA;
    const local_in = { read: readLocal }; 
    const release_in = { git };
    const secret_out = { git, env };
    const dispatch_out = { git, key: "op" };
    const input = local ? local_in : release_in;
    const user_decrypt = dbt.decryptUser.bind(dbt, user);
    const user_mapper = toMailMapper(user_decrypt, "user");
    const mail_user = {
      mapper: user_mapper, input, output: null, delay
    };
    const UserSock = await toSockClient(mail_user);
    const installed = await UserSock.get("mail", "user");
    git.owner_token = installed.token;
    const user_reset_ok = [
      DATA.reset, pass !== inputs.pass, DATA.last_session_string
    ].every(v => v);
    DATA.loading.socket = false;
    DATA.loading.mailer = true;
    UserSock.quit();
    const preface = await toResetPreface(user_reset_ok);
    const local_out = { write: writeLocal };
    const op_out = local ? local_out : dispatch_out;
    const opaque_in = { 
      preface, input, output: op_out, user_id, pass, times, delay
    };
    // Login to recieve session key
    const session_string = await clientLogin(opaque_in);
    DATA.loading.mailer = false;
    if (user_reset_ok) {
      // Use last session as new user key 
      const s = DATA.last_session_string;
      const new_user_key = toBytes(s);
      DATA.user_key = new_user_key;
      // Update URL hash after password reset
      const to_encrypt = { password: pass, secret_text: s }
      const encrypted = await encryptSecrets(to_encrypt);
      const query = toB64urlQuery(encrypted);
      const roundtrip = await decryptQuery(query, pass);
      DATA.master_key = roundtrip.master_key;
      const url = `${DATA.href}${query}`;
      history.pushState(null, '', url);
      // Save DB after password reset
      const preface = local ? await toLocalPreface() : [];
      await uploadDatabase(preface);
      const message = [
        "Updated the master password.",
        "Copy and save new login link."
      ].join(' ');
      DATA.modal = { message, copy: url, simple: true };
      return ["Updated Master Password"];
    }
    else {
      // Read the latest database
      const session = fromKey(toBytes(session_string));
      const session_decrypt = dbt.decryptSession.bind(dbt, session);
      const session_mapper = toMailMapper(session_decrypt, "session");
      const mail_session = { 
        mapper: session_mapper, input, output: null, delay
      };
      DATA.loading.database = true;
      const Sock = await toSockClient(mail_session);
      await Sock.get("mail", "session");
      Sock.quit();
      DATA.loading.database = false;
    }
    // Update last session string
    DATA.last_session_string = session_string;
    return ["Logged in"];
  }

  function submitHandler (event) {
    event.preventDefault();
    outage().then((outages) => {
      if (outages.length < 1) {
        return;
      }
      const { body, date, fault } = outages.pop();
      const message = `${fault}: ${body} (${date})`;
      DATA.modal = { error: true, message };
      cleanRefresh();
    })
    if (event.target.matches(`#${passFormId}`)) {
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
      return uploadDatabase([]);
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
  toEnv().then((config) => {
    const { remote, env, dev_root } = config;
    const dev = [null, { dev_root }][+hasLocal];
    runReef(dev, remote, env);
    //runReef(null, remote, "PRODUCTION-LOGIN");
  });
};
