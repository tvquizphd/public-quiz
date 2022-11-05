import { 
  toPub, toShared, toServerAuth,
  toInstallPublic, toAppPublic
} from "pub";
import { toB64urlQuery } from "project-sock";
import { WikiMailer } from "wiki";
import { encryptSecrets } from "encrypt";
import { decryptQuery } from "decrypt";
import { templates } from "templates";
import { Workflow } from "workflow";
import { toEnv } from "environment";
import { configureNamespace } from "sock";
import { findOp, toSock } from "finders";
import { OP } from "opaque-low-io";

/*
 * Globals needed on window object:
 *
 * reef 
 */

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

async function toUserSock(inputs) {
  const { git, env, delay } = inputs;
  const namespace = configureNamespace(env);
  return await toOpaqueSock({ git, delay, namespace });
}

const toSyncOp = async () => {
  const Sock = {
    get: async () => null,
    give: () => undefined
  }
  return await OP(Sock);
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
  logger(k, msg);
}

const parseSearch = (state, { search }) => {
  const entries = (new URLSearchParams(search)).entries();
  const out = Object.fromEntries(entries);
  if (out.state && out.state !== state) {
    throw new Error('Invalid verification state');
  }
  return { ...out, state };
}

const goodInfo = async (search, app_manifest) => {
  const needs_1 = [
    typeof search?.state === "string",
    typeof search?.code === "string",
  ]
  const needs_3 = needs_1.concat([
    search?.setup_action === "install",
    typeof search?.installation_id === "string",
  ]);
  if (needs_3.every(v => v)) {
    const pub_str = await toInstallPublic(search.code);
    return { first: 3, pub_str, app_str: "" };
  }
  if (needs_1.every(v => v)) {
    const pub_str = await toAppPublic(search.code);
    return { first: 1, pub_str, app_str: "" };
  }
  const app_val = JSON.stringify(app_manifest);
  const app_root = `https://github.com/settings/apps/new?`;
  const app_str = app_root + (new URLSearchParams({
    state: search.state,
    manifest: app_val,
  })).toString();
  return { first: 0, app_str, pub_str: "" };
}

const runReef = (hasLocal, remote, env) => {

  const passFormId = "pass-form";
  const href = window.location.href;
  const host = window.location.origin;
  const {store, component} = window.reef;

  if (!remote || !env) {
    component(`#reef-main`, noTemplate);
    return;
  }

  let HANDLERS = [];
  const NO_LOADING = {
    socket: false,
    finish: false
  }
  const app_name = `QUIZ-${env}`;
  const MANIFEST = {
   "url": href,
   "name": app_name,
   "redirect_url": href,
   "callback_urls": [href],
   "public": true,
   "default_permissions": {
     "administration": "write"
   }
  }
  const DATA = store({
    app_name,
    pub_str: "",
    app_str: "",
    Au: null, //TODO
    local: hasLocal,
    unchecked: true,
    reset: false,
    login: null,
    modal: null,
    step: 0,
    host,
    env,
    git: {
      token: null,
      owner: remote[0],
      repo: remote[1]
    },
    remote: remote.join('/'),
    loading: { ...NO_LOADING },
    wiki_ext: ""
  });
  const readSearch = () => {
    const search = parseSearch(toPub(), window.location);
    goodInfo(search, MANIFEST).then((good) => {
      const { first, app_str, pub_str } = good;
      DATA.app_str = app_str;
      DATA.pub_str = pub_str;
      DATA.step = first;
    });
  }
  const wikiMailer = new WikiMailer(host);
  const cleanRefresh = () => {
    DATA.loading = { ...NO_LOADING };
    wikiMailer.finish();
    readSearch();
  }
  readSearch();
  const props = { DATA, templates };
  const workflow = new Workflow(props);
  const final_step = workflow.paths.length - 1;

  function mailerStart () {
    wikiMailer.start();
    wikiMailer.addHandler('app', async (pasted) => {
      const Opaque = await toSyncOp();
      const { toServerPepper, toServerSecret } = Opaque;
      const { client_auth_data, register } = pasted;
      const { pepper } = toServerPepper(register);
      const out = toServerSecret({ pepper, client_auth_data});
      const { server_auth_data } = out;
      toServerAuth(server_auth_data);
      toShared(out.token);
    });
    wikiMailer.addHandler('install', (pasted) => {
      const { Au } = pasted.client_auth_result; 
      DATA.Au = Au; // TODO
    });
    wikiMailer.addHandler('auth', (pasted) => {
      const shared = toShared();
      if (!shared) return cleanRefresh();
      const token = decryptQuery(pasted, shared);
      DATA.git.token = token;
      DATA.step = final_step;
      wikiMailer.finish();
    });
  }
  mailerStart();

  const usePasswords = ({ target }) => {
    const passSelect = 'input[type="password"]';
    const passFields = target.querySelectorAll(passSelect);
    const pass = [...passFields].find((el) => {
      return el.autocomplete === "current-password";
    })?.value;
    return { pass };
  }

  async function encryptWithPassword ({ pass }) {
    DATA.loading.socket = true;
    const { git, env } = DATA;
    if (!git?.token) {
      throw new Error("Missing GitHub Token.");
    }
    const delay = 0.3333;
    const namespace = configureNamespace(env);
    const Sock = await toUserSock({ git, env, delay });
    Sock.give = giver.bind(Sock, (k, msg) => {
      const reg_k = k.match(/register$/);
      const reg_x = ArrayBuffer.isView(msg?.pw);
      if (reg_k & reg_x) {
        DATA.loading.socket = false;
        DATA.loading.finish = true;
      }
    });
    // Start verification
    const Opaque = await OP(Sock);
    const op = findOp(namespace.opaque, "registered");
    await Opaque.clientRegister(pass, "root", op);
    Sock.sock.project.done = true;
    DATA.loading.finish = false;
    const to_encrypt = {
      password: pass,
      secret_text: toShared(),
    }
    return await encryptSecrets(to_encrypt);
  }

  function outageCheck () {
    outage().then((outages) => {
      DATA.unchecked = false;
      if (outages.length < 1) {
        return;
      }
      const { body, date, fault } = outages.pop();
      const message = `${fault}: ${body} (${date})`;
      DATA.modal = { error: true, message };
      cleanRefresh();
    });
  }

  // Handle all click events
  function clickHandler (event) {
    if (DATA.unchecked) outageCheck();
    for (const handler of HANDLERS) {
      if (event.target.closest(handler.query)) {
        return handler.fn(event);
      }
    }
  }

  function submitHandler (event) {
    if (DATA.unchecked) outageCheck();
    if (event.target.matches(`#${passFormId}`)) {
      event.preventDefault();
      const passwords = usePasswords(event);
      encryptWithPassword(passwords).then((encrypted) => {
        const query = toB64urlQuery(encrypted);
        DATA.login = `${DATA.host}/login${query}`;
      }).catch(() => {
        DATA.modal = {
          error: true,
          message: "Unable to register"
        }
        cleanRefresh();
      });
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
