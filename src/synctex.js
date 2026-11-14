// SyncTeX: une cada línea del código con su lugar en el PDF (y al revés).
//  - Del código al PDF (doble clic en el código): forward(file, line)
//  - Del PDF al código (Ctrl + clic o mantener presionado): inverse(page, x, y)
// Las coordenadas que devuelve están en puntos PDF (bp) con origen arriba a la izquierda,
// igual que pdf.js con escala 1.

const SP_PER_BP = 65781.76; // 65536 sp/pt × 72,27 pt / 72 bp

async function gunzip(bytes) {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).text();
}

/**
 * Lee un .synctex(.gz). `projectFiles` = rutas del proyecto (p. ej. ['main.tex', 'capitulos/intro.tex'])
 * para traducir las rutas absolutas del servidor a las del proyecto.
 */
export async function parseSynctex(bytes, projectFiles = []) {
  const text = await gunzip(bytes);
  const inputs = new Map(); // tag -> ruta del proyecto (o null si es de un paquete)
  let unit = 1, mag = 1000, xoff = 0, yoff = 0;
  const pages = []; // por página: { boxes: [], leaves: [] }
  const byLine = new Map(); // "ruta:línea" -> [{page, kind, x, y, w, h, d}]
  let page = null;
  const stack = []; // cajas abiertas (para saber la altura del renglón de cada «hoja»)

  const mapPath = (abs) => {
    const p = abs.replace(/\/\.\//g, '/').replace(/\\/g, '/');
    let best = null;
    for (const f of projectFiles) if ((p === f || p.endsWith('/' + f)) && (!best || f.length > best.length)) best = f;
    return best;
  };
  const conv = (v) => (+v * unit) / SP_PER_BP * (mag / 1000);

  let inContent = false;
  for (const line of text.split('\n')) {
    if (!line) continue;
    const c = line[0];
    if (c === 'I' && line.startsWith('Input:')) {
      const m = line.match(/^Input:(\d+):(.*)$/);
      if (m) inputs.set(+m[1], mapPath(m[2]));
      continue;
    }
    if (!inContent) {
      if (line.startsWith('Unit:')) unit = +line.slice(5) || 1;
      else if (line.startsWith('Magnification:')) mag = +line.slice(14) || 1000;
      else if (line.startsWith('X Offset:')) xoff = +line.slice(9) || 0;
      else if (line.startsWith('Y Offset:')) yoff = +line.slice(9) || 0;
      else if (line.startsWith('Content:')) inContent = true;
      continue;
    }
    if (c === '{') { page = { n: +line.slice(1), boxes: [], leaves: [] }; pages[page.n - 1] = page; stack.length = 0; continue; }
    if (c === '}') { page = null; continue; }
    if (!page) continue;
    if (c === ')' || c === ']') { stack.pop(); continue; }
    if (!'[(hvxkg$'.includes(c)) continue;
    // tipo tag,línea[,columna]:x,y[:W,H,D | :W]
    const m = line.slice(1).match(/^(\d+),(-?\d+)(?:,-?\d+)?:(-?\d+),(-?\d+)(?::(-?\d+)(?:,(-?\d+),(-?\d+))?)?/);
    if (!m) { if (c === '[' || c === '(') stack.push(null); continue; }
    const file = inputs.get(+m[1]);
    const rec = {
      page: page.n, kind: c, file, line: +m[2],
      x: conv(+m[3] + xoff), y: conv(+m[4] + yoff),
      w: m[5] ? conv(m[5]) : 0, h: m[6] ? conv(m[6]) : 0, d: m[7] ? conv(m[7]) : 0,
    };
    if (c === '[' || c === '(') {
      stack.push(rec);
      if (c === '(') page.boxes.push(rec);
    } else {
      const parent = [...stack].reverse().find((b) => b && b.kind === '(');
      rec.parent = parent || null;
      page.leaves.push(rec);
    }
    if (file && rec.line > 0) {
      const key = file + ':' + rec.line;
      if (!byLine.has(key)) byLine.set(key, []);
      byLine.get(key).push(rec);
    }
  }
  return { inputs, pages, byLine };
}

/** Del código al PDF: rectángulo (página, x, y, w, h) que corresponde a esa línea. */
function rectOf(r) {
  if (r.kind === '(' && r.w > 0) return { x: r.x, y: r.y - Math.max(r.h, 6), w: r.w, h: Math.max(r.h, 6) + r.d };
  if (r.parent) return { x: r.parent.x, y: r.parent.y - Math.max(r.parent.h, 6), w: r.parent.w, h: Math.max(r.parent.h, 6) + r.parent.d };
  return { x: r.x - 2, y: r.y - 8, w: Math.max(r.w, 12), h: 10 };
}

export function forward(sync, file, line) {
  if (!sync) return null;
  // Se ignoran las cajas de página, las vacías (ancho 0) y las marcas en la esquina de la página.
  const real = (r) => {
    if (r.kind === '[' || r.kind === 'v' || r.y <= 1) return false;
    const box = r.kind === '(' ? r : r.parent;
    if (box) return box.w > 0 && box.h + box.d > 0; // el renglón tiene que tener ancho y alto de verdad
    return r.kind === 'x' || r.kind === '$';
  };
  const all = (n) => (sync.byLine.get(file + ':' + n) || []).filter(real);
  // «Pequeños»: letras, espacios y renglones normales (no cajas que ocupan media página).
  const small = (n) => all(n).filter((r) => rectOf(r).h <= 250);
  const result = (recs) => {
    const pageN = recs[0].page;
    const rects = recs.filter((r) => r.page === pageN).map(rectOf);
    const x1 = Math.min(...rects.map((r) => r.x)), y1 = Math.min(...rects.map((r) => r.y));
    const x2 = Math.max(...rects.map((r) => r.x + r.w)), y2 = Math.max(...rects.map((r) => r.y + r.h));
    if (y2 - y1 <= 250) return { page: pageN, x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    return { page: pageN, x: x1, y: y1, w: x2 - x1, h: 250 };
  };
  // 1) La línea exacta.
  let recs = small(line);
  if (recs.length) return result(recs);
  // 2) La línea exacta produce solo una caja grande (\tableofcontents, una figura…): su parte de arriba.
  const big = all(line);
  if (big.length) { const r = rectOf(big[0]); return { page: big[0].page, x: r.x, y: r.y, w: r.w, h: Math.min(r.h, 60) }; }
  // 3) Línea sin salida (comentario, línea en blanco): la más cercana.
  for (let delta = 1; delta <= 12; delta++) {
    recs = small(line + delta);
    if (!recs.length) recs = small(line - delta);
    if (recs.length) return result(recs);
  }
  // 4) Preámbulo o definición de comandos: el primer contenido que viene después.
  const lines = [...sync.byLine.keys()].filter((k) => k.startsWith(file + ':')).map((k) => +k.slice(file.length + 1)).sort((a, b) => a - b);
  const next = lines.find((n) => n > line && small(n).length) ?? [...lines].reverse().find((n) => n < line && small(n).length);
  return next != null ? result(small(next)) : null;
}

/** Del PDF al código: archivo y línea del punto (x, y) de la página (en bp). */
export function inverse(sync, pageN, x, y) {
  const page = sync && sync.pages[pageN - 1];
  if (!page) return null;
  const TALL = 40; // un renglón normal mide menos; las cajas más altas (título, figuras) no sirven para ubicar
  const band = (l) => {
    const p = l.parent;
    if (p && p.h + p.d > 0 && p.h + p.d <= TALL) return [p.y - p.h, p.y + p.d];
    return [l.y - 9, l.y + 3]; // banda de un renglón alrededor de la línea base
  };
  // 1) El renglón (h-box de altura normal) más pequeño que contiene el punto.
  let box = null;
  for (const b of page.boxes) {
    if (!b.file || b.w <= 0 || b.h + b.d <= 0 || b.h + b.d > TALL) continue;
    const top = b.y - b.h, bottom = b.y + Math.max(b.d, 1);
    if (x >= b.x && x <= b.x + b.w && y >= top - 1 && y <= bottom + 1 && (!box || b.w * (b.h + b.d) < box.w * (box.h + box.d))) box = b;
  }
  // 2) Dentro de ese renglón (o en toda la página si no hay), la letra/espacio más cercano.
  const cand = page.leaves.filter((l) => l.file && l.y > 1 && (!box || l.parent === box));
  let best = null, bestD = Infinity;
  for (const l of cand) {
    const [top, bottom] = band(l);
    const dy = y < top ? top - y : y > bottom ? y - bottom : 0;
    const dist = dy * 8 + Math.abs(x - l.x);
    if (dist < bestD) { bestD = dist; best = l; }
  }
  const hit = best || box;
  if (!hit) {
    // 3) Último recurso: la caja más cercana.
    let nb = null, nd = Infinity;
    for (const b of page.boxes) {
      if (!b.file || b.y <= 1) continue;
      const dy = Math.abs(y - b.y), dx = x < b.x ? b.x - x : x > b.x + b.w ? x - b.x - b.w : 0;
      if (dy * 4 + dx < nd) { nd = dy * 4 + dx; nb = b; }
    }
    return nb ? { file: nb.file, line: nb.line } : null;
  }
  return { file: hit.file, line: hit.line };
}
