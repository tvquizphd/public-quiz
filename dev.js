import fs from 'fs';
import url from 'url';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import child from 'child_process';
import UAParser from 'ua-parser-js';
const PORT = 8000 // match tests

const logger = (err, prefix, input) => {
  const mode = err ? 'error' : 'log';
  const one = typeof input === "string";
  const lines = one ? [input] : input;
  if (lines.length === 0) return null;
  const pfx = `${prefix.toUpperCase()}`;
  console[mode]([pfx+':', ...lines].join('\n'));
  return lines.map((l,i) => [i, pfx, l]);
}

const normalize = (root, url_in) => {
  const { pathname } = url.parse(url_in);
  const p = path.parse(`.${pathname || ''}`);
  const suffix = p.ext ? '' : 'index.html';
  return path.join(root, path.format(p), suffix);
}

const startServer = async (port, opts) => {
  return http.createServer((req, res)  => {
    const root = {
      GET: 'client',
      POST: 'tmp-dev'
    }
    const ua = req.headers['user-agent'];
    if (ua !== opts.ua) {
      opts.log = toLogger(ua);
      opts.ua = ua;
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
      return;
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
  return fs.readFileSync(fname).length === 0;
}

const CLEAN = () => {
  if (process.argv.length < 3) return false;
  return process.argv[2] === 'clean';
};

const appendEvent = (msg_file, data) => {
  const encoding = 'utf8';
  fs.appendFileSync(msg_file, data, { encoding });
}

const writeEvent = (msg_file, data) => {
  const encoding = 'utf8';
  fs.writeFileSync(msg_file, data, { encoding });
}

const readEvent = (msg_file) => {
  const encoding = 'utf8';
  const data = fs.readFileSync(msg_file, { encoding });
  return data.toString();
}

const toLogger = (_ua) => {
  const log_dir = "tmp-log";
  const ua = new UAParser(_ua);
  const name = ua.getBrowser().name || "None";
  const ia = { hour: 'numeric', weekday: 'short' };
  const when = new Date().toLocaleString('ia', ia).replace(' ', '');
  const random = crypto.randomBytes(16).toString('base64url');
  const file_name = [ when+'00', name, random ].join('_') + '.log';
  if (!fs.existsSync(log_dir)) fs.mkdirSync(log_dir);
  const log_file = path.join(log_dir, file_name);
  fs.openSync(log_file, 'w');
  return (err, prefix, input) => {
    const lines = logger(err, prefix, input);
    if (lines === null) return;
    const json = lines.map(l => JSON.stringify(l));
    appendEvent(log_file, [...json, ''].join('\n'));
  }
}

const toNewOpts = (ua) => {
  return { ua, log: toLogger(ua) };
}

const dev = async (env) => {
  const pre = 'DEV';
  const opts = toNewOpts(null);
  const basic_log = opts.log;
  try {
    if (CLEAN()) fs.unlinkSync(env);
  }
  catch (e) {
    opts.log(0, pre, e.message);
  }
  const delay = 5;
  const stdio = 'pipe';
  const ses = 'ROOT__SESSION';
  const child_procs = new Set();
  const msg_file = "./tmp-dev/msg.txt";
  const args = ['bash', ['develop.bash'], { stdio }];
  opts.log(0, pre, `Polling ${msg_file} each ${delay} secs`)
  const server = await startServer(PORT, opts);
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
      opts.log(0, pre, 'Waited ' + toTimeDelta(state.basis));
    }
    else {
      const new_basis = Date.now();
      const bash_proc = child.spawn(...args);
      child_procs.add(bash_proc)
      bash_proc.stdout.on('data', (data) => {
        const filter = (line) => {
          if (!line.length) return false;
          return line.match(/^Action/); // Filter
        }
        const lines = data.toString().split('\n');
        opts.log(0, 'BASH', lines.filter(filter));
      });
      await new Promise(r => bash_proc.on('close', r));
      opts.log = basic_log; // Reset Log after process end
      opts.log(0, pre, 'Done in ' + toTimeDelta(new_basis));
      await new Promise(r => setTimeout(r, dt));
      state.basis = new_basis;
      state.first = false;
    }
  }
}

const main_file = `file://${process.argv[1]}`;
if (import.meta.url === main_file) dev('.env');

export default dev;
