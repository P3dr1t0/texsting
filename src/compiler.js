// Cliente del servidor de compilación que corre en Termux.
import { getSettings } from './store.js';
import { bytesToBase64, base64ToBytes } from './util.js';

export class CompileError extends Error {
  constructor(message, kind) {
    super(message);
    this.kind = kind; // 'offline' | 'auth' | 'server'
  }
}

function base() {
  return getSettings().serverUrl.replace(/\/+$/, '');
}

async function call(path, { method = 'GET', body, timeout = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(base() + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-TeXsting-Token': getSettings().token },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new CompileError(
      e.name === 'AbortError' ? 'El servidor tardó demasiado en responder.' : 'No hay conexión con Termux. Abre Termux para iniciar el servidor de TeXsting.',
      'offline',
    );
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch { /* respuesta no JSON */ }
  if (res.status === 401) throw new CompileError('El token no coincide con el de Termux. Revísalo en Ajustes.', 'auth');
  if (!res.ok) throw new CompileError((data && data.error) || 'Error del servidor (' + res.status + ')', 'server');
  return data;
}

/** Versión mínima del servidor de Termux que espera esta app. */
export const SERVER_VERSION = '0.2.5';

export function serverOutdated(info) {
  const a = String((info && info.version) || '0').split('.').map(Number);
  const b = SERVER_VERSION.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i]; }
  return false;
}

/** Comprobación rápida (2,5 s) de que el servidor de Termux está activo. */
export async function quickCheck() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(base() + '/health', { signal: ctrl.signal, cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function ping() {
  return call('/info', { timeout: 6000 });
}

const ENGINE_NAMES = { pdflatex: 'pdflatex', xelatex: 'xelatex', lualatex: 'lualatex', xetex: 'xelatex', luatex: 'lualatex' };
export const ENGINE_LABEL = { pdflatex: 'pdfLaTeX', xelatex: 'XeLaTeX', lualatex: 'LuaLaTeX' };

// Cosas que solo funcionan con ciertos motores. «unicode»: XeLaTeX o LuaLaTeX.
const NEEDS = [
  { engine: 'lualatex', re: /\\(directlua|luaexec|luadirect)\b/, what: (m) => '\\' + m[1] },
  { engine: 'lualatex', re: /\\begin\{(luacode\*?)\}/, what: (m) => 'el entorno ' + m[1] },
  { engine: 'lualatex', re: /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*?\b(luacode|luatexja[\w-]*|luacolor|lua-ul|luamplib|luaotfload|lua-visual-debug|lualatex-math)\b/, what: (m) => 'el paquete ' + m[1] },
  { engine: 'xelatex', re: /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*?\b(xeCJK|xltxtra|xunicode|xepersian|xgreek|mathspec|xecolor|ucharclasses)\b/, what: (m) => 'el paquete ' + m[1] },
  { engine: 'xelatex', re: /\\(XeTeX\w+)/, what: (m) => '\\' + m[1] },
  { engine: 'unicode', re: /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*?\b(fontspec|unicode-math|polyglossia)\b/, what: (m) => 'el paquete ' + m[1] },
  { engine: 'unicode', re: /\\(setmainfont|setsansfont|setmonofont|newfontfamily|setmathfont)\b/, what: (m) => '\\' + m[1] },
];

function stripComments(line) {
  return line.replace(/(^|[^\\])%.*$/, '$1');
}

/** Busca en los archivos .tex lo que obliga a usar un motor. Devuelve { lua, xe, unicode } con { file, line, what }. */
export function engineNeeds(files, main) {
  const out = {};
  const texs = files.filter((f) => f.kind !== 'binary' && /\.(tex|ltx)$/i.test(f.path) && typeof f.text === 'string');
  texs.sort((a, b) => (a.path === main ? -1 : b.path === main ? 1 : 0));
  for (const f of texs) {
    const lines = f.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const ln = stripComments(lines[i]);
      if (!ln.includes('\\')) continue;
      for (const n of NEEDS) {
        const key = n.engine === 'lualatex' ? 'lua' : n.engine === 'xelatex' ? 'xe' : 'unicode';
        if (out[key]) continue;
        const m = ln.match(n.re);
        if (m) out[key] = { file: f.path, line: i + 1, what: n.what(m) };
      }
    }
  }
  return out;
}

/**
 * Decide el motor y explica por qué:
 * - lo que el documento *necesita* manda (código Lua → LuaLaTeX; xeCJK… → XeLaTeX;
 *   fontspec/unicode-math → XeLaTeX o LuaLaTeX, nunca pdfLaTeX),
 * - si no, el comentario mágico «% !TEX program = …» (como TeXstudio),
 * - si no, el motor del proyecto.
 * reason: null | 'magic' | 'auto' (cambió por lo que usa el documento) | 'conflict' (la línea mágica pedía otro).
 */
export function chooseEngine(project, files) {
  const base = project.engine || getSettings().defaultEngine || 'pdflatex';
  const main = files.find((f) => f.path === project.main && f.kind === 'text');
  if (!main) return { engine: base, reason: null };
  const lines = main.text.split('\n');
  let magic = null;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const m = lines[i].match(/^%\s*!\s*T[eE]X\s+(?:TS-)?program\s*=\s*([A-Za-z]+)/);
    if (m && ENGINE_NAMES[m[1].toLowerCase()]) { magic = { engine: ENGINE_NAMES[m[1].toLowerCase()], line: i + 1 }; break; }
  }
  const needs = engineNeeds(files, project.main);
  const wanted = magic ? magic.engine : base;
  let need = null;
  if (needs.lua) need = { engine: 'lualatex', ...needs.lua };
  else if (needs.xe) need = { engine: 'xelatex', ...needs.xe };
  else if (needs.unicode && wanted === 'pdflatex') need = { engine: base !== 'pdflatex' ? base : 'xelatex', ...needs.unicode };
  const info = { magic, need, base };
  if (need && need.engine !== wanted) return { engine: need.engine, reason: magic ? 'conflict' : 'auto', ...info };
  if (magic) return { engine: magic.engine, reason: 'magic', ...info };
  return { engine: base, reason: null, ...info };
}

/** Texto corto para explicar por qué se usa (o se usó) un motor. */
export function engineExplanation(ch, main) {
  if (!ch || !ch.reason) return '';
  const where = (n) => (n.file && n.file !== main ? `${n.file}, línea ${n.line}` : `línea ${n.line}`);
  const E = (e) => ENGINE_LABEL[e] || e;
  if (ch.reason === 'magic') return `Lo pide la ${where({ ...ch.magic, file: main })}: «% !TEX program = ${ch.magic.engine}»`;
  const why = `el documento usa ${ch.need.what} (${where(ch.need)}), que ${ch.need.engine === 'lualatex' ? 'solo funciona con LuaLaTeX' : ch.need.what.match(/fontspec|unicode-math|polyglossia|font/) ? 'no funciona con pdfLaTeX' : 'solo funciona con XeLaTeX'}`;
  if (ch.reason === 'conflict') return `La línea ${ch.magic.line} pide ${E(ch.magic.engine)}, pero ${why}: se usa ${E(ch.engine)}`;
  return `Se usa ${E(ch.engine)} porque ${why}`;
}

/**
 * Compila el proyecto. files: registros de store.listFiles().
 * Devuelve { status, pdf: Uint8Array|null, synctex, log, output, installed, missing, elapsed }.
 */
export async function compileProject(project, files) {
  if (!(await quickCheck())) {
    throw new CompileError('Termux no está abierto: ábrelo un momento para iniciar el servidor y vuelve a compilar.', 'offline');
  }
  const s = getSettings();
  const chosen = chooseEngine(project, files);
  const payload = {
    project: project.id,
    main: project.main,
    engine: chosen.engine,
    autoinstall: s.autoinstall,
    files: files.map((f) => (f.kind === 'binary' ? { path: f.path, base64: bytesToBase64(f.data) } : { path: f.path, text: f.text })),
  };
  const data = await call('/compile', { method: 'POST', body: payload, timeout: 30 * 60 * 1000 });
  return {
    ...data,
    engineReason: chosen.reason,
    engineChoice: chosen,
    pdf: data.pdf ? base64ToBytes(data.pdf) : null,
    synctex: data.synctex ? base64ToBytes(data.synctex) : null,
  };
}
