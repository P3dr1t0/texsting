// Lectura del log de LaTeX: errores, advertencias y cajas mal ajustadas,
// con archivo y línea para saltar al código (como el panel de mensajes de TeXstudio).

const RE_FILE_LINE_ERROR = /^(\.?\/?[^:\n]+\.(?:tex|sty|cls|bib|ltx|def)):(\d+): (.*)$/;
const RE_WARNING = /^(?:LaTeX|Package|Class)\s*(?:(\S+)\s+)?Warning:\s*(.*)$/;
const RE_INPUT_LINE = /on input line (\d+)/;
const RE_BADBOX = /^(Over|Under)full \\[hv]box \((.*?)\) (?:in paragraph |detected |has occurred while \\output is active)?(?:at lines? (\d+)(?:--(\d+))?)?/;

export const TRANSLATIONS = [
  [/language@active@arg/, 'Conflicto entre babel (español) y TikZ/circuitikz por los símbolos > o <: agrega \\usetikzlibrary{babel} después de cargar tikz/circuitikz'],
  [/File ended while scanning use of (\\?\S+?)\s*\.?$/, 'El archivo terminó sin cerrar el argumento de $1: falta una llave }'],
  [/LaTeX Error: File `([^'.]+)' not found/, 'No se encontró la imagen o archivo «$1»: revisa el nombre o súbelo en Archivos'],
  [/fontspec package requires either XeTeX or LuaTeX/, 'Este documento usa fontspec y necesita XeLaTeX o LuaLaTeX: cambia el motor en ⋮ → Motor'],
  [/unicode-math.*requires|polyglossia.*(XeTeX|LuaTeX)/, 'Este documento necesita XeLaTeX o LuaLaTeX: cambia el motor en ⋮ → Motor'],
  [/^Undefined control sequence/, 'Comando no definido (¿falta un paquete o hay un error de tipeo?)'],
  [/^Missing \$ inserted/, 'Falta un $: hay símbolos matemáticos fuera de modo matemático'],
  [/^Missing \} inserted/, 'Falta cerrar una llave }'],
  [/^Missing \{ inserted/, 'Falta abrir una llave {'],
  [/^Extra \}, or forgotten/, 'Sobra una llave } o falta un \\begin'],
  [/^File `(.+)' not found/, 'No se encontró el archivo $1'],
  [/LaTeX Error: File `(.+)' not found/, 'No se encontró el archivo/paquete $1'],
  [/LaTeX Error: Environment (\S+) undefined/, 'El entorno $1 no existe (¿falta un paquete?)'],
  [/LaTeX Error: \\begin\{(\S+)\} on input line (\d+) ended by \\end\{(\S+)\}/, '\\begin{$1} (línea $2) se cerró con \\end{$3}'],
  [/LaTeX Error: \\begin\{(\S+)\} ended by \\end\{(\S+)\}/, '\\begin{$1} se cerró con \\end{$2} (revisa los entornos abiertos)'],
  [/LaTeX Error: Missing \\begin\{document\}/, 'Falta \\begin{document} o hay texto antes de él'],
  [/^Misplaced alignment tab character &/, 'Carácter & fuera de una tabla o alineación'],
  [/^Paragraph ended before (.+) was complete/, 'Párrafo terminado antes de completar $1 (¿llave sin cerrar?)'],
  [/^Runaway argument/, 'Argumento sin cerrar (falta una llave })'],
  [/^Double superscript/, 'Doble superíndice: usa llaves, p. ej. x^{a^b}'],
  [/^Double subscript/, 'Doble subíndice: usa llaves, p. ej. x_{a_b}'],
  [/no legal \\end found/, 'Falta \\end{document} al final del documento'],
  [/^Emergency stop/, 'Parada de emergencia: revisa el primer error'],
  [/^Display math should end with \$\$/, 'La ecuación en display debe cerrar con $$'],
  [/^Illegal unit of measure/, 'Unidad de medida no válida (usa pt, cm, mm, em...)'],
  [/^Too many \}'s/, 'Demasiadas llaves }'],
  [/LaTeX Error: There's no line here to end/, 'No hay línea que terminar (\\\\ mal ubicado)'],
  [/Citation `(.+)' on page .* undefined/, 'Cita no definida: $1'],
  [/Reference `(.+)' on page .* undefined/, 'Referencia no definida: $1'],
  [/There were undefined references/, 'Hay referencias o citas sin definir: revisa los avisos de arriba (si las acabas de agregar, compila otra vez)'],
  [/Command \\\S+ invalid in math mode/, 'Hay un carácter de texto (como una tilde) dentro de modo matemático: probablemente falta cerrar un $'],
  [/Label\(s\) may have changed/, 'Las etiquetas cambiaron: vuelve a compilar'],
];

export function translate(msg) {
  for (const [re, es] of TRANSLATIONS) {
    const m = msg.match(re);
    if (m) return es.replace(/\$(\d)/g, (_, i) => m[+i] || '');
  }
  return null;
}

function normFile(f, main) {
  if (!f) return main;
  return f.replace(/^\.\//, '');
}

const COMMON_PACKAGES = ['amsmath', 'amssymb', 'amsthm', 'amsfonts', 'mathtools', 'graphicx', 'geometry', 'babel', 'inputenc', 'fontenc',
  'hyperref', 'xcolor', 'color', 'tikz', 'pgfplots', 'circuitikz', 'siunitx', 'booktabs', 'multirow', 'array', 'tabularx', 'longtable',
  'float', 'caption', 'subcaption', 'enumitem', 'fancyhdr', 'titlesec', 'listings', 'minted', 'xcolor', 'setspace', 'parskip',
  'natbib', 'biblatex', 'cleveref', 'csquotes', 'url', 'microtype', 'lipsum', 'multicol', 'wrapfig', 'eurosym', 'textcomp',
  'fontspec', 'unicode-math', 'polyglossia', 'physics', 'esint', 'bm', 'cancel', 'tcolorbox', 'pdfpages', 'appendix', 'tocloft',
  'beamer', 'article', 'report', 'book', 'IEEEtran', 'memoir', 'scrartcl', 'standalone', 'chemfig', 'mhchem', 'algorithm2e', 'algorithmic'];

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

export function suggestPackage(name) {
  let best = null, bestD = 3;
  for (const p of COMMON_PACKAGES) {
    const dd = editDistance(name.toLowerCase(), p.toLowerCase());
    if (dd > 0 && dd < bestD) { best = p; bestD = dd; }
  }
  return best;
}

/** Para un .sty/.cls que no existe, busca la línea del \usepackage/\documentclass que lo pide. */
function locatePackage(fname, sources, main) {
  const m = fname.match(/^(.+)\.(sty|cls)$/);
  if (!m || !sources) return null;
  const re = m[2] === 'cls' ? new RegExp('\\\\documentclass(\\[[^\\]]*\\])?\\{\\s*' + m[1] + '\\s*\\}') : new RegExp('\\\\(usepackage|RequirePackage)(\\[[^\\]]*\\])?\\{[^}]*\\b' + m[1].replace(/[-.]/g, '\\$&') + '\\b');
  const order = [main, ...Object.keys(sources).filter((k) => k !== main)];
  for (const file of order) {
    const text = sources[file];
    if (!text) continue;
    const lines = text.split('\n');
    const idx = lines.findIndex((l) => re.test(l.replace(/(^|[^\\])%.*$/, '$1')));
    if (idx >= 0) return { file, line: idx + 1 };
  }
  return null;
}

/** Paquete o clase inexistente: apunta al \\usepackage y sugiere el nombre correcto. */
function fixNotFound(entry, sources, main) {
  const nf = entry.message.match(/File `([^']+\.(?:sty|cls))' not found/);
  if (!nf) return;
  const loc = locatePackage(nf[1], sources, main);
  if (loc) { entry.file = loc.file; entry.line = loc.line; entry.context = ''; }
  const base = nf[1].replace(/\.(sty|cls)$/, '');
  const sug = suggestPackage(base);
  if (sug) entry.hint = `No existe «${base}». ¿Quisiste decir «${sug}»?`;
}

const NOISE = [/==> Fatal error occurred/, /Writing or overwriting file/, /^\s*$/];

/** Busca en el código el fragmento que TeX muestra tras "Runaway argument?" para ubicar la línea. */
function locate(snippet, sources) {
  if (!snippet || !sources) return null;
  const clean = snippet.replace(/\\par\b.*$/, '').replace(/^\{/, '').trim().slice(0, 40);
  if (clean.length < 4) return null;
  for (const [file, text] of Object.entries(sources)) {
    const idx = text.indexOf(clean);
    if (idx >= 0) return { file, line: text.slice(0, idx).split('\n').length };
  }
  return null;
}

export function parseLog(log, main = 'main.tex', sources = null) {
  const out = [];
  if (!log) return out;
  // Une líneas cortadas a 79 caracteres por TeX (heurística simple).
  const lines = log.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(RE_FILE_LINE_ERROR);
    if (m && !/^\//.test(m[1])) {
      let msg = m[3];
      if (NOISE.some((re) => re.test(msg))) continue;
      // Contexto: la línea "l.N ..." que sigue suele mostrar dónde ocurrió.
      let context = '';
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        if (/^l\.\d+/.test(lines[j])) { context = (lines[j].replace(/^l\.\d+\s?/, '') + (lines[j + 1] ? lines[j + 1].trim() : '')).replace(/\^\^M/g, '').trim(); break; }
      }
      const entry = { type: 'error', file: normFile(m[1], main), line: +m[2], message: msg, hint: translate(msg), context };
      fixNotFound(entry, sources, main);
      out.push(entry);
      continue;
    }
    if (m && /^\//.test(m[1])) {
      if (NOISE.some((re) => re.test(m[3]))) continue;
      // Error dentro de un paquete del sistema: se informa sin salto al código.
      out.push({ type: 'error', file: null, line: null, message: m[3] + ' (' + m[1].split('/').pop() + ':' + m[2] + ')', hint: translate(m[3]) });
      continue;
    }
    if (line.startsWith('! ')) {
      const msg = line.slice(2);
      if (NOISE.some((re) => re.test(msg))) continue;
      let ln = null;
      let file = main;
      if (/^File ended while scanning|^Paragraph ended before/.test(msg)) {
        // TeX imprime "Runaway argument?" y el texto afectado justo antes del error.
        const prev = lines.slice(Math.max(0, i - 3), i).join(' ');
        const m2 = prev.match(/Runaway argument\?\s*(.*)$/);
        const loc = locate(m2 ? m2[1] : '', sources);
        if (loc) { ln = loc.line; file = loc.file; }
      }
      if (/^Emergency stop/.test(msg) && lines.slice(i + 1, i + 5).some((l) => /no legal \\end found/.test(l))) {
        const lastLine = sources && sources[main] ? sources[main].replace(/\s+$/, '').split('\n').length : null;
        out.push({ type: 'error', file: main, line: lastLine, message: 'Emergency stop (no legal \\end found).', hint: translate('no legal \\end found') });
        continue;
      }
      if (ln == null) {
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const lm = lines[j].match(/^l\.(\d+)/);
          if (lm) { ln = +lm[1]; break; }
        }
      }
      const entry = { type: 'error', file: ln != null ? file : null, line: ln, message: msg, hint: translate(msg) };
      fixNotFound(entry, sources, main);
      out.push(entry);
      continue;
    }
    m = line.match(RE_WARNING);
    if (m && NOISE.some((re) => re.test(m[2]))) continue;
    if (m) {
      let msg = m[2];
      let j = i + 1;
      while (j < lines.length && /^\(\S*\)\s+/.test(lines[j])) { msg += ' ' + lines[j].replace(/^\(\S*\)\s+/, ''); j++; }
      while (j < lines.length && lines[j].trim() && !RE_INPUT_LINE.test(msg) && j - i < 4 && !/^(LaTeX|Package|Class|Overfull|Underfull|!)/.test(lines[j])) { msg += ' ' + lines[j].trim(); j++; }
      const lm = msg.match(RE_INPUT_LINE);
      out.push({ type: 'warning', file: lm ? main : null, line: lm ? +lm[1] : null, message: (m[1] ? m[1] + ': ' : '') + msg.trim(), hint: translate(msg) });
      continue;
    }
    m = line.match(RE_BADBOX);
    if (m) {
      out.push({ type: 'badbox', file: m[3] ? main : null, line: m[3] ? +m[3] : null, message: `${m[1] === 'Over' ? 'Desborde' : 'Caja poco llena'} (${m[2]})` });
    }
  }
  // Quita duplicados exactos.
  const seen = new Set();
  return markCascades(out.filter((e) => {
    const k = e.type + e.file + e.line + e.message;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }));
}

/**
 * Marca como "en cadena" los mensajes que son consecuencia de un error anterior,
 * para no confundir: se arreglan solos al corregir el error original.
 */
export function markCascades(entries) {
  const errs = entries.filter((e) => e.type === 'error');
  const undefinedEnvs = [];
  let prevMissingDollar = null;
  const firstReal = errs.find((e) => !/^Emergency stop\.?$/.test(e.message));
  for (const e of entries) {
    const m = e.message;
    if (e.type === 'error' && /^Emergency stop\.?$/.test(m) && firstReal && firstReal !== e) { e.cascade = firstReal.line ?? '?'; continue; }
    if (e.type === 'error' && /no legal \\end found/.test(m)) {
      const runaway = errs.find((x) => x !== e && /^File ended while scanning/.test(x.message));
      if (runaway) { e.cascade = runaway.line ?? '?'; continue; }
    }
    const env = m.match(/Environment (\S+) undefined/);
    if (env) { undefinedEnvs.push({ name: env[1], line: e.line }); continue; }
    if (e.type === 'error') {
      const ended = m.match(/\\begin\{[^}]+\} ended by \\end\{([^}]+)\}/);
      const u = ended && undefinedEnvs.find((x) => x.name === ended[1]);
      if (u) { e.cascade = u.line; continue; }
      if (/Misplaced alignment tab/.test(m)) {
        const u2 = undefinedEnvs.find((x) => x.line != null && e.line != null && e.line > x.line && e.line - x.line <= 15);
        if (u2) { e.cascade = u2.line; continue; }
      }
      if (/^Missing \$ inserted/.test(m)) {
        if (prevMissingDollar && e.line != null && prevMissingDollar.line != null && e.line - prevMissingDollar.line <= 2 && !(e.context || '').trim()) {
          e.cascade = prevMissingDollar.line; continue;
        }
        prevMissingDollar = e;
      }
    } else if (e.type === 'warning' && /invalid in math mode/.test(m)) {
      const src = errs.find((x) => /Missing \$ inserted/.test(x.message) && x.line === e.line);
      if (src) e.cascade = src.line;
    }
  }
  return entries;
}

export function summarize(entries) {
  return {
    cascades: entries.filter((e) => e.type === 'error' && e.cascade != null).length,
    errors: entries.filter((e) => e.type === 'error' && e.cascade == null).length,
    warnings: entries.filter((e) => e.type === 'warning').length,
    badboxes: entries.filter((e) => e.type === 'badbox').length,
  };
}
