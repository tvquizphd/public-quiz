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
    p_serve.stdout.once('data', d => {
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

(async (opts) => {
  const delay = 5;
  const pre = 'LOG';
  const stdio = 'inherit';
  const child_procs = new Set();
  const init_file = "./tmp-dev/init.txt";
  const init = ['bash', ['develop.bash'], { stdio }];
  const mail = ['bash', ['develop.bash', 'MAIL'], { stdio }];
  logger(0, pre, `Polling ${init_file} each ${delay} secs`)
  child_procs.add(await startServer(8000));
  const dt = delay * 1000;
  let basis = Date.now();
  // Handle process closure
  process.on('SIGINT', () => {
    [...child_procs].map(p => p.kill('SIGINT'));
    process.exit(0);
  });
  // Await client inputs
  while (true) {
    // read text file as string
    const cmd = await new Promise((resolve, reject) => {
      fs.readFile(init_file, 'utf8', (err, data) => {
        if (err?.code === 'ENOENT') resolve(null);
        else if (err) reject(err);
        else {
          const s = data.toString();
          const known = opts.includes(s);
          if (!s.match(/\S/)) resolve(null);
          else if (known) resolve(s);
          else reject(new Error('Invalid command'));
        }
      });
    });
    if (!cmd) {
      await new Promise(r => setTimeout(r, dt));
      logger(0, pre, 'Waited ' + toTimeDelta(basis));
    }
    else {
      basis = Date.now();
      const args = cmd === "MAIL" ? mail : init;
      const bash_proc = child.spawn(...args);
      child_procs.add(bash_proc)
      await new Promise(r => bash_proc.on('close', r));
      logger(0, pre, 'Done in ' + toTimeDelta(basis));
      fs.writeFileSync(init_file, "", { flag: 'w' });
      await new Promise(r => setTimeout(r, dt));
    }
  }
})([ 
  "INSTALL",
  "LOGIN",
  "MAIL"
])
