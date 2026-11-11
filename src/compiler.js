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

export function ping() {
  return call('/info', { timeout: 6000 });
}

/**
 * Compila el proyecto. files: registros de store.listFiles().
 * Devuelve { status, pdf: Uint8Array|null, synctex, log, output, installed, missing, elapsed }.
 */
export async function compileProject(project, files) {
  const s = getSettings();
  const payload = {
    project: project.id,
    main: project.main,
    engine: project.engine || s.defaultEngine,
    autoinstall: s.autoinstall,
    files: files.map((f) => (f.kind === 'binary' ? { path: f.path, base64: bytesToBase64(f.data) } : { path: f.path, text: f.text })),
  };
  const data = await call('/compile', { method: 'POST', body: payload, timeout: 30 * 60 * 1000 });
  return {
    ...data,
    pdf: data.pdf ? base64ToBytes(data.pdf) : null,
    synctex: data.synctex ? base64ToBytes(data.synctex) : null,
  };
}
