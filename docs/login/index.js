import { Mailer } from "mailer";
import { DBTrio } from "dbtrio";
import { templates } from "templates";
import { Workflow } from "workflow";
import { toEnv } from "environment";
import { OP } from "opaque-low-io";
import { request } from "@octokit/request";
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

const dispatch = async ({ git, env }) => {
  const { owner, repo, token } = git;
  const api_url = `/repos/${owner}/${repo}/dispatches`;
  await request(`POST ${api_url}`, {
    event_type: `${env}-START`,
    headers: {
      authorization: `token ${token}`,
    }
  })
}

async function triggerGithubAction(local, env, git) {
  if (local) {
    console.log('DEVELOPMENT: please run action locally.');
    return;
  }
  console.log('PRODUCTION: calling GitHub action.');
  try {
    await dispatch({ git, env });
  }
  catch (e) {
    console.log(e?.message);
  }
}

const noTemplate = () => {
  return `
    <div class="wrap-lines">
      <div class="list-wrapper">
        Invalid environment configured.
      </div>
    </div>
  `;
}

const runReef = (hasLocal, remote, env) => {

  const passFormId = "pass-form";
  const {store, component} = window.reef;

  if (!remote || !env) {
    component(`#reef-main`, noTemplate);
    return;
  }

  let HANDLERS = [];
  const DATA = store({
    local: hasLocal,
    failure: false,
    step: 0,
    env,
    git: {
      token: null,
      owner: remote[0],
      repo: remote[1]
    },
    loading: {
      socket: false,
      mailer: false,
      database: false,
      sending: false
    },
    errors: {
      socket: [],
      mailer: [],
      database: [],
      sending: [] 
    },
    newRows: [...EMPTY_NEW],
    tables: [...EMPTY_TABLES]
  });
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
  function uploadDatabase() {
    const { mailer } = API;
    DATA.loading.sending = true;
    if (mailer instanceof Mailer) {
      mailer.send_database().then(() => {
        DATA.loading.sending = false;
        console.log('Sent mail.');
      }).catch((e) => {
        console.log('Unable to send mail.');
        console.error(e);
      })
    }
  }
  const props = { DATA, API, templates };
  const workflow = new Workflow(props);

  async function decryptWithPassword (event) {
    event.preventDefault();
    //addErrors(await outage());
    DATA.loading.socket = true;
    const { target } = event;

    const passSelect = 'input[type="password"]';
    const passField = target.querySelector(passSelect);
    const pass = passField.value;

    const { search } = window.location;
    const result = await decryptQuery(search, pass);
    DATA.git.token = result.plain_text;
    const master_key = result.master_key;
    const delay = 0.3333;
    const times = 1000;
    const { local, env, git } = DATA;
    const namespace = configureNamespace(env);
    await triggerGithubAction(local, env, git);
    const sock_inputs = { git, delay, ...namespace };
    const Sock = await toOpaqueSock(sock_inputs);
    DATA.loading.socket = false;
    DATA.loading.mailer = true;
    // Start verification
    const Opaque = await OP(Sock, sodium);
    const op = findOp(namespace.opaque, "registered");
    await Opaque.clientRegister(pass, "root", op);
    const { clientAuthenticate: authenticate } = Opaque;
    const session = await authenticate(pass, "root", times, op);
    const bytes = session.match(/../g).map(h=>parseInt(h,16));
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
    try {
      await API.mailer.read_database();
      DATA.loading.database = false;
      return "Loaded database.";
    }
    catch (e) {
      const msg = 'Master decryption error';
      DATA.loading.database = false;
      const message = e?.message;
      if (message !== msg) {
        throw e;
      }
      console.warn(message); //TODO
    }
  }

  function submitHandler (event) {
    event.preventDefault();
    if (event.target.matches(`#${passFormId}`)) {
      decryptWithPassword(event).then((done) => {
        workflow.stepNext(true);
        console.log(done)
      }).catch((e) => {
        console.error(e?.message);
        DATA.failure = true;
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
    return `<div class="main-font">${html}</div>`;
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
