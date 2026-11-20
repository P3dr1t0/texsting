// Carpetas reales en el teléfono (#4 y #7).
// - Carpeta propia: Documentos/Projects_LaTeX/<proyecto>/, visible desde Archivos y la PC.
// - Abrir carpeta: un proyecto que ya existe en el teléfono, editado ahí mismo.
// La app sigue trabajando con su copia interna (rápida, sin permisos); cada cambio se escribe también en la carpeta
// y, al abrir un proyecto, se traen los cambios hechos desde fuera (la PC, otra app).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { setEspejo, listFiles, putFile, deleteFile, createProject, getSettings, setSettings, isTextPath, listProjects } from './store.js';
import { bytesToBase64, base64ToBytes, sanitizeName } from './util.js';

// Las pruebas automáticas (tests/carpetas.mjs) ponen una carpeta falsa en memoria en window.__carpetasPrueba.
const prueba = typeof window !== 'undefined' ? window.__carpetasPrueba : null;
const Carpetas = prueba || registerPlugin('Carpetas');
const enc = new TextEncoder();
const dec = new TextDecoder();
const RAIZ = 'Projects_LaTeX';
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
  const { items } = await Carpetas.listar({ tree: r.tree, doc: r.doc });
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
    if (!vinculo(id)) return;
    enCola(id, () => escribir(id, f)).catch(falla);
  },
  borrado(id, path) {
    const v = vinculo(id);
    if (!v) return;
    enCola(id, async () => { await Carpetas.borrar({ tree: v.tree, doc: v.doc, path }); marcar(id, path, null); }).catch(falla);
  },
  renombrado(id, from, to, f) {
    const v = vinculo(id);
    if (!v) return;
    enCola(id, async () => {
      if (f) await escribir(id, { ...f, path: to });
      await Carpetas.borrar({ tree: v.tree, doc: v.doc, path: from });
      marcar(id, from, null);
    }).catch(falla);
  },
  guardado(p) {
    // Renombrar el proyecto renombra su carpeta (solo las de Projects_LaTeX; una carpeta abierta de otro lugar no se toca).
    const v = vinculo(p.id);
    if (!v || v.externa) return;
    const nuevo = sanitizeName(p.name).replace(/[\\/:*?"<>|]/g, '-').trim();
    if (!nuevo || nuevo === v.nombre) return;
    enCola(p.id, async () => {
      const r = await Carpetas.renombrar({ tree: v.tree, doc: v.doc, nombre: nuevo });
      const act = vinculo(p.id);
      if (act) setVinculo(p.id, { ...act, doc: r.doc, nombre: nuevo, ruta: act.ruta.replace(/[^/]*$/, nuevo) });
    }).catch(falla);
  },
  eliminado(p) {
    const v = vinculo(p.id);
    if (!v) return;
    setVinculo(p.id, null);
    // Una carpeta abierta desde otro lugar es del usuario: solo se desvincula. La de Projects_LaTeX se borra.
    if (!v.externa) Carpetas.borrar({ tree: v.tree, doc: v.doc }).catch(falla);
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
  return enCola(id, async () => {
    let items;
    try {
      ({ items } = await Carpetas.listar({ tree: v.tree, doc: v.doc, recursivo: true }));
    } catch (e) {
      const a = await Carpetas.acceso({ tree: v.tree, doc: v.doc }).catch(() => ({}));
      if (a.permiso && !a.existe && !v.externa && raiz()) {
        // La carpeta se borró desde fuera: se vuelve a crear con lo que tiene la app.
        setVinculo(id, null);
        await exportar({ id, name: v.nombre });
        return [];
      }
      throw new Error(a.permiso === false ? 'TeXsting ya no tiene permiso para la carpeta «' + v.nombre + '»' : (e.message || String(e)));
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

/** Carpetas nuevas en Projects_LaTeX (copiadas desde la PC, por ejemplo) aparecen como proyectos. */
export async function revisarRaiz() {
  const r = raiz();
  if (!r || !disponible()) return [];
  const { items } = await Carpetas.listar({ tree: r.tree, doc: r.doc });
  const conocidas = new Set(Object.values(vinculos()).map((v) => v.doc));
  // Carpetas sin ningún .tex: no son proyectos; se recuerdan para no leerlas cada vez.
  let sinTex = {};
  try { sinTex = JSON.parse(localStorage.getItem(VINC_KEY + '.sintex') || '{}'); } catch { /* vacío */ }
  const nuevos = [];
  for (const it of items) {
    if (!it.dir || conocidas.has(it.doc) || sinTex[it.doc] === it.mtime) continue;
    try { nuevos.push(await importar({ tree: r.tree, doc: it.doc, nombre: it.path, ruta: r.ruta + '/' + it.path, externa: false })); }
    catch (e) { sinTex[it.doc] = it.mtime; console.warn('carpetas: no se importó', it.path, e); }
  }
  try { localStorage.setItem(VINC_KEY + '.sintex', JSON.stringify(sinTex)); } catch { /* sin espacio */ }
  return nuevos;
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
