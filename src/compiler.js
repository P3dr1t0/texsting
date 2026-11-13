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
export const SERVER_VERSION = '0.2.1';

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

/**
 * Decide el motor: 1) comentario mágico "% !TEX program = xelatex" (como TeXstudio),
 * 2) si el documento carga fontspec/unicode-math/polyglossia y el motor es pdfLaTeX → XeLaTeX,
 * 3) el motor del proyecto.
 */
export function chooseEngine(project, files) {
  const base = project.engine || getSettings().defaultEngine || 'pdflatex';
  const main = files.find((f) => f.path === project.main && f.kind === 'text');
  if (!main) return { engine: base, reason: null };
  const head = main.text.split('\n').slice(0, 30).join('\n');
  const magic = head.match(/^%\s*!\s*T[eE]X\s+(?:TS-)?program\s*=\s*([A-Za-z]+)/m);
  if (magic && ENGINE_NAMES[magic[1].toLowerCase()]) return { engine: ENGINE_NAMES[magic[1].toLowerCase()], reason: 'magic' };
  const pre = main.text.split('\\begin{document}')[0].replace(/(^|[^\\])%.*$/gm, '$1');
  if (base === 'pdflatex' && /\\usepackage(\[[^\]]*\])?\{[^}]*\b(fontspec|unicode-math|polyglossia)\b/.test(pre)) return { engine: 'xelatex', reason: 'fontspec' };
  return { engine: base, reason: null };
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
    pdf: data.pdf ? base64ToBytes(data.pdf) : null,
    synctex: data.synctex ? base64ToBytes(data.synctex) : null,
  };
}
