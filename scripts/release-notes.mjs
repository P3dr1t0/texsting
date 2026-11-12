// Extrae del CHANGELOG.md la sección de la versión actual (la primera "## [x.y.z]")
// para usarla como descripción del APK publicado en GitHub Releases.
import { readFileSync, writeFileSync } from 'node:fs';

const md = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const start = md.search(/^## \[\d/m);
let section = start >= 0 ? md.slice(start) : '';
const next = section.slice(3).search(/^## \[/m);
if (next >= 0) section = section.slice(0, next + 3);
section = section.replace(/\n---\s*$/, '').trim();
const out = `${section}\n\n---\nDescarga **TeXsting.apk** desde el teléfono e instálalo encima de la versión anterior.\nRegistro completo: [CHANGELOG.md](https://github.com/P3dr1t0/texsting/blob/main/CHANGELOG.md)\n`;
writeFileSync(process.argv[2] || 'release-notes.md', out);
console.log(out);
