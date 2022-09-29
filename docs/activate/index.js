/*
 * Globals needed on window object:
 *
 * reef, decryptQuery
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
    decryptQuery(search, pass).then(({ plain_text }) => {
      DATA.code = plain_text;
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
      <div class="container">
        <div class="contained">
          <div>
          ${codeTemplate()}
          </div>
          <form id="${passFormId}">
            <label for="pwd">Password:</label>
            <input type="password" id="pwd" name="pwd">
            <button>Decrypt Code</button>
          </form>
        </div>
      </div>
    `;
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
