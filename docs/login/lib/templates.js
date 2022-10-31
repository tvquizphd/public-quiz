const to_random = (n) => {
  const empty = new Uint8Array(Math.ceil(n / 2));
  const bytes = [...crypto.getRandomValues(empty)];
  const to_pair = x => {
    const [p0, p1] = x.toString(36).padStart(2,'0');
    const P0 = Math.random() > 0.5 ? p0.toUpperCase() : p0;
    const P1 = Math.random() > 0.5 ? p1.toUpperCase() : p1;
    const sep = Math.random() > 0.5 ? '' : '-';
    return [P0, P1].join(sep);
  }
  return bytes.map(to_pair).join('');
}
const saveTemplate = (inputs) => {
  const { title, loading } = inputs.node;
  const cls = "send-mail button black-blue";
  let core = `
    <button class="${cls}">Save 💌</button>
  `;
  if (loading) {
    core = `<div class="loading large-font">
      <div>${title}</div>
    </div>`;
  }
  const html = `
  <div class="wrap-save">
    ${core}
  </div>`
  return { html, handlers: [] };
}
const navTemplate = (inputs) => {
  const { stepBack } = inputs;
  const { uuid, labels } = inputs.node;
  const slash = '<div class="slash">/</div>'
  const items = labels.map((label) => {
    return `<div>${label}</div>`;
  }).join(slash);
  const id = `${uuid}-go-back`;
  const props = [
    'class="wrap-nav"',
    `id=${id}`
  ].join(' ');
  const fn = () => stepBack(); 
  const handlers = [{ id, fn }]
  const html = `<div ${props}>${items}</div>`;
  return { html, handlers };
}
const formTemplate = (inputs) => {
  const passFormId = "pass-form";
  const { uuid, title, loading } = inputs.node;
  const id = `${uuid}-form-login`;
  const u_id = "u-root";
  const p_id = "password-input";
  const user_auto = 'readonly="readonly" autocomplete="username"';
  const user_props = `id="${u_id}" value="root" ${user_auto}`;
  const pwd_auto = 'autocomplete="current-password"';
  const pwd_props = `id="${p_id}" ${pwd_auto}`;
  let bottom = `
    <button id="${id}" class="button true-blue">Log in</button>
  `;
  if (loading) {
    bottom = `<div class="loading large-font">
      <div>${title}</div>
    </div>`;
  }
  const html = `
  <div class="wrap-form">
    <h2>${title}</h2>
    <form id="${passFormId}">
      <label for="${u_id}">Username:</label>
      <input type="text" ${user_props}>
      <label for="${p_id}">Password:</label>
      <input type="password" ${pwd_props}>
      ${bottom} 
    </form>
  </div>`
  return { html, handlers: [] };
}
const buttonsTemplate = (inputs) => {
  const { stepNext, stepHome } = inputs;
  const { data } = inputs.node;
  const idx = data?.idx || "";
  const password = data?.password || "";
  const { keys, uuid } = inputs.node;
  const api = inputs.api;
  const labels = {
    "NEW": "alter ✨",
    "NEW-NEXT": "new ✨",
    "PASTE": "alter ✂️",
    "PASTE-NEXT": "use ✂️",
    "PASTE-DONE": "alter ✂️",
    "READ-NEXT": "view 🔑",
    "WRITE-DONE": "ok 💯",
    "ERASE-DONE": "lose ☠️",
    "COPY-DONE": "copy 🔑"
  };
  const deletePass = api.dbt.at.deleteSecret;
  const setNewPass = api.dbt.at.setNewSecret;
  const savePass = api.dbt.at.addNewSecret;
  const setPass = api.dbt.at.setSecret;
  const update = (s) => {
    return idx ? setPass(idx, s) : setNewPass(s);
  }
  const copyPass = () => {
    navigator.clipboard.writeText(password);
  };
  const pastePass = async () => {
    const text = await navigator.clipboard.readText();
    update(text);
  }
  const makePass = () => {
    const text = to_random(16);
    update(text);
  }
  const removePass = () => deletePass(idx);
  const actions = {
    "NEW": () => [ makePass() ],
    "NEW-NEXT": () => [ makePass(), stepNext(false) ],
    "PASTE": () => [ pastePass() ],
    "PASTE-NEXT": async () => {
      await pastePass();
      stepNext(false);
    },
    "PASTE-DONE": async () => {
      await pastePass();
      savePass();
    },
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
    "black-pink", "black-blue", "dark-blue", "true-blue"
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
  const { stepNext, api } = inputs;
  const pickSite = api.dbt.at.setNewSecretServer;
  const pickUser = api.dbt.at.setNewSecretClient;
  const filter = inputs.node.filter || (() => true);
  const { table, key, empty, uuid } = inputs.node;
  const picker = ({
    sites: pickSite,
    users: pickUser
  })[key] || (() => null);
  const handlers = table.map(([label], i) => {
    const id = `${uuid}-${label}-${i}`;
    const data = { label };
    const fn = () => {
      picker(`${i}`);
      stepNext(false); 
    };
    return { data, id, fn };
  }).filter(filter);
  if (!handlers.length && empty) {
    const labels = [empty];
    const node = { ...inputs.node, labels };
    return navTemplate({...inputs, node});
  }
  const items = handlers.map(({ data, id }, i) => {
    const colors = [
      'black-blue', 'black-pink', 'black-tan',
      'dark-blue', 'dark-pink', 'dark-tan'
    ];
    const color = colors[i % colors.length];
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
  const { stepNext, api } = inputs;
  const { table, uuid, key } = inputs.node;
  const f_id = `${uuid}-form-root`;
  const id = `${uuid}-form-define`;
  const write_id = "write-define";
  const next_id = `${table.length}`;
  const pickSite = api.dbt.at.setNewSecretServer;
  const pickUser = api.dbt.at.setNewSecretClient;
  const makeSite = api.dbt.at.setNewServer;
  const makeUser = api.dbt.at.setNewClient;
  const addSite = api.dbt.at.addNewServer;
  const addUser = api.dbt.at.addNewClient;
  const maker = ({
    sites: (v) => [makeSite(v), addSite(), pickSite(next_id)],
    users: (v) => [makeUser(v), addUser(), pickUser(next_id)]
  })[key] || (() => null);
  const fn = (event) => {
    const root = event.target.closest("form");
    const { value } = root.querySelector("input");
    const is_space = (c) => c.match(/\s/);
    if (![...value].every(is_space)) {
      maker(value);
      stepNext(false);
    }
  };
  const label = ({
    "sites": "provider",
    "users": "username"
  })[key]
  const write = `
  <div class="wrap-form">
    <form id="${f_id}">
      <label class="large-font" for="${write_id}">New ${label}:</label>
      <input class="large-font" id="${write_id} "type="text">
      <button id="${id}" class="button true-blue">ok 💯</button>
    </form>
  </div>`
  const read = readTemplate(inputs);
  const html = `${read.html}\n${write}`;
  const handlers = [ { id, fn } ].concat(read.handlers);
  return { html, handlers };
}

const templates = {
  save: saveTemplate,
  nav: navTemplate,
  form: formTemplate,
  buttons: buttonsTemplate,
  display: displayTemplate,
  write: writeTemplate,
  read: readTemplate,
}

export { templates };
