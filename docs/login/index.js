/*
 * Globals needed on window object:
 *
 * reef, fromB64urlQuery, 
 * decryptKey, decryptSecret, argon2
 * Octokit, graphql, toProjectSock, OP
 */

const runReef = (mainId, formId, passFormId) => {

let {store, component} = reef;

// Create reactive data store
let DATA = store({
    loading: false,
    secret: null,
    code: null,
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

/**
 * Decrypt with password
 */
async function decryptWithPassword (event) {
    // Prevent default form submission
    event.preventDefault();

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
    DATA.code = await new Promise((resolve) => {
      argon2.hash(argonOpts).then(async ({hash}) => {
        const d_key = await decryptKey({hash, key});
        const message = await decryptSecret({data, key: d_key});
        const m_text = new TextDecoder().decode(message);
        resolve(m_text);
      });
    });
    const octokit = new Octokit({
      auth: DATA.code 
    });
    const git = {
      owner: "tvquizphd",
      repo: "public-quiz-device"
    }
    /* const star_api = `/user/starred/${git.owner}/${git.repo}`;
     * await octokit.request(`PUT ${star_api}`, git);
     * alert('Star!');
     */
    const v = "v";
    const sock_inputs = {
      token: DATA.code,            
      scope: v,  
      title: "verify",
      owner: "tvquizphd"
    };
    const pSock = await toProjectSock(sock_inputs);
    const Opaque = await OP(pSock);
    const times = 1000;
    await Opaque.clientRegister(pass, "root", v);
    Opaque.clientAuthenticate(pass, "root", times, v).then((session) => {
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
    DATA.loading = true;
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
   const secret = DATA.secret || "############";
   const code = DATA.code || "*******";
   return `
      <p> Session encryption key: ${secret} </p>
      <p> GitHub API Code: ${code} </p>
      <p></p>
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
        <form id="${passFormId}">
          <label for="pwd">Password:</label>
          <input type="password" id="pwd" name="pwd">
          <button>Decrypt Code</button>
        </form>
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
