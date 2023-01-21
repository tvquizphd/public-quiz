import { 
  toPub, toShared, toServerAuth, toAppPublic
} from "pub";
import { toB64urlQuery } from "sock-secret";
import { toSyncOp, clientLogin,  writeText } from "io";
import { WikiMailer } from "wiki";
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
  if (needs_1.every(v => v) && toShared()) {
    const pub_str = await toAppPublic(search.code);
    return { first: 1, pub_str, app_str: "" };
  }
  const app_val = JSON.stringify(app_manifest);
  const app_root = `https://github.com/settings/apps/new?`;
  const app_str = app_root + (new URLSearchParams({
    state: search.state,
    manifest: app_val,
  })).toString();
  toShared("");
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
     "environments": "write",
     "secrets": "write"
   }
  };
  const DATA = store({
    app_name,
    pub_str: "",
    app_str: "",
    Au: null, //TODO
    local: dev !== null,
    dev_root: dev?.dev_root,
    dev_file: "Home.md",
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
      token: null,
      owner: remote[0],
      repo: remote[1]
    },
    remote: remote.join('/'),
    loading: { ...NO_LOADING }
  });
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
  const wiki_props = { 
    host, git: DATA.git, local: DATA.local
  };
  const wikiMailer = new WikiMailer(wiki_props);
  const mailerStart = (first_step) => {
    wikiMailer.start();
    const { user_id } = DATA;
    if (first_step === 0) {
      wikiMailer.addHandler('app', async (pasted) => {
        const Opaque = await toSyncOp();
        const { toServerPepper, toServerSecret } = Opaque;
        const { client_auth_data } = pasted;
        const { pw } = client_auth_data;
        const { pepper } = toServerPepper({ user_id, pw });
        const out = toServerSecret({ pepper, client_auth_data });
        const { server_auth_data } = out;
        toServerAuth(server_auth_data);
        toShared(out.token);
        await readSearch();
      });
    }
    wikiMailer.addHandler('install', async (pasted) => {
      const { Au } = pasted.client_auth_result; 
      DATA.Au = Au; // TODO
    });
    wikiMailer.addHandler('auth', async (pasted) => {
      const shared = toShared();
      const { encrypted } = pasted;
      if (!shared) return cleanRefresh();
      const token = await decryptQuery(encrypted, shared);
      DATA.git.token = token.plain_text;
      DATA.step = final_step - 1;
      wikiMailer.finish();
    });
  }
  const cleanRefresh = () => {
    wikiMailer.finish();
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
    const { git, env, user_id, local, host } = DATA;
    DATA.loading.socket = true;
    if (!git?.token) {
      throw new Error("Missing GitHub Token.");
    }
    const times = 1000;
    const delay = 2.0;
    const send = (text) => {
      const f = DATA.dev_handle;
      if (f) writeText(f, text);
    }
    const user_in = { git, env, local, delay, host };
    await clientLogin({ user_id, user_in, pass, times, send });
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
  //const hasLocal = false; //TODO
  toEnv().then((config) => {
    const { remote, env, dev_root } = config;
    const dev = [null, { dev_root }][+hasLocal];
    runReef(dev, remote, env);
  });
};
