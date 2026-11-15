// Fire one effect: `npm run test-fx -- ace`
import { openAura } from './aura.ts';
import { EFFECTS, Player } from './effects.ts';

const name = process.argv[2] ?? '';
const lights = openAura();
if (!lights) {
  console.error('No ASUS Aura keyboard found.');
  process.exit(1);
}
if (!(await new Player(lights).play(name))) {
  console.error(`Unknown effect "${name}". Try: ${Object.keys(EFFECTS).join(', ')}`);
  lights.off();
  process.exit(1);
}
console.log(`played ${name}`);
