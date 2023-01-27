import { 
  toPub, toSharedCache, toServerAuthCache, toAppPublic
} from "pub";
import { toSockClient } from "sock-secret";
import { toB64urlQuery } from "sock-secret";
import { toSyncOp, clientLogin,  writeText, toGitHubDelay } from "io";
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

const parseSearch = (state, { search }) => {
  const entries = (new URLSearchParams(search)).entries();
  const out = Object.fromEntries(entries);
  if (out.state && out.state !== state) {
    throw new Error('Invalid verification state');
  }
  return { ...out, state };
}

const useSearch = async (search, app_manifest) => {
  const needs_1 = [
    typeof search?.state === "string",
    typeof search?.code === "string",
  ]
  if (needs_1.every(v => v) && toSharedCache()) {
    const pub_str = await toAppPublic(search.code);
    return { first: 1, pub_str, app_str: "" };
  }
  const app_val = JSON.stringify(app_manifest);
  const app_root = `https://github.com/settings/apps/new?`;
  const app_str = app_root + (new URLSearchParams({
    state: search.state,
    manifest: app_val,
  })).toString();
  toSharedCache("");
  return { first: 0, app_str, pub_str: "" };
}

const runReef = (dev, remote, env) => {

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
    Au: null, //TODO
    local: dev !== null,
    delay: toGitHubDelay(dev !== null),
    dev_root: dev?.dev_root,
    dev_file: "dev.txt",
    user_id: "root",
    dev_handle: null,
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
      owner_token: null,
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
    return (await (result).text()).replaceAll('\n', '');
  }
  const writeLocal = (text) => {
    const f = DATA.dev_handle;
    if (f) writeText(f, text);
  }
  const readSearch = async () => {
    const search = parseSearch(toPub(), window.location);
    const opts = await useSearch(search, MANIFEST);
    const { first, app_str, pub_str } = opts;
    DATA.app_str = app_str;
    DATA.pub_str = pub_str;
    DATA.step = first;
    return first;
  }
  const props = { DATA, templates };
  const workflow = new Workflow(props);
  const final_step = workflow.paths.length - 1;
  const mailerStart = async (first_step) => {
    const local_in = { read: readLocal }; 
    const { user_id, git, local, delay } = DATA;
    const input = local ? local_in : { git };
    const pub_sock = {
      input, output: null, delay
    }
    const PubSock = await toSockClient(pub_sock);
    if (first_step === 0) {
      const Opaque = await toSyncOp();
      const { toServerPepper, toServerSecret } = Opaque;
      const appi = await PubSock.get("app", "in");
      const { client_auth_data } = appi;
      const { pw } = client_auth_data;
      const pepper_in = { user_id, pw };
      const { pepper } = toServerPepper(pepper_in);
      const out = toServerSecret({ pepper, client_auth_data });
      toServerAuthCache(out.server_auth_data);
      toSharedCache(out.token);
      await readSearch();
    }
    await PubSock.get("app", "out").then(appo => {
      const { client_auth_result } = appo;
      DATA.Au = client_auth_result.Au;
    });
    await PubSock.get("app", "auth").then(appa => {
      const enc_str = toB64urlQuery(appa);
      const shared = toSharedCache();
      PubSock.quit();
      if (!shared) return cleanRefresh();
      decryptQuery(enc_str, shared).then(token => {
        DATA.git.owner_token = token.plain_text;
        DATA.step = final_step - 1;
      }).catch((e) => {
        console.error(e.message);
      });
    });
  }
  const cleanRefresh = () => {
    DATA.loading = { ...NO_LOADING };
    readSearch().then((first_step) => {
      console.log({ first_step }); //TODO
      mailerStart(first_step);
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
    if (!git?.owner_token) {
      throw new Error("Missing GitHub Token.");
    }
    const times = 1000;
    const local_in = { read: readLocal }; 
    const local_out = { write: writeLocal };
    const input = local ? local_in : { git };
    const op_out = local ? local_out : { git, key: "op" };
    await clientLogin({ input, output: op_out, user_id, pass, times, delay });
    DATA.loading.finish = false;
    const to_encrypt = {
      password: pass,
      secret_text: toSharedCache(),
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
        DATA.login = `${DATA.host}/login${query}`;
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
  toEnv().then((config) => {
    const { remote, env, dev_root } = config;
    const dev = [null, { dev_root }][+hasLocal];
    runReef(dev, remote, env);
  });
};
