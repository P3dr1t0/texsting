// Carpetas reales en el teléfono (#4 y #7).
// - Carpeta propia: Documentos/Projects_LaTeX/<proyecto>/, visible desde Archivos y la PC.
// - Abrir carpeta: un proyecto que ya existe en el teléfono, editado ahí mismo.
// La app sigue trabajando con su copia interna (rápida, sin permisos); cada cambio se escribe también en la carpeta
// y, al abrir un proyecto, se traen los cambios hechos desde fuera (la PC, otra app).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { setEspejo, listFiles, putFile, deleteFile, createProject, getSettings, setSettings, isTextPath, listProjects, getProject, saveProject } from './store.js';
import { bytesToBase64, base64ToBytes, sanitizeName } from './util.js';

// Las pruebas automáticas (tests/carpetas.mjs) ponen una carpeta falsa en memoria en window.__carpetasPrueba.
const prueba = typeof window !== 'undefined' ? window.__carpetasPrueba : null;
const Carpetas = prueba || registerPlugin('Carpetas');
const enc = new TextEncoder();
const dec = new TextDecoder();
const RAIZ = 'Projects_LaTeX';
// Proyectos eliminados: su carpeta va aquí (dentro de Projects_LaTeX, visible desde Archivos) hasta que se borran de verdad a los 15 días.
const PAPELERA = 'Papelera de TeXsting';
const VINC_KEY = 'texsting.carpetas';

/** Archivos que genera la compilación: no son del proyecto (no se importan desde la carpeta). */
const GENERADO = /\.(aux|log|out|toc|lof|lot|fls|fdb_latexmk|synctex|synctex\.gz|bbl|blg|bcf|run\.xml|idx|ind|ilg|nav|snm|vrb|xdv|fmt|bak|tmp)$|(^|\/)(texsting-|_minted)/i;
const MAX_BYTES = 40 * 1024 * 1024;
/** Lo que no se trae de la carpeta: archivos de la compilación, muy grandes, o el PDF que sale del .tex. */
function ignorar(it, items) {
  if (it.dir || GENERADO.test(it.path) || it.size > MAX_BYTES) return true;
  return /\.pdf$/i.test(it.path) && items.some((o) => o.path.toLowerCase() === it.path.replace(/\.pdf$/i, '.tex').toLowerCase());
}

export const disponible = () => !!prueba || (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android');

// ───────── Vínculos proyecto ↔ carpeta (aparte del registro del proyecto, para que nunca se pisen) ─────────
function vinculos() { try { return JSON.parse(localStorage.getItem(VINC_KEY) || '{}'); } catch { return {}; } }
function guardarVinculos(v) { try { localStorage.setItem(VINC_KEY, JSON.stringify(v)); } catch { /* sin espacio */ } }
export function vinculo(id) { return vinculos()[id] || null; }
function setVinculo(id, datos) { const v = vinculos(); if (datos) v[id] = datos; else delete v[id]; guardarVinculos(v); }
function marcar(id, path, mtime) {
  const v = vinculos();
  if (!v[id]) return;
  v[id].sinc = v[id].sinc || {};
  if (mtime == null) delete v[id].sinc[path]; else v[id].sinc[path] = mtime;
  guardarVinculos(v);
}

export function raiz() { return getSettings().carpetaRaiz || null; }
/** El vínculo, solo si su carpeta está (si se borró o se renombró desde fuera, no se intenta escribir en ella). */
function activo(id) { const v = vinculo(id); return v && !v.falta ? v : null; }
/** ¿La carpeta de este proyecto desapareció? (se borró, se movió o se le cambió el nombre desde fuera) */
export function carpetaFalta(id) { const v = vinculo(id); return !!(v && v.falta); }

/** Dónde está el proyecto, para mostrarlo («Documents/Projects_LaTeX/Tarea 3»). */
export function dondeEsta(id) {
  const v = vinculo(id);
  return v ? v.ruta || v.nombre : null;
}

// ───────── Cola por proyecto: las escrituras van en orden y la sincronización espera a que terminen ─────────
const colas = new Map();
function enCola(id, fn) {
  const prev = colas.get(id) || Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  colas.set(id, next.catch(() => {}));
  return next;
}

let avisado = false;
function falla(e) {
  console.error('carpetas:', e);
  if (avisado) return;
  avisado = true;
  import('./ui.js').then(({ toast }) => toast('No se pudo guardar en la carpeta del proyecto: ' + (e.message || e) + '. Tus cambios siguen guardados en la app.', { kind: 'error', ms: 7000 }));
  setTimeout(() => { avisado = false; }, 60000);
}

const datos64 = (f) => bytesToBase64(f.kind === 'binary' ? f.data : enc.encode(f.text ?? ''));

async function escribir(id, f) {
  const v = vinculo(id);
  if (!v) return;
  const r = await Carpetas.escribir({ tree: v.tree, doc: v.doc, path: f.path, data: datos64(f) });
  marcar(id, f.path, r.mtime || Date.now());
}

/** Nombre libre dentro de la carpeta raíz: «Tarea», «Tarea (2)»… */
async function nombreLibre(nombre) {
  const r = raiz();
  return nombreLibreEn(r.tree, r.doc, nombre);
}
async function nombreLibreEn(tree, doc, nombre) {
  const { items } = await Carpetas.listar({ tree, doc });
  const usados = new Set(items.map((i) => i.path.toLowerCase()));
  const base = sanitizeName(nombre).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Proyecto';
  if (!usados.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!usados.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
}

/** Crea la carpeta del proyecto en Projects_LaTeX y escribe todos sus archivos. */
async function exportar(p, files) {
  const r = raiz();
  if (!r || vinculo(p.id)) return;
  const nombre = await nombreLibre(p.name);
  const { doc } = await Carpetas.carpeta({ tree: r.tree, doc: r.doc, nombre });
  setVinculo(p.id, { tree: r.tree, doc, nombre, ruta: r.ruta + '/' + nombre, externa: false, sinc: {} });
  for (const f of files || (await listFiles(p.id))) await escribir(p.id, f);
}

// ───────── Lo que pasa en la app se escribe en la carpeta ─────────
setEspejo({
  creado(p, files) {
    if (!disponible() || !raiz() || vinculo(p.id)) return;
    enCola(p.id, () => exportar(p, files)).catch(falla);
  },
  archivo(id, f) {
    if (!activo(id)) return;
    enCola(id, () => escribir(id, f)).catch(falla);
  },
  borrado(id, path) {
    const v = activo(id);
    if (!v) return;
    enCola(id, async () => { await Carpetas.borrar({ tree: v.tree, doc: v.doc, path }); marcar(id, path, null); }).catch(falla);
  },
  renombrado(id, from, to, f) {
    const v = activo(id);
    if (!v) return;
    enCola(id, async () => {
      if (f) await escribir(id, { ...f, path: to });
      await Carpetas.borrar({ tree: v.tree, doc: v.doc, path: from });
      marcar(id, from, null);
    }).catch(falla);
  },
  guardado(p) {
    // Renombrar el proyecto renombra su carpeta (solo las de Projects_LaTeX; una carpeta abierta de otro lugar no se toca).
    const v = activo(p.id);
    if (!v || v.externa) return;
    const nuevo = sanitizeName(p.name).replace(/[\\/:*?"<>|]/g, '-').trim();
    if (!nuevo || nuevo === v.nombre) return;
    enCola(p.id, async () => {
      const r = await Carpetas.renombrar({ tree: v.tree, doc: v.doc, nombre: nuevo });
      const act = vinculo(p.id);
      if (act) setVinculo(p.id, { ...act, doc: r.doc, nombre: nuevo, ruta: act.ruta.replace(/[^/]*$/, nuevo) });
    }).catch(falla);
  },
  aPapelera(p) {
    const v = activo(p.id);
    const r = raiz();
    if (!v || v.externa || !r) return;  // una carpeta abierta desde otro lugar no se mueve
    enCola(p.id, async () => {
      const { doc: papel } = await Carpetas.carpeta({ tree: r.tree, doc: r.doc, nombre: PAPELERA });
      const nombre = await nombreLibreEn(r.tree, papel, v.nombre);
      let doc;
      try {
        if (v.tree !== r.tree) throw new Error('otra carpeta');
        if (nombre !== v.nombre) await Carpetas.renombrar({ tree: v.tree, doc: v.doc, nombre });
        const actual = nombre !== v.nombre ? (await Carpetas.listar({ tree: r.tree, doc: r.doc })).items.find((i) => i.path === nombre).doc : v.doc;
        ({ doc } = await Carpetas.mover({ tree: r.tree, doc: actual, desde: r.doc, hacia: papel }));
      } catch {
        // Sin «mover» (algunos teléfonos): se copia a la papelera y se borra la original.
        ({ doc } = await Carpetas.carpeta({ tree: r.tree, doc: papel, nombre }));
        setVinculo(p.id, { ...v, tree: r.tree, doc });
        for (const f of await listFiles(p.id)) await escribir(p.id, f);
        await Carpetas.borrar({ tree: v.tree, doc: v.doc }).catch(() => {});
      }
      setVinculo(p.id, { ...vinculo(p.id), tree: r.tree, doc, nombre, ruta: r.ruta + '/' + PAPELERA + '/' + nombre, enPapelera: true });
    }).catch(falla);
  },
  restaurado(p) {
    const v = vinculo(p.id);
    const r = raiz();
    if (!v || !v.enPapelera || !r) return;
    enCola(p.id, async () => {
      const { doc: papel } = await Carpetas.carpeta({ tree: r.tree, doc: r.doc, nombre: PAPELERA });
      const nombre = await nombreLibre(p.name);
      let doc;
      try {
        if (nombre !== v.nombre) await Carpetas.renombrar({ tree: r.tree, doc: v.doc, nombre });
        const actual = nombre !== v.nombre ? (await Carpetas.listar({ tree: r.tree, doc: papel })).items.find((i) => i.path === nombre).doc : v.doc;
        ({ doc } = await Carpetas.mover({ tree: r.tree, doc: actual, desde: papel, hacia: r.doc }));
      } catch {
        ({ doc } = await Carpetas.carpeta({ tree: r.tree, doc: r.doc, nombre }));
        const viejo = v.doc;
        setVinculo(p.id, { ...v, doc });
        for (const f of await listFiles(p.id)) await escribir(p.id, f);
        await Carpetas.borrar({ tree: r.tree, doc: viejo }).catch(() => {});
      }
      const act = vinculo(p.id);
      setVinculo(p.id, { ...act, doc, nombre, ruta: r.ruta + '/' + nombre, enPapelera: false, falta: false });
    }).catch(falla);
  },
  eliminado(p) {
    const v = vinculo(p.id);
    if (!v) return;
    setVinculo(p.id, null);
    // Una carpeta abierta desde otro lugar es del usuario: solo se desvincula. La de Projects_LaTeX se borra.
    if (!v.externa && !v.falta) Carpetas.borrar({ tree: v.tree, doc: v.doc }).catch(falla);
  },
});

// ───────── Lo que cambió en la carpeta se trae a la app ─────────
/**
 * Al abrir un proyecto: trae lo que se cambió, agregó o borró desde fuera, y sube lo que la app tenga y la carpeta no.
 * Devuelve las rutas que cambiaron en la app.
 */
export async function sincronizar(id) {
  const v = vinculo(id);
  if (!v || !disponible()) return [];
  if (v.falta) { const err = new Error(`La carpeta «${v.ruta || v.nombre}» ya no está. Tus archivos siguen en TeXsting; en el inicio puedes volver a crearla.`); err.code = 'FALTA'; throw err; }
  return enCola(id, async () => {
    let items;
    try {
      ({ items } = await Carpetas.listar({ tree: v.tree, doc: v.doc, recursivo: true }));
    } catch (e) {
      const a = await Carpetas.acceso({ tree: v.tree, doc: v.doc }).catch(() => ({}));
      if (a.permiso === false) throw new Error('TeXsting ya no tiene permiso para la carpeta «' + (v.ruta || v.nombre) + '»');
      if (!a.existe) {
        // Se borró, se movió o se le cambió el nombre: se avisa (no se vuelve a crear sin preguntar).
        setVinculo(id, { ...v, falta: true });
        const err = new Error(`La carpeta «${v.ruta || v.nombre}» ya no está: se eliminó, se movió o se le cambió el nombre. Tus archivos siguen en TeXsting.`);
        err.code = 'FALTA';
        throw err;
      }
      throw new Error(e.message || String(e));
    }
    const sinc = { ...(v.sinc || {}) };
    const enApp = new Map((await listFiles(id)).map((f) => [f.path, f]));
    const enCarpeta = new Set();
    const cambios = [];
    for (const it of items) {
      if (ignorar(it, items)) continue;
      enCarpeta.add(it.path);
      const f = enApp.get(it.path);
      const visto = sinc[it.path];
      if (f && visto != null && it.mtime <= visto + 1000) continue;  // sin cambios desde la última vez
      const { data } = await Carpetas.leer({ tree: v.tree, doc: it.doc });
      const bytes = base64ToBytes(data);
      const nuevo = isTextPath(it.path) ? { path: it.path, text: dec.decode(bytes) } : { path: it.path, data: bytes };
      const igual = f && (f.kind === 'binary' ? !nuevo.text && sameBytes(f.data, nuevo.data) : f.text === nuevo.text);
      if (!igual) { await putFile(id, nuevo, { sinEspejo: true }); cambios.push(it.path); }
      marcar(id, it.path, it.mtime);
    }
    for (const [path, f] of enApp) {
      if (enCarpeta.has(path)) continue;
      if (sinc[path] != null) {
        await deleteFile(id, path, { sinEspejo: true });  // estaba en la carpeta y alguien lo borró desde fuera
        marcar(id, path, null);
        cambios.push(path);
      } else {
        await escribir(id, f);  // nuevo en la app (o la carpeta no estaba disponible al crearlo)
      }
    }
    return cambios;
  });
}

function sameBytes(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Guarda el PDF compilado junto al .tex (para verlo desde la PC o compartirlo desde Archivos). */
export function guardarPdf(id, main, pdf) {
  if (!vinculo(id) || !pdf) return;
  const path = main.replace(/\.tex$/i, '') + '.pdf';
  enCola(id, () => escribir(id, { path, kind: 'binary', data: pdf })).catch(falla);
}

// ───────── Elegir carpetas ─────────
/**
 * La carpeta propia.
 * - modo «crear»: TeXsting crea Documentos/Projects_LaTeX y abre el selector ya ahí (solo queda «Usar esta carpeta»
 *   y «Permitir»: Android no deja saltarse ese permiso).
 * - modo «otra»: el usuario elige cualquier carpeta y se usa tal cual; si elige Documentos o la raíz del teléfono,
 *   adentro se crea Projects_LaTeX (para no tomar como proyectos sus otras carpetas).
 */
export async function elegirRaiz(modo = 'crear') {
  let inicial = 'Documents';
  if (modo === 'crear') {
    const c = await Carpetas.crearEnDocumentos({ nombre: RAIZ }).catch(() => ({}));
    if (c && c.ok) inicial = 'Documents/' + RAIZ;
  }
  const r = await Carpetas.elegir({ inicial });
  let doc = r.doc;
  let ruta = r.ruta;
  const general = /:(Documents|Download|)$/i.test(r.doc) || !r.ruta;
  if (r.nombre !== RAIZ && (modo === 'crear' || general)) {
    ({ doc } = await Carpetas.carpeta({ tree: r.tree, doc: r.doc, nombre: RAIZ }));
    ruta = (r.ruta ? r.ruta + '/' : '') + RAIZ;
  }
  const nueva = { tree: r.tree, doc, ruta };
  setSettings({ carpetaRaiz: nueva });
  return nueva;
}

/** Copia a Projects_LaTeX los proyectos que todavía solo están dentro de la app. */
export async function exportarTodos(alAvanzar) {
  const lista = (await listProjects()).filter((p) => !vinculo(p.id));
  let n = 0;
  for (const p of lista) {
    alAvanzar && alAvanzar(++n, lista.length, p.name);
    await enCola(p.id, () => exportar(p));
  }
  return lista.length;
}

async function leerCarpeta(tree, doc) {
  const { items } = await Carpetas.listar({ tree, doc, recursivo: true });
  const files = [];
  const sinc = {};
  for (const it of items) {
    if (ignorar(it, items)) continue;
    const { data } = await Carpetas.leer({ tree, doc: it.doc });
    const bytes = base64ToBytes(data);
    files.push(isTextPath(it.path) ? { path: it.path, text: dec.decode(bytes) } : { path: it.path, data: bytes });
    sinc[it.path] = it.mtime;
  }
  return { files, sinc };
}

/** El .tex principal: el que tiene \documentclass y \begin{document} (main.tex si hay varios). */
function principal(files) {
  const texs = files.filter((f) => /\.tex$/i.test(f.path) && f.text != null);
  const completos = texs.filter((f) => /\\documentclass/.test(f.text) && /\\begin\s*\{document\}/.test(f.text));
  const pref = (arr) => arr.find((f) => /(^|\/)main\.tex$/i.test(f.path)) || arr.sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
  return (pref(completos) || pref(texs) || {}).path;
}

async function importar({ tree, doc, nombre, ruta, externa }) {
  const { files, sinc } = await leerCarpeta(tree, doc);
  const main = principal(files);
  if (!main) throw new Error(`En «${nombre}» no hay ningún archivo .tex`);
  const p = await createProject({ name: sanitizeName(nombre) || 'Proyecto', main, files, sinEspejo: true });
  setVinculo(p.id, { tree, doc, nombre, ruta, externa, sinc });
  return p;
}

/** «Abrir carpeta»: un proyecto que ya existe en el teléfono (se edita en su lugar). */
export async function abrirCarpeta() {
  const r = await Carpetas.elegir({ inicial: 'Documents' });
  const ya = Object.entries(vinculos()).find(([, v]) => v.doc === r.doc);
  if (ya) return { id: ya[0], existente: true };
  const p = await importar({ tree: r.tree, doc: r.doc, nombre: r.nombre, ruta: r.ruta, externa: true });
  return { id: p.id };
}

/** ¿Está este vínculo dentro de la carpeta propia? */
const enRaiz = (v, r) => v && !v.externa && !v.enPapelera && r && v.ruta && v.ruta.startsWith(r.ruta + '/');

/**
 * Revisa la carpeta propia al volver al inicio:
 * - si la carpeta Projects_LaTeX ya no está → { raizFalta: true };
 * - carpetas nuevas (copiadas desde la PC) → proyectos nuevos;
 * - una carpeta de proyecto a la que le cambiaron el nombre → se sigue usando (y el proyecto toma ese nombre);
 * - carpetas de proyectos que desaparecieron → { faltan: [...] } para avisar.
 */
export async function revisarRaiz() {
  const r = raiz();
  const res = { nuevos: [], renombrados: [], faltan: [], raizFalta: false };
  if (!r || !disponible()) return res;
  // Los vínculos se leen ANTES de mirar la carpeta: un proyecto que se está creando en este momento (su carpeta
  // todavía no aparecía en la lista) no debe confundirse con uno cuya carpeta se borró.
  const todos = vinculos();
  let items;
  try { ({ items } = await Carpetas.listar({ tree: r.tree, doc: r.doc })); } catch (e) {
    const a = await Carpetas.acceso({ tree: r.tree, doc: r.doc }).catch(() => ({}));
    if (a.existe === false || a.permiso === false) { res.raizFalta = true; return res; }
    throw e;
  }
  const docs = new Set(items.filter((i) => i.dir).map((i) => i.doc));
  // Proyectos de esta carpeta cuya carpeta ya no aparece.
  const perdidos = Object.entries(todos).filter(([, v]) => enRaiz(v, r) && !docs.has(v.doc)).map(([id, v]) => ({ id, v }));
  const conocidas = new Set(Object.values(todos).map((v) => v.doc));
  // Carpetas sin ningún .tex: no son proyectos; se recuerdan para no leerlas cada vez.
  let sinTex = {};
  try { sinTex = JSON.parse(localStorage.getItem(VINC_KEY + '.sintex') || '{}'); } catch { /* vacío */ }
  for (const it of items) {
    if (!it.dir || it.path.startsWith('.') || it.path === PAPELERA || conocidas.has(it.doc) || sinTex[it.doc] === it.mtime) continue;
    // ¿Es la carpeta de un proyecto perdido con otro nombre? Se compara qué archivos tiene.
    if (perdidos.length) {
      const { items: dentro } = await Carpetas.listar({ tree: r.tree, doc: it.doc, recursivo: true }).catch(() => ({ items: [] }));
      const rutas = new Set(dentro.filter((d) => !d.dir).map((d) => d.path));
      let mejor = null;
      let puntaje = 0;
      for (const per of perdidos) {
        const propios = (await listFiles(per.id)).map((f) => f.path);
        if (!propios.length) continue;
        const comunes = propios.filter((f) => rutas.has(f)).length;
        const pts = comunes / Math.max(propios.length, 1);
        if (pts > puntaje) { puntaje = pts; mejor = per; }
      }
      if (mejor && puntaje >= 0.5) {
        const nombre = it.path;
        setVinculo(mejor.id, { ...mejor.v, doc: it.doc, nombre, ruta: r.ruta + '/' + nombre, falta: false });
        const p = await getProject(mejor.id);
        const antes = p ? p.name : mejor.v.nombre;
        if (p && p.name !== nombre) { p.name = nombre; await saveProject(p); }
        res.renombrados.push({ id: mejor.id, de: mejor.v.nombre, a: nombre, antes });
        perdidos.splice(perdidos.indexOf(mejor), 1);
        continue;
      }
    }
    try { res.nuevos.push(await importar({ tree: r.tree, doc: it.doc, nombre: it.path, ruta: r.ruta + '/' + it.path, externa: false })); }
    catch (e) { sinTex[it.doc] = it.mtime; console.warn('carpetas: no se importó', it.path, e); }
  }
  try { localStorage.setItem(VINC_KEY + '.sintex', JSON.stringify(sinTex)); } catch { /* sin espacio */ }
  // Los que siguen sin carpeta: se marcan (no se escribe en ellas) y se avisa.
  const actual = vinculos();
  for (const { id, v } of perdidos) {
    if (!(await getProject(id))) { delete actual[id]; continue; }
    // Se confirma una por una: solo se avisa si de verdad no existe (no por una lista leída a destiempo).
    const a = await Carpetas.acceso({ tree: v.tree, doc: v.doc }).catch(() => ({}));
    if (a.existe !== false) continue;
    actual[id] = { ...(actual[id] || v), falta: true };
    res.faltan.push({ id, nombre: v.nombre, ruta: v.ruta });
  }
  guardarVinculos(actual);
  return res;
}

/** Vuelve a crear las carpetas de estos proyectos dentro de la carpeta propia, con lo que tiene la app. */
export async function reponer(ids) {
  const r = raiz();
  for (const id of ids) {
    const v = vinculo(id);
    if (!v || !r) continue;
    await enCola(id, async () => {
      const { doc } = await Carpetas.carpeta({ tree: r.tree, doc: r.doc, nombre: v.nombre });
      setVinculo(id, { ...v, tree: r.tree, doc, ruta: r.ruta + '/' + v.nombre, falta: false, sinc: {} });
      for (const f of await listFiles(id)) await escribir(id, f);
    });
  }
}

/** Deja estos proyectos solo en la app (sin carpeta). */
export function desvincular(ids) { for (const id of ids) setVinculo(id, null); }

/** «tree» de Android → id de la carpeta elegida («content://…/tree/primary%3ADocuments» → «primary:Documents»). */
function docDelTree(tree) {
  const m = String(tree).match(/\/tree\/([^/]+)/);
  if (m) return decodeURIComponent(m[1]);
  return String(tree).replace(/^tree:/, '');
}

/**
 * La carpeta propia desapareció y el usuario pide «Volver a crearla»: se crea de nuevo en el mismo lugar
 * (sin preguntar si Android lo permite; si no, con el selector) y se vuelven a escribir todos los proyectos.
 */
export async function recrearRaiz() {
  const r = raiz();
  if (!r) return false;
  const nombre = r.ruta.split('/').pop();
  const padre = docDelTree(r.tree);
  let nueva = null;
  if (padre !== r.doc) {
    // Se eligió una carpeta (p. ej. Documentos) y Projects_LaTeX está adentro: se crea de nuevo ahí.
    try { const { doc } = await Carpetas.carpeta({ tree: r.tree, doc: padre, nombre }); nueva = { ...r, doc }; } catch { /* sigue */ }
  }
  if (!nueva && /^Documents\//.test(r.ruta)) {
    // La carpeta elegida era Projects_LaTeX misma: se crea en el mismo lugar y el permiso de antes vuelve a servir.
    const c = await Carpetas.crearEnDocumentos({ nombre: r.ruta.slice('Documents/'.length) }).catch(() => ({}));
    if (c && c.ok) { const a = await Carpetas.acceso({ tree: r.tree, doc: r.doc }).catch(() => ({})); if (a.existe) nueva = r; }
  }
  if (!nueva) { await elegirRaiz('crear'); nueva = raiz(); }
  setSettings({ carpetaRaiz: nueva });
  await recolocar(r, nueva);
  return true;
}

/**
 * La carpeta propia se renombró o se movió y el usuario la vuelve a elegir: cada proyecto busca su carpeta
 * (por nombre) en la nueva ubicación; los que no la encuentran la vuelven a crear.
 */
export async function buscarRaiz() {
  const vieja = raiz();
  await elegirRaiz('otra');
  await recolocar(vieja, raiz());
}

async function recolocar(vieja, nueva) {
  const { items } = await Carpetas.listar({ tree: nueva.tree, doc: nueva.doc });
  const porNombre = new Map(items.filter((i) => i.dir).map((i) => [i.path, i.doc]));
  const faltan = [];
  for (const [id, v] of Object.entries(vinculos())) {
    if (!enRaiz(v, vieja)) continue;
    const doc = porNombre.get(v.nombre);
    if (doc) setVinculo(id, { ...v, tree: nueva.tree, doc, ruta: nueva.ruta + '/' + v.nombre, falta: false });
    else { setVinculo(id, { ...v, tree: nueva.tree, ruta: nueva.ruta + '/' + v.nombre }); faltan.push(id); }
  }
  await reponer(faltan);
}

/**
 * «Abrir con» un archivo que está dentro de la carpeta de un proyecto (p. ej. desde Archivos, en
 * Documentos/Projects_LaTeX/Tarea/main.tex): devuelve ese proyecto y la ruta del archivo, para abrirlo ahí
 * en vez de importarlo como copia. «ruta» puede venir de Android (relative_path / _data) o de la propia URI.
 */
export async function proyectoDeArchivo(uri, { ruta = '', nombre = '' } = {}) {
  let s = String(uri || '');
  for (let i = 0; i < 3; i++) { try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch { break; } }
  const textos = [s, ruta].filter(Boolean).map((t) => t.replace(/\\/g, '/'));
  const buscar = () => {
    for (const [id, v] of Object.entries(vinculos())) {
      if (!v.ruta) continue;
      for (const t of textos) {
        const k = t.indexOf(v.ruta + '/');
        if (k < 0 || !(k === 0 || /[/:]/.test(t[k - 1]))) continue;
        let rel = t.slice(k + v.ruta.length + 1).replace(/[?#].*$/, '');
        if (t === ruta && nombre && !rel.endsWith(nombre)) rel = rel.replace(/\/?$/, '/') + nombre;
        if (rel) return { id, path: rel.replace(/^\/+/, '') };
      }
    }
    return null;
  };
  let r = buscar();
  // Una carpeta nueva en Projects_LaTeX que todavía no es proyecto: se importa y se busca de nuevo.
  if (!r && raiz() && textos.some((t) => t.includes(raiz().ruta + '/'))) { await revisarRaiz().catch(() => {}); r = buscar(); }
  return r;
}

export { Carpetas };
