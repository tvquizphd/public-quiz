/*
 * Globals needed on window object:
 *
 * reef, fromB64urlQuery, 
 * decryptKey, decryptSecret, argon2
 */

const runReef = (mainId, formId, passFormId) => {

let {store, component} = reef;

// Create reactive data store
let DATA = store({
    code: null,
});

/**
 * Decrypt with password
 */
function decryptWithPassword (event) {
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
    argon2.hash(argonOpts).then(async ({hash}) => {
      const d_key = await decryptKey({hash, key});
      const message = await decryptSecret({data, key: d_key});
      const m_text = new TextDecoder().decode(message);
      DATA.code = m_text;
    });
    // Clear the input field and return to focus
    passField.value = '';
    passField.focus();
}

/**
 * Handle form submit events
 */
function submitHandler (event) {
    if (event.target.matches(`#${formId}`)) {
        addTodo(event);
    }
    if (event.target.matches(`#${passFormId}`)) {
        decryptWithPassword(event);
    }
}

function codeTemplate () {
   const url = "https://github.com/login/device/";
   const code = DATA.code || "*******";
   const link = DATA.code ? `
     Paste the code <a href=${url}>at this url</a>.
   ` : '';
   return `
      <p> Code: ${code} </p>
      <p> ${link} </p>
   `;
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
        </form>`;
}

// Create reactive component
component(`#${mainId}`, appTemplate);

// Listen for events
document.addEventListener('submit', submitHandler);

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
