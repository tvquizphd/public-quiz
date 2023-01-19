import { DBTrio } from "dbtrio";
import { templates } from "templates";
import { toEnv } from "environment";
//import { OP } from "opaque-low-io";
import { toMailSock,  writeText } from "io";
import { clientLogin } from "io";
//import { request } from "@octokit/request";
import { Workflow } from "workflow";
import { toHash } from "encrypt";
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

/*
async function toOpaqueSock(inputs) {
  const { opaque } = inputs;
  const Sock = await toSock(inputs, "opaque");
  await clearOpaqueClient(Sock, opaque);
  return Sock;
}
*/

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

/*
async function triggerGithubAction(data) {
  const { local, env, git } = data;
  const { session_hash, reset } = data;
  if (reset && !session_hash) {
    throw new Error("Unable to reset master.");
  }
  const options = [session_hash, ""];
  const reset_key = options[+!reset];
  const payload = { "reset-key": reset_key };
  if (local) {
    if (reset && reset_key) {
      const message = "Copy to develop.bash";
      data.modal = { message, copy: reset_key };
    }
    console.log('DEVELOPMENT: please run action locally.');
    return;
  }
  console.log('PRODUCTION: calling GitHub action.');
  try {
    await dispatch({ git, env, payload });
  }
  catch (e) {
    console.log(e?.message);
  }
}
*/

const noTemplate = () => {
  return `
    <div class="wrap-lines">
      <div class="wrap-shadow">
        Invalid environment configured.
      </div>
    </div>
  `;
}

/*
function giver (logger, op_id, tag, msg) {
  const k = this.sock.toKey(op_id, tag);
  this.sock.sendMail(k, msg);
  logger(k);
}
*/

const runReef = (dev, remote, env) => {

  const passFormId = "pass-form";
  const path = window.location.pathname;
  const host = window.location.origin;
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
    session_hash: null,
    local: dev !== null,
    dev_root: dev?.dev_root,
    dev_file: "Home.md",
    dev_handle: null,
    user_id: "root",
    pub_str: "",
    reset: false,
    modal: null,
    step: 0,
    host,
    path,
    env,
    git: {
      token: null,
      owner: remote[0],
      repo: remote[1]
    },
    loading: {...NO_LOADING},
    newRows: [...EMPTY_NEW],
    tables: [...EMPTY_TABLES]
  });
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

  const uploadDatabase = async () => {
    const { env, git, host, local } = DATA;
    const { master_key, user_key } = DATA;
    const { dbt } = API;
    const delay = 0.3333;
    const send = (text) => {
      const f = DATA.dev_handle;
      if (f) writeText(f, text);
    }
    const user_args = { 
      to_master: writeKey(master_key),
      to_session: writeKey(user_key)
    };
    DATA.loading.sending = true;
    const user_in = { git, env, local, delay, host };
    const user_sock_in = { send, user_in, key_in: user_args };
    const { Sock: UserSock } = await toMailSock(user_sock_in);
    // TODO -- make sure it works
    const encrypted = await dbt.encrypt(user_args);
    UserSock.give("mail", "table", encrypted);
    DATA.loading.sending = false;
    console.log('Sent mail.');
    UserSock.quit();
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
    const { newPass } = inputs;
    const pass = newPass || inputs.pass;
    DATA.loading.socket = true;
    const { hash: search } = window.location;
    const result = await decryptQuery(search, pass);
    const master_key = result.master_key;
    const shared = result.plain_text;
    const user_key = toBytes(shared);
    DATA.master_key = master_key;
    DATA.user_key = user_key;
    const times = 1000;
    const delay = 0.3333;
    const { dbt } = API;
    const { user_id } = DATA;
    const { env, git, host, local } = DATA;
    //await devStartWaiter({ local, delay, host });
    const send = (text) => {
      const f = DATA.dev_handle;
      if (f) writeText(f, text);
    }
    const user_args = { 
      from_master: readKey(master_key),
      from_session: readKey(user_key)
    };
    // Use user key to recieve GitHub token
    const user_in = { git, env, local, delay, host };
    const opaque_in = { send, user_id, user_in, pass, times };
    const user_sock_in = { send, user_in, key_in: user_args };
    const { Sock: UserSock } = await toMailSock(user_sock_in);
    const user = await UserSock.get("mail", "user");
    const { installed } = await dbt.decryptUser(user_args, user);
    git.token = installed.token;
    DATA.loading.socket = false;
    DATA.loading.mailer = true;
    UserSock.quit();
    // Login to recieve session key
    const token = await clientLogin(opaque_in);
    const session_key = toBytes(token);
    const session_args = { 
      from_master: readKey(master_key),
      from_session: readKey(session_key)
    };
    DATA.loading.mailer = false;
    DATA.loading.database = true;
    const session_sock_in = { send, user_in, key_in: session_args };
    const { Sock } = await toMailSock(session_sock_in);
    const mail = await Sock.get("mail", "session");
    const { ascii } = await dbt.decryptSession(session_args, mail);
    console.log({ token, ascii });
    Sock.quit();
    // TODO should use this or user_key hash?
    DATA.session_hash = await toHash(token);
    DATA.loading.database = false;
    return ["Logged in"];
    // TODO password reset
    /*
    if (typeof newPass === "string") { 
      const { token } = DATA.git;
      const to_encrypt = {
        password: newPass,
        secret_text: token
      }
      const encrypted = await encryptSecrets(to_encrypt);
      const search = toB64urlQuery(encrypted);
      const url = `${DATA.path}${search}`;
      history.pushState(null, '', url);
      const result = await decryptQuery(search, newPass);
      await uploadDatabase(result.master_key);
      const full_url = `${DATA.host}${url}`;
      const message = [
        "Updated the master password.",
        "Copy and save new login link."
      ].join(' ');
      DATA.modal = { message, copy: full_url, simple: true };
      output.push("Saved database");
    }
    return output;
    */
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
  toEnv().then((config) => {
    const { remote, env, dev_root } = config;
    const dev = [null, { dev_root }][+hasLocal];
    runReef(dev, remote, env);
  });
};
