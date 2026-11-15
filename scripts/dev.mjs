// Runs the API (:3001) and web (:5173) together, cross-platform, no extra deps.
// Usage: npm run dev
import { spawn, spawnSync } from 'node:child_process';

// On Windows, killing the npm shell leaves node children holding the ports: kill the tree.
const killTree = (p) => {
  if (p.exitCode !== null || !p.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
  else p.kill('SIGTERM');
};

const procs = [
  ['server', ['run', 'dev', '-w', 'server'], '\x1b[31m'],
  ['web', ['run', 'dev', '-w', 'web'], '\x1b[36m'],
].map(([name, args, color]) => {
  const p = spawn('npm', args, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (d) => out.write(d.toString().replace(/^(?=.)/gm, tag)));
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on('exit', (code) => {
    console.log(`${tag}exited (${code})`);
    procs.forEach((x) => x !== p && killTree(x));
    process.exit(code ?? 0);
  });
  return p;
});

const shutdown = () => {
  procs.forEach(killTree);
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
