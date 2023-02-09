import fs from 'fs';
import child from 'child_process';

const logger = (err, prefix, input) => {
  const mode = err ? 'error' : 'log';
  const one = typeof input === "string";
  const lines = one ? [input] : input;
  if (lines.length === 0) return;
  console[mode]([
    `${prefix.toUpperCase()}: `, ...lines 
  ].join(one ? '' : '\n'));
}

const startServer = async (port) => {
  const dir = 'docs';
  const run = 'http-server';
  const serve_opts = { stdio: "pipe" };
  const web_server = [run, dir, `-p ${port}`];
  const serve_in = ['npx', web_server, serve_opts];
  const p_serve = child.spawn(...serve_in);
  await new Promise(resolve => {
    p_serve.stdout.once('data', () => {
      p_serve.stdout.once('data', d => {
        const lines = d.toString().split('\n').filter(l => l);
        logger(0, run, lines.slice(Math.max(lines.length - 2, 0)));
        resolve();
      });
    });
  });
  p_serve.stderr.on('data', d => {
    const lines = d.toString().split('\n').filter(l => l);
    logger(1, run, lines);
  });
  return p_serve;
};

const toTimeDelta = (basis) => {
  var date = new Date(0);
  date.setMilliseconds(Date.now() - basis);
  return 'Δ'+date.toISOString().substring(10, 19);
}

const CLEAN = () => {
  if (process.argv.length < 3) return false;
  return process.argv[2] === 'clean';
};

const readEvent = (msg_file) => {
  const encoding = 'utf8';
  const data = fs.readFileSync(msg_file, { encoding });
  return data.toString();
}

try {
  if (CLEAN()) fs.unlinkSync('.env');
}
catch (e) {
  console.log(e.message);
}
(async () => {
  const delay = 5;
  const pre = 'LOG';
  const stdio = 'inherit';
  const ses = 'ROOT__SESSION';
  const child_procs = new Set();
  const msg_file = "./tmp-dev/msg.txt";
  const args = ['bash', ['develop.bash'], { stdio }];
  logger(0, pre, `Polling ${msg_file} each ${delay} secs`)
  child_procs.add(await startServer(8000));
  const dt = delay * 1000;
  const state = {
    first: CLEAN(),
    basis: Date.now(),
  };
  // Handle process closure
  process.on('SIGINT', () => {
    [...child_procs].map(p => p.kill('SIGINT'));
    process.exit(0);
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
    if (!state.first && !msg) {
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
})()
