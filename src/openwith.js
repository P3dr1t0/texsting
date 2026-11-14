// «Abrir con → TeXsting»: recibe un .tex desde otra app (Archivos, WhatsApp, Drive…)
// y pregunta si se quiere importar como proyecto nuevo o dentro de uno existente.
import { App } from '@capacitor/app';
import { Filesystem } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { el, dialog, sheet, toast } from './ui.js';
import { listProjects, createProject, putFile, listFiles, isTextPath } from './store.js';
import { base64ToBytes, sanitizeName } from './util.js';

const LATEX_EXT = /\.(tex|ltx|bib|sty|cls|bst|dtx)$/i;
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

export async function handleOpenedFile(url, navigate) {
  if (!/^(content|file):/i.test(url || '')) return;
  if (url === lastUrl && Date.now() - lastTime < 4000) return; // mismo aviso dos veces al arrancar
  lastUrl = url; lastTime = Date.now();

  let bytes;
  try { bytes = await readUri(url); } catch (e) {
    toast('No se pudo leer el archivo: ' + (e.message || e), { kind: 'error' });
    return;
  }
  const known = nameFromUri(url);
  let fname = known || 'documento.tex';
  const head = bytes.subarray(0, 4096);
  const binary = head.includes(0) || /^(%PDF|PK\x03\x04|\x89PNG|\xFF\xD8)/.test(String.fromCharCode(...head.subarray(0, 4)));
  const text = binary ? '' : new TextDecoder().decode(bytes);
  const looksLatex = /\\(documentclass|begin\{|section|chapter|usepackage|input\{)/.test(text);
  // Con nombre: basta la extensión. Sin nombre (algunas apps no lo dan): el contenido tiene que ser LaTeX.
  const isLatex = !binary && (known ? LATEX_EXT.test(fname) || (isTextPath(fname) && looksLatex) : looksLatex);
  if (!isLatex) {
    toast(known ? `TeXsting abre archivos LaTeX (.tex). «${fname}» no parece uno.` : 'TeXsting abre archivos LaTeX (.tex) y este no parece uno.', { kind: 'error', ms: 5000 });
    return;
  }
  const isDoc = /\\documentclass/.test(text);
  const projects = await listProjects();
  const stem = fname.replace(/\.[^.]+$/, '');
  const same = projects.find((p) => p.main === fname || p.name === stem);

  const nameInput = el('input', { type: 'text', class: 'input', value: sanitizeName(stem) || 'Importado', autocapitalize: 'off', spellcheck: 'false' });
  const kb = Math.max(1, Math.round(bytes.length / 1024));
  const body = el('div', {},
    el('p', {}, `¿Deseas importar «${fname}» (${kb} kB)?`),
    isDoc ? el('label', { class: 'field-label' }, 'Nombre del proyecto nuevo') : el('p', { class: 'muted' }, 'Es un archivo suelto (no tiene \\documentclass): conviene agregarlo a un proyecto que ya tengas.'),
    isDoc ? nameInput : null,
    same ? el('p', { class: 'muted small' }, `Ya tienes el proyecto «${same.name}» con este archivo: puedes actualizarlo con esta versión.`) : null,
  );
  const buttons = [{ label: 'Cancelar', value: null }];
  if (same) buttons.push({ label: `Actualizar «${same.name}»`, value: 'update' });
  if (projects.length && !same) buttons.push({ label: 'Agregar a un proyecto', value: 'add' });
  buttons.push({ label: isDoc ? 'Crear proyecto' : 'Proyecto nuevo', value: 'new', primary: true });
  const choice = await dialog({ title: 'Abrir con TeXsting', body, buttons });
  if (!choice) return;

  let projectId;
  let missing = [];
  if (choice === 'new') {
    const taken = new Set(projects.map((p) => p.name));
    const name = uniqueName(sanitizeName(nameInput.value.trim() || stem) || 'Importado', taken);
    const p = await createProject({ name, main: fname, files: [{ path: fname, text }] });
    projectId = p.id;
    missing = referencedFiles(text);
  } else {
    let target = same;
    if (choice === 'add') {
      const id = await sheet('¿A qué proyecto lo agrego?', projects.map((p) => ({ label: p.name, icon: 'files', value: p.id, hint: p.main })));
      if (!id) return;
      target = projects.find((p) => p.id === id);
    }
    const existing = new Set((await listFiles(target.id)).map((f) => f.path));
    let path = fname;
    if (choice === 'add' && existing.has(path)) {
      const ok = await dialog({ title: 'Ya existe', body: el('p', {}, `«${target.name}» ya tiene un archivo «${fname}». ¿Lo reemplazo?`), buttons: [{ label: 'Cancelar', value: false }, { label: 'Guardar como copia', value: 'copy' }, { label: 'Reemplazar', value: true, primary: true }] });
      if (!ok) return;
      if (ok === 'copy') { let i = 2; while (existing.has(`${stem}-${i}.tex`)) i++; path = `${stem}-${i}.tex`; }
    }
    await putFile(target.id, { path, text });
    projectId = target.id;
    const all = new Set([...existing, path]);
    missing = referencedFiles(text).filter((r) => !all.has(r) && ![...all].some((f) => f.replace(/\.[^.]+$/, '') === r));
  }
  await navigate('editor', { id: projectId });
  if (choice === 'update') toast('Proyecto actualizado con la nueva versión');
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
  } else toast(`«${fname}» importado`);
}

export function initOpenWith(navigate) {
  App.addListener('appUrlOpen', (e) => handleOpenedFile(e && e.url, navigate));
  if (App.getLaunchUrl) App.getLaunchUrl().then((r) => { if (r && r.url) handleOpenedFile(r.url, navigate); }).catch(() => {});
}
