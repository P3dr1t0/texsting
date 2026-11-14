// Almacenamiento local de proyectos y archivos (IndexedDB dentro de la app).
const DB_NAME = 'texsting';
const DB_VERSION = 2;
let dbPromise = null;

function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('files')) {
          const fs = d.createObjectStore('files', { keyPath: ['projectId', 'path'] });
          fs.createIndex('byProject', 'projectId');
        }
        if (!d.objectStoreNames.contains('outputs')) d.createObjectStore('outputs', { keyPath: 'projectId' });
        if (!d.objectStoreNames.contains('templates')) d.createObjectStore('templates', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Pide almacenamiento persistente para que Android no borre los proyectos.
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }
  return dbPromise;
}

function tx(stores, mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    let result;
    Promise.resolve(fn(t)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
  }));
}

const reqP = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const TEXT_EXT = ['tex', 'bib', 'sty', 'cls', 'bst', 'txt', 'md', 'csv', 'dat', 'cfg', 'def', 'ltx', 'dtx', 'ins', 'clo', 'bbx', 'cbx', 'lbx', 'tikz', 'pgf', 'json', 'xml', 'gnuplot', 'm', 'py', 'asy', 'mp', 'lua'];

export function isTextPath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  return TEXT_EXT.includes(ext) || !path.includes('.');
}

export async function listProjects() {
  const all = await tx(['projects'], 'readonly', (t) => reqP(t.objectStore('projects').getAll()));
  return all.sort((a, b) => b.updated - a.updated);
}

export async function getProject(id) {
  return tx(['projects'], 'readonly', (t) => reqP(t.objectStore('projects').get(id)));
}

export async function saveProject(p) {
  p.updated = Date.now();
  await tx(['projects'], 'readwrite', (t) => t.objectStore('projects').put(p));
  return p;
}

export async function createProject({ name, files, main = 'main.tex', engine, source }) {
  engine = engine || getSettings().defaultEngine || 'pdflatex';
  const now = Date.now();
  const p = { id: newId(), name, main, engine, created: now, updated: now, openFiles: [main], current: main };
  if (source) p.source = source; // de dónde vino («Abrir con»): uri, nombre real y huella del contenido
  await tx(['projects', 'files'], 'readwrite', (t) => {
    t.objectStore('projects').put(p);
    const fs = t.objectStore('files');
    for (const f of files) fs.put(normalizeFile(p.id, f));
  });
  return p;
}

function normalizeFile(projectId, f) {
  const rec = { projectId, path: f.path, updated: Date.now() };
  if (f.data instanceof Uint8Array || f.data instanceof ArrayBuffer) {
    rec.kind = 'binary';
    rec.data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
  } else {
    rec.kind = 'text';
    rec.text = f.text ?? '';
  }
  return rec;
}

export async function listFiles(projectId) {
  const files = await tx(['files'], 'readonly', (t) => reqP(t.objectStore('files').index('byProject').getAll(projectId)));
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getFile(projectId, path) {
  return tx(['files'], 'readonly', (t) => reqP(t.objectStore('files').get([projectId, path])));
}

export async function putFile(projectId, f) {
  const rec = normalizeFile(projectId, f);
  await tx(['files', 'projects'], 'readwrite', async (t) => {
    t.objectStore('files').put(rec);
    const p = await reqP(t.objectStore('projects').get(projectId));
    if (p) { p.updated = Date.now(); t.objectStore('projects').put(p); }
  });
  return rec;
}

export async function deleteFile(projectId, path) {
  await tx(['files'], 'readwrite', (t) => t.objectStore('files').delete([projectId, path]));
}

export async function renameFile(projectId, from, to) {
  const f = await getFile(projectId, from);
  if (!f) return;
  await tx(['files'], 'readwrite', (t) => {
    const s = t.objectStore('files');
    s.delete([projectId, from]);
    s.put({ ...f, path: to, updated: Date.now() });
  });
}

export async function deleteProject(id) {
  const files = await listFiles(id);
  await tx(['projects', 'files', 'outputs'], 'readwrite', (t) => {
    t.objectStore('projects').delete(id);
    for (const f of files) t.objectStore('files').delete([id, f.path]);
    t.objectStore('outputs').delete(id);
  });
}

export async function duplicateProject(id, name) {
  const p = await getProject(id);
  const files = await listFiles(id);
  return createProject({
    name, main: p.main, engine: p.engine,
    files: files.map((f) => (f.kind === 'binary' ? { path: f.path, data: f.data } : { path: f.path, text: f.text })),
  });
}

export async function saveOutput(projectId, out) {
  await tx(['outputs'], 'readwrite', (t) => t.objectStore('outputs').put({ projectId, ...out, time: Date.now() }));
}

export async function getOutput(projectId) {
  return tx(['outputs'], 'readonly', (t) => reqP(t.objectStore('outputs').get(projectId)));
}

// Plantillas propias del usuario.
export async function listTemplates() {
  const all = await tx(['templates'], 'readonly', (t) => reqP(t.objectStore('templates').getAll()));
  return all.sort((a, b) => b.created - a.created);
}

export async function saveTemplate(tpl) {
  await tx(['templates'], 'readwrite', (t) => t.objectStore('templates').put(tpl));
  return tpl;
}

export async function deleteTemplate(id) {
  await tx(['templates'], 'readwrite', (t) => t.objectStore('templates').delete(id));
}

// Ajustes globales (pequeños) en localStorage.
const SETTINGS_KEY = 'texsting.settings';
const DEFAULTS = {
  serverUrl: 'http://127.0.0.1:8765',
  token: '',
  theme: 'system',
  accent: 'miel',
  fontSize: 15,
  lineWrap: true,
  lineNumbers: true,
  autocomplete: true,
  autoinstall: true,
  defaultEngine: 'pdflatex',
  compileOnSave: false,
  splitRatio: 0.5,
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSettings(patch) {
  const s = { ...getSettings(), ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  return s;
}

export function ensureToken() {
  let s = getSettings();
  if (!s.token) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    s = setSettings({ token: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') });
  }
  return s.token;
}
