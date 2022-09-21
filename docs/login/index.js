/*
 * Globals needed on window object:
 *
 * reef, fromB64urlQuery, 
 * decryptKey, decryptSecret, argon2
 * Octokit, toProjectSock, OP
 */

const runReef = (mainId, formId, passFormId) => {

let {store, component} = reef;

// Create reactive data store
let DATA = store({
    loaded: {
      session: false
    },
    loading: {
      session: false
    },
    secret: null,
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

function triggerGithubAction(git) {
  const octokit = new Octokit({
    auth: git.token
  });
  const star_api = `/user/starred/${git.owner}/${git.repo}`;
  octokit.request(`PUT ${star_api}`, git).then(() => {
    console.log('Starred Repository to trigger action.')
  }).catch(e => console.error(e.message));
}

async function toOpaqueSock(git) {
  const v = "v";
  const sock_inputs = {
    token: git.token,
    owner: git.owner,
    title: "verify",
    scope: v
  };
  const Sock = await toProjectSock(sock_inputs);
  const Opaque = await OP(Sock);
  return { Opaque, v };
}


/**
 * Decrypt with password
 */
async function decryptWithPassword (event) {
    // Prevent default form submission
    event.preventDefault();
    DATA.loading.session = true;

    const passField = document.getElementById('pwd');
    const pass = passField.value;

    const { search } = window.location;
    const inputs = fromB64urlQuery(search);
    const { salt, key, data } = inputs;
    const argonOpts = {
      pass,
      salt,
      time: 3,
      mem: 4096,
      hashLen: 32
    };
    const api_token = await new Promise((resolve) => {
      argon2.hash(argonOpts).then(async ({hash}) => {
        const d_key = await decryptKey({hash, key});
        const message = await decryptSecret({data, key: d_key});
        const m_text = new TextDecoder().decode(message);
        resolve(m_text);
      });
    });
    const git = {
      token: api_token,
      owner: "tvquizphd",
      repo: "public-quiz-device"
    }
    const times = 1000;
    triggerGithubAction(git);
    const { Opaque, v } = await toOpaqueSock(git);
    await Opaque.clientRegister(pass, "root", v);
    Opaque.clientAuthenticate(pass, "root", times, v).then((session) => {
      DATA.loading.session = false;
      DATA.loaded.session = true;
      DATA.secret = session;
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
    if (loading.session) {
      return `<p class="loading"> Loading... </p>`;
    } 
    if (loaded.session) {
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
