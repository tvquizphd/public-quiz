/*
 * Globals needed on window object:
 *
 * reef, decryptQuery,
 * decryptQueryMaster,
 * encryptQueryMaster
 * OP, Octokit, toProjectSock
 * configureNamespace, toB64urlQuery 
 */

const runReef = (mainId, formId, passFormId) => {

let {store, component} = reef;

// Create reactive data store
let DATA = store({
    loaded: {
      mailer: null
    },
    loading: {
      mailer: false
    },
    todos: []
});

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

function star(git) {
  return new Promise((resolve, reject) => {
    const { octokit, star_api } = useGit(git);
    octokit.request(`PUT ${star_api}`, git).then(() => {
      resolve('Starred Repository to trigger action.');
    }).catch(e => reject(e));
  });
}

function unStar(git) {
  return new Promise((resolve, reject) => {
    const { octokit, star_api } = useGit(git);
    octokit.request(`DELETE ${star_api}`).then(() => {
      resolve('Unstarred Repository.');
    }).catch(e => reject(e));
  });
}

async function triggerGithubAction(git) {
  const { hostname } = window.location; 
  if (hostname === "localhost") {
    return; // Ignore if localhost
  }
  try {
    await unStar(git);
    console.log(await star(git));
  }
  catch (e) {
    console.error(e.message);
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
  const timeout = "timeout";
  const { opaque, delay } = inputs;
  const dt = 1000 * delay + 500;
  const Sock = await toSock(inputs, "opaque");
  const start = findSub(opaque, "start");
  await clearOpaqueClient(Sock, opaque);
  // Check for existing start signal
  const promise = new Promise((resolve, reject) => {
    const { text, subcommand: sub } = start;
    const { project } = Sock.sock;
    setTimeout(() => {
      project.waitMap.delete(text);
      reject(new Error(timeout));
    }, dt);
    const op_id = opId(opaque, sub);
    Sock.get(op_id, sub).then(resolve).catch(reject);
  });
  try {
    await promise;
    return Sock;
  }
  catch (e) {
    if (e.message != timeout) {
      throw e;
    }
  }
  // Need to reset server
  Sock.give(opId(opaque, "reset"), "reset", true);
  await Sock.get(opId(opaque, "start"), "start");
  return Sock;
}


class Mailer {
  constructor(inputs) {
    const { Sock } = inputs;
    this.mk = inputs.master_key;
    this.sk = inputs.session_key;
    this.Sock = Sock;
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
    return await encryptQueryMaster(args);
  }
  async from_session_search(search) {
    const args = { search, master_key: this.sk };
    return (await decryptQueryMaster(args)).plain_text;
  }
  async print() {
    const s1 = await this.to_master_search("hello");
    console.log(s1)
    const s2 = await this.to_session_search(s1);
    console.log(s2)
    const s3 = await this.from_session_search(s2);
    console.log(s3)
    const s4 = await this.from_master_search(s3);
    console.log(s4)
  }
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
    Opaque.clientAuthenticate(pass, "root", times, op).then((session) => {
      Sock.sock.project.done = true;
      const bytes = session.match(/../g).map(h=>parseInt(h,16));
      const session_key = new Uint8Array(bytes);
      toSock(sock_inputs, "mailbox").then((mbs) => {
        const m_input = { 
          session_key,
          master_key,
          Sock: mbs
        }
        const mailer = new Mailer(m_input);
        DATA.loaded.mailer = mailer;
        DATA.loading.mailer = false;
      });
    })
    // Clear the input field and return to focus
    passField.value = '';
    passField.focus();
    return "Running";
}


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

function submitTodos () {
    alert('TODO');
}

/**
 * Handle click events
 */
function clickHandler (event) {

    // Complete todos
    let todo = event.target.closest('[data-todo]');
    if (todo) {
        completeTodo(todo);
    }

    // Submit all todos
    if (event.target.closest('.todo-submit')) {
        submitTodos();
    }
}

/**
 * Handle form submit events
 */
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
      return `<p class="loading"> Loading... </p>`;
    } 
    const { mailer } = loaded;
    if (mailer instanceof Mailer) {
      mailer.print();
      return `<p class="loaded"> Welcome </p>`;
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

function appTemplate () {
    return `
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
        </div>`;
}

// Create reactive component
component(`#${mainId}`, appTemplate);

// Listen for events
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
  runReef("reef-main", "todo-form", "pass-form");
};
