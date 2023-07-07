import { 
  toPub, clearSharedCache, toSharedCache, toAppPublic
} from "pub";
import { OP } from "opaque-low-io";
import { toSockServer, toSockClient } from "sock-secret";
import { toB64urlQuery } from "sock-secret";
import { toSyncOp, clientLogin } from "io";
import { toGitHubDelay, writeFile } from "io";
import { encryptSecrets } from "encrypt";
import { decryptQuery } from "decrypt";
import { templates } from "templates";
import { toEnv } from "environment";
import { Workflow } from "workflow";

/*
 * Globals needed on window object:
 *
 * reef 
 */

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

const parseSearch = (state, { search }) => {
  const entries = (new URLSearchParams(search)).entries();
  const out = Object.fromEntries(entries);
  if (out.state && out.state !== state) {
    throw new Error('Invalid verification state');
  }
  return { ...out, state };
}

const useSearch = (local) => {
  const search = parseSearch(toPub(), window.location);
  const needs_1 = [
    typeof search?.state === "string",
    typeof search?.code === "string",
    toSharedCache()
  ]
  const { state } = search;
  if (needs_1.every(v => v)) {
    const { code } = search;
    const first = local ? 2 : 1;
    return { first, state, code };
  }
  clearSharedCache();
  return { first: 0, state, code: null };
}

const verifyServer = async (appo) => {
  const tmp_cmd = "op:pake__client_auth_result";
  const inputs = [{ command: tmp_cmd, tree: appo }];
  const tmp_sock = await toSockServer({ inputs });
  const tmp_op = await OP(tmp_sock);
  const cached = toSharedCache();
  try {
    return (await tmp_op.serverStep(cached, 'op')).token;
  }
  catch {
    throw new Error('Can\'t verify server!');
  }
}

const runReef = (dev, version, remote, env) => {

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
  const app_name = `${env}`;
  const MANIFEST = {
   "url": href,
   "name": app_name,
   "redirect_url": href,
   "callback_urls": [href],
   "public": true,
   "default_permissions": {
     "actions": "read",
     "secrets": "write",
     "contents": "write",
     "environments": "write"
   }
  };
  const DATA = store({
    app_name,
    pub_str: "",
    app_str: "",
    local: dev === true,
    version: version || null,
    delay: toGitHubDelay(dev === true),
    dev_file: "msg.txt",
    user_id: "root",
    unchecked: true,
    copied: false,
    reset: false,
    lock: false,
    login: null,
    modal: null,
    step: 0,
    host,
    env,
    git: {
      owner_token: "",
      owner: remote[0],
      repo: remote[1]
    },
    remote: remote.join('/'),
    loading: { ...NO_LOADING }
  });
  const readLocal = async () => {
    const headers = {
      "Cache-Control": "no-store",
      "Pragma": "no-cache"
    };
    const pub = [DATA.host, "pub.txt"].join('/');
    const result = await fetch(pub, { headers });
    return await (result).text();
  }
  const writeLocal = async (text) => {
    const fname = DATA.dev_file;
    await writeFile({ fname, text });
  }
  const readSearch = async () => {
    const { first, state } = useSearch(DATA.local);
    const manifest = JSON.stringify(MANIFEST);
    const app_root = `https://github.com/settings/apps/new?`;
    if (state) {
      const q = new URLSearchParams({ state, manifest });
      const app_str = app_root + q.toString();
      DATA.app_str = app_str;
    }
    DATA.step = first;
    return { first };
  }
  const props = { DATA, templates };
  const workflow = new Workflow(props);
  const final_step = workflow.paths.length - 1;
  const mailerStart = async (first_step) => {
    const local_in = { read: readLocal }; 
    const { user_id, git, local, delay } = DATA;
    const input = local ? local_in : { git };
    const pub_sock = { input, output: null, delay };
    const sock = await toSockClient(pub_sock);
    if (first_step === 0) {
      const Opaque = await toSyncOp();
      const { toServerPepper, toServerSecret } = Opaque;
      const appi = await sock.get("app", "in");
      const { client_auth_data } = appi;
      const { pw } = client_auth_data;
      const pepper_in = { user_id, pw };
      const { pepper } = toServerPepper(pepper_in);
      const out = toServerSecret({ pepper, client_auth_data });
      toSharedCache(out);
      DATA.step = useSearch(DATA.local).first;
    }
    const { code } = useSearch(DATA.local);
    DATA.pub_str = await toAppPublic(code);
    if (DATA.local) {
      await writeLocal(DATA.pub_str);
    }
    const appo = await sock.get("app", "out");
    const shared = await verifyServer(appo);
    const appa = await sock.get("app", "auth")
    const enc_str = toB64urlQuery(appa);
    sock.quit();
    try {
      const token = await decryptQuery(enc_str, shared)
      DATA.git.owner_token = token.plain_text;
      DATA.step = final_step - 1;
    }
    catch (e) {
      throw new Error(e.message);
    }
  }
  const cleanRefresh = () => {
    DATA.loading = { ...NO_LOADING };
    readSearch().then(({ first }) => {
      mailerStart(first);
    }).catch(({ message }) => {
      DATA.modal = { error: true, message };
    });
  }
  cleanRefresh();

  const usePasswords = ({ target }) => {
    const passSelect = 'input[type="password"]';
    const passFields = target.querySelectorAll(passSelect);
    const pass = [...passFields].find((el) => {
      return el.autocomplete === "current-password";
    })?.value;
    return { pass };
  }

  async function encryptWithPassword ({ pass }) {
    const { git, user_id, local, delay } = DATA;
    DATA.loading.socket = true;
    if (git.owner_token === "") {
      throw new Error("Missing GitHub Token.");
    }
    const times = 1000;
    const local_in = { read: readLocal }; 
    const local_out = { write: writeLocal };
    const input = local ? local_in : { git };
    const op_out = local ? local_out : { git, key: "op" };
    await clientLogin({
      register: true, input, output: op_out, user_id, pass, times, delay
    });
    const { token: secret_text } = toSharedCache();
    DATA.loading.finish = false;
    const to_encrypt = {
      password: pass,
      secret_text
    }
    return await encryptSecrets(to_encrypt);
  }

  function outageCheck () {
    outage(DATA.local).then((outages) => {
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
      if (DATA.lock) continue;
      if (event.target.closest(handler.query)) {
        handler.fn(event).finally(() => {
          DATA.lock = false;
        });
        DATA.lock = true;
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
        DATA.login = `${DATA.host}/login/${query}`;
        DATA.step = final_step;
      }).catch((e) => {
        console.error(e);
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
  toEnv('./').then((config) => {
    const { version, remote, env } = config;
    runReef(hasLocal, version, remote, env);
    //runReef(null, null, remote, "INTEGRATION-TEST");
    //runReef(null, null, remote, "PRODUCTION-LOGIN");
  });
};
