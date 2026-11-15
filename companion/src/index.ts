// FaZe HQ RGB companion: `npm start`. Keeps the keyboard off between effects and on exit.
import { openAura } from './aura.ts';
import { createServer } from './server.ts';

const PORT = 7777;
const lights = openAura();
if (lights) lights.off();
const app = createServer({ lights });
app.server.listen(PORT, '127.0.0.1', () => {
  console.log(`RGB companion on http://127.0.0.1:${PORT} (keyboard: ${lights ? 'found' : 'not found'})`);
});

let done = false;
const quit = () => {
  if (done) return;
  done = true;
  app.shutdown();
  app.server.close();
  process.exit(0);
};
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.on('exit', () => app.shutdown());
