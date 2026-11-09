// Marca una nueva versión de la web: los navegadores descargan los archivos nuevos al abrirla.
// Uso: npm run version  (ejecutar antes de publicar cambios de código)
import fs from 'node:fs';
const version = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
fs.writeFileSync(new URL('../public/version.json', import.meta.url), JSON.stringify({ version }) + '\n');
console.log('versión', version);
