const navTemplate = (inputs) => {
  const { labels } = inputs.node;
  const slash = "<div>/</div>"
  const items = labels.map((label) => {
    return `<div>${label}</div>`;
  }).join(slash);
  const props = 'class="wrap-nav"';
  const html = `<div ${props}>${items}</div>`;
  return { html, handlers: [] };
}
const formTemplate = (inputs) => {
  const passFormId = "pass-form";
  const { uuid, title } = inputs.node;
  const { stepNext } = inputs;
  const id = `${uuid}-form-login`;
  const u_id = "user-root";
  const p_id = "password-input";
  const user_auto = 'readonly="readonly" autocomplete="username"';
  const user_props = `id="u-root" value="root" ${user_auto}`;
  const pwd_auto = 'autocomplete="current-password"';
  const pwd_props = `id="${p_id}" ${pwd_auto}`;
  const fn = () => [stepNext(true)];
  const handlers = [ { id, fn } ];
  const html = `
  <div class="wrap-form">
    <h2>${title}</h2>
    <form id="${passFormId}">
      <label for="${u_id}">Username:</label>
      <input id="${u_id} "type="text" ${user_props}>
      <label for="${p_id}">Password:</label>
      <input type="password" ${pwd_props}>
      <p></p>
      <button id="${id}" class="button true-blue">Log in</button>
    </form>
  </div>`
  return { html, handlers };
}
const buttonsTemplate = (inputs) => {
  const { stepBack, stepNext, stepHome } = inputs;
  const { keys, uuid } = inputs.node;
  const api = inputs.api;
  const labels = {
    "NEW": "alter ✨",
    "NEW-NEXT": "new ✨",
    "PASTE": "alter ✏️",
    "PASTE-NEXT": "add ✏️",
    "PASTE-DONE": "alter ✏️",
    "READ-NEXT": "get 🔑",
    "WRITE-DONE": "ok 💯",
    "ERASE-DONE": "lose ☠️",
    "COPY-DONE": "copy 🔑"
  };
  const savePass = () => null;
  const makePass = () => null;
  const copyPass = () => null;
  const pastePass = () => null;
  const removePass = () => null;
  const actions = {
    "NEW": () => [ makePass() ],
    "NEW-NEXT": () => [ makePass(), stepNext(false) ],
    "PASTE": () => [ pastePass() ],
    "PASTE-NEXT": () => [ pastePass(), stepNext(false) ],
    "PASTE-DONE": () => [ pastePass(), savePass(), stepHome() ],
    "READ-NEXT": () => [ stepNext(true) ],
    "WRITE-DONE": () => [ savePass(), stepHome() ],
    "ERASE-DONE": () => [ removePass(), stepHome()],
    "COPY-DONE": () => [ copyPass(), stepHome() ],
  }
  const colors = {
    "NEW": "dark-tan",
    "NEW-NEXT": "true-blue",
    "PASTE": "dark-tan",
    "PASTE-NEXT": "dark-blue",
    "PASTE-DONE": "dark-pink",
    "READ-NEXT": "true-tan",
    "WRITE-DONE": "true-blue",
    "ERASE-DONE": "true-pink",
    "COPY-DONE": "true-blue"
  }
  const handlers = keys.map((key, i) => {
    const fn = actions[key] || (() => null); 
    const id = `${uuid}-${key}-${i}`;
    const data = { key };
    return { data, id, fn };
  });
  const label_list = handlers.map(({ data, id }) => {
    const { key } = data;
    const label = labels[key] || key;
    const cls = colors[key];
    const props = [
      `class="${cls} button"`,
      `id=${id}`,
    ].join(" ");
    return `<button ${props}>${label}</button>`;
  }).join('');
  const props = 'class="wrap-3"';
  const html = `<div ${props}>${label_list}</div>`;
  return { html, handlers };
}
const displayTemplate = (inputs) => {
  const { items } = inputs.node;
  const colors = [
    "black-pink", "dark-tan", "true-tan"
  ]
  const baseline = colors[0];
  const lines = items.map((item) => {
    const { strength, text } = item;
    const color = colors[strength] || baseline;
    const props = `class="${color}"`;
    return `<div ${props}>${text}</div>`;
  }).join('');
  const props = 'class="wrap-lines"';
  const html = `<div ${props}>${lines}</div>`;
  return { html, handlers: [] };
}
const readTemplate = (inputs) => {
  const { stepNext } = inputs;
  const { table, uuid } = inputs.node;
  const action = () => stepNext(false); 
  const handlers = table.map((label, i) => {
    const id = `${uuid}-${label}-${i}`;
    const data = { label };
    const fn = action;
    return { data, id, fn };
  });
  const items = handlers.map(({ data, id }, i) => {
    const color = ['black-tan', 'black-pink', 'black-blue'][i % 3];
    const props = [
      `id="${id}"`,
      `class="${color} button"`
    ].join(' ');
    const label = data.label;
    return `<button ${props}>${label}</button>`;
  }).join('\n');
  const props = 'class="wrap-2"';
  const html = `<div ${props}>${items}</div>`;
  return { html, handlers };
}
const writeTemplate = (inputs) => {
  return readTemplate(inputs);//TODO
}

const templates = {
  nav: navTemplate,
  form: formTemplate,
  buttons: buttonsTemplate,
  display: displayTemplate,
  write: writeTemplate,
  read: readTemplate,
}

export { templates };
