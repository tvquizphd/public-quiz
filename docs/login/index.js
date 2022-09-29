/**
 * Add a todo to the list
 */
function addTodo (event) {

    let todoField = document.getElementById('todo-item');

    // Only run if there's an item to add
    if (!todoField || todoField.value.length < 1) return;

    // Prevent default form submission
    event.preventDefault();

    // Update the state
    DATA.todos.push({
        item: todoField.value,
        id: crypto.randomUUID(),
        completed: false
    });

    // Clear the input field and return to focus
    todoField.value = '';
    todoField.focus();

}

function useGit(git) {
  const octokit = new Octokit({
    auth: git.token
  });
  const star_api = `/user/starred/${git.owner}/${git.repo}`;
  return { octokit, star_api };
}

function hasStar(git) {
  return new Promise((resolve, reject) => {
    const { octokit, star_api } = useGit(git);
    octokit.request(`Get ${star_api}`, git).then(() => {
      resolve('Action is already running.');
    }).catch(e => reject(e));
  });
}

function star(git) {
  return new Promise((resolve, reject) => {
    const { octokit, star_api } = useGit(git);
    octokit.request(`PUT ${star_api}`, git).then(() => {
      resolve('Starred Repository to trigger action.');
    }).catch(e => reject(e));
  });
}

async function triggerGithubAction(git) {
  const { hostname } = window.location; 
  if (hostname === "localhost") { //TODO
    return; // Ignore if localhost
  }
  try {
    console.log(await hasStar(git));
  }
  catch (e) {
    try {
      console.log(await star(git));
    }
    catch (e) {
      console.log(e.message);
    }
  }
}

// TODO: package and distribute 4 fns

function findSub (inputs, sub) {
  return inputs.commands.filter((c) => {
    return c.subcommand == sub;
  }).pop();
}

function findOp (inputs, sub) {
  const command = findSub(inputs, sub);
  return inputs.sockets.find(({ text }) => {
    return text == command.prefix;
  }).suffix;
}

function opId (inputs, sub) {
  const command = findSub(inputs, sub);
  const op = findOp(inputs, sub);
  return op + command.command;
}

async function toSock(inputs, key) {
  const { project } = inputs[key];
  const { git, delay } = inputs;
  const sock_inputs = {
    delay: delay,
    token: git.token,
    owner: git.owner,
    title: project.title,
    scope: project.prefix
  };
  return await toProjectSock(sock_inputs);
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

const waiter = (n, delay, check_status) => {
  const tries = [...new Array(n + 1).keys()];
  return tries.reduce((o, i) => {
    if (i === n) {
      return o.then(v => v);
    }
    if (check_status()) {
      return Promise.resolve(true);
    }
    return o.then(() => {
      return new Promise((resolve) => {
        const v = check_status();
        setTimeout(resolve, delay * 1000, v);
      });
    });
  }, Promise.resolve(false));
}

const get_now = (Sock, config, cmd_name, dt) => {
  const timeout = "timeout";
  const cmd = findSub(config, cmd_name);
  return new Promise((resolve, reject) => {
    const { text, subcommand: sub } = cmd;
    const { project } = Sock.sock;
    setTimeout(() => {
      project.waitMap.delete(text);
      reject(new Error(timeout));
    }, dt);
    const op_id = opId(config, sub);
    Sock.get(op_id, sub).then(resolve).catch(reject);
  });
}

/**
 * Decrypt with password
 */
async function decryptWithPassword (event) {
  // Prevent default form submission
  event.preventDefault();
  DATA.loading.mailer = true;

  const passField = document.getElementById('pwd');
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
  const delay = 2;
  const times = 1000;
  triggerGithubAction(git);
  const sock_inputs = { git, delay, ...namespace };
  const Sock = await toOpaqueSock(sock_inputs);
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
    console.error(e?.message);
    DATA.loading.database = false;
    return "Unable to load database.";
  }
}
/*
 * Globals needed on window object:
 *
 * reef, decryptQuery
 * OP, Octokit, DBTrio 
 * toProjectSock, configureNamespace
 * fromB64urlQuery, decryptQueryMaster, encryptQueryMaster
 */

class Mailer {
  constructor(inputs) {
    this.mailbox = inputs.mailbox;
    this.sk = inputs.session_key;
    this.mk = inputs.master_key;
    this.delay = inputs.delay;
    this.mbs = inputs.mbs;
    this.dbt = new DBTrio({ DATA });
    const { project } = this.mbs.sock;
    const check_stop = (p) => p.done;
    const check_start = (p) => !p.done;
    const set_stop = (p, now=false) => {
      p.call_fifo = [
        ...(now ? [] : p.call_fifo),
        async () => p.waitMap = new Map(),
        async () => p.done = true
      ];
    }
    const set_start = (p) => {
      p.done = false;
      p.mainLoop();
    }
    this.set_stop = set_stop.bind(null, project);
    this.set_start = set_start.bind(null, project);
    this.check_stop = check_stop.bind(null, project);
    this.check_start = check_start.bind(null, project);
    this.stop(true, 3).then(() => {
      console.log('Stopped Mailbox polling');
    }).catch((e) => console.error(e?.message));
  }

  async to_master_search(plain_text) {
    const args = { plain_text, master_key: this.mk };
    return await encryptQueryMaster(args);
  }
  async from_master_search(search) {
    const args = { search, master_key: this.mk };
    return (await decryptQueryMaster(args)).plain_text;
  }
  async to_session_search(plain_text) {
    const args = { plain_text, master_key: this.sk };
    const search = await encryptQueryMaster(args);
    return fromB64urlQuery(search).data;
  }
  async from_session_search(search) {
    const args = { search, master_key: this.sk };
    return (await decryptQueryMaster(args)).plain_text;
  }
  get to_session() {
    return this.to_session_search.bind(this);
  }
  get to_master() {
    return this.to_master_search.bind(this);
  }
  get from_master() {
    return this.from_master_search.bind(this);
  }
  get from_session() {
    return this.from_session_search.bind(this);
  }

  stop(now, tries) {
    const { project } = this.mbs.sock;
    if (this.check_stop()) {
      return true;
    }
    this.set_stop(now);
    const wait = waiter(tries, this.delay, this.check_stop);
    return new Promise((resolve, reject) => {
      wait.then((v) => {
        if (v) {
          resolve(v);
        }
        const e = new Error('Unable to stop socket');
        reject(e);
      });
    });
  }

  async restart(now, tries) {
    await this.stop(now, tries);
    this.set_start();
  }

  async read_database() {
    const message = await this.read_mail();
    const { dbt, from_master, from_session } = this;
    const d_args = { from_master, from_session };
    await dbt.decrypt(d_args, message);
    return DATA.tables;
  }

  async read_mail() {
    const sub = "from_secret";
    const { mbs, mailbox } = this;
    const proj = mbs.sock.project;
    const dt = this.delay * 1000 + 1000;
    const commands = [findSub(mailbox, sub)];
    const clear_args = { commands, done: true };
    const clear = proj.clear.bind(proj, clear_args);
    await this.restart(false, 5);
    try {
      const promise = get_now(mbs, mailbox, sub, dt);
      const mail = await promise;
      await clear();
      return mail;
    }
    catch (e) {
      if (e.message != "timeout") {
        throw e;
      }
    }
  }

  async send_database() {
    const { dbt, to_master, to_session } = this;
    const e_args = { to_master, to_session };
    const message = await dbt.encrypt(e_args);
    return await this.send_mail(message);
  }

  async send_mail(mail) {
    const sub = "to_secret";
    const { mbs, mailbox } = this;
    await this.restart(false, 5);
    mbs.give(opId(mailbox, sub), sub, mail);
    await this.stop(false, 5);
  }

  render(cls) {
    return this.dbt.render(cls);
  }
}

const API = {
  mailer: null,
  get dbt() {
    const { mailer } = API;
    if (mailer instanceof Mailer) {
      return mailer.dbt;
    }
    return new DBTrio({ DATA });
  }
}

const TEST_TABLES = [
  [
    ["google.com"],
    ["github.com"]
  ],
  [
    ["email@example.com"],
    ["cool_username_123"],
  ],
  [
    ['0', '0', "correct horse battery staple 123"],
    ['1', '1', "correct horse battery staple 1234"]
  ]
]

const runReef = (mainId, formId, passFormId) => {

const {store, component} = reef;

// Create reactive data store
window.DATA = store({
    loading: {
      mailer: false,
      database: false
    },
    tables: TEST_TABLES,
    todos: []
});


/**
 * Mark a todo as complete (or incomplete)
 * @param  {Node} item  The todo item
 */
function completeTodo (item) {

    // Get the todo item
    let todoItem = DATA.todos[item.getAttribute('data-todo')];
    if (!todoItem) return;

    // If it's completed, uncomplete it
    // Otherwise, mark is as complete
    if (todoItem.completed) {
        todoItem.completed = false;
    } else {
        todoItem.completed = true;
    }

}

function uploadDatabase() {
    const { mailer } = API;
    if (mailer instanceof Mailer) {
      mailer.send_database().then(() => {
        console.log('Sent mail.');
      }).catch((e) => {
        console.log('Unable to send mail.');
        console.error(e);
      })
    }
}

function submitTodos () {
    alert('TODO');
}

// Handle all click events
function clickHandler (event) {

    const todo = event.target.closest('[data-todo]');
    const send_mail = event.target.closest('.send-mail');
    const todo_submit = event.target.closest('.todo-submit');
    const click_item = event.target.closest('.item');
    // Complete todos
    if (todo) {
        completeTodo(todo);
    }
    // Send mail
    if (send_mail) {
        uploadDatabase();
    }
    // Submit all todos
    if (todo_submit) {
        submitTodos();
    }
    const { dbt } = API;
    // Handle item click
    if (click_item) {
      const d = click_item.dataset;
      dbt.setTarget(click_item.dataset);
      click_item.parentNode.scrollTop = 0;
    }
}

// Handle all wheel events
function wheelHandler (event) {

    const wrapper = event.target.closest('.scroll-wrapper');
    const wrappers = document.querySelectorAll('.scroll-wrapper');

    [...wrappers].forEach((wrap) => {
      if (wrap !== wrapper) {
        wrap.scrollTop = 0;
      }
    })
}

// Handle form submit events
function submitHandler (event) {
  if (event.target.matches(`#${formId}`)) {
    addTodo(event);
  }
  if (event.target.matches(`#${passFormId}`)) {
    decryptWithPassword(event).then((done) => {
      console.log(done)
    });
  }
}

function codeTemplate () {
  const url = "https://github.com/login/device/";
  const loadingInfo = (({loading, loaded}) => {
    if (loading.mailer) {
      return `<p class="loading"> Connecting... </p>`;
    } 
    if (loading.database) {
      return `<p class="loading"> Loading... </p>`;
    } 
    const { mailer } = API;
    if (mailer instanceof Mailer) {
      return `<p>Welcome</p>`;
    }
    return `
      <p>Please enter Password</p>
      <form id="${passFormId}">
        <label for="pwd">Password:</label>
        <input type="password" id="pwd" name="pwd">
        <button>Log in</button>
      </form>
    `;
  })(DATA);
  return `
    <div class="loading-wrapper">
      ${loadingInfo} 
    </div>
  `;
}

function listTemplate () {

    // Create each todo item
    let todoList = DATA.todos.map(function (todo, index) {
        return `
            <li class="todo" id="todo-${todo.id}">
                <label ${todo.completed ? ' class="completed"' : ''}>
                    <input data-todo="${index}" type="checkbox" ${todo.completed ? ' checked="checked"' : ''}>
                    <span class="todo-item">${todo.item}</span>
                </label>
            </li>`;
    }).join('');

    if (todoList.length > 0) {
        return `
            <ul class="todos">
                ${todoList}
            </ul>
            <p>
                <button class="todo-submit">
                    Get them all
                </button>
            </p>`;
    }
    return '';
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
    // TODO: Remove placeholder table
    // return `<div></div>`;
    const { dbt } = API;
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
    const { mailer } = API;
    if (mailer instanceof Mailer) {
      return `<button class="send-mail">
        Send Mail
      </button>`;
    }
    return `<div></div>`;
  })(DATA);
}

function appTemplate () {
    return `
      <div class="container">
        <div class="contained">
          <div>
            ${codeTemplate()}
          </div>
          <br>
          <form id="${formId}">
              <label for="todo-item">What do you need? </label>
              <input type="text" name="todo-item" id="todo-item">
              <button>Find it</button>
          </form>
          <div>
          ${listTemplate()}
          </div>
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
document.addEventListener('submit', submitHandler);
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
  runReef("reef-main", "todo-form", "pass-form");
};
