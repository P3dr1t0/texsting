// Prueba de Ajustes → «Usar sin internet» con un motor falso (simula la descarga de paquetes).
import { createRequire } from 'node:module';
const require = createRequire('/home/claude/.npm-global/lib/node_modules/');
const { chromium } = require('playwright');
const OUT = '/home/claude/tests/shots';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  localStorage.setItem('texsting.settings', JSON.stringify({ theme: 'light' }));
  const oyentes = [];
  let instalados = 3;
  window.__motorPrueba = {
    async sinInternet() {
      return { basicos: { total: 120, listos: instalados, descarga: 48e6 * (120 - instalados) / 120, instalado: 160e6 }, avanzados: { total: 2900, listos: instalados, descarga: 1.4e9, instalado: 4.1e9 }, ocupado: instalados * 2e6, paquetes: instalados, descargando: false };
    },
    async descargarSinInternet({ nivel }) {
      const total = 117;
      let i = 0;
      const t = setInterval(() => {
        i += 13; instalados = 3 + Math.min(i, total);
        const fin = i >= total;
        for (const cb of oyentes) cb({ nivel, hechos: Math.min(i, total), total, paquete: 'pgfplots', bytes: Math.min(i, total) * 4e5, bytesTotal: total * 4e5, fin, fallos: 0, cancelado: false });
        if (fin) clearInterval(t);
      }, 300);
    },
    async cancelarDescarga() {},
    async borrarDescargados() { const l = instalados * 2e6; instalados = 0; return { liberado: l }; },
    async addListener(ev, cb) { if (ev === 'descargaPaquetes') oyentes.push(cb); return { remove() {} }; },
  };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:8080/index.html');
await page.click('[aria-label="Ajustes"]');
await page.waitForSelector('.sin-internet:not([hidden]) .lic-item');
await page.locator('.sin-internet').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/sin-internet-1.png` });
await page.click('.sin-internet .lic-item:has-text("básicos") button:has-text("Descargar")');
await page.waitForTimeout(700);
await page.locator('.sin-internet').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/sin-internet-2.png` });
console.log('durante:', await page.textContent('.sin-internet .lic-item:has-text("básicos") small'));
await page.waitForTimeout(3500);
console.log('después:', await page.textContent('.sin-internet .lic-item:has-text("básicos") small'), '| toast:', await page.textContent('.toast').catch(() => ''));
await page.click('.sin-internet .lic-item:has-text("avanzados") button:has-text("Descargar")');
await page.waitForTimeout(300);
console.log('aviso grande:', await page.textContent('.dialog').catch(() => '(sin aviso)'));
await page.click('.dialog >> text=Cancelar');
await page.click('.sin-internet >> button:has-text("Borrar")');
await page.click('.dialog >> button:has-text("Borrar")');
await page.waitForTimeout(500);
console.log('tras borrar:', await page.textContent('.toast').catch(() => ''));
await page.locator('.sin-internet').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/sin-internet-3.png` });
console.log('ERRORES:', errors.length ? errors : 'ninguno');
await b.close();
