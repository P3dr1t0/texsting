// Prueba de la carpeta propia y «Abrir carpeta» con una carpeta falsa en memoria (simula el Storage Access Framework).
import { createRequire } from 'node:module';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = '/home/claude/tests/shots';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('texsting.settings')) localStorage.setItem('texsting.settings', JSON.stringify({ token: 'abc123', theme: 'light' }));
  // Sistema de archivos falso: id = ruta («primary:Documents/...»). Se guarda en sessionStorage para sobrevivir recargas.
  const load = () => JSON.parse(sessionStorage.getItem('fs') || '{"primary:Documents":{"dir":true,"mtime":1},"primary:Documents/Tesis":{"dir":true,"mtime":1},"primary:Documents/Tesis/main.tex":{"data":"XGRvY3VtZW50Y2xhc3N7YXJ0aWNsZX0KXGJlZ2lue2RvY3VtZW50fQpUZXNpcyBcaW5wdXR7Y2FwMX0KXGVuZHtkb2N1bWVudH0K","mtime":5},"primary:Documents/Tesis/cap1.tex":{"data":"Q2FwaXR1bG8gMQo=","mtime":5}}');
  const save = (fs) => sessionStorage.setItem('fs', JSON.stringify(fs));
  let t = 1000;
  const hijos = (fs, id) => Object.keys(fs).filter((k) => k.startsWith(id + '/') && !k.slice(id.length + 1).includes('/'));
  window.__fs = { load, save };
  window.__elegir = 'primary:Documents';
  window.__carpetasPrueba = {
    async elegir() { const id = window.__elegir; return { tree: 'tree:' + id, doc: id, nombre: id.split('/').pop().replace('primary:', ''), ruta: id.replace('primary:', '') }; },
    async carpeta({ doc, nombre }) { const fs = load(); const id = doc + '/' + nombre; if (!fs[id]) fs[id] = { dir: true, mtime: ++t }; save(fs); return { doc: id }; },
    async listar({ doc, recursivo }) {
      const fs = load(); if (!fs[doc]) throw new Error('no existe');
      const out = [];
      const walk = (id, base) => { for (const k of hijos(fs, id)) { const n = k.split('/').pop(); out.push({ path: base + n, doc: k, dir: !!fs[k].dir, size: (fs[k].data || '').length, mtime: fs[k].mtime }); if (fs[k].dir && recursivo) walk(k, base + n + '/'); } };
      walk(doc, ''); return { items: out };
    },
    async leer({ doc }) { return { data: load()[doc].data }; },
    async escribir({ doc, path, data }) {
      const fs = load(); let id = doc; const parts = path.split('/');
      for (const p of parts.slice(0, -1)) { id += '/' + p; if (!fs[id]) fs[id] = { dir: true, mtime: ++t }; }
      id += '/' + parts.at(-1); fs[id] = { data, mtime: ++t }; save(fs); return { doc: id, mtime: fs[id].mtime };
    },
    async borrar({ doc, path }) { const fs = load(); const id = path ? doc + '/' + path : doc; for (const k of Object.keys(fs)) if (k === id || k.startsWith(id + '/')) delete fs[k]; save(fs); },
    async renombrar({ doc, path, nombre }) { const fs = load(); const id = path ? doc + '/' + path : doc; const nid = id.replace(/[^/]*$/, nombre); for (const k of Object.keys(fs)) if (k === id || k.startsWith(id + '/')) { fs[nid + k.slice(id.length)] = fs[k]; delete fs[k]; } save(fs); return { doc: nid }; },
    async acceso({ doc }) { return { permiso: true, existe: !!load()[doc] }; },
  };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const fsKeys = () => page.evaluate(() => Object.keys(window.__fs.load()).sort());
await page.goto('http://127.0.0.1:8080/index.html');
await page.waitForSelector('.home-aviso:not([hidden])');
await page.screenshot({ path: `${OUT}/carpetas-01-aviso.png` });
// 1) Crear un proyecto antes de elegir carpeta (queda solo en la app)
await page.click('text=Nuevo proyecto');
await page.waitForSelector('.tpl-card');
await page.click('.tpl-card:has-text("Práctica")');
await page.fill('.dialog input', 'Práctica 1');
await page.click('.dialog .btn.primary');
await page.waitForSelector('.editor-screen');
await page.goto('http://127.0.0.1:8080/index.html');
await page.waitForSelector('.home-aviso:not([hidden])');
// 2) Elegir carpeta: crea Projects_LaTeX y copia el proyecto
await page.click('.home-aviso >> text=Elegir carpeta');
await page.waitForTimeout(1500);
console.log('tras elegir carpeta:', (await fsKeys()).filter((k) => k.includes('Projects_LaTeX')));
await page.screenshot({ path: `${OUT}/carpetas-02-elegida.png` });
// 3) Editar desde fuera (como la PC): cambiar main.tex del proyecto y agregar un archivo
const proj = (await fsKeys()).find((k) => /Projects_LaTeX\/[^/]+$/.test(k));
await page.evaluate((proj) => {
  const fs = window.__fs.load();
  const main = Object.keys(fs).find((k) => k.startsWith(proj + '/') && k.endsWith('.tex'));
  fs[main] = { data: btoa(unescape(encodeURIComponent('\\documentclass{article}\\begin{document}EDITADO EN LA PC\\end{document}'))), mtime: 99999 };
  fs[proj + '/notas.txt'] = { data: btoa('hola'), mtime: 99999 };
  window.__fs.save(fs);
}, proj);
await page.click('.project-open >> nth=0');
await page.waitForSelector('.editor-screen');
await page.waitForTimeout(800);
console.log('código tras abrir:', (await page.evaluate(() => document.querySelector('.basic-editor').value)).slice(0, 80));
await page.screenshot({ path: `${OUT}/carpetas-03-sinc.png` });
// 4) Escribir en la app → se guarda en la carpeta
await page.focus('.basic-editor');
await page.keyboard.press('Control+End');
await page.keyboard.type('\n% escrito en la app');
await page.waitForTimeout(2500);
const txt = await page.evaluate((proj) => { const fs = window.__fs.load(); const k = Object.keys(fs).find((k) => k.startsWith(proj + '/') && k.endsWith('.tex')); return decodeURIComponent(escape(atob(fs[k].data))); }, proj);
console.log('carpeta tras escribir:', JSON.stringify(txt.slice(-40)));
// 5) Abrir carpeta existente (Documents/Tesis)
await page.goto('http://127.0.0.1:8080/index.html');
await page.waitForSelector('.project-list');
await page.evaluate(() => { window.__elegir = 'primary:Documents/Tesis'; });
await page.click('.home-actions >> text=Abrir');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/carpetas-04-abrir.png` });
await page.click('.sheet-item:has-text("Carpeta del teléfono")');
await page.waitForSelector('.editor-screen');
await page.waitForTimeout(600);
console.log('tesis:', (await page.evaluate(() => document.querySelector('.basic-editor').value)).slice(0, 60));
// 6) Copiar una carpeta nueva a Projects_LaTeX desde fuera → aparece al volver al inicio
await page.evaluate(() => { const fs = window.__fs.load(); const r = 'primary:Documents/Projects_LaTeX/Desde la PC'; fs[r] = { dir: true, mtime: 1 }; fs[r + '/doc.tex'] = { data: btoa('\\documentclass{article}\\begin{document}PC\\end{document}'), mtime: 1 }; fs['primary:Documents/Projects_LaTeX/Vacia'] = { dir: true, mtime: 1 }; window.__fs.save(fs); });
await page.goto('http://127.0.0.1:8080/index.html');
await page.waitForTimeout(1500);
console.log('proyectos:', await page.$$eval('.project-meta strong', (a) => a.map((x) => x.textContent)));
await page.screenshot({ path: `${OUT}/carpetas-05-inicio.png` });
// 7) Renombrar y eliminar
const opc = page.locator('.project-card:has-text("Desde la PC") [aria-label="Opciones"]');
await opc.click(); await page.click('.sheet-item:has-text("Renombrar")'); await page.fill('.dialog input', 'Renombrado'); await page.keyboard.press('Enter');
await page.waitForTimeout(800);
console.log('tras renombrar:', (await fsKeys()).filter((k) => /Projects_LaTeX\/[^/]+$/.test(k)));
await page.locator('.project-card:has-text("Renombrado") [aria-label="Opciones"]').click(); await page.click('.sheet-item:has-text("Eliminar")');
await page.waitForTimeout(300);
console.log('mensaje:', await page.textContent('.dialog'));
await page.click('.dialog >> button:has-text("Eliminar")');
await page.waitForTimeout(800);
console.log('tras eliminar:', (await fsKeys()).filter((k) => /Projects_LaTeX\/[^/]+$/.test(k)));
await page.locator('.project-card:has-text("Tesis") [aria-label="Opciones"]').click(); await page.click('.sheet-item:has-text("Eliminar")');
await page.waitForTimeout(300);
console.log('mensaje externa:', await page.textContent('.dialog'));
console.log('ERRORES:', errors.length ? errors : 'ninguno');
await b.close();
