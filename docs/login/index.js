import { Mailer } from "mailer";
import { DBTrio } from "dbtrio";

import { templates } from "templates";
import { Workflow } from "workflow";
import { toEnv } from "environment";
import { OP } from "opaque-low-io";
import { request } from "@octokit/request";
import { toB64urlQuery } from "project-sock";
import { toHash, encryptSecrets } from "encrypt";
import sodium from "libsodium-wrappers-sumo";
import { configureNamespace } from "sock";
import { findOp, toSock } from "finders";
import { decryptQuery } from "decrypt";
/*
 * Globals needed on window object:
 *
 * reef 
 */
const EMPTY_NEW = [ [""], [""], ["","",""] ];
const EMPTY_TABLES = [ [], [], [] ];

const clearOpaqueClient = (Sock, { commands }) => {
  const client_subs = ['register'];
  const toClear = commands.filter((cmd) => {
    return client_subs.includes(cmd.subcommand);
  });
  return Sock.sock.project.clear({ commands: toClear });
}

async function toOpaqueSock(inputs) {
  const { opaque } = inputs;
  const Sock = await toSock(inputs, "opaque");
  await clearOpaqueClient(Sock, opaque);
  return Sock;
}

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

const dispatch = async ({ git, env, payload }) => {
  const { owner, repo, token } = git;
  const api_url = `/repos/${owner}/${repo}/dispatches`;
  await request(`POST ${api_url}`, {
    event_type: `${env}-START`,
    client_payload: payload,
    headers: {
      authorization: `token ${token}`,
    }
  })
}

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

const noTemplate = () => {
  return `
    <div class="wrap-lines">
      <div class="wrap-shadow">
        Invalid environment configured.
      </div>
    </div>
  `;
}

function giver (logger, op_id, tag, msg) {
  const k = this.sock.toKey(op_id, tag);
  this.sock.sendMail(k, msg);
  logger(k);
}

const runReef = (hasLocal, remote, env) => {

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
    session_hash: null,
    local: hasLocal,
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
    focus: null,
    get dbt() {
      const { mailer } = API;
      if (mailer instanceof Mailer) {
        return mailer.dbt;
      }
      return new DBTrio({ DATA });
    }
  }
  function uploadDatabase(mk) {
    const { mailer } = API;
    DATA.loading.sending = true;
    if (mailer instanceof Mailer) {
      if (ArrayBuffer.isView(mk)) {
        mailer.mk = mk;
      }
      return mailer.send_database().then(() => {
        DATA.loading.sending = false;
        console.log('Sent mail.');
      }).catch((e) => {
        console.error(e);
      });
    }
    return Promise.reject("Unable to send mail.");
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

  async function decryptWithPassword({pass, newPass}) {
    const rootPass = newPass ? newPass : pass;
    DATA.loading.socket = true;
    const { search } = window.location;
    const result = await decryptQuery(search, pass);
    DATA.git.token = result.plain_text;
    const master_key = result.master_key;
    const delay = 0.3333;
    const times = 1000;
    const { env, git } = DATA;
    const namespace = configureNamespace(env);
    await triggerGithubAction(DATA);
    const sock_inputs = { git, delay, ...namespace };
    const Sock = await toOpaqueSock(sock_inputs);
    Sock.give = giver.bind(Sock, (k) => {
      if (k.match(/auth_data$/)) {
        DATA.loading.socket = false;
        DATA.loading.mailer = true;
      }
    });
    // Start verification
    const Opaque = await OP(Sock, sodium);
    const op = findOp(namespace.opaque, "registered");
    await Opaque.clientRegister(rootPass, "root", op);
    const { clientAuthenticate: authenticate } = Opaque;
    const session = await authenticate(rootPass, "root", times, op);
    const bytes = session.match(/../g).map(h=>parseInt(h,16));
    DATA.session_hash = await toHash(session);
    const session_key = new Uint8Array(bytes);
    Sock.sock.project.done = true;
    // Recieve mail from mailbox
    const mbs = await toSock(sock_inputs, "mailbox");
    const m_input = { 
      mailbox: namespace.mailbox,
      session_key,
      master_key,
      delay,
      DATA,
      mbs
    }
    DATA.loading.mailer = false;
    DATA.loading.database = true;
    API.mailer = new Mailer(m_input);
    const output = [];
    try {
      await API.mailer.read_database();
      DATA.loading.database = false;
      output.push("Loaded database");
    }
    catch (e) {
      const msg = 'Master decryption error';
      DATA.loading.database = false;
      const message = e?.message;
      if (message !== msg) {
        throw e;
      }
      console.warn(message); //TODO
      return;
    }
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
  toEnv().then(({ remote, env }) => {
    runReef(hasLocal, remote, env);
  });
};
