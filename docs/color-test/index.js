import { Mailer } from "mailer";
import { DBTrio } from "dbtrio";
import { templates } from "templates";
import { Workflow } from "workflow";
import { toEnv } from "environment";

const USERS = [
  "tvquizphd", "john@hoff.in", "mom", "irl", "wifi"
];
const SITES = [
  "google.com", "github.com", "twitter.com", "reddit.com",
  "bank of america", "npm auth code", "that one briefcase",
  "1798 Beacon St"
];
const user_range = USERS.map((_, i) => i);
const site_range = USERS.map((_, j) => j);

const PASSWORDS = [].concat(...user_range.map((_, i) => {
  const filter = () => Math.random() > 0.5;
  return site_range.map((_, j) => {
    return [`${i}`, `${j}`, "password!"];
  }).filter(filter);
}))

const runReef = (hasLocal, remote, env) => {

  const passFormId = "pass-form";
  const {store, component} = window.reef;
  console.log({ hasLocal, remote, env }) // TODO;

  let HANDLERS = [];
  const DATA = store({
    tables: [ SITES, USERS, PASSWORDS ],
    step: 0,
    newRows: [ 
      ["tech giant"],
      ["cool user 42"],
      ["", "", "password!"] 
    ],
    loading: {
      socket: false,
      mailer: false,
      database: false,
      sending: false
    }
  });
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
  const props = { DATA, API, templates };
  const workflow = new Workflow(props);

  async function decryptWithPassword (event) {
    event.preventDefault();
  }

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

  // Handle all click events
  function clickHandler (event) {
    for (const handler of HANDLERS) {
      if (event.target.id === handler.id) {
        return handler.fn();
      }
    }
  }

  function appTemplate () {
    const { html, handlers } = workflow.render;
    HANDLERS = handlers;
    return html;
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
