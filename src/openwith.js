// «Abrir con → TeXsting»: recibe un .tex desde otra app (Archivos, WhatsApp, Drive…)
// y pregunta si se quiere importar como proyecto nuevo o dentro de uno existente.
import { App } from '@capacitor/app';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { el, dialog, sheet, toast } from './ui.js';
import { listProjects, createProject, putFile, listFiles, getFile, saveProject, isTextPath } from './store.js';
import { base64ToBytes, sanitizeName, slug } from './util.js';

const OpenedFile = registerPlugin('OpenedFile');

const LATEX_EXT = /\.(tex|ltx|bib|sty|cls|bst|dtx)$/i;
const inProgress = new Set();
let lastUrl = '';
let lastTime = 0;

/** Saca el nombre del archivo de una URI content:// o file:// (suele venir codificado dentro). */
export function nameFromUri(uri) {
  let s = uri;
  for (let i = 0; i < 3; i++) { try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch { break; } }
  s = s.replace(/[?#].*$/, '');
  const m = s.match(/([^/:\\]+\.[A-Za-z0-9]{1,5})$/);
  return m ? m[1].trim() : null;
}

/** Archivos que el documento menciona (imágenes, \input…) para avisar que no vinieron. */
export function referencedFiles(text) {
  const clean = text.replace(/(^|[^\\])%.*$/gm, '$1');
  const out = new Set();
  const re = /\\(includegraphics|input|include|bibliography|addbibresource|lstinputlisting)\*?(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    for (const part of m[2].split(',')) {
      const p = part.trim();
      if (!p || p.includes('#') || /^example-image/.test(p)) continue;
      if (m[1] === 'bibliography' && !/\.bib$/.test(p)) out.add(p + '.bib');
      else if ((m[1] === 'input' || m[1] === 'include') && !/\.[A-Za-z]{1,4}$/.test(p)) out.add(p + '.tex');
      else out.add(p);
    }
  }
  return [...out];
}

async function readUri(url) {
  try {
    const r = await Filesystem.readFile({ path: url });
    return typeof r.data === 'string' ? base64ToBytes(r.data) : new Uint8Array(await r.data.arrayBuffer());
  } catch (e) {
    // Plan B: el servidor local de Capacitor también sirve content:// .
    const res = await fetch(Capacitor.convertFileSrc(url));
    if (!res.ok) throw e;
    return new Uint8Array(await res.arrayBuffer());
  }
}

function uniqueName(name, taken) {
  if (!taken.has(name)) return name;
  for (let i = 2; ; i++) if (!taken.has(`${name} (${i})`)) return `${name} (${i})`;
}

/** Huella corta del contenido (FNV-1a de 32 bits): sirve para reconocer el mismo archivo. */
export function fingerprint(text) {
  let h = 0x811c9dc5;
  const t = text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0') + '-' + t.length.toString(36);
}

/** Título o primera sección del documento, para reconocerlo cuando el archivo no trae nombre. */
export function docTitle(text) {
  const clean = text.replace(/(^|[^\\])%.*$/gm, '$1');
  const m = clean.match(/\\title(?:\[[^\]]*\])?\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/) || clean.match(/\\(?:chapter|section)\*?\{([^{}]*)\}/);
  if (!m) return '';
  return m[1].replace(/\\\\|\\newline/g, ' ').replace(/\\[a-zA-Z]+\*?(\[[^\]]*\])?/g, '').replace(/[{}~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
}

async function realName(url) {
  try {
    const info = await OpenedFile.info({ url });
    if (info && info.name) return String(info.name).split(/[\\/]/).pop();
  } catch { /* sin complemento nativo (navegador) o la app no lo da */ }
  return nameFromUri(url);
}

export async function handleOpenedFile(url, navigate) {
  if (!/^(content|file):/i.test(url || '')) return;
  // Al arrancar, Android puede avisar dos veces del mismo archivo: se ignora el repetido.
  if (inProgress.has(url) || (url === lastUrl && Date.now() - lastTime < 1000)) return;
  inProgress.add(url);
  try { await importFlow(url, navigate); } finally { inProgress.delete(url); lastUrl = url; lastTime = Date.now(); }
}

async function importFlow(url, navigate) {

  let bytes;
  try { bytes = await readUri(url); } catch (e) {
    toast('No se pudo leer el archivo: ' + (e.message || e), { kind: 'error' });
    return;
  }
  const known = await realName(url);
  const head = bytes.subarray(0, 4096);
  const binary = head.includes(0) || /^(%PDF|PK\x03\x04|\x89PNG|\xFF\xD8)/.test(String.fromCharCode(...head.subarray(0, 4)));
  const text = binary ? '' : new TextDecoder().decode(bytes);
  const looksLatex = /\\(documentclass|begin\{|section|chapter|usepackage|input\{)/.test(text);
  // Con nombre: basta la extensión. Sin nombre (algunas apps no lo dan): el contenido tiene que ser LaTeX.
  const isLatex = !binary && (known ? LATEX_EXT.test(known) || (isTextPath(known) && looksLatex) : looksLatex);
  if (!isLatex) {
    toast(known ? `TeXsting abre archivos LaTeX (.tex). «${known}» no parece uno.` : 'TeXsting abre archivos LaTeX (.tex) y este no parece uno.', { kind: 'error', ms: 5000 });
    return;
  }
  const isDoc = /\\documentclass/.test(text);
  const title = docTitle(text);
  const hash = fingerprint(text);
  const lines = text.split('\n').length;
  const projects = await listProjects();
  const stem = known ? known.replace(/\.[^.]+$/, '') : '';

  // ¿Ya está importado? Solo cuenta lo que se importó con «Abrir con» (tiene origen guardado):
  // exactamente el mismo contenido, o el mismo archivo de origen (misma dirección o mismo nombre real).
  const identical = projects.find((p) => p.source && p.source.hash === hash);
  const sameOrigin = identical ? null : projects.find((p) => p.source && (p.source.uri === url || (known && p.source.name === known)));

  const defaultName = sanitizeName(stem || title || 'Importado') || 'Importado';
  const nameInput = el('input', { type: 'text', class: 'input', value: defaultName, autocapitalize: 'off', spellcheck: 'false' });
  const kb = Math.max(1, Math.round(bytes.length / 1024));
  const body = el('div', {},
    el('p', {}, known ? `¿Deseas importar «${known}»?` : '¿Deseas importar este archivo LaTeX?'),
    el('p', { class: 'muted small' }, [title ? `«${title}»` : null, `${lines} líneas`, `${kb} kB`, known ? null : 'la app que lo envió no dio su nombre'].filter(Boolean).join(' · ')),
    isDoc ? el('label', { class: 'field-label' }, 'Nombre del proyecto nuevo') : el('p', { class: 'muted' }, 'Es un archivo suelto (no tiene \\documentclass): conviene agregarlo a un proyecto que ya tengas.'),
    isDoc ? nameInput : null,
    identical ? el('p', { class: 'note' }, `Ya importaste este mismo archivo (sin cambios) como «${identical.name}».`) : null,
    sameOrigin ? el('p', { class: 'note' }, `Parece una versión nueva del archivo del proyecto «${sameOrigin.name}».`) : null,
  );
  const buttons = [{ label: 'Cancelar', value: null }];
  if (identical) buttons.push({ label: `Abrir «${identical.name}»`, value: 'open' });
  if (sameOrigin) buttons.push({ label: 'Actualizar…', value: 'update' });
  if (projects.length && !isDoc) buttons.push({ label: 'Agregar a un proyecto', value: 'add' });
  buttons.push({ label: identical ? 'Crear copia' : (isDoc ? 'Crear proyecto' : 'Proyecto nuevo'), value: 'new', primary: true });
  const choice = await dialog({ title: 'Abrir con TeXsting', body, buttons });
  if (!choice) return;
  if (choice === 'open') { await navigate('editor', { id: identical.id }); return; }

  let projectId;
  let missing = [];
  if (choice === 'new') {
    const taken = new Set(projects.map((p) => p.name));
    const name = uniqueName(sanitizeName(nameInput.value.trim() || defaultName) || 'Importado', taken);
    const main = known || slug(name) + '.tex';
    const p = await createProject({ name, main, files: [{ path: main, text }], source: { uri: url, name: known || null, hash, path: main, imported: Date.now() } });
    projectId = p.id;
    missing = referencedFiles(text);
  } else if (choice === 'update') {
    // Reemplazar nunca es de un toque: se confirma y se guarda la versión anterior.
    const target = sameOrigin;
    const path = target.source.path || target.main;
    const old = await getFile(target.id, path);
    const oldText = old && old.kind === 'text' ? old.text : '';
    const backup = path.replace(/\.tex$/i, '') + '.anterior.tex';
    const ok = await dialog({
      title: `¿Actualizar «${target.name}»?`,
      body: el('div', {},
        el('p', {}, `Se reemplazará «${path}» por la versión que acabas de abrir.`),
        el('p', { class: 'muted small' }, `Actual: ${oldText.split('\n').length} líneas · Nueva: ${lines} líneas`),
        el('p', { class: 'muted' }, `La versión actual se guarda como «${backup}» dentro del proyecto, por si necesitas recuperarla.`)),
      buttons: [{ label: 'Cancelar', value: false }, { label: 'Reemplazar', value: true, primary: true }],
    });
    if (!ok) return;
    if (oldText) await putFile(target.id, { path: backup, text: oldText });
    await putFile(target.id, { path, text });
    target.source = { ...target.source, uri: url, hash, name: known || target.source.name, updatedFrom: Date.now() };
    await saveProject(target);
    projectId = target.id;
  } else {
    const id = await sheet('¿A qué proyecto lo agrego?', projects.map((p) => ({ label: p.name, icon: 'files', value: p.id, hint: p.main })));
    if (!id) return;
    const target = projects.find((p) => p.id === id);
    const existing = new Set((await listFiles(target.id)).map((f) => f.path));
    const base = known || 'capitulo.tex';
    const bstem = base.replace(/\.[^.]+$/, '');
    const ext = (base.match(/\.[^.]+$/) || ['.tex'])[0];
    let path = base;
    if (existing.has(path)) {
      const ok = await dialog({ title: 'Ya existe', body: el('p', {}, `«${target.name}» ya tiene un archivo «${path}». ¿Qué hago?`), buttons: [{ label: 'Cancelar', value: false }, { label: 'Reemplazar', value: 'replace' }, { label: 'Guardar como copia', value: 'copy', primary: true }] });
      if (!ok) return;
      if (ok === 'copy') { let i = 2; while (existing.has(`${bstem}-${i}${ext}`)) i++; path = `${bstem}-${i}${ext}`; }
    }
    await putFile(target.id, { path, text });
    projectId = target.id;
    const all = new Set([...existing, path]);
    missing = referencedFiles(text).filter((r) => !all.has(r) && ![...all].some((f) => f.replace(/\.[^.]+$/, '') === r));
  }
  await navigate('editor', { id: projectId });
  if (choice === 'update') toast('Proyecto actualizado. La versión anterior quedó como copia en Archivos.');
  else if (missing.length) {
    dialog({
      title: 'Faltan archivos',
      body: el('div', {},
        el('p', {}, 'El documento usa estos archivos, que no vinieron con el .tex:'),
        el('ul', { class: 'missing-list' }, ...missing.slice(0, 12).map((f) => el('li', {}, el('code', {}, f)))),
        missing.length > 12 ? el('p', { class: 'muted' }, `… y ${missing.length - 12} más.`) : null,
        el('p', { class: 'muted' }, 'Agrégalos en Archivos → Importar (botón de subir). Si no, compilará con errores en esas líneas.')),
      buttons: [{ label: 'Entendido', value: true, primary: true }],
    });
  } else toast(known ? `«${known}» importado` : 'Archivo importado');
}

export function initOpenWith(navigate) {
  App.addListener('appUrlOpen', (e) => handleOpenedFile(e && e.url, navigate));
  if (App.getLaunchUrl) App.getLaunchUrl().then((r) => { if (r && r.url) handleOpenedFile(r.url, navigate); }).catch(() => {});
}
