import { 
  fromB64urlQuery, toB64urlQuery 
} from "project-sock";
import * as eccrypto from "eccrypto/browser";
import { WikiMailer } from "./scripts/wiki.js";
import { decryptQueryMaster } from "./scripts/decrypt.js";
import { encryptSecrets } from "./scripts/encrypt.js";
import { toEnv } from "../config/environment.js";
import { configureNamespace } from "./config/sock.js";
import { findOp, toSock } from "./scripts/finders.js";
import sodium from "libsodium-wrappers-sumo";
import { OP } from "opaque-low-io";
import { Buffer } from "buffer"
/*
 * Globals needed on window object:
 *
 * reef 
 */

const toPrivate = () => {
  const LOCAL_KEY = "private-session-key";
  const old_priv_str = sessionStorage.getItem(LOCAL_KEY);
  if (old_priv_str) {
    return fromB64urlQuery(old_priv_str).priv;
  }
  const priv = new Uint8Array(eccrypto.generatePrivate());
  sessionStorage.setItem(LOCAL_KEY, toB64urlQuery({ priv }));
  return priv;
}

const toKeyPair = () => {
  const priv = toPrivate();
  const b_priv = Buffer.from(priv);
  const b_pub = eccrypto.getPublic(b_priv);
  const pub = new Uint8Array(b_pub);
  return { priv, pub };
}

const derive = async (priv, pub) => {
  const b_priv = Buffer.from(priv);
  const b_pub = Buffer.from(pub);
  const b_key = eccrypto.derive(b_priv, b_pub);
  return new Uint8Array(await b_key);
}

const decryptPublic = async (inputs) => {
  const { pub, priv, data } = inputs;
  const master_key = await derive(priv, pub);
  const search = toB64urlQuery({ data });
  try {
    const decrypted = await decryptQueryMaster({
      master_key, search 
    });
    return decrypted.plain_text;
  }
  catch (e) {
    throw new Error("Unable to decrypt");
  }
}

const clearOpaqueClient = (Sock, { commands }) => {
  const client_subs = ['sid', 'pw'];
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

async function encryptWithPassword (event, DATA) {
  event.preventDefault();
  DATA.loading.socket = true;
  const { target } = event;
  const { git, env } = DATA;
  const { token } = git;

  const passSelect = 'input[type="password"]';
  const passField = target.querySelector(passSelect);
  const pass = passField.value;

  const namespace = configureNamespace(env);
  const to_encrypt = {
    password: pass,
    secret_text: token,
  }
  const delay = 0.3333;
  const result = await encryptSecrets(to_encrypt);
  const sock_inputs = { git, delay, ...namespace };
  const Sock = await toOpaqueSock(sock_inputs);
  DATA.loading.socket = false;
  DATA.loading.verify = true;
  // Start verification
  const Opaque = await OP(Sock, sodium);
  const op = findOp(namespace.opaque, "registered");
  await Opaque.clientRegister(pass, "root", op);
  Sock.sock.project.done = true;
  DATA.loading.verify = false;
  return result;
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
  const host = window.location.origin; //TODO
  let {store, component} = window.reef;

  const KEY_PAIR = toKeyPair();

  if (!remote || !env) {
    component(`#reef-main`, noTemplate);
    return;
  }


  // Create reactive data store
  const DATA = store({
    local: hasLocal,
    failure: false,
    login: null,
    code: null,
    phase: 0,
    host,
    env,
    git: {
      token: null,
      owner: remote[0],
      repo: remote[1]
    },
    remote: remote.join('/'),
    loading: {
      socket: false,
      verify: false
    },
    wiki_ext: ""
  });
  const wikiMailer = new WikiMailer(DATA);

  function clickHandler (event) {
    const reload = event.target.closest('.force-reload');
    const copy = event.target.closest('.copier');
    const { priv } = KEY_PAIR;
    if (reload) {
      return window.location.reload();
    }
    if (copy) {
      const first_div = copy.querySelector('div');
      const first_span = copy.querySelector('span');
      const { innerText } = first_div || first_span;
      const wiki_root = "https://raw.githubusercontent.com/wiki";
      const wiki_home = `${wiki_root}/${DATA.remote}/Home.md`; 
      navigator.clipboard.writeText(innerText).then(() => {
        wikiMailer.start();
        fetch(wiki_home).then(({ ok }) => {
          DATA.wiki_ext = ok ? 'Home/_edit' : '_new';
        })
        wikiMailer.addHandler('code', (pasted) => {
          DATA.phase = Math.max(1, DATA.phase);
          const decrypt_in = { ...pasted, priv };
          decryptPublic(decrypt_in).then((code) => {
            DATA.code = code;
          }).catch((e) => {
            console.error(e?.message);
          });
        });
        wikiMailer.addHandler('token', (pasted) => {
          DATA.phase = Math.max(2, DATA.phase);
          const decrypt_in = { ...pasted, priv };
          decryptPublic(decrypt_in).then((token) => {
            wikiMailer.finish();
            DATA.git.token = token;
          }).catch((e) => {
            console.error(e?.message);
          });
        });
      });
    }
  }

  function submitHandler (event) {
    if (event.target.matches(`#${passFormId}`)) {
      encryptWithPassword(event, DATA).then((encrypted) => {
        const query = toB64urlQuery(encrypted);
        DATA.login = `${DATA.host}/login${query}`;
        DATA.phase = 4;
      }).catch((e) => {
        console.error(e?.message);
        console.error(e); //TODO
        DATA.failure = true;
      });
    }
  }

  function statusTemplate (props) {
    const { verb, failure } = props;
    if (!failure) {
      const gerrund = {
        "connect": "Connecting...",
        "register": "Registering...",
      }[verb] || verb;
      return `<div class="loading large-font">
        <div> ${gerrund} </div>
      </div>`;
    }
    return `<div>
      <p class="failure"> Failed to ${verb}. </p>
      <button class="button true-pink force-reload">Retry?</button>
    </div>`;
  }

  function passTemplate() {
    const { phase } = DATA;
    if (phase < 2) {
      return "";
    }
    const u_id = "user-root";
    const p_id = "password-input";
    const user_auto = 'readonly="readonly" autocomplete="username"';
    const user_props = `id="u-root" value="root" ${user_auto}`;
    const pwd_auto = 'autocomplete="new-password"';
    const pwd_props = `id="${p_id}" ${pwd_auto}`;
    return `
      <div class="wrap-form">
        <form id="${passFormId}">
          <label class="large-font" for="${u_id}">Username:</label>
          <input class="large-font" id="${u_id} "type="text" ${user_props}>
          <label class="large-font" for="${p_id}">Password:</label>
          <input class="large-font" type="password" ${pwd_props}>
          <button class="button true-blue">Log in</button>
        </form>
      </div>
    `;
  }

  function loadingTemplate () {
    const { login, loading, failure } = DATA;
    const loadingInfo = (() => {
      if (loading.socket) {
        return statusTemplate({ failure, verb: "connect" });
      } 
      if (loading.verify) {
        return statusTemplate({ failure, verb: "register" });
      } 
      return passTemplate();
    })();
    if (login !== null) {
      const link_props = [
        `href="${login}"`,
        'target="_blank"',
        'rel="noopener noreferrer"'
      ].join(" ");
      const login_link = `<a ${link_props}>${login}</a>`
      return `
      <div class="footer">
        <p>You are now registered! Use this link from now on:</p>
        <p class="long-link">${login_link}</p>
      </div>
      `
    }
    return `
      <div class="footer">
        <div> ${loadingInfo} </div>
      </div>
    `;
  }

  function listTemplate (props) {
    const { items } = props;
    const all_li = items.map(({ spans, cls }) => {
      const inner = spans.join(' ');
      return `
        <li class="${cls}">${inner}</li>
      `;
    }).join('');
    return "<ol>" + all_li + "</ol>";
  }

  function toSpans (...args) {
    return args.map(a => `<span>${a}</span>`);
  }

  function isCopyKeyPhase() {
    return DATA.phase === 0;
  }
  function isCopyCodePhase() {
    const { phase, code } = DATA;
    return phase === 1 && !!code;
  }

  function toCopyKeySpans(root, placeholder) {
    const { pub } = KEY_PAIR;
    const pub_str = toB64urlQuery({ pub });
    if (isCopyKeyPhase()) {
      const { remote, wiki_ext } = DATA;
      const wiki = `${root}/${remote}/wiki/${wiki_ext}`;
      const link_props = [
        `href="${wiki}"`,
        'target="_blank"',
        'rel="noopener noreferrer"'
      ].join(" ");
      const wiki_link = `to <a ${link_props}>the Wiki</a>`;
      const button = '<button class="button true-tan">Copy</button>';
      const pub_span = `<span class="hidden">${pub_str}</span>`;
      const spans = [button, pub_span, ...toSpans("Public Key", wiki_link)];
      return { spans, cls: "dark-blue copier" };
    }
    const spans = toSpans(placeholder);
    return { spans, cls: "" };
  }

  function toCopyCodeSpans(root, placeholder) {
    if (isCopyCodePhase()) {
      const { code } = DATA;
      const device = `${root}/login/device/`;
      const link_props = [
        `href="${device}"`,
        'target="_blank"',
        'rel="noopener noreferrer"'
      ].join(" ");
      const device_link = `to <a ${link_props}>GitHub</a>.`;
      const button = '<button class="button true-tan">Copy</button>';
      const spans = [button, ...toSpans(code, device_link)];
      return { spans, cls: "dark-blue copier" };
    }
    const spans = toSpans(placeholder);
    return { spans, cls: "" };
  }

  function appTemplate () {
      const root = "https://github.com";
      const { phase } = DATA;
      const items = [
        toCopyKeySpans(root, 'Pasted Key.'),
        toCopyCodeSpans(root, 'Await GitHub Code.'),
        {
          spans: toSpans("Choose master password!"),
          cls: phase > 1 ? "dark-blue" : ""
        }
      ];
      const list_props = { items };
      return `
        <div class="container">
          <div class="contained">
            <div class="list-wrapper">
              ${listTemplate(list_props)}
            </div>
          </div>
        </div>
        ${loadingTemplate()}
      `;
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
