import * as eccrypto from "eccrypto/browser";
import { WikiMailer } from "./scripts/wiki.js";
import { Buffer } from "buffer"
/*
 * Globals needed on window object:
 *
 * reef, encryptSecrets 
 * OP, deploy, graphql 
 * configureNamespace
 * decryptQueryMaster,
 * fromB64urlQuery, toB64urlQuery
 */
const LOCAL_KEY = "private"

const toPrivate = () => {
  const old_priv_str = localStorage.getItem(LOCAL_KEY);
  if (!!old_priv_str) {
    return fromB64urlQuery(old_priv_str).priv;
  }
  const priv = new Uint8Array(eccrypto.generatePrivate());
  localStorage.setItem(LOCAL_KEY, toB64urlQuery({ priv }));
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
  const { opaque, delay } = inputs;
  const dt = 1000 * delay + 500;
  const Sock = await toSock(inputs, "opaque");
  await clearOpaqueClient(Sock, opaque);
  return Sock;
}

async function triggerGithubAction(local, git) {
  if (local) {
    console.log('DEVELOPMENT: please run action locally.');
    return;
  }
  console.log('PRODUCTION: calling GitHub action.');
  const { repo, owner } = git;
  const metadata = { env: "development" };
  const accept = "application/vnd.github.flash-preview+json";
  const octograph = graphql.defaults({
    headers: {
      accept,
      authorization: `token ${git.token}`,
    }
  });
  const opts = { repo, owner, octograph, metadata };
  try {
    await deploy(opts);
  }
  catch (e) {
    console.log(e?.message);
  }
}

async function encryptWithPassword (event, DATA) {
  event.preventDefault();
  DATA.loading.socket = true;
  const { target } = event;
  const { git } = DATA;
  const { token } = git;

  const passSelect = 'input[type="password"]';
  const passField = target.querySelector(passSelect);
  const pass = passField.value;

  const namespace = configureNamespace();
  const to_encrypt = {
    password: pass,
    secret_text: token,
  }
  const delay = 1;
  await triggerGithubAction(false, git);
  const result = await encryptSecrets(to_encrypt);
  const sock_inputs = { git, delay, ...namespace };
  const Sock = await toOpaqueSock(sock_inputs);
  DATA.loading.socket = false;
  DATA.loading.verify = true;
  // Start verification
  const Opaque = await OP(Sock);
  const op = findOp(namespace.opaque, "registered");
  await Opaque.clientRegister(pass, "root", op);
  DATA.loading.verify = false;
  return result;
}

const runReef = (host, mainId, passFormId) => {

  let {store, component} = reef;

  const KEY_PAIR = toKeyPair();
  const local = host !== location.origin;

  // Create reactive data store
  let DATA = store({
    failure: false,
    login: null,
    code: null,
    phase: 0,
    local,
    host,
    git: {
      token: null,
      owner: "tvquizphd",
      repo: "public-quiz-device"
    },
    loading: {
      socket: false,
      verify: false
    }
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
      navigator.clipboard.writeText(innerText).then(() => {
        wikiMailer.start();
        DATA.phase = Math.max(1, DATA.phase);
        wikiMailer.addHandler('wiki', (pasted) => {
          DATA.phase = Math.max(2, DATA.phase);
        });
        wikiMailer.addHandler('code', (pasted) => {
          DATA.phase = Math.max(2, DATA.phase);
          const decrypt_in = { ...pasted, priv };
          decryptPublic(decrypt_in).then((code) => {
            DATA.code = code;
          }).catch((e) => {
            console.error(e?.message);
          });
        });
        wikiMailer.addHandler('token', (pasted) => {
          DATA.phase = Math.max(3, DATA.phase);
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
        throw e;
        console.error(e?.message);
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
      return `<p class="loading"> ${gerrund} </p>`;
    }
    return `<div>
      <p class="failure"> Failed to ${verb}. </p>
      <button class="b-add force-reload">Retry?</button>
    </div>`;
  }

  function passTemplate() {
    const { phase } = DATA;
    if (phase < 3) {
      return "";
    }
    const u_id = "user-root";
    const p_id = "password-input";
    const user_auto = 'readonly="readonly" autocomplete="username"';
    const user_props = `id="u-root" value="root" ${user_auto}`;
    const pwd_auto = 'autocomplete="new-password"';
    const pwd_props = `id="${p_id}" ${pwd_auto}`;
    return `
      <form id="${passFormId}">
        <label for="${u_id}">Username:</label>
        <input id="${u_id} "type="text" ${user_props}>
        <label for="${p_id}">Password:</label>
        <input type="password" ${pwd_props}>
        <button class="b-add">Log in</button>
      </form>
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
      const login_link = `<a href="${login}">${login}</a>`
      return `
      <div class="uncontained">
        <p>You are now registered! Use this link from now on:</p>
        <p class="long-link">${login_link}</p>
      </div>
      `
    }
    return `
      <div class="contained">
        <div class="loading-wrapper">
          ${loadingInfo} 
        </div>
      </div>
    `;
  }

  function copyTemplate () {
    const { phase } = DATA;
    const { pub } = KEY_PAIR;
    const pub_str = toB64urlQuery({pub});
    if (phase > 1) {
      return "";
    }
    const button = `
      <button class="b-add">
        Copy
      </button>
    `;
    return `
      <div class="copier copy-wrapper">
        <div>${pub_str}</div>
        ${button}
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

  function isCopyPhase() {
    const { phase, code } = DATA;
    return phase === 2 && !!code;
  }

  function toCopySpans(root, placeholder) {
    if (isCopyPhase()) {
      const { code } = DATA;
      const device = `${root}login/device/`;
      const device_link = `to <a href="${device}">GitHub</a>.`;
      const button = '<button class="b-add">Copy</button>';
      return [button, ...toSpans(code, device_link)];
    }
    return toSpans(placeholder);
  }

  function appTemplate () {
      const { phase, code } = DATA;
      const { owner, repo } = DATA.git;
      const root = "https://github.com/";
      const repo_url = [owner, repo].join('/');
      const wiki = `${root}${repo_url}/wiki/Home`;
      const wiki_link = `<a href="${wiki}">the Wiki</a>`;
      const item_spans = [
        toSpans("Copy temporary public key."),
        toSpans(`Paste into ${wiki_link} Home.md.`),
        toCopySpans(root, 'Await GitHub Code.'),
        toSpans("Choose master password!")
      ];
      const items = item_spans.map((spans, i) => {
        const classes = [phase === i ? "highlight" : ""];
        if (isCopyPhase() && i === 2) {
          classes.push("copier");
        }
        const cls = classes.join(" ");
        return { spans, cls };
      });
      const list_props = { items };
      return `
        <div class="container">
          <div class="uncontained">
            ${copyTemplate()} 
          </div>
          <div class="contained">
            <div class="list-wrapper">
              ${listTemplate(list_props)}
            </div>
          </div>
          ${loadingTemplate()}
          <br>
        </div>
      `;
  }

  // Create reactive component
  component(`#${mainId}`, appTemplate);
  document.addEventListener('submit', submitHandler);
  document.addEventListener('click', clickHandler);
}

window.onload = (event) => {
  const rootApp = document.createElement("div");
  const rootForm = document.createElement("div");
  const reefMain = document.getElementById("reef-main");
  rootApp.id = "root-app";
  rootForm.id = "root-form";
  reefMain.appendChild(rootForm);
  reefMain.appendChild(rootApp);

  const { hostname, origin } = window.location;
  //const remote = "https://pass.tvquizphd.com";
  const remote = origin; // TODO
  const isLocal = hostname === "localhost";
  const host = isLocal ? remote : origin;
  runReef(host, "reef-main", "pass-form");
};
