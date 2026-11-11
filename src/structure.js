// Análisis de estructura del documento: secciones, etiquetas, figuras, tablas,
// archivos incluidos y claves bibliográficas (para el panel y el autocompletado).

const LEVELS = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5 };
const RE_SECTION = /\\(part|chapter|section|subsection|subsubsection|paragraph)(\*?)\s*(?:\[[^\]]*\])?\s*\{/g;
const RE_LABEL = /\\label\s*\{([^}]+)\}/g;
const RE_INPUT = /\\(?:input|include|subfile)\s*\{([^}]+)\}/g;
const RE_BEGIN = /\\begin\s*\{(figure\*?|table\*?)\}/g;
const RE_CAPTION = /\\caption\s*(?:\[[^\]]*\])?\s*\{/g;
const RE_TODO = /%\s*(TODO|POR HACER|FIXME)[:\s](.*)$/gim;
const RE_BIBKEY = /@\w+\s*\{\s*([^,\s]+)\s*,/g;
const RE_NEWCMD = /\\(?:re)?newcommand\*?\s*\{?\\([A-Za-z@]+)\}?/g;

function stripComments(text) {
  // Reemplaza comentarios por espacios para conservar las posiciones.
  return text.replace(/(^|[^\\])%.*$/gm, (m, pre) => pre + ' '.repeat(m.length - pre.length));
}

function readBraced(text, start) {
  let depth = 1;
  let i = start;
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  return text.slice(start, i - 1);
}

function lineIndex(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (pos) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

function cleanTitle(t) {
  return t.replace(/\\[a-zA-Z]+\*?\s*/g, '').replace(/[{}$]/g, '').replace(/\s+/g, ' ').trim() || '(sin título)';
}

export function analyzeFile(path, text) {
  const items = [];
  const labels = [];
  const inputs = [];
  const commands = [];
  const lineOf = lineIndex(text);
  const src = stripComments(text);
  let m;
  RE_SECTION.lastIndex = 0;
  while ((m = RE_SECTION.exec(src))) {
    const title = readBraced(src, m.index + m[0].length);
    items.push({ type: 'section', kind: m[1], level: LEVELS[m[1]], starred: !!m[2], title: cleanTitle(title), file: path, line: lineOf(m.index), pos: m.index });
  }
  RE_LABEL.lastIndex = 0;
  while ((m = RE_LABEL.exec(src))) {
    labels.push({ name: m[1].trim(), file: path, line: lineOf(m.index) });
    items.push({ type: 'label', title: m[1].trim(), file: path, line: lineOf(m.index), pos: m.index });
  }
  RE_INPUT.lastIndex = 0;
  while ((m = RE_INPUT.exec(src))) {
    inputs.push(m[1].trim());
    items.push({ type: 'input', title: m[1].trim(), file: path, line: lineOf(m.index), pos: m.index });
  }
  RE_BEGIN.lastIndex = 0;
  while ((m = RE_BEGIN.exec(src))) {
    RE_CAPTION.lastIndex = m.index;
    const end = src.indexOf('\\end{' + m[1] + '}', m.index);
    const c = RE_CAPTION.exec(src);
    let caption = '';
    if (c && (end < 0 || c.index < end)) caption = cleanTitle(readBraced(src, c.index + c[0].length));
    items.push({ type: m[1].startsWith('figure') ? 'figure' : 'table', title: caption || (m[1].startsWith('figure') ? 'Figura' : 'Tabla'), file: path, line: lineOf(m.index), pos: m.index });
  }
  RE_TODO.lastIndex = 0;
  while ((m = RE_TODO.exec(text))) {
    items.push({ type: 'todo', title: m[2].trim() || m[1], file: path, line: lineOf(m.index), pos: m.index });
  }
  RE_NEWCMD.lastIndex = 0;
  while ((m = RE_NEWCMD.exec(src))) commands.push('\\' + m[1]);
  items.sort((a, b) => a.pos - b.pos);
  return { items, labels, inputs, commands };
}

export function bibKeys(text) {
  const keys = [];
  let m;
  RE_BIBKEY.lastIndex = 0;
  while ((m = RE_BIBKEY.exec(text))) if (!/^(comment|string|preamble)$/i.test(m[1])) keys.push(m[1]);
  return keys;
}

function resolveInput(name, paths) {
  const n = name.replace(/^\.\//, '');
  const candidates = [n, n + '.tex'];
  return candidates.find((c) => paths.has(c)) || null;
}

/**
 * Analiza el proyecto completo siguiendo \input/\include desde el archivo principal.
 * files: [{path, text}] (solo texto). Devuelve árbol ordenado + etiquetas + claves bib.
 */
export function analyzeProject(main, files) {
  const byPath = new Map(files.map((f) => [f.path, f]));
  const paths = new Set(byPath.keys());
  const visited = new Set();
  const outline = [];
  const labels = [];
  const commands = new Set();

  function walk(path, depth) {
    if (visited.has(path) || depth > 12) return;
    visited.add(path);
    const f = byPath.get(path);
    if (!f) return;
    const a = analyzeFile(path, f.text);
    labels.push(...a.labels);
    a.commands.forEach((c) => commands.add(c));
    for (const it of a.items) {
      outline.push({ ...it, depth });
      if (it.type === 'input') {
        const target = resolveInput(it.title, paths);
        if (target) walk(target, depth + 1);
      }
    }
  }
  if (byPath.has(main)) walk(main, 0);
  // Archivos .tex no alcanzados también aportan etiquetas y comandos.
  for (const f of files) {
    if (!visited.has(f.path) && f.path.endsWith('.tex')) {
      const a = analyzeFile(f.path, f.text);
      labels.push(...a.labels);
      a.commands.forEach((c) => commands.add(c));
    }
  }
  const cites = [];
  for (const f of files) if (f.path.endsWith('.bib')) cites.push(...bibKeys(f.text));
  return { outline, labels, cites: [...new Set(cites)], commands: [...commands] };
}
