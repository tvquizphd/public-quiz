const toRows = (s) => {
  return s.split('\n').map(r => r.split(','));
}

const toEnv = async (root) => {
  const valid = {
    REMOTE: "remote",
    VERSION: "version",
    DEPLOYMENT: "env"
  };
  const modifiers = {
    REMOTE: (s) => s.split('/')
  }
  const source = `${root}environment.csv`;
  const response = await fetch(source);
  const rows = toRows(await response.text());
  const filtered = rows.filter(([k, v]) => {
    return k in valid && v?.length > 0;
  });
  const renamed = filtered.map(([k, v]) => {
    const mod = modifiers[k] || (s => s);
    return [valid[k], mod(v)];
  })
  return Object.fromEntries(renamed);
}

export { toEnv }
