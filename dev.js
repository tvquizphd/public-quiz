import fs from 'fs';
import url from 'url';
import path from 'path';
import http from 'http';
import child from 'child_process';
const PORT = 8000 // match tests

const logger = (err, prefix, input) => {
  const mode = err ? 'error' : 'log';
  const one = typeof input === "string";
  const lines = one ? [input] : input;
  if (lines.length === 0) return;
  console[mode]([
    `${prefix.toUpperCase()}: `, ...lines 
  ].join(one ? '' : '\n'));
}

const normalize = (root, url_in) => {
  const { pathname } = url.parse(url_in);
  const p = path.parse(`.${pathname || ''}`);
  const suffix = p.ext ? '' : 'index.html';
  return path.join(root, path.format(p), suffix);
}

const startServer = async (port) => {
  return http.createServer((req, res)  => {
    const root = {
      GET: 'client',
      POST: 'tmp-dev'
    }
    if (req.method === 'POST') {
      const { pathname } = url.parse(req.url);
      const valid = ['/msg.txt', '/vars.txt'];
      const empty = { "Content-Length": 0 };
      if (!valid.includes(pathname)) {
        res.statusCode = 403;
        res.end(`Error: Forbidden.`);
        return;
      }
      let body = "";
      req.on("data", str => body += str);
      req.on("end", () => {
        writeEvent(path.join(root.POST, pathname), body)
        res.writeHead(201, empty).end();
      });
    }
    const full_path = normalize(root.GET, req.url);
    const ext = path.extname(full_path);
    // Get mimetype from extension
    const mime = {
      '.css': 'text/css',
      '.csv': 'text/csv',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.js': 'text/javascript'
    }[ext] || 'text/plain';

    const exist = fs.existsSync(full_path);
    if(!exist) {
      res.statusCode = 404;
      res.end(`Not found: ${full_path}`);
      return;
    }
    try {
      const data = fs.readFileSync(full_path);
      res.setHeader('Content-type', mime);
      res.end(data);
    }
    catch (e) {
      res.statusCode = 500;
      res.end(`Error: ${e.message}.`);
    }
  }).listen(PORT);
};

const toTimeDelta = (basis) => {
  var date = new Date(0);
  date.setMilliseconds(Date.now() - basis);
  return 'Δ'+date.toISOString().substring(10, 19);
}

const isEmpty = (fname) => {
  if (!fs.existsSync(fname)) return true;
  return fs.readSync(fname).length === 0;
}

const CLEAN = () => {
  if (process.argv.length < 3) return false;
  return process.argv[2] === 'clean';
};

const writeEvent = (msg_file, data) => {
  const encoding = 'utf8';
  fs.writeFileSync(msg_file, data, { encoding });
}

const readEvent = (msg_file) => {
  const encoding = 'utf8';
  const data = fs.readFileSync(msg_file, { encoding });
  return data.toString();
}

const dev = async (env) => {
  try {
    if (CLEAN()) fs.unlinkSync(env);
  }
  catch (e) {
    console.log(e.message);
  }
  const delay = 5;
  const pre = 'LOG';
  const stdio = 'inherit';
  const ses = 'ROOT__SESSION';
  const child_procs = new Set();
  const msg_file = "./tmp-dev/msg.txt";
  const args = ['bash', ['develop.bash'], { stdio }];
  logger(0, pre, `Polling ${msg_file} each ${delay} secs`)
  const server = await startServer(PORT);
  const dt = delay * 1000;
  const state = {
    first: CLEAN(),
    basis: Date.now(),
  };
  // Handle process closure
  process.on('SIGINT', () => {
    [...child_procs].map(p => p.kill('SIGINT'));
    server.close(() => process.exit(0));
  });
  // Await client inputs
  while (true) {
    // read text file as string
    const msg = await new Promise((resolve, reject) => {
      try {
        const s = readEvent(msg_file);
        if (!s.match(/\S/)) resolve(null);
        else resolve(s);
      }
      catch (e) {
        if (e?.code === 'ENOENT') resolve(null);
        else reject(e);
      }
    });
    if (!state.first && !isEmpty(env) && !msg) {
      await new Promise(r => setTimeout(r, dt));
      logger(0, pre, 'Waited ' + toTimeDelta(state.basis));
    }
    else {
      const new_basis = Date.now();
      const bash_proc = child.spawn(...args);
      child_procs.add(bash_proc)
      await new Promise(r => bash_proc.on('close', r));
      logger(0, pre, 'Done in ' + toTimeDelta(new_basis));
      await new Promise(r => setTimeout(r, dt));
      state.basis = new_basis;
      state.first = false;
    }
  }
}

const main_file = `file://${process.argv[1]}`;
if (import.meta.url === main_file) dev('.env');

export default dev;
