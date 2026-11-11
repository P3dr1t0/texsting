// Lectura del log de LaTeX: errores, advertencias y cajas mal ajustadas,
// con archivo y línea para saltar al código (como el panel de mensajes de TeXstudio).

const RE_FILE_LINE_ERROR = /^(\.?\/?[^:\n]+\.(?:tex|sty|cls|bib|ltx|def)):(\d+): (.*)$/;
const RE_WARNING = /^(?:LaTeX|Package|Class)\s*(?:(\S+)\s+)?Warning:\s*(.*)$/;
const RE_INPUT_LINE = /on input line (\d+)/;
const RE_BADBOX = /^(Over|Under)full \\[hv]box \((.*?)\) (?:in paragraph |detected |has occurred while \\output is active)?(?:at lines? (\d+)(?:--(\d+))?)?/;

export const TRANSLATIONS = [
  [/^Undefined control sequence/, 'Comando no definido (¿falta un paquete o hay un error de tipeo?)'],
  [/^Missing \$ inserted/, 'Falta un $: hay símbolos matemáticos fuera de modo matemático'],
  [/^Missing \} inserted/, 'Falta cerrar una llave }'],
  [/^Missing \{ inserted/, 'Falta abrir una llave {'],
  [/^Extra \}, or forgotten/, 'Sobra una llave } o falta un \\begin'],
  [/^File `(.+)' not found/, 'No se encontró el archivo $1'],
  [/LaTeX Error: File `(.+)' not found/, 'No se encontró el archivo/paquete $1'],
  [/LaTeX Error: Environment (\S+) undefined/, 'El entorno $1 no existe (¿falta un paquete?)'],
  [/LaTeX Error: \\begin\{(\S+)\} on input line (\d+) ended by \\end\{(\S+)\}/, '\\begin{$1} (línea $2) se cerró con \\end{$3}'],
  [/LaTeX Error: Missing \\begin\{document\}/, 'Falta \\begin{document} o hay texto antes de él'],
  [/^Misplaced alignment tab character &/, 'Carácter & fuera de una tabla o alineación'],
  [/^Paragraph ended before (.+) was complete/, 'Párrafo terminado antes de completar $1 (¿llave sin cerrar?)'],
  [/^Runaway argument/, 'Argumento sin cerrar (falta una llave })'],
  [/^Double superscript/, 'Doble superíndice: usa llaves, p. ej. x^{a^b}'],
  [/^Double subscript/, 'Doble subíndice: usa llaves, p. ej. x_{a_b}'],
  [/^Emergency stop/, 'Parada de emergencia: revisa el primer error'],
  [/^Display math should end with \$\$/, 'La ecuación en display debe cerrar con $$'],
  [/^Illegal unit of measure/, 'Unidad de medida no válida (usa pt, cm, mm, em...)'],
  [/^Too many \}'s/, 'Demasiadas llaves }'],
  [/LaTeX Error: There's no line here to end/, 'No hay línea que terminar (\\\\ mal ubicado)'],
  [/Citation `(.+)' on page .* undefined/, 'Cita no definida: $1'],
  [/Reference `(.+)' on page .* undefined/, 'Referencia no definida: $1'],
  [/There were undefined references/, 'Hay referencias sin definir (compila otra vez)'],
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

export function parseLog(log, main = 'main.tex') {
  const out = [];
  if (!log) return out;
  // Une líneas cortadas a 79 caracteres por TeX (heurística simple).
  const lines = log.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(RE_FILE_LINE_ERROR);
    if (m && !/^\//.test(m[1])) {
      let msg = m[3];
      // Contexto: la línea "l.N ..." que sigue suele mostrar dónde ocurrió.
      let context = '';
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        if (/^l\.\d+/.test(lines[j])) { context = lines[j].replace(/^l\.\d+\s?/, '') + (lines[j + 1] ? ' ' + lines[j + 1].trim() : ''); break; }
      }
      out.push({ type: 'error', file: normFile(m[1], main), line: +m[2], message: msg, hint: translate(msg), context });
      continue;
    }
    if (m && /^\//.test(m[1])) {
      // Error dentro de un paquete del sistema: se informa sin salto al código.
      out.push({ type: 'error', file: null, line: null, message: m[3] + ' (' + m[1].split('/').pop() + ':' + m[2] + ')', hint: translate(m[3]) });
      continue;
    }
    if (line.startsWith('! ')) {
      const msg = line.slice(2);
      let ln = null;
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const lm = lines[j].match(/^l\.(\d+)/);
        if (lm) { ln = +lm[1]; break; }
      }
      out.push({ type: 'error', file: main, line: ln, message: msg, hint: translate(msg) });
      continue;
    }
    m = line.match(RE_WARNING);
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
  return out.filter((e) => {
    const k = e.type + e.file + e.line + e.message;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function summarize(entries) {
  return {
    errors: entries.filter((e) => e.type === 'error').length,
    warnings: entries.filter((e) => e.type === 'warning').length,
    badboxes: entries.filter((e) => e.type === 'badbox').length,
  };
}
