import * as eccrypto from "eccrypto/browser";
import { WikiMailer } from "./scripts/wiki.js";
import { Buffer } from "buffer"
/*
 * Globals needed on window object:
 *
 * reef, decryptQueryMaster,
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

const runReef = (mainId) => {

  let {store, component} = reef;

  const KEY_PAIR = toKeyPair();

  // Create reactive data store
  let DATA = store({
    phase: 0,
    code: null,
    git: {
      token: null,
      owner: "tvquizphd",
      repo: "public-quiz-device"
    }
  });
  const wikiMailer = new WikiMailer(DATA);

  function clickHandler (event) {
    const copy = event.target.closest('.copier');
    const { priv } = KEY_PAIR;
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
            DATA.token = token;
            console.log(token);
          }).catch((e) => {
            console.error(e?.message);
          });
        });
      });
    }
  }

  function copyTemplate () {
    const { pub } = KEY_PAIR;
    const pub_str = toB64urlQuery({pub});
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

  function toCopyTag() {
    if (isCopyPhase()) {
      return ['<button class="b-add">Copy</button>'];
    }
    return toSpans('Copy');
  }

  function appTemplate () {
      const { phase, code } = DATA;
      const { owner, repo } = DATA.git;
      const root = "https://github.com/";
      const repo_url = [owner, repo].join('/');
      const device = `${root}login/device/`;
      const wiki = `${root}${repo_url}/wiki/Home`;
      const wiki_link = `<a href="${wiki}">the Wiki</a>`;
      const device_link = `to <a href="${device}">GitHub</a>.`;
      const device_code = !!code ? code : "####-####";
      const copy_spans = toSpans(device_code, device_link);
      const item_spans = [
        toSpans("Copy temporary public key."),
        toSpans(`Paste into ${wiki_link} Home.md.`),
        [...toCopyTag(), ...copy_spans],
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
        </div>
      `;
  }

  // Create reactive component
  component(`#${mainId}`, appTemplate);
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
  runReef("reef-main");
};
