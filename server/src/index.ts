import { app } from './app.js';

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`FaZe HQ API on http://localhost:${port} (COACHING_MODE=${process.env.COACHING_MODE || 'auto'})`);
});
