/*
 * Globals needed on window object:
 *
 * reef, decryptQuery
 * OP, deploy, graphql, DBTrio 
 * configureNamespace
 * itemButtonTag
 */

function addErrors(errors) {
  if (window.DATA) {
    const new_errors = errors.reduce((o_0, error) =>{
      return error.scopes.reduce((o_1, scope) => {
        return { ...o_1, [scope]: [...o_1[scope], error] };
      }, o_0);
    }, DATA.errors);
    DATA.errors = new_errors;
  }
}

async function outage() {
  const fault = "GitHub internal outage";
  const scopes = [
    "socket", "mailer", "database", "sending"
  ];
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
    return { body, date, fault, scopes };
  });
}

async function triggerGithubAction(git) {
  const { hostname } = window.location; 
  if (DATA.local) {
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
  const start = findSub(opaque, "start");
  await clearOpaqueClient(Sock, opaque);
  // Check for existing start signal
  const promise = get_now(Sock, opaque, "start", dt);
  try {
    await promise;
    return Sock;
  }
  catch (e) {
    if (e.message != "timeout") {
      throw e;
    }
  }
  // Need to reset server
  Sock.give(opId(opaque, "reset"), "reset", true);
  await Sock.get(opId(opaque, "start"), "start");
  return Sock;
}

const get_now = (Sock, config, sub, dt) => {
  const timeout = "timeout";
  const cmd = findSub(config, sub);
  return new Promise((resolve, reject) => {
    const { text, subcommand } = cmd;
    const { project } = Sock.sock;
    setTimeout(() => {
      project.waitMap.delete(text);
      reject(new Error(timeout));
    }, dt);
    const op_id = opId(config, subcommand);
    Sock.get(op_id, subcommand).then(resolve).catch(reject);
  });
}

/**
 * Decrypt with password
 */
async function decryptWithPassword (event) {
  // Prevent default form submission
  event.preventDefault();
  addErrors(await outage());
  DATA.loading.socket = true;
  const { target } = event;

  const passSelect = 'input[type="password"]';
  const passField = target.querySelector(passSelect);
  const pass = passField.value;

  const { search } = window.location;
  const namespace = configureNamespace();
  const result = await decryptQuery(search, pass);
  const master_key = result.master_key;
  const api_token = result.plain_text;
  const git = {
    token: api_token,
    owner: "tvquizphd",
    repo: "public-quiz-device"
  }
  const delay = 1;
  const times = 1000;
  await triggerGithubAction(git);
  const sock_inputs = { git, delay, ...namespace };
  const Sock = await toOpaqueSock(sock_inputs);
  DATA.loading.socket = false;
  DATA.loading.mailer = true;
  // Start verification
  const Opaque = await OP(Sock);
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
    DATA.loading.database = false;
    console.error(e?.message);
    throw e;
  }
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

const EMPTY_NEW = [ [""], [""], ["","",""] ];
const EMPTY_TABLES = [ [], [], [] ];

const runReef = (mainId, passFormId) => {

  const {store, component} = reef;

  // Create reactive data store
  window.DATA = store({
      failure: false,
      local: false,
      errors: {
        socket: [],
        mailer: [],
        database: [],
        sending: [] 
      },
      loading: {
        socket: false,
        mailer: false,
        database: false,
        sending: false
      },
      newRows: [...EMPTY_NEW],
      tables: [...EMPTY_TABLES]
  });

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

  // Handle all click events
  function clickHandler (event) {

      const reload = event.target.closest('.force-reload');
      const send_mail = event.target.closest('.send-mail');
      const click_item = event.target.closest('.item');
      if (reload) {
          return window.location.reload();
      }
      // Send mail
      if (send_mail) {
          return uploadDatabase();
      }
      const { dbt } = API;
      // Handle item click
      if (click_item) {
        const d = click_item.dataset;
        if (d.targetKey === "set-local") {
          const v = parseInt(d.targetIdx);
          DATA.local = !!v;
        }
        // Handle database table management
        dbt.handleClick(click_item.dataset);
        click_item.parentNode.scrollTop = 0;
        return null;
      }
  }

  function renderHandler(event) {
    if (API.focus) {
      const { id, position } = API.focus;
      const elem = document.getElementById(id)
      API.focus = null;
      elem.focus();
      elem.setSelectionRange(...position);
    }
  };

  function resetScroll (fn) {
    const wrappers = document.querySelectorAll('.scroll-wrapper');
    [...wrappers].filter(fn).forEach((wrap) => wrap.scrollTop = 0);
  }

  // Handle all wheel events
  function inputHandler (event) {
      const { dbt } = API;
      const field = event.target.closest('input[type="text"]');
      if (!field) {
        return;
      }
      const { selectionStart, selectionEnd } = field;
      const position = [selectionStart, selectionEnd];
      const { id, dataset, value } = field
      dbt.handleClick(dataset, value);
      API.focus = { id, position };
      resetScroll(() => true);
  }

  // Handle all wheel events
  function wheelHandler (event) {
      const wrapper = event.target.closest('.scroll-wrapper');
      resetScroll((wrap) => wrap !== wrapper);
  }

  // Handle form submit events
  function submitHandler (event) {
    if (event.target.matches(`#${passFormId}`)) {
      decryptWithPassword(event).then((done) => {
        console.log(done)
      }).catch((e) => {
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
        "log in": "Logging in...",
        "load": "Loading...",
      }[verb] || verb;
      return `<p class="loading"> ${gerrund} </p>`;
    }
    return `<div>
      <p class="failure"> Failed to ${verb}. </p>
      <button class="b-add force-reload">Retry?</button>
    </div>`;
  }

  function codeTemplate () {
    const url = "https://github.com/login/device/";
    const loadingInfo = ((data) => {
      const {loading, loaded, failure} = data;
      if (loading.socket) {
        return statusTemplate({ failure, verb: "connect" });
      } 
      if (loading.mailer) {
        return statusTemplate({ failure, verb: "log in" });
      } 
      if (loading.database) {
        return statusTemplate({ failure, verb: "load" });
      } 
      const { mailer } = API;
      if (mailer instanceof Mailer) {
        return "";
      }
      const u_id = "user-root";
      const p_id = "password-input";
      const user_auto = 'readonly="readonly" autocomplete="username"';
      const user_props = `id="u-root" value="root" ${user_auto}`;
      const pwd_auto = 'autocomplete="current-password"';
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
    })(DATA);
    return `
      <div class="loading-wrapper">
        ${loadingInfo} 
      </div>
    `;
  }

  function tableTemplate () {
    return (({loading, loaded}) => {
      if (loading.mailer || loading.database) {
        return `<div></div>`;
      } 
      const { mailer } = API;
      if (mailer instanceof Mailer) {
        return `<div class="full-width">
          ${mailer.render("table-wrapper")}
        </div>`;
      }
      if (DATA.local === false) {
        return `<div></div>`;
      }
      this.dbt = new DBTrio({ DATA });
      return `<div class="full-width">
        ${dbt.render("table-wrapper")}
      </div>`;
    })(DATA);
  }

  function uploadDatabaseTemplate () {
    return (({loading, loaded}) => {
      if (loading.mailer || loading.database) {
        return `<div></div>`;
      } 
      if (loading.sending) {
        return `<div class="loading-wrapper">
          <p class="loading"> Saving... </p>
        </div>`;
      } 
      const { mailer } = API;
      if (mailer instanceof Mailer) {
        return `<div>
          <button class="send-mail b-add">
            Save Passwords 
          </button>
        </div>
        `;
      }
      return `<div></div>`;
    })(DATA);
  }

  function errorDisplayTemplate() {
    const { errors, loading } = DATA;
    const relevant = Object.entries(loading).reduce((o, [k, v]) => {
      const bodies = o.map(({body}) => body);
      const k_errors = errors[k].filter(({body}) => {
        return !bodies.includes(body);
      });
      return v ? [...o, ...k_errors] : o;
    }, []);
    const list = relevant.map((error) => {
      const { body, date, fault } = error;
      const date_str = date.toLocaleDateString("en-CA");
      const time_str = date.toLocaleTimeString("en-CA");
      return `<div>
        <p class="a-body">${body}</p>
        <div class="a-date">${date_str}</div>
        <div class="a-time">${time_str}</div>
        <div clas="a-fault">&mdash; ${fault}</div>
      </div>`;
    }).join('');
    const cls = "error-wrapper";
    return `
      <div class="uncontained">
        <div class="${cls}">${list}</div>
      </div>
    `;
  }

  function debugTemplate() {
    const errorDisplay = errorDisplayTemplate();
    if (location.hostname !== "localhost") {
      return errorDisplay;
    }
    const { local } = DATA;
    const close = `</button>`;
    const labels = ['GitHub', 'Local'];
    const buttons = [false, true].map((i) => {
      const choice = +(i ^ local);
      const idx = {
        "target-idx": `${choice}`,
        "target-key": `set-local`
      }
      const text = labels[choice] + ' Action';
      const open = itemButtonTag(+i, idx, ['item']);
      return `${open}${text}${close}`;
    }).join('');
    return `
      <div class="contained">
        <div class="debug-wrapper">
          <div>
            Action testing:
          </div>
          <div class="scroll-wrapper">
            ${buttons}
          </div>
        </div>
      </div>
      ${errorDisplay}
    `;
  }

  function appTemplate () {
    return `
      <div class="container">
        ${debugTemplate()}
        <div class="contained">
          ${codeTemplate()}
        </div>
        <div class="uncontained">
          ${tableTemplate()}
        </div>
        <div class="contained">
          ${uploadDatabaseTemplate()}
        </div>
      </div>
    `;
  }

  // Create reactive component
  component(`#${mainId}`, appTemplate);

  // Listen for events
  document.addEventListener('reef:render', renderHandler);
  document.addEventListener('submit', submitHandler);
  document.addEventListener('input', inputHandler);
  document.addEventListener('wheel', wheelHandler);
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
  runReef("reef-main", "pass-form");
};
