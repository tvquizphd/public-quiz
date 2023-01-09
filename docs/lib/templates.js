const formTemplate = (inputs) => {
  const passFormId = "pass-form";
  const { title } = inputs.node;
  const { loading } = inputs.node;
  const u_id = "u-root";
  const p_id = "password-input";
  const user_auto = 'readonly="readonly" autocomplete="username"';
  const user_props = `id="${u_id}" value="root" ${user_auto}`;
  const pwd_auto = 'autocomplete="current-password"';
  const pwd_props = `id="${p_id}" ${pwd_auto}`;
  let bottom = `
    <button class="true-blue">Log In</button>
  `;
  if (loading) {
    bottom = `<div class="loading large-font">
      <div>${title}</div>
    </div>`;
  }
  const html = `
  <div class="wrap-shadow">
    <h2 class="center-text">${title}</h2>
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

const isValid = async (dir) => {
  for await (const [k0, v0] of dir.entries()) {
    if (k0 !== "tmp-wiki") continue;
    for await (const [k1, v1] of v0.entries()) {
      if (k1 !== "public-quiz-device.wiki") continue;
      return v1;
    }
  }
  return null
} 

const actionTemplate = (step, is_idx, act) => {
  if (is_idx && act?.act === "copy") {
    const cls = "copier";
    const action_content = `
      <button class="button true-tan">${act.text}</button>
    `;
    const fn = async () => {
      navigator.clipboard.writeText(act.target);
      step();
    };
    const handlers = [{ query: `.${cls}`, fn }];
    return { cls, action, handlers };
  }
  else if (is_idx && act?.act === "go") {
    const action = `<form action="${act.target}" method="post">
       <input type="submit" value="${act.text}" class="true-tan">
    </form>
    `;
    const cls = "redirection";
    return { cls, action, handlers: [] };
  }
  else if (is_idx && act?.act === "open") {
    const cls = "opener";
    const action = `
      <button class="button true-tan">${act.text}</button>
      <span>${act.target}</span>
    `;
    const fn = async () => {
      const dir_opts = { mode: "readwrite" };
      const dir = await window.showDirectoryPicker(dir_opts);
      let dev_root = null;
      while (!dev_root) {
        dev_root = await isValid(dir);
      }
      step(dev_root);
    };
    const handlers = [{ query: `.${cls}`, fn }];
    return { cls, action, handlers };
  }
  const action = `
    <span>${act?.text || ""}</span>
  `;
  return { cls: "", action, handlers: [] };
}

const listTemplate = (inputs) => {
  const { stepNext, setDevHandle } = inputs;
  const { index, items } = inputs.node;
  const colors = [ "", "dark-blue" ];
  let handlers = []
  const lines = items.map((item, idx) => {
    const { text, link, act } = item;
    const is_idx = (idx === index);
    const cls = [colors[+is_idx]];
    const fn = async (dev_root) => {
      if (dev_root) {
        await setDevHandle(dev_root);
      }
      stepNext(idx + 1);
    }
    const out = actionTemplate(fn, is_idx, act);
    handlers = handlers.concat(out.handlers);
    cls.push(out.cls);
    let core_content = text;
    if (is_idx && link?.href) {
      const a_props = [
        `href="${link.href}"`,
        'target="_blank"',
        'rel="noopener noreferrer"'
      ].join(" ");
      core_content += `<a ${a_props}>${link.text}</a>`;
    }
    else if (link?.text) {
      core_content += `<span>${link.text}</span>`;
    }
    const content = [
      `<span>${idx+1}.</span>`,
      out.action,
      `<span>${core_content}</span>`,
    ].join("");
    const props = `class="${cls.join(" ")}"`;
    return `<div ${props}>${content}</div>`;
  }).join('');
  const props = 'class="wrap-shadow"';
  const core = `<div class="ol">${lines}</div>`;
  const html = `<div ${props}>${core}</div>`;
  return { html, handlers: handlers };
}
const modalTemplate = (inputs) => {
  const { hideModal } = inputs;
  const { uuid, error, message } = inputs.node;
  const color = ["dark-pink", "black-blue"][+!error];
  const content = `<div>${message}</div>`;
  const close_id = `close-modal-${uuid}`;
  const fn = async () => hideModal();
  const handlers = [{query: `#${close_id}`, fn }];
  const close_props = `id="${close_id}" class="dark-pink"`;
  const close_button = `<button ${close_props}>close</button>`
  const core = `<div class="${color}">
    <div>${content}</div>
    ${close_button}
  </div>`;
  const html = `<div class="wrap-modal">${core}</div>`;
  return { html, handlers };
}
const readyTemplate = (inputs) => {
  const { text, link } = inputs.node;
  const link_props = [
    `href="${link.href}"`,
    'target="_blank"',
    'rel="noopener noreferrer"'
  ].join(" ");
  const login_link = `<a ${link_props}>${link.text}</a>`;
  const long_link = `<p class="long-link">${login_link}</p>`;
  const html = `<p>${text}</p>${long_link}`;
  return { html, handlers: [] };
}
const templates = {
  form: formTemplate,
  modal: modalTemplate,
  ready: readyTemplate,
  list: listTemplate
}

export { templates };
