// Lectura del log de LaTeX: errores, advertencias y cajas mal ajustadas,
// con archivo y línea para saltar al código (como el panel de mensajes de TeXstudio).

// Cualquier archivo con extensión (también los que lee listings: .m, .py, .c…).
const RE_FILE_LINE_ERROR = /^(\.?\/?[^:\n]+\.[A-Za-z0-9]{1,8}):(\d+): (.*)$/;
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
  [/^Please use \\mathaccent for accents in math mode/, 'Hay una letra con tilde dentro de una fórmula: si es texto, cierra antes la fórmula con $ o escríbelo con \\text{…}'],
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
  [/Invalid UTF-8 byte/, 'Hay un carácter que este archivo o paquete no sabe leer (p. ej. listings no acepta Ω, ≤ ni emojis dentro del código): cámbialo por texto o, en listings, usa la opción literate'],
  [/Unicode character (.+?) \(U\+([0-9A-Fa-f]+)\)/, 'pdfLaTeX no conoce el carácter «$1» (U+$2): bórralo o cámbialo por un comando de LaTeX'],
  [/Misplaced \\noalign/, 'Un \\hline (o \\midrule) quedó en medio de una fila: casi siempre falta \\\\ al final de la fila anterior'],
  [/Misplaced \\omit/, 'Esta fila de la tabla tiene más columnas de las que se definieron (o un \\multicolumn en mal lugar)'],
  [/You can't use `macro parameter character #'/, '# es un carácter especial en LaTeX: en texto se escribe \\#'],
  [/Couldn't load requested language/, 'listings no conoce ese lenguaje: revisa cómo está escrito (Python, C, C++, Java, Matlab, VHDL…)'],
  [/could not retrieve column '([^']*)' from table '([^']*)'/, 'La tabla de datos «$2» no tiene una columna llamada «$1»'],
  [/Could not read table file '([^']*)'/, 'No existe el archivo de datos «$1» en el proyecto: súbelo (Archivos → Subir) o corrige el nombre'],
  [/the current plot has no coordinates/, 'Esta gráfica quedó sin puntos (normalmente por el error de arriba)'],
  [/You have an axis with empty range/, 'El eje quedó sin datos para fijar su escala (normalmente por el error de arriba)'],
  [/Quote style not defined/, 'csquotes no tiene ese estilo de comillas: usa \\usepackage[autostyle]{csquotes}, que toma el idioma de babel («» en español)'],
  [/Unknown float option `H'/, 'La opción [H] (figura o tabla «aquí exactamente») necesita el paquete float: agrega \\usepackage{float}'],
  [/^Paragraph ended before (.+) was complete/, 'Párrafo terminado antes de completar $1 (¿llave sin cerrar?)'],
  [/^Runaway argument/, 'Argumento sin cerrar (falta una llave })'],
  [/^Double superscript/, 'Doble superíndice: usa llaves, p. ej. x^{a^b}'],
  [/^Double subscript/, 'Doble subíndice: usa llaves, p. ej. x_{a_b}'],
  [/no legal \\end found/, 'Falta \\end{document} al final del documento'],
  [/^Emergency stop/, 'Parada de emergencia: revisa el primer error'],
  [/^Display math should end with \$\$/, 'La ecuación en display debe cerrar con $$'],
  [/^Illegal unit of measure/, 'Unidad de medida no válida (usa pt, cm, mm, em...)'],
  [/^Too many \}'s/, 'Demasiadas llaves }'],
  [/LaTeX Error: There's no line here to end/, 'No hay línea que terminar: \\\\ al empezar un párrafo o después de una línea en blanco. Para dejar espacio usa \\vspace{1em}'],
  [/Option clash for package ([^\s.]+)/, 'El paquete $1 se cargó dos veces con opciones distintas: cárgalo una sola vez, con todas sus opciones juntas'],
  [/LaTeX Error: Can be used only in preamble/, 'Este comando (p. ej. \\usepackage) solo puede ir en el preámbulo, antes de \\begin{document}'],
  [/LaTeX Error: Command (\\\S+) already defined/, 'El comando $1 ya existe: usa otro nombre, o \\renewcommand si de verdad quieres cambiarlo'],
  [/Lonely \\item/, '\\item solo puede ir dentro de una lista (itemize, enumerate o description)'],
  [/Something's wrong--perhaps a missing \\item/, 'Hay texto dentro de la lista antes del primer \\item (o falta un \\item)'],
  [/Undefined color `([^']*![^']*)'/, 'El color «$1» es una mezcla y necesita el paquete xcolor: agrega \\usepackage{xcolor} (antes de hyperref)'],
  [/Undefined color `([^']+)'/, 'El color «$1» no está definido: defínelo con \\definecolor o usa uno básico (red, blue, black…)'],
  [/I can't find file `([^']+)'/, 'Falta el archivo «$1», que necesita un paquete. TeXsting intenta instalarlo solo (necesita internet la primera vez)'],
  [/The font "([^"]+)" cannot be found/, 'La fuente «$1» no está instalada en este equipo'],
  [/\\textfont \d+ is undefined|Insufficient symbol fonts/, 'Falta la fuente matemática (casi siempre porque otra fuente no se pudo cargar antes)'],
  [/not loadable: Metric \(TFM\) file/, 'No se pudo cargar esta fuente'],
  [/scanning use of \\@xverbatim|scanning use of \\lst@/, 'Código literal (verbatim/lstlisting) que no se cerró bien'],
  [/Citation `(.+)' on page .* undefined/, 'Cita no definida: $1'],
  [/Reference `(.+)' on page .* undefined/, 'Referencia no definida: $1'],
  [/There were undefined references/, 'Hay referencias o citas sin definir: revisa los avisos de arriba (si las acabas de agregar, compila otra vez)'],
  [/Command \\\S+ invalid in math mode/, 'Hay un carácter de texto (como una tilde) dentro de modo matemático: probablemente falta cerrar un $'],
  [/Label\(s\) may have changed/, 'Las etiquetas cambiaron: vuelve a compilar'],
  [/Label `(.+)' multiply defined/, 'La etiqueta $1 está repetida: cada \\label debe ser único'],
  [/There were multiply-defined labels/, 'Hay etiquetas repetidas: revisa el aviso de arriba'],
  [/Font shape `(.+)' undefined/, 'La fuente no tiene esa combinación de estilos ($1): LaTeX usó una parecida. No es grave'],
  [/^Missing \\right\. inserted/, 'Falta \\right para cerrar un \\left (p. ej. \\left( … \\right))'],
  [/^Extra alignment tab has been changed/, 'Esta fila tiene más columnas (&) que las declaradas en \\begin{tabular}{…}'],
  [/LaTeX Error: Illegal character in array arg/, 'Tipo de columna no válido en la tabla: usa l, c, r o p{ancho} (X necesita tabularx)'],
  [/LaTeX Error: \\caption outside float/, '\\caption solo funciona dentro de un entorno figure o table'],
  [/LaTeX Error: Bad math environment delimiter/, 'Una ecuación no está bien cerrada (¿hay una línea en blanco dentro?)'],
  [/Giving up on this path\. Did you forget a semicolon/, 'Falta «;» al final de un \\draw (o \\node, \\path, \\fill…)'],
  [/You've asked me to divide `.*' by `0/, 'División entre cero en una expresión: revisa el dominio de la gráfica'],
  [/^Arithmetic overflow/, 'Desbordamiento: algún número es demasiado grande'],
  [/^Dimension too large/, 'Un valor es demasiado grande para dibujarlo (TikZ no pasa de ~5,7 m): reduce el dominio o usa pgfplots, que ajusta la escala'],
  [/No shape named `(.+)' is known/, 'No existe un nodo llamado «$1»: revisa el nombre (se define con node (nombre) {…})'],
  [/PGF Math Error: Unknown function `(.+?)'/, '«$1» no es una función conocida: si es parte de un nodo (p. ej. oa.salida), revisa el nombre del ancla (out, north, …)'],
  [/I do not know the key '(?:\/[^/']+)*\/([^']+)'/, 'Opción desconocida «$1»: revisa cómo está escrita'],
  [/Package babel Error: Unknown option '(.+?)'/, 'Babel no reconoce el idioma «$1»: revisa cómo está escrito (p. ej. spanish, english)'],
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

function escapeRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** Todas las líneas (archivo principal primero) que cumplen la expresión, sin contar comentarios. */
function findLines(re, sources, main) {
  const hits = [];
  if (!sources) return hits;
  const order = [main, ...Object.keys(sources).filter((k) => k !== main)];
  for (const file of order) {
    const text = sources[file];
    if (!text) continue;
    text.split('\n').forEach((l, i) => { if (re.test(l.replace(/(^|[^\\])%.*$/, '$1'))) hits.push({ file, line: i + 1, text: l }); });
  }
  return hits;
}

function closest(word, list, max = 2) {
  let best = null, bestD = max + 1;
  for (const w of list) {
    const d = editDistance(word.toLowerCase(), w.toLowerCase());
    if (d > 0 && d < bestD) { best = w; bestD = d; }
  }
  return best;
}

const CMD_PKG = {
  printindex: 'makeidx', makeindex: 'makeidx', multirow: 'multirow', cref: 'cleveref', Cref: 'cleveref', lstinline: 'listings', lstinputlisting: 'listings',
  mathbb: 'amssymb', mathfrak: 'amssymb', varnothing: 'amssymb', therefore: 'amssymb', because: 'amssymb', leqslant: 'amssymb', geqslant: 'amssymb',
  text: 'amsmath', eqref: 'amsmath', dfrac: 'amsmath', tfrac: 'amsmath', binom: 'amsmath', operatorname: 'amsmath', DeclareMathOperator: 'amsmath', intertext: 'amsmath',
  includegraphics: 'graphicx', rotatebox: 'graphicx', scalebox: 'graphicx', resizebox: 'graphicx',
  SI: 'siunitx', si: 'siunitx', qty: 'siunitx', unit: 'siunitx', num: 'siunitx', ang: 'siunitx',
  textcolor: 'xcolor', color: 'xcolor', colorbox: 'xcolor', definecolor: 'xcolor',
  url: 'url', href: 'hyperref', toprule: 'booktabs', midrule: 'booktabs', bottomrule: 'booktabs', cmidrule: 'booktabs',
  multirow: 'multirow', lipsum: 'lipsum', degree: 'gensymb', celsius: 'gensymb', ce: 'mhchem', cancel: 'cancel',
  tikz: 'tikz', usetikzlibrary: 'tikz', pgfplotsset: 'pgfplots', lstinputlisting: 'listings', lstset: 'listings',
  subcaption: 'subcaption', captionof: 'caption', cref: 'cleveref', Cref: 'cleveref', citep: 'natbib', citet: 'natbib',
  euro: 'eurosym', checkmark: 'amssymb', bm: 'bm', boldsymbol: 'amsmath', phase: 'steinmetz', ohm: 'siunitx', textdegree: 'textcomp',
  pagestyle: null, fancyhead: 'fancyhdr', fancyfoot: 'fancyhdr', onehalfspacing: 'setspace', doublespacing: 'setspace', newgeometry: 'geometry',
};
const KNOWN_CMDS = ['textbf', 'textit', 'texttt', 'textsc', 'emph', 'underline', 'section', 'subsection', 'subsubsection', 'chapter', 'paragraph',
  'frac', 'sqrt', 'sum', 'prod', 'int', 'iint', 'oint', 'lim', 'infty', 'partial', 'nabla', 'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx', 'equiv',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'theta', 'lambda', 'omega', 'Omega', 'sigma', 'Sigma', 'Delta', 'Gamma', 'Phi', 'phi', 'varphi', 'rho', 'tau', 'mu', 'pi',
  'sin', 'cos', 'tan', 'log', 'ln', 'exp', 'left', 'right', 'begin', 'end', 'label', 'ref', 'cite', 'caption', 'centering', 'item', 'hline', 'vspace', 'hspace',
  'newline', 'newpage', 'clearpage', 'noindent', 'footnote', 'tableofcontents', 'maketitle', 'title', 'author', 'date', 'today', 'documentclass', 'usepackage',
  'input', 'include', 'bibliography', 'bibliographystyle', 'overline', 'hat', 'vec', 'dot', 'ddot', 'bar', 'tilde', 'mathrm', 'mathbf', 'mathcal', 'quad', 'qquad',
  'ldots', 'cdots', 'vdots', 'ddots', 'rightarrow', 'leftarrow', 'Rightarrow', 'Leftrightarrow', 'to', 'mapsto', 'in', 'subset', 'cup', 'cap', 'forall', 'exists',
  'small', 'large', 'Large', 'huge', 'tiny', 'normalsize', 'footnotesize', 'newcommand', 'renewcommand', 'draw', 'node', 'fill', 'path', 'addplot',
  ...Object.keys(CMD_PKG)];
const ENV_PKG = { align: 'amsmath', 'align*': 'amsmath', gather: 'amsmath', 'gather*': 'amsmath', multline: 'amsmath', split: 'amsmath', cases: 'amsmath',
  pmatrix: 'amsmath', bmatrix: 'amsmath', vmatrix: 'amsmath', matrix: 'amsmath', tikzpicture: 'tikz', circuitikz: 'circuitikz', axis: 'pgfplots',
  semilogxaxis: 'pgfplots', loglogaxis: 'pgfplots', lstlisting: 'listings', tcolorbox: 'tcolorbox', multicols: 'multicol', subfigure: 'subcaption',
  longtable: 'longtable', tabularx: 'tabularx', wrapfigure: 'wrapfig', karnaugh: 'karnaugh-map', 'karnaugh-map': 'karnaugh-map', minted: 'minted', proof: 'amsthm' };
const KNOWN_ENVS = ['document', 'figure', 'table', 'tabular', 'itemize', 'enumerate', 'description', 'equation', 'equation*', 'center', 'flushleft', 'flushright',
  'minipage', 'verbatim', 'quote', 'abstract', 'array', 'eqnarray', 'thebibliography', 'titlepage', 'frame', 'block', 'columns', 'column', ...Object.keys(ENV_PKG)];
const KNOWN_KEYS = ['xlabel', 'ylabel', 'zlabel', 'title', 'xmin', 'xmax', 'ymin', 'ymax', 'zmin', 'zmax', 'domain', 'samples', 'grid', 'legend', 'width', 'height',
  'xmode', 'ymode', 'xtick', 'ytick', 'axis lines', 'legend pos', 'mark', 'only marks', 'no marks', 'thick', 'thin', 'dashed', 'dotted', 'color', 'fill', 'draw',
  'line width', 'scale', 'rotate', 'shift', 'above', 'below', 'left', 'right', 'anchor', 'node', 'smooth', 'colormap', 'colorbar', 'view', 'shader',
  'resistor', 'capacitor', 'inductor', 'battery', 'battery1', 'diode', 'led', 'short', 'open', 'ground', 'voltmeter', 'ammeter', 'lamp', 'switch', 'fuse',
  'R', 'C', 'L', 'V', 'I', 'D', 'sV', 'vR', 'cV', 'cI', 'american', 'european', 'cute inductor', 'generic', 'potentiometer', 'thermistor', 'photodiode'];
const PGF_FUNCS = ['sin', 'cos', 'tan', 'exp', 'ln', 'log10', 'log2', 'sqrt', 'abs', 'deg', 'rad', 'atan', 'atan2', 'asin', 'acos', 'pow', 'mod', 'min', 'max',
  'floor', 'ceil', 'round', 'pi', 'e', 'rand', 'sinh', 'cosh', 'tanh', 'sec', 'cot', 'cosec'];

/** Explicaciones más precisas usando el código fuente y la línea «l.N …» del log. */
const SI_UNITS = ['kilo', 'mega', 'giga', 'tera', 'milli', 'micro', 'nano', 'pico', 'femto', 'centi', 'deci', 'ohm', 'volt', 'ampere', 'watt',
  'farad', 'henry', 'hertz', 'second', 'metre', 'meter', 'gram', 'kilogram', 'newton', 'joule', 'coulomb', 'tesla', 'weber', 'siemens', 'kelvin',
  'degreeCelsius', 'degree', 'percent', 'radian', 'decibel', 'per', 'square', 'cubic', 'squared', 'cubed', 'tothe', 'minute', 'hour', 'litre', 'liter',
  'pascal', 'bar', 'electronvolt', 'lumen', 'lux', 'candela', 'mole', 'becquerel', 'gray', 'sievert', 'katal', 'steradian', 'byte', 'bit'];

// Fuentes de Windows/Mac que no vienen en Android/Linux, y su equivalente libre incluido en TeX Live.
const FONT_ALTERNATIVES = {
  // Solo TeX Gyre: viene en la instalación recomendada de TeX Live (los nombres son de archivo,
  // así funcionan también en XeLaTeX aunque el sistema no conozca las fuentes de TeX Live).
  arial: 'texgyreheros', helvetica: 'texgyreheros', verdana: 'texgyreheros', tahoma: 'texgyreheros', 'segoe ui': 'texgyreheros', calibri: 'texgyreheros',
  'times new roman': 'texgyretermes', times: 'texgyretermes', cambria: 'texgyretermes',
  georgia: 'texgyrepagella', 'book antiqua': 'texgyrepagella', palatino: 'texgyrepagella', garamond: 'texgyrepagella',
  consolas: 'texgyrecursor', 'courier new': 'texgyrecursor', courier: 'texgyrecursor', 'lucida console': 'texgyrecursor',
  'century gothic': 'texgyreadventor',
};

// Fuentes que vienen con TeX Live. En Termux, XeLaTeX (con un servidor viejo) no las
// encuentra por su nombre; por archivo siempre funcionan.
const FOUR = (base) => `${base}}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-italic, BoldItalicFont=*-bolditalic]`;
const TL_FONTS = {
  'latin modern roman': FOUR('lmroman10'),
  'latin modern sans': 'lmsans10}[Extension=.otf, UprightFont=*-regular, BoldFont=*-bold, ItalicFont=*-oblique, BoldItalicFont=*-boldoblique]',
  'latin modern mono': 'lmmono10}[Extension=.otf, UprightFont=*-regular, ItalicFont=*-italic]',
  'latin modern math': 'latinmodern-math.otf}',
  'tex gyre termes': FOUR('texgyretermes'), 'tex gyre pagella': FOUR('texgyrepagella'), 'tex gyre heros': FOUR('texgyreheros'),
  'tex gyre cursor': FOUR('texgyrecursor'), 'tex gyre bonum': FOUR('texgyrebonum'), 'tex gyre schola': FOUR('texgyreschola'), 'tex gyre adventor': FOUR('texgyreadventor'),
  'tex gyre termes math': 'texgyretermes-math.otf}', 'tex gyre pagella math': 'texgyrepagella-math.otf}', 'tex gyre bonum math': 'texgyrebonum-math.otf}',
  'tex gyre schola math': 'texgyreschola-math.otf}', 'tex gyre dejavu math': 'texgyredejavu-math.otf}',
  'libertinus serif': 'LibertinusSerif}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]',
  'libertinus sans': 'LibertinusSans}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic]',
  'libertinus mono': 'LibertinusMono-Regular.otf}', 'libertinus math': 'LibertinusMath-Regular.otf}',
  'stix two math': 'STIXTwoMath-Regular.otf}', 'stix two text': 'STIXTwoText}[Extension=.otf, UprightFont=*-Regular, BoldFont=*-Bold, ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic]',
};

/** Entorno de alineación abierto más interno en esa línea (cases, tabular, align…). */
function innermostEnv(text, line) {
  if (!text) return null;
  const stack = [];
  for (const l of text.split('\n').slice(0, line)) {
    for (const m of l.replace(/(^|[^\\])%.*$/, '$1').matchAll(/\\(begin|end)\{([a-zA-Z]+)\*?\}/g)) {
      if (m[1] === 'begin') stack.push(m[2]);
      else { const i = stack.lastIndexOf(m[2]); if (i >= 0) stack.splice(i); }
    }
  }
  const ALIGN = /^(cases|dcases|matrix|pmatrix|bmatrix|vmatrix|Vmatrix|array|tabular|tabularx|longtable|align|alignat|flalign|eqnarray|split|aligned|gathered)$/;
  for (let i = stack.length - 1; i >= 0; i--) if (ALIGN.test(stack[i])) return stack[i];
  return null;
}

function findInSources(re, sources, main, beforeLine = Infinity) {
  if (!sources) return null;
  const text = sources[main];
  if (!text) return null;
  const lines = text.split('\n');
  let hit = null;
  lines.forEach((l, i) => { if (i + 1 <= beforeLine && re.test(l.replace(/(^|[^\\])%.*$/, '$1'))) hit = i + 1; });
  return hit;
}

// Caracteres que pdfLaTeX no conoce (suelen venir al pegar desde Word, PDF o la web).
const INVISIBLE = {
  0x200B: 'un espacio invisible', 0x200C: 'un separador invisible', 0x200D: 'un unidor invisible', 0x2060: 'un carácter invisible',
  0xFEFF: 'una marca invisible (BOM)', 0x00AD: 'un guion invisible', 0x2028: 'un salto de línea especial', 0x2029: 'un salto de párrafo especial',
  0x202F: 'un espacio angosto especial', 0x200E: 'una marca de dirección invisible', 0x200F: 'una marca de dirección invisible',
};
const UNI_REPL = { // [en texto, en fórmula]
  0x2212: ['$-$', '-'], 0x2264: ['$\\leq$', '\\leq'], 0x2265: ['$\\geq$', '\\geq'], 0x2260: ['$\\neq$', '\\neq'], 0x2248: ['$\\approx$', '\\approx'],
  0x00D7: ['$\\times$', '\\times'], 0x00F7: ['$\\div$', '\\div'], 0x2192: ['$\\to$', '\\to'], 0x2190: ['$\\leftarrow$', '\\leftarrow'],
  0x21D2: ['$\\Rightarrow$', '\\Rightarrow'], 0x2194: ['$\\leftrightarrow$', '\\leftrightarrow'], 0x221E: ['$\\infty$', '\\infty'],
  0x00B1: ['$\\pm$', '\\pm'], 0x221A: ['$\\sqrt{}$', '\\sqrt{}'], 0x2211: ['$\\sum$', '\\sum'], 0x222B: ['$\\int$', '\\int'],
  0x2202: ['$\\partial$', '\\partial'], 0x0394: ['$\\Delta$', '\\Delta'], 0x03A9: ['$\\Omega$', '\\Omega'], 0x03C9: ['$\\omega$', '\\omega'],
  0x03C0: ['$\\pi$', '\\pi'], 0x03B1: ['$\\alpha$', '\\alpha'], 0x03B2: ['$\\beta$', '\\beta'], 0x03B8: ['$\\theta$', '\\theta'],
  0x03BB: ['$\\lambda$', '\\lambda'], 0x03C3: ['$\\sigma$', '\\sigma'], 0x03C6: ['$\\phi$', '\\phi'], 0x00B5: ['\\textmu{}', '\\mu'],
  0x2026: ['\\dots{}', '\\dots'], 0x2009: ['\\,', '\\,'], 0x2022: ['\\textbullet{}', '\\bullet'], 0x2122: ['\\texttrademark{}', '\\text{\\texttrademark}'],
  0xFB00: ['ff', 'ff'], 0xFB01: ['fi', 'fi'], 0xFB02: ['fl', 'fl'], 0xFB03: ['ffi', 'ffi'], 0xFB04: ['ffl', 'ffl'],
};

// Equivalentes en ASCII para caracteres dentro de código (listings no lee UTF-8).
const ASCII_REPL = { 'Ω': 'ohm', 'µ': 'u', 'μ': 'u', '°': ' grados', '≤': '<=', '≥': '>=', '≠': '!=', '→': '->', '×': '*', '÷': '/', '±': '+/-', '·': '*',
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'ü': 'u', '¿': '', '¡': '',
  '“': '"', '”': '"', '‘': "'", '’': "'", '–': '-', '—': '-', '…': '...', 'π': 'pi', 'Δ': 'Delta', 'α': 'alpha', 'β': 'beta', 'θ': 'theta', 'λ': 'lambda', 'ω': 'omega' };

// Comandos que dependen de la clase del documento.
const noComments = (t) => (t || '').replace(/(^|[^\\])%.*$/gm, '$1');
const CLASS_CMDS = {
  chapter: { classes: ['report', 'book', 'memoir', 'scrbook', 'scrreprt'], text: 'los capítulos son de report o book (cambia \\documentclass{article} por \\documentclass{report}) o usa \\section' },
  frontmatter: { classes: ['book', 'memoir', 'scrbook'], text: 'es de la clase book; en article/report bórralo' },
  mainmatter: { classes: ['book', 'memoir', 'scrbook'], text: 'es de la clase book; en article/report bórralo' },
  backmatter: { classes: ['book', 'memoir', 'scrbook'], text: 'es de la clase book; en article/report bórralo' },
  frametitle: { classes: ['beamer'], text: 'es de beamer (presentaciones): \\documentclass{beamer}' },
};
const LST_LANGS = ['Python', 'C', 'C++', 'Java', 'Matlab', 'Octave', 'VHDL', 'Verilog', 'HTML', 'XML', 'SQL', 'bash', 'R', 'Fortran', 'Pascal', 'Assembler', 'TeX', 'Perl', 'PHP', 'Ruby', 'Lisp', 'Haskell', 'Mathematica', 'make', 'command.com'];

const BEAMER_THEMES = {
  '': ['default', 'AnnArbor', 'Antibes', 'Bergen', 'Berkeley', 'Berlin', 'Boadilla', 'boxes', 'CambridgeUS', 'Copenhagen', 'Darmstadt', 'Dresden', 'EastLansing', 'Frankfurt', 'Goettingen', 'Hannover', 'Ilmenau', 'JuanLesPins', 'Luebeck', 'Madrid', 'Malmoe', 'Marburg', 'Montpellier', 'PaloAlto', 'Pittsburgh', 'Rochester', 'Singapore', 'Szeged', 'Warsaw', 'metropolis'],
  color: ['default', 'albatross', 'beaver', 'beetle', 'crane', 'dolphin', 'dove', 'fly', 'lily', 'monarca', 'orchid', 'rose', 'seagull', 'seahorse', 'sidebartab', 'spruce', 'structure', 'whale', 'wolverine'],
  font: ['default', 'professionalfonts', 'serif', 'structurebold', 'structureitalicserif', 'structuresmallcapsserif'],
  inner: ['default', 'circles', 'inmargin', 'rectangles', 'rounded'],
  outer: ['default', 'infolines', 'miniframes', 'shadow', 'sidebar', 'smoothbars', 'smoothtree', 'split', 'tree'],
};

/** La parte de una línea antes de un comentario % (sin contar \%). */
function codePart(l) {
  for (let c = 0; c < l.length; c++) {
    if (l[c] === '\\') { c++; continue; }
    if (l[c] === '%') return l.slice(0, c);
  }
  return l;
}
/** Primera línea (índice) del párrafo que termina en `idx`: sube hasta una línea en blanco. */
function paragraphStart(ls, idx) {
  let k = idx;
  while (k > 0 && ls[k - 1].trim() !== '') k--;
  return k;
}
/** Llaves { que quedan abiertas al leer las líneas from..to como TeX (\x escapa, % comenta). */
function unclosedBraces(ls, from, to) {
  const stack = [];
  for (let k = from; k <= to && k < ls.length; k++) {
    const l = ls[k];
    for (let c = 0; c < l.length; c++) {
      const ch = l[c];
      if (ch === '\\') { c++; continue; }
      if (ch === '%') break;
      if (ch === '{') stack.push({ line: k, col: c });
      else if (ch === '}') stack.pop();
    }
  }
  return stack;
}
/** El $ (o $$) que abre una fórmula y no se cierra en las líneas from..to, o null. */
function unclosedDollar(ls, from, to) {
  let open = null;
  for (let k = from; k <= to && k < ls.length; k++) {
    const l = ls[k];
    for (let c = 0; c < l.length; c++) {
      const ch = l[c];
      if (ch === '\\') { c++; continue; }
      if (ch === '%') break;
      if (ch === '$') {
        const dbl = l[c + 1] === '$';
        if (dbl) c++;
        open = open ? null : { line: k, col: c, dbl };
      }
    }
  }
  return open;
}

function enrich(entry, head, sources, main, top = '') {
  const msg = entry.message;
  const font = msg.match(/The font "([^"]+)" cannot be found/);
  if (font) {
    const alt = FONT_ALTERNATIVES[font[1].toLowerCase()];
    // fontspec avisa una línea después: se busca la línea que de verdad nombra esa fuente.
    let cmd = 'setmainfont';
    const fre = new RegExp('\\\\(set(?:main|sans|mono|math)font|newfontfamily\\\\\\w+)\\s*(\\[[^\\]]*\\])?\\s*\\{\\s*' + font[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\}');
    // Si la misma fuente aparece en varias líneas (\setmainfont y \setsansfont), se elige la
    // última que está antes de la línea que informó TeX.
    const reported = entry.line || Infinity;
    let best = null;
    for (const [file, text] of Object.entries(sources || {})) {
      const ls = text.split('\n');
      ls.forEach((l, i) => {
        if (!fre.test(l.replace(/(^|[^\\])%.*$/, '$1'))) return;
        const sameFile = file === entry.file;
        // TeX informa una línea después (mira si sigue un [...]): primero las de antes, luego la misma.
        const score = sameFile ? (i + 1 < reported ? 4 : i + 1 === reported ? 3 : 2) : 1;
        if (!best || score > best.score || (score === best.score && score === 4 && i > best.i) || (score === best.score && score < 3 && i < best.i)) best = { file, i, score, l };
      });
    }
    if (best) { entry.file = best.file; entry.line = best.i + 1; entry.context = best.l.trim(); cmd = best.l.match(fre)[1]; }
    const name = font[1];
    const tl = TL_FONTS[name.toLowerCase()];
    const isMath = cmd === 'setmathfont';
    // Arreglo con un toque: reemplazar el nombre por el archivo de la fuente.
    const spec = tl || (alt ? FOUR(alt) : null);
    if (spec && entry.context) {
      const m = entry.context.match(fre);
      if (m) {
        const find = m[0];
        const newCmd = find.replace(/\{[^}]*\}$/, '{' + spec);
        entry.fix = { file: entry.file, line: entry.line, find, replace: newCmd, label: tl ? 'Usar el archivo de la fuente' : `Cambiar por ${alt}` };
      }
    }
    if (tl) {
      const isLM = /^latin modern (roman|math)$/i.test(name);
      entry.hint = `«${name}» viene con TeX Live, pero XeLaTeX no la encontró por su nombre en este equipo (se arregla actualizando el servidor de Termux). ` +
        `Mientras tanto, escríbela por archivo: \\${cmd}{${spec}` + (isLM ? ` — o borra la línea: ${isMath ? 'Latin Modern Math' : 'Latin Modern'} ya es la fuente por defecto` : '');
    } else if (alt) {
      entry.hint = `La fuente «${name}» no está instalada (es de Windows/Mac). Una parecida que viene con TeX Live: \\${cmd}{${FOUR(alt)} — o borra la línea para usar Latin Modern`;
    } else {
      entry.hint = `La fuente «${name}» no está instalada. Usa una de TeX Live, p. ej. \\${cmd}{${isMath ? 'latinmodern-math.otf}' : FOUR('texgyretermes')} — o borra la línea para usar Latin Modern`;
    }
    return;
  }
  if (/Unknown float option `H'/.test(msg)) { entry.needPkg = 'float'; return; }
  if (/macro parameter character #/.test(msg) && sources && entry.line) {
    const l = (sources[entry.file || main] || '').split('\n')[entry.line - 1] || '';
    const m = l.match(/(^|[^\\])#/);
    if (m) { const find = m[0]; entry.fix = { file: entry.file || main, line: entry.line, find, replace: m[1] + '\\#', label: 'Escribir \\#' }; }
    return;
  }
  if (/Misplaced \\noalign/.test(msg) && sources && entry.line) {
    // Falta \\ al final de la fila anterior (la última línea no vacía antes del \hline).
    const ls = (sources[entry.file || main] || '').split('\n');
    for (let k = entry.line - 2; k >= 0 && k >= entry.line - 6; k--) {
      const t = ls[k].replace(/(^|[^\\])%.*$/, '$1').trimEnd();
      if (!t.trim()) continue;
      if (/&/.test(t) && !/\\\\\s*(\\hline|\\midrule|\\toprule|\\bottomrule)?\s*$/.test(t)) {
        entry.hint = `Falta \\\\ al final de la fila de la línea ${k + 1}: por eso el \\hline de abajo quedó «en medio» de esa fila`;
        entry.fix = { file: entry.file || main, line: k + 1, find: t.trim(), replace: t.trim() + ' \\\\', label: `Agregar \\\\ en la línea ${k + 1}` };
      }
      break;
    }
    return;
  }
  if (/Invalid UTF-8 byte/.test(msg) && sources && entry.line) {
    const l = (sources[entry.file || main] || '').split('\n')[entry.line - 1] || '';
    const ch = [...l].find((c) => c.codePointAt(0) > 127);
    if (ch) {
      const rep = ASCII_REPL[ch] != null ? ASCII_REPL[ch] : '';
      entry.hint = `«${ch}» no lo puede leer listings dentro del código: cámbialo por ${rep ? `«${rep}»` : 'texto simple'} (para que se vea, usa la opción literate de \\lstset)`;
      entry.fix = { file: entry.file || main, line: entry.line, find: ch, replace: rep, label: rep ? `Cambiar «${ch}» por «${rep}»` : `Quitar «${ch}»` };
    }
    return;
  }
  if (/Giving up on this path/.test(msg) && sources && entry.line) {
    // LaTeX de nov. 2026 cambió \underline (ahora arma cajas con \hrule) y, dentro del texto de
    // un \node de TikZ, a veces rompe la lectura del camino aunque el «;» sí esté. Con llaves
    // extra alrededor queda aislado y funciona igual que antes (Overleaf aún usa la versión vieja).
    const l = (sources[entry.file || main] || '').split('\n')[entry.line - 1] || '';
    const i = l.indexOf('\\underline{');
    if (i >= 0 && l.slice(i - 2, i) !== '{{' && /;\s*(%.*)?$/.test(codePart(l) || l)) {
      let d = 0, j = i + 10;
      for (; j < l.length; j++) { if (l[j] === '{') d++; else if (l[j] === '}' && --d === 0) break; }
      if (d === 0 && j < l.length) {
        const u = l.slice(i, j + 1);
        entry.hint = `El «;» sí está: es ${u} dentro del nodo. LaTeX (versión de nov. 2026) cambió \\underline y TikZ se confunde; ponlo entre llaves extra: {${u}}`;
        entry.fix = { file: entry.file || main, line: entry.line, find: u, replace: '{' + u + '}', label: 'Poner \\underline entre llaves' };
      }
    }
  }
  if (/language@active@arg/.test(msg) && sources) {
    // babel en español y TikZ: se ofrece agregar \usetikzlibrary{babel} debajo de \usepackage{tikz/circuitikz/pgfplots}.
    const f = main;
    const ls = (sources[f] || '').split('\n');
    if (!/\\usetikzlibrary\s*\{[^}]*\bbabel\b/.test(noComments(sources[f]))) {
      let k = -1;
      ls.forEach((l, i) => { if (/^\s*\\usepackage\s*(\[[^\]]*\])?\s*\{[^}]*\b(tikz|circuitikz|pgfplots)\b/.test(l)) k = i; });
      if (k >= 0) entry.fix = { file: f, line: k + 1, find: ls[k].trim(), replace: ls[k].trim() + '\n\\usetikzlibrary{babel}', label: 'Agregar \\usetikzlibrary{babel}' };
    }
    return;
  }
  if (/Quote style not defined/.test(msg) && sources) {
    const f = Object.keys(sources).find((k) => /\\usepackage\s*\[[^\]]*\]\s*\{csquotes\}/.test(sources[k]));
    if (f) {
      const ls = sources[f].split('\n');
      const k = ls.findIndex((l) => /\\usepackage\s*\[[^\]]*\]\s*\{csquotes\}/.test(l));
      entry.file = f; entry.line = k + 1; entry.context = ls[k].trim();
      const m = ls[k].match(/\\usepackage\s*\[[^\]]*\]\s*\{csquotes\}/);
      entry.fix = { file: f, line: k + 1, find: m[0], replace: '\\usepackage[autostyle]{csquotes}', label: 'Usar [autostyle]' };
    }
    return;
  }
  if (/Couldn't load requested language/.test(msg) && sources && entry.line) {
    const l = (sources[entry.file || main] || '').split('\n')[entry.line - 1] || '';
    const lang = (l.match(/language\s*=\s*\{?\s*(?:\[[^\]]*\])?\s*([\w+#.-]+)/i) || [])[1];
    if (lang) {
      const sug = closest(lang, LST_LANGS);
      entry.context = l.trim();
      entry.hint = `listings no conoce el lenguaje «${lang}»` + (sug && sug.toLowerCase() !== lang.toLowerCase() ? `. ¿Quisiste decir ${sug}?` : ': revisa cómo está escrito');
      if (sug && sug.toLowerCase() !== lang.toLowerCase()) entry.fix = { file: entry.file || main, line: entry.line, find: 'language=' + lang, replace: 'language=' + sug, label: `Cambiar por ${sug}` };
    }
    return;
  }
  const col = msg.match(/could not retrieve column '([^']*)' from table '([^']*)'/);
  if (col && sources) {
    // Se leen los nombres de columna de la primera línea del archivo de datos (del proyecto o de un filecontents).
    let header = null;
    let fname = col[2];
    if (/\\/.test(fname) && entry.line) {
      // pgfplots a veces da un nombre interno: se toma el archivo de la línea del \addplot table.
      const l = (sources[entry.file || main] || '').split('\n')[entry.line - 1] || '';
      const m = l.match(/table\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/);
      if (m) fname = m[1].trim();
    }
    if (sources[fname]) header = sources[fname].split('\n').find((l) => l.trim() && !/^[#%]/.test(l.trim()));
    if (!header) for (const t of Object.values(sources)) {
      const m = t.match(new RegExp('\\\\begin\\{filecontents\\*?\\}(?:\\[[^\\]]*\\])?\\{' + escapeRe(fname) + '\\}\\s*\\n([^\\n]*)'));
      if (m) { header = m[1]; break; }
    }
    if (header) {
      const cols = header.trim().split(/[\s,;]+/).filter(Boolean);
      const sug = closest(col[1], cols);
      entry.hint = `La tabla «${fname}» no tiene una columna «${col[1]}». Sus columnas son: ${cols.join(', ')}` + (sug ? `. ¿Quisiste decir «${sug}»?` : '');
    } else {
      entry.hint = `La tabla de datos «${fname}» no tiene una columna llamada «${col[1]}»: revisa la primera línea del archivo (los nombres de columna)`;
      const l = sources[entry.file || main] && (sources[entry.file || main].split('\n')[(entry.line || 1) - 1] || '');
      if (sug && l && l.includes('=' + col[1])) entry.fix = { file: entry.file || main, line: entry.line, find: '=' + col[1], replace: '=' + sug, label: `Usar la columna «${sug}»` };
    }
    return;
  }
  const userFile = msg.match(/File `([^']+\.tex)' not found/);
  if (userFile && sources && !(userFile[1] in sources)) {
    const sug = closest(userFile[1], Object.keys(sources));
    entry.hint = `El archivo «${userFile[1]}» no está en el proyecto` + (sug ? `. ¿Quisiste decir «${sug}»?` : ': créalo en Archivos (+) o corrige la ruta del \\input/\\include');
    return;
  }
  const uni = msg.match(/Unicode character (.+?) \(U\+([0-9A-Fa-f]+)\)/);
  if (uni) {
    const cp = parseInt(uni[2], 16);
    const ch = String.fromCodePoint(cp);
    const hex = 'U+' + uni[2].toUpperCase();
    const ls = sources && sources[entry.file || main] ? sources[entry.file || main].split('\n') : null;
    let line = entry.line && ls && ls[entry.line - 1] != null && ls[entry.line - 1].includes(ch) ? entry.line : null;
    if (!line && ls) { const k = ls.findIndex((l) => l.includes(ch)); if (k >= 0) line = k + 1; }
    const text = line ? ls[line - 1] : '';
    if (line) { entry.file = entry.file || main; entry.line = line; entry.context = text.trim().replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, '⟦?⟧'); }
    const pos = text.indexOf(ch);
    const inMath = pos >= 0 && ((text.slice(0, pos).match(/(^|[^\\])\$/g) || []).length % 2 === 1 || /\\\(|\\\[/.test(text.slice(0, pos)));
    const fix = (replace, label) => { if (line && text.includes(ch)) entry.fix = { file: entry.file, line, find: ch, replace, label }; };
    if (INVISIBLE[cp]) {
      entry.hint = `En esta línea hay ${INVISIBLE[cp]} (${hex}) que no se ve en el editor: suele venir al copiar desde Word, un PDF o una página web. Bórralo` + (entry.context ? ' (está marcado como ⟦?⟧ abajo)' : '');
      fix('', 'Quitar el carácter invisible');
    } else if (UNI_REPL[cp]) {
      const [txt, mth] = UNI_REPL[cp];
      const rep = inMath ? mth : txt;
      entry.hint = `pdfLaTeX no conoce «${ch}» (${hex}): escríbelo como ${rep}` + (cp >= 0xFB00 ? ' (es una ligadura que viene al copiar de un PDF)' : '') + ' — o compila con XeLaTeX';
      fix(rep, `Cambiar «${ch}» por ${rep}`);
    } else if (cp >= 0x1F000 || (cp >= 0x2600 && cp <= 0x27BF)) {
      entry.hint = `Los emojis («${ch}») no existen en pdfLaTeX: bórralo (o compila con LuaLaTeX y una fuente con emojis)`;
      fix('', 'Quitar el emoji');
    } else {
      entry.hint = `pdfLaTeX no conoce el carácter «${ch}» (${hex}): bórralo, cámbialo por un comando de LaTeX o compila con XeLaTeX (⋮ → Motor)`;
    }
    return;
  }
  const runaway = msg.match(/^(?:Paragraph ended before|File ended while scanning use of) \\?(\S+?)(?: was complete)?\s*\.?$/);
  if (runaway && sources && sources[entry.file || main]) {
    // Una llave sin cerrar: TeX lo nota recién al terminar el párrafo (una línea en blanco más abajo)
    // o el archivo. Se recorre el párrafo como lo lee TeX y se marca la PRIMERA llave que nunca se cerró
    // (no la última línea con más { que }: un \def repartido en dos líneas engañaba a esa regla).
    const f = entry.file || main;
    const ls = sources[f].split('\n');
    let end, start;
    if (/^File ended/.test(msg)) { start = 0; end = ls.length - 1; } else {
      end = Math.min((entry.line || ls.length) - 1, ls.length - 1);
      while (end > 0 && !ls[end].trim()) end--;
      start = paragraphStart(ls, end);
    }
    const open = unclosedBraces(ls, start, end);
    let k = open.length ? open[0].line : -1;
    if (k < 0) {
      // Respaldo: la línea más cercana con más { que }.
      const bal = (l) => { const t = codePart(l).replace(/\\[{}]/g, ''); return (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length; };
      for (let q = end; q >= 0 && q > end - 60; q--) if (bal(ls[q]) > 0) { k = q; break; }
    }
    if (k >= 0) {
      const raw = ls[k].replace(/\s+$/, '');
      // Lo que TeX leyó «dentro» del argumento sin cerrar depende de este error (ver más abajo).
      const defs = [];
      for (let q = k; q <= end; q++) for (const m of codePart(ls[q]).matchAll(/\\(?:def|gdef|edef|let|(?:re)?newcommand\*?\s*\{?|providecommand\*?\s*\{?|DeclareMathOperator\*?\s*\{?)\s*\\([A-Za-z@]+)/g)) defs.push(m[1]);
      entry.covers = { from: k + 1, to: /^File ended/.test(msg) ? Infinity : end + 1, defs };
      entry.file = f; entry.line = k + 1; entry.context = raw.trim();
      const isPkg = /^(\\usepackage|\\RequirePackage|\\documentclass)/.test(raw.trim()) || /fileswith@ptions|@onefilewithoptions/.test(runaway[1]);
      entry.hint = isPkg
        ? 'A esta línea le falta la llave de cierre }. Por eso los \\usepackage que siguen (hasta la próxima línea en blanco) no se cargaron: los errores de «falta el paquete…» de abajo son consecuencia de este'
        : /^File ended/.test(msg)
          ? 'Aquí se abre una llave { que nunca se cierra: TeX recién lo notó al llegar al final del archivo'
          : 'Aquí se abre una llave { que nunca se cierra: TeX recién lo notó al terminar el párrafo' + (end + 1 !== k + 1 ? ` (línea ${end + 1})` : '');
      const onLine = open.filter((o) => o.line === k).length;
      const code = codePart(ls[k]).replace(/\s+$/, '');
      if ((onLine === 1 || (!open.length)) && code.trim()) entry.fix = { file: f, line: k + 1, find: code.trim(), replace: code.trim() + '}', label: 'Agregar la } que falta al final de la línea' };
      if (isPkg) entry.swallow = true;
      return;
    }
  }
  const theme = msg.match(/File `beamer(color|font|inner|outer)?theme([^']+)\.sty' not found/);
  if (theme) {
    const kind = theme[1] || '';
    const list = BEAMER_THEMES[kind] || [];
    const sug = closest(theme[2], list);
    const cmd = `\\use${kind}theme`;
    const ln = findInSources(new RegExp(escapeRe(cmd) + '\\s*(\\[[^\\]]*\\])?\\s*\\{\\s*' + escapeRe(theme[2]) + '\\s*\\}'), sources, main);
    if (ln) { entry.file = main; entry.line = ln; entry.context = sources[main].split('\n')[ln - 1].trim(); }
    entry.hint = `El tema ${kind ? `de ${{ color: 'colores', font: 'letras', inner: 'interior', outer: 'exterior' }[kind]} ` : ''}de beamer «${theme[2]}» no existe` +
      (sug ? `. ¿Quisiste decir ${cmd}{${sug}}?` : `. Algunos que vienen con beamer: ${list.slice(0, 6).join(', ')}`);
    return;
  }
  if (/scanning use of \\beamer@collect@@body|scanning use of \\beamer@@frame/.test(msg)) {
    // Una diapositiva sin \end{frame}: se busca el \begin{frame} que no se cerró.
    const ls = sources && sources[main] ? sources[main].split('\n') : [];
    let open = null, found = null;
    for (let k = 0; k < ls.length && !found; k++) {
      const l = ls[k].replace(/(^|[^\\])%.*$/, '$1');
      if (/\\begin\s*\{frame\}/.test(l)) { if (open != null) found = open; else open = k; }
      if (/\\end\s*\{frame\}/.test(l)) open = null;
      if (/\\end\s*\{document\}/.test(l) && open != null) found = open;
    }
    if (found == null) found = open;
    if (found != null) { entry.file = main; entry.line = found + 1; entry.context = ls[found].trim(); }
    entry.hint = 'Esta diapositiva no se cerró: falta \\end{frame} antes de la siguiente (o antes de \\end{document})';
    return;
  }
  const clash = msg.match(/Option clash for package ([^\s.]+)/);
  if (clash && sources && entry.file && sources[entry.file]) {
    // LaTeX avisa en la línea siguiente: se apunta a la *segunda* carga del paquete.
    const ls = sources[entry.file].split('\n');
    const re = new RegExp('\\\\(usepackage|RequirePackage)\\s*(\\[[^\\]]*\\])?\\s*\\{[^}]*\\b' + escapeRe(clash[1]) + '\\b');
    const hits = ls.map((l, k) => (re.test(l.replace(/(^|[^\\])%.*$/, '$1')) ? k : -1)).filter((k) => k >= 0 && k < (entry.line || ls.length));
    if (hits.length) {
      const k = hits[hits.length - 1];
      entry.line = k + 1; entry.context = ls[k].trim();
      if (hits.length > 1) entry.hint += ` (la primera vez está en la línea ${hits[0] + 1})`;
    }
    return;
  }
  if (/Something's wrong--perhaps a missing \\item/.test(msg) && sources && entry.file && sources[entry.file] && entry.line) {
    // Si hay texto entre \begin{lista} y el primer \item, ese texto es el problema.
    const ls = sources[entry.file].split('\n');
    for (let k = entry.line - 1; k >= 0 && k > entry.line - 40; k--) {
      if (/\\begin\s*\{(itemize|enumerate|description)\}/.test(ls[k])) {
        for (let t = k + 1; t < entry.line; t++) {
          const clean = ls[t].replace(/(^|[^\\])%.*$/, '$1').trim();
          if (!clean) continue;
          if (/^\\item\b/.test(clean)) break;
          entry.line = t + 1; entry.context = clean;
          entry.hint = 'Este texto está dentro de la lista pero antes del primer \\item: ponle \\item delante o sácalo de la lista';
          break;
        }
        break;
      }
    }
    return;
  }
  if (/scanning use of \\@xverbatim|scanning use of \\lst@/.test(msg)) {
    const isBeamer = sources && sources[main] && /\\documentclass(\[[^\]]*\])?\{beamer\}/.test(sources[main]);
    // El bloque que empieza en (o justo antes de) la línea que mostró TeX; si no, el primero.
    const ls = sources && sources[entry.file || main] ? sources[entry.file || main].split('\n') : [];
    let ln = null;
    if (entry.line) for (let q = Math.min(entry.line, ls.length) - 1; q >= 0 && q >= entry.line - 40; q--) if (/\\begin\{(verbatim|lstlisting|minted)\}/.test(ls[q])) { ln = q + 1; break; }
    if (ln) entry.line = ln;
    else { ln = findInSources(/\\begin\{(verbatim|lstlisting|minted)\}/, sources, main); if (ln && entry.line == null) { entry.file = main; entry.line = ln; } }
    entry.hint = isBeamer
      ? 'En beamer, una diapositiva con código literal (verbatim, lstlisting) necesita la opción fragile: \\begin{frame}[fragile]{…}'
      : 'Un bloque de código literal no se cerró: revisa que \\end{verbatim} (o \\end{lstlisting}) esté solo en su línea y bien escrito';
    return;
  }
  if (/^Extra alignment tab has been changed/.test(msg) && sources && entry.line) {
    const env = innermostEnv(sources[entry.file], entry.line);
    if (env === 'cases' || env === 'dcases') entry.hint = 'cases admite solo 2 columnas (valor & condición): sobra un & en esta fila';
    else if (env && /matrix$/.test(env)) entry.hint = 'Esta fila de la matriz tiene más columnas (&) que el máximo (10 por defecto) o que las demás';
    else if (env && /^(array|tabular|tabularx|longtable)$/.test(env)) entry.hint = `Esta fila tiene más columnas (&) que las declaradas en \\begin{${env}}{…}`;
    return;
  }
  if (/^Misplaced alignment tab character &/.test(msg) && sources && entry.line) {
    const env = innermostEnv(sources[entry.file], entry.line);
    if (env) { entry.hint = `Hay un & de más o mal ubicado dentro de ${env}: revisa cuántas columnas tiene esta fila`; return; }
    entry.hint = 'Carácter & fuera de una tabla o alineación: en texto normal se escribe \\&';
    return;
  }
  const srcLines = sources && entry.file && sources[entry.file] ? sources[entry.file].split('\n') : null;
  if (/^Undefined control sequence/.test(msg)) {
    // TeX deja el comando no definido al final de la primera línea de contexto.
    const firstCtx = /^l\.\d+/.test(top) ? head : top.replace(/^<[^>]*>\s*/, '');
    const cm = (firstCtx || '').replace(/\s+$/, '').match(/\\([A-Za-z@]+)\*?$/);
    if (!cm) return;
    const cmd = cm[1];
    if (/\\(SI|si|qty|unit)\{/.test(head || '') && !/^(SI|si|qty|unit|num)$/.test(cmd)) {
      const sug = closest(cmd, SI_UNITS);
      entry.hint = sug ? `La unidad \\${cmd} no existe en siunitx. ¿Quisiste decir \\${sug}? (los múltiplos van por partes: \\kilo\\ohm, \\milli\\ampere)`
        : `La unidad \\${cmd} no existe en siunitx: se escribe por partes, p. ej. \\kilo\\ohm, \\milli\\ampere, \\micro\\farad`;
    } else if (/^(directlua|luaexec|luadirect|luaescapestring)$/.test(cmd)) {
      entry.hint = `\\${cmd} solo existe en LuaLaTeX: escribe «% !TEX program = lualatex» en la primera línea o cambia el motor en ⋮ → Motor`;
    } else if (/^XeTeX/.test(cmd)) {
      entry.hint = `\\${cmd} solo existe en XeLaTeX: escribe «% !TEX program = xelatex» en la primera línea o cambia el motor en ⋮ → Motor`;
    } else if (/^pdf[a-z]+$/.test(cmd) && !CMD_PKG[cmd]) {
      entry.hint = `\\${cmd} es propio de pdfLaTeX y no existe en XeLaTeX/LuaLaTeX: compila con pdfLaTeX (⋮ → Motor) o quítalo`;
    } else if (CLASS_CMDS[cmd] && sources && !new RegExp('\\\\documentclass(\\[[^\\]]*\\])?\\{(' + CLASS_CMDS[cmd].classes.join('|') + ')\\}').test(noComments(sources[main]))) {
      const cls = (noComments(sources[main]).match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/) || [])[1] || 'del documento';
      entry.hint = `\\${cmd} no existe en la clase ${cls}: ${CLASS_CMDS[cmd].text}`;
    } else if (CMD_PKG[cmd]) {
      entry.hint = `\\${cmd} necesita el paquete ${CMD_PKG[cmd]}: agrega \\usepackage{${CMD_PKG[cmd]}}`;
      entry.needPkg = CMD_PKG[cmd];
    } else {
      const sug = cmd.length > 2 ? closest(cmd, KNOWN_CMDS) : null;
      entry.hint = sug ? `El comando \\${cmd} no existe. ¿Quisiste decir \\${sug}?`
        : `El comando \\${cmd} no existe: revisa cómo está escrito o defínelo con \\newcommand`;
    }
    return;
  }
  const env = msg.match(/Environment (\S+) undefined/);
  if (env) {
    const name = env[1];
    if (ENV_PKG[name]) { entry.hint = `El entorno ${name} necesita el paquete ${ENV_PKG[name]}: agrega \\usepackage{${ENV_PKG[name]}}`; entry.needPkg = ENV_PKG[name]; }
    else { const sug = closest(name, KNOWN_ENVS); if (sug) entry.hint = `El entorno «${name}» no existe. ¿Quisiste decir «${sug}»?`; }
    return;
  }
  const key = msg.match(/I do not know the key '(?:\/[^/']+)*\/([^']+)'/);
  if (key) {
    const k = key[1];
    const sug = closest(k, KNOWN_KEYS);
    if (sug && k.length > 2) entry.hint = `Opción desconocida «${k}». ¿Quisiste decir «${sug}»?`;
    if (k.length > 1 && srcLines && entry.line) {
      const re = new RegExp('(^|[\\[,{\\s])' + escapeRe(k) + '\\s*([=,\\]}]|$)');
      for (let n = entry.line; n >= Math.max(1, entry.line - 40); n--) {
        if (re.test((srcLines[n - 1] || '').replace(/(^|[^\\])%.*$/, '$1'))) { if (n !== entry.line) { entry.line = n; entry.context = srcLines[n - 1].trim(); } break; }
      }
    }
    return;
  }
  if (/Did you forget a semicolon/.test(msg) && srcLines && entry.line) {
    for (let n = entry.line - 1; n >= 1; n--) {
      const t = (srcLines[n - 1] || '').replace(/(^|[^\\])%.*$/, '$1').trim();
      if (t) { entry.line = n; entry.context = t; break; }
    }
    return;
  }
  const fn = msg.match(/Unknown function `(.+?)'/);
  if (fn) {
    if (fn[1] === 'sen') entry.hint = 'En LaTeX el seno se escribe sin, no sen (igual que en inglés)';
    else { const sug = closest(fn[1], PGF_FUNCS, 1); if (sug) entry.hint = `«${fn[1]}» no es una función conocida. ¿Quisiste decir «${sug}»?`; }
    return;
  }
  const shape = msg.match(/No shape named `(.+)' is known/);
  if (shape && /^\s*-?[\d.]+\s+-?[\d.]+\s*$/.test(shape[1])) {
    entry.hint = `«(${shape[1]})» parece una coordenada sin coma: escríbela así (${shape[1].trim().split(/\s+/).join(',')})`;
    return;
  }
  if (/^Missing \$ inserted/.test(msg)) {
    if (srcLines && entry.line && !(srcLines[entry.line - 1] || '').trim()) {
      // TeX avisa en la línea en blanco; la causa suele ser un $ que se abrió más arriba y no se cerró.
      let end = entry.line - 2;
      while (end > 0 && !(srcLines[end] || '').trim()) end--;
      const d = end >= 0 ? unclosedDollar(srcLines, paragraphStart(srcLines, end), end) : null;
      if (d) {
        entry.covers = { from: d.line + 1, to: entry.line };
        entry.line = d.line + 1; entry.context = srcLines[d.line].trim();
        entry.hint = `Aquí se abre una fórmula con ${d.dbl ? '$$' : '$'} que nunca se cierra: agrega el ${d.dbl ? '$$' : '$'} de cierre donde termina la fórmula`;
      } else {
        entry.hint = 'Hay una línea en blanco dentro de una ecuación: bórrala (para varias ecuaciones usa align)';
        entry.context = '';
      }
    } else if (/_/.test(head || '') && !/\$|\\\(|\\\[/.test(head || '')) {
      entry.hint = 'Hay un _ en texto normal: fuera de las ecuaciones el guion bajo se escribe \\_';
      const l = srcLines && entry.line ? srcLines[entry.line - 1] || '' : '';
      const tok = (l.match(/[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+/) || [])[0];
      if (tok && !/\$/.test(l.slice(0, l.indexOf(tok)))) entry.fix = { file: entry.file, line: entry.line, find: tok, replace: tok.replace(/_/g, '\\_'), label: `Escribir ${tok.replace(/_/g, '\\_')}` };
    }
  }
}

const NOISE = [/==> Fatal error occurred/, /Writing or overwriting file/, /^\s*$/, /Package tikz Warning: Some images are not up-to-date/];

/** Busca en el código el fragmento que TeX muestra tras "Runaway argument?" para ubicar la línea. */
function locate(snippet, sources) {
  if (!snippet || !sources) return null;
  // TeX agrega espacios tras los comandos («\\usepackage {float}») y corta con \\ETC.: se compara sin espacios.
  const clean = snippet.replace(/\\par\b.*$/, '').replace(/\\ETC\..*$/, '').replace(/^\{/, '').replace(/\s+/g, '').slice(0, 30);
  if (clean.length < 4) return null;
  for (const [file, text] of Object.entries(sources)) {
    let flat = '';
    const pos = [];
    for (let i = 0; i < text.length; i++) if (!/\s/.test(text[i])) { flat += text[i]; pos.push(i); }
    const idx = flat.indexOf(clean);
    if (idx >= 0) return { file, line: text.slice(0, pos[idx]).split('\n').length };
  }
  return null;
}

// Los mensajes de LaTeX3 y de muchos paquetes siguen en líneas «(fontspec)   …» o «(LaTeX)  …»;
// en fontspec reciente la primera línea queda vacía («Package fontspec Error: »).
function joinContinuation(lines, i, msg) {
  let j = i + 1;
  while (j < lines.length && /^\([\w@.-]+\)\s+/.test(lines[j])) { msg = (msg.replace(/\s+$/, '') + ' ' + lines[j].replace(/^\([\w@.-]+\)\s+/, '').trim()).trim(); j++; }
  return { msg, next: j };
}

// Avisos que no piden hacer nada: se explican y se muestran como «Info», sin contarlos como advertencias.
const INFO_WARNINGS = [
  [/Using \\overbracket and \\underbracket from `mathtools'/, 'Solo informativo: unicode-math y mathtools traen su propia versión de \\overbracket y \\underbracket; se usa la de mathtools. No hace falta hacer nada.'],
  [/going to overwrite the following commands from the `mathtools' package/, 'Solo informativo: unicode-math reemplaza algunos comandos de mathtools (\\coloneqq, \\eqqcolon…). No hace falta hacer nada; si usas esos símbolos, revisa que se vean bien.'],
  [/Token not allowed in a PDF string/, 'Solo informativo: un título tiene fórmulas o comandos que no se pueden mostrar en el índice lateral del PDF (marcadores), así que ahí se simplifica. Si quieres controlarlo: \\section{\\texorpdfstring{$\\sin\\theta$}{sen θ}}'],
  [/Unknown language 'latin'/, 'Solo informativo: el texto de relleno de lipsum está en latín y no hay reglas de partición para ese idioma; no afecta a tu texto.'],
  [/The API for specifying variable labels have been updated/, 'karnaugh-map cambió la forma de poner los nombres de las variables: ahora va uno por corchete, p. ej. \\begin{karnaugh-map}[4][4][1][$D$][$C$][$B$][$A$] (la forma vieja todavía funciona).'],
  [/cref reference format for label type `([^']+)' undefined/, 'cleveref no sabe qué palabra poner para esta referencia: define \\crefname{$1}{nombre}{nombres} (en tcolorbox, con la opción crefname={…}{…}).'],
  [/Size substitutions with differences/, 'Solo informativo: algún tamaño de letra no existe exacto y se usó el más cercano. No hace falta hacer nada.'],
  [/Some font shapes were not available, defaults substituted/, 'Solo informativo: alguna variante de letra (p. ej. versalitas en cursiva) no existe y se usó otra parecida. Busca arriba el aviso «Font shape … undefined» para ver cuál.'],
  [/Unknown document class \(or package\)/, 'Solo informativo: el paquete caption no reconoce la clase del documento, pero funciona igual.'],
  [/running in backwards compatibility mode/, 'pgfplots funciona en modo compatible con versiones viejas: agrega \\pgfplotsset{compat=1.18} después de \\usepackage{pgfplots} para usar el comportamiento actual (y que desaparezca este aviso).'],
  [/\\headheight is too small/, 'La cabecera (fancyhdr) es más alta que el espacio reservado: agrega headheight=14pt (o el valor que sugiere el aviso) a las opciones de geometry.'],
];

export function parseLog(log, main = 'main.tex', sources = null) {
  const out = [];
  if (!log) return out;
  // TeX corta cada línea del registro a 79 caracteres: se vuelven a unir (si no, un mensaje como
  // «Giving up on this path. Did you forge|t a semicolon?» quedaba partido y sin traducir).
  const raw = log.split(/\r?\n/);
  const lines = [];
  for (let k = 0; k < raw.length; k++) {
    let l = raw[k];
    while (l.length > 0 && raw[k].length === 79 && k + 1 < raw.length) { k++; l += raw[k]; if (raw[k].length !== 79) break; }
    lines.push(l);
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(RE_FILE_LINE_ERROR);
    if (m && !/^\//.test(m[1])) {
      const jc = joinContinuation(lines, i, m[3]);
      let msg = jc.msg;
      if (NOISE.some((re) => re.test(msg))) continue;
      // Contexto: la línea "l.N ..." que sigue suele mostrar dónde ocurrió.
      let context = '';
      let head = '';
      for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
        if (/^l\.\d+/.test(lines[j])) { head = lines[j].replace(/^l\.\d+\s?/, ''); context = (head + (lines[j + 1] ? lines[j + 1].trim() : '')).replace(/\^\^M/g, '').trim(); break; }
      }
      const entry = { type: 'error', file: normFile(m[1], main), line: +m[2], message: msg, hint: translate(msg), context };
      fixNotFound(entry, sources, main);
      enrich(entry, head, sources, main, lines[jc.next] || '');
      out.push(entry);
      continue;
    }
    if (m && /^\//.test(m[1])) {
      if (NOISE.some((re) => re.test(m[3]))) continue;
      // Error dentro de un paquete del sistema: se informa sin salto al código.
      const sysMsg = joinContinuation(lines, i, m[3]).msg;
      const sysEntry = { type: 'error', file: null, line: null, message: sysMsg + ' (' + m[1].split('/').pop() + ':' + m[2] + ')', hint: translate(sysMsg) };
      // Algunos errores «dentro» de un paquete se pueden ubicar en el documento (p. ej. la opción de csquotes).
      try { enrich(sysEntry, '', sources, main, ''); } catch { /* sin ubicación */ }
      out.push(sysEntry);
      continue;
    }
    // Errores de pdfTeX al armar el PDF (fuentes): «!pdfTeX error: pdflatex (file utmr8a.pfb): cannot open Type 1 font file…»
    const pe = line.match(/^!\s?pdfTeX error:?\s*\S*\s*(?:\(file ([^)]+)\))?:?\s*(.*)$/);
    if (pe) {
      const f = pe[1] ? pe[1].split('/').pop() : '';
      const what = /Type 1 font file/.test(pe[2]) ? `el archivo de la fuente ${f}` : /encoding file/.test(pe[2]) ? `la codificación de fuente ${f}` : f ? `el archivo ${f}` : '';
      out.push({ type: 'error', file: null, line: null, message: line.replace(/^!\s?/, ''),
        hint: what ? `pdfTeX no pudo abrir ${what} al armar el PDF: falta el paquete de esa fuente (con «Instalar paquetes faltantes» activado se descarga solo al compilar de nuevo)` : 'pdfTeX no pudo terminar el PDF: revisa el mensaje en inglés' });
      continue;
    }
    if (line.startsWith('! ')) {
      const bj = joinContinuation(lines, i, line.slice(2));
      const msg = bj.msg;
      if (NOISE.some((re) => re.test(msg))) continue;
      let ln = null;
      let file = main;
      let bangHead = '';
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
          if (lm) { ln = +lm[1]; bangHead = lines[j].replace(/^l\.\d+\s?/, ''); break; }
        }
      }
      const entry = { type: 'error', file: ln != null ? file : null, line: ln, message: msg, hint: translate(msg) };
      fixNotFound(entry, sources, main);
      enrich(entry, bangHead, sources, main, lines[bj.next] || '');
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
      const w = { type: 'warning', file: lm ? main : null, line: lm ? +lm[1] : null, message: (m[1] ? m[1] + ': ' : '') + msg.trim(), hint: translate(msg) };
      const info = INFO_WARNINGS.find(([re]) => re.test(msg));
      if (info) { const mm = msg.match(info[0]); w.hint = info[1].replace(/\$(\d)/g, (_, n) => (mm && mm[n]) || ''); if (/^Solo informativo/.test(info[1])) w.info = true; }
      const dup = msg.match(/Label `([^']+)' multiply defined/);
      if (dup && sources) {
        const hits = findLines(new RegExp('\\\\label\\{' + escapeRe(dup[1]) + '\\}'), sources, main);
        if (hits.length > 1) { w.file = hits[1].file; w.line = hits[1].line; }
      }
      // Tamaño de letra que Computer Modern no trae (p. ej. \fontsize{38}): LaTeX usa el más cercano.
      const fsz = msg.match(/Font shape `([^']+)' in size <([\d.]+)> not available.*?size <([\d.]+)> substituted/);
      if (fsz) {
        const cm = /\/cm[a-z]*\//.test(fsz[1]);
        w.hint = `La letra no viene en tamaño ${fsz[2]} pt y LaTeX usó ${fsz[3]} pt (se ve casi igual).` + (cm ? ' Para el tamaño exacto, agrega \\RequirePackage{fix-cm} antes de \\documentclass' : '');
        const ls = sources && (sources[main] || '').split('\n');
        const k = ls ? ls.findIndex((l) => /^\s*\\documentclass/.test(l)) : -1;
        if (cm && k >= 0 && !/\\RequirePackage\s*\{fix-cm\}/.test(sources[main])) {
          w.fix = { file: main, line: k + 1, find: ls[k].trim(), replace: '\\RequirePackage{fix-cm}\n' + ls[k].trim(), label: 'Agregar \\RequirePackage{fix-cm}' };
        }
      }
      // Una tilde dentro de una fórmula (\operatorname{Máx}, $\mathrm{Mín}$…): en modo matemático
      // las letras con tilde no existen; con \text{…} se escribe como texto normal.
      if (/Command \\\S+ invalid in math mode/.test(msg) && sources && w.line) {
        const l = (sources[w.file || main] || '').split('\n')[w.line - 1] || '';
        const op = l.match(/\\(operatorname\*?|mathrm|mathit|mathbf)\s*\{([^{}]*[^\x00-\x7f][^{}]*)\}/);
        const acc = [...l].find((c) => /[áéíóúÁÉÍÓÚñÑüÜ]/.test(c));
        if (op) {
          w.hint = `La «${acc || '?'}» de \\${op[1]}{${op[2]}} está dentro de una fórmula, donde las tildes no funcionan: escríbelo como texto con \\text{${op[2]}}`;
          const rep = op[1].startsWith('operatorname') ? `\\${op[1]}{\\text{${op[2]}}}` : `\\text{${op[2]}}`;
          w.fix = { file: w.file || main, line: w.line, find: op[0], replace: rep, label: `Usar \\text{${op[2]}}` };
        } else if (acc && /\$|\\\[|\\\(/.test(l)) {
          w.hint = `La «${acc}» está dentro de una fórmula, donde las tildes no funcionan: escribe esa palabra con \\text{…} (o cierra el $ antes si es texto)`;
        }
      }
      out.push(w);
      continue;
    }
    m = line.match(RE_BADBOX);
    if (m) {
      out.push({ type: 'badbox', file: m[3] ? main : null, line: m[3] ? +m[3] : null, message: `${m[1] === 'Over' ? 'Desborde' : 'Caja poco llena'} (${m[2]})` });
    }
  }
  // Un \usepackage sin cerrar se «traga» los siguientes: los «falta el paquete X» de esos
  // paquetes (que sí están escritos) son consecuencia de ese error.
  const swallow = out.find((e) => e.swallow);
  if (swallow && sources && sources[swallow.file]) {
    const pre = sources[swallow.file].split('\\begin{document}')[0].replace(/(^|[^\\])%.*$/gm, '$1');
    const loaded = new Set();
    for (const m of pre.matchAll(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}\n]*)\}?/g)) m[1].split(',').forEach((p) => loaded.add(p.trim()));
    for (const e of out) if (e !== swallow && e.needPkg && loaded.has(e.needPkg)) { e.cascade = swallow.line; e.swallowed = true; }
  }
  // Una llave o un $ sin cerrar: los errores de todo lo que TeX leyó «dentro» (desde la causa hasta
  // donde lo notó) y los comandos que se definían ahí son consecuencia de ese único error.
  for (const root of out.filter((e) => e.covers)) {
    const { from, to, defs = [] } = root.covers;
    for (const e of out) {
      if (e === root || e.type !== 'error' || e.cascade != null) continue;
      const inside = e.file === root.file && e.line != null && e.line >= from && e.line <= to;
      const atEnd = to === Infinity && /^Emergency stop/.test(e.message);
      const usesDef = /^Undefined control sequence/.test(e.message) && defs.some((d) => new RegExp('\\\\' + d.replace(/@/g, '\\@') + '(?![A-Za-z@])').test(e.context || ''));
      if (inside || atEnd || usesDef) e.cascade = root.line;
    }
  }
  // «Falta el paquete X»: botón para agregar \usepackage{X} debajo del último \usepackage.
  if (sources && sources[main]) {
    const ls = sources[main].split('\n');
    const begin = ls.findIndex((l) => /\\begin\s*\{document\}/.test(l));
    let last = -1;
    ls.forEach((l, i) => { if ((begin < 0 || i < begin) && /^\s*\\usepackage/.test(l)) last = i; });
    const loadedAll = new Set();
    for (const m of noComments(sources[main].split('\\begin{document}')[0]).matchAll(/\\usepackage\s*(?:\[[^\]]*\])?\s*\{([^}]*)\}/g)) m[1].split(',').forEach((p) => loadedAll.add(p.trim()));
    if (last >= 0) for (const e of out) {
      if (e.needPkg && !e.fix && !e.swallowed && !loadedAll.has(e.needPkg)) {
        e.fix = { file: main, line: last + 1, find: ls[last].trim(), replace: ls[last].trim() + '\n\\usepackage{' + e.needPkg + '}', label: `Agregar \\usepackage{${e.needPkg}}` };
      }
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
  const prevReal = [];
  const prevAll = [];
  for (const e of entries) {
    const m = e.message;
    if (e.cascade != null) { prevAll.push(e); continue; }
    // Los avisos de resumen («There were undefined references») repiten los de arriba.
    if (e.type === 'warning' && /There were (undefined references|multiply-defined labels|undefined citations)/.test(m)) {
      const src = prevAll.find((x) => x.type === 'warning' && /(Reference|Citation) `[^']+' on page|Label `[^']+' multiply defined/.test(x.message));
      if (src) { e.info = true; e.hint = 'Solo informativo: es el resumen de los avisos de arriba (' + (/labels/.test(m) ? 'etiquetas repetidas' : 'referencias sin definir') + ').'; continue; }
    }
    if (e.type === 'warning') prevAll.push(e);
    // «Dimension too large» repetido en las líneas siguientes: es el mismo problema.
    if (e.type === 'error' && /^Dimension too large/.test(m)) {
      const src = prevReal.find((x) => /^Dimension too large/.test(x.message) && x.file === e.file && e.line - x.line <= 3 && e.line >= x.line);
      if (src) { e.cascade = src.line; continue; }
    }
    // Avisos de pgfplots que son consecuencia de un error de pgfplots justo antes.
    if (e.type === 'warning' && /the current plot has no coordinates|axis with empty range/.test(m)) {
      const src = prevReal.find((x) => /pgfplots Error/.test(x.message) && x.line != null && e.line != null && e.line - x.line <= 3 && e.line >= x.line);
      if (src) { e.cascade = src.line; continue; }
    }
    // En la misma línea que un comando de un paquete «tragado»: también es consecuencia.
    if (e.type === 'error' && e.line != null) {
      const sameCascade = prevAll.find((x) => x.swallowed && x.line === e.line && x.file === e.file);
      if (sameCascade) { e.cascade = sameCascade.cascade; e.swallowed = true; prevAll.push(e); continue; }
    }
    if (e.type === 'error') prevAll.push(e);
    if (e.type === 'error' && /^Emergency stop\.?$/.test(m) && firstReal && firstReal !== e) { e.cascade = firstReal.line ?? '?'; continue; }
    if (e.type === 'error' && /no legal \\end found/.test(m)) {
      const runaway = errs.find((x) => x !== e && /^File ended while scanning/.test(x.message));
      if (runaway) { e.cascade = runaway.line ?? '?'; continue; }
    }
    if (e.type === 'error' && e.line != null) {
      // Otro error en la misma línea que uno anterior: casi siempre es consecuencia.
      const same = prevReal.find((x) => x.line === e.line && x.file === e.file);
      if (same) { e.cascade = same.line; continue; }
      // Ecuación rota: los errores matemáticos que siguen a «Missing $» en las 2 líneas siguientes.
      if (/^(Missing \$ inserted|Display math should end|LaTeX Error: Bad math environment delimiter|You can't use `\\eqno')/.test(m)) {
        const src = prevReal.find((x) => /^(Missing \$ inserted|Display math should end)/.test(x.message) && x.file === e.file && e.line > x.line && e.line - x.line <= 2);
        if (src) { e.cascade = src.line; continue; }
      }
      // Fuente que no carga porque fontspec no la encontró antes.
      if (/not loadable: Metric \(TFM\) file|\\(text|script|scriptscript)font \d+ is undefined|Math formula deleted: Insufficient symbol fonts/.test(m)) {
        const src = prevReal.find((x) => /The font ".+" cannot be found/.test(x.message));
        if (src) { e.cascade = src.line; continue; }
      }
      if (/^LaTeX Error: Something's wrong--perhaps a missing \\item/.test(m)) {
        const src = prevReal.find((x) => x.message === m && x.file === e.file && e.line > x.line && e.line - x.line <= 3);
        if (src) { e.cascade = src.line; continue; }
      }
      // La misma fila de más repetida en una tabla.
      if (/^Extra alignment tab/.test(m)) {
        const src = prevReal.find((x) => /^Extra alignment tab/.test(x.message) && x.file === e.file && e.line > x.line && e.line - x.line <= 6);
        if (src) { e.cascade = src.line; continue; }
      }
    }
    const env = m.match(/Environment (\S+) undefined/);
    if (env) { undefinedEnvs.push({ name: env[1], line: e.line }); prevReal.push(e); continue; }
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
      prevReal.push(e);
    } else if (e.type === 'warning' && /Axis range for axis \w+ is approximately empty/.test(m)) {
      const src = prevReal.slice().reverse().find((x) => x.file === e.file && e.line != null && x.line != null && e.line >= x.line && e.line - x.line <= 3);
      if (src) e.cascade = src.line;
    } else if (e.type === 'warning' && /invalid in math mode/.test(m)) {
      const src = errs.find((x) => /Missing \$ inserted/.test(x.message) && x.line === e.line);
      if (src) e.cascade = src.line;
    }
  }
  return entries;
}

/**
 * Errores y avisos de BibTeX y biber (programas aparte de LaTeX). Se leen de la salida de latexmk.
 * Si el .bib lo escribió el propio documento con filecontents, la línea se traduce al .tex.
 */
export function parseBibOutput(output, sources = null, main = 'main.tex', existing = []) {
  if (!output) return [];
  const out = [];
  const seen = new Set();
  const push = (e) => { const k = e.type + e.message; if (!seen.has(k)) { seen.add(k); out.push(e); } };
  // XeLaTeX: xdvipdfmx (el que arma el PDF a partir del .xdv) falló; se muestran sus mensajes.
  const xd = output.match(/\[xdvipdfmx\] No se pudo armar el PDF[^\n]*\n([\s\S]{0,1500})/);
  if (xd) {
    const fuente = xd[1].match(/(?:Could not locate|Cannot proceed without|not found)[^\n]*/i);
    push({ type: 'error', file: null, line: null, message: 'XeLaTeX compiló, pero no se pudo armar el PDF (xdvipdfmx)',
      hint: (fuente ? fuente[0] + ' · ' : '') + xd[1].trim().split('\n').slice(-4).join(' · ').slice(0, 400) });
  }
  const bibLine = (bib, n) => {
    if (sources && sources[bib]) return { file: bib, line: n };
    for (const [file, text] of Object.entries(sources || {})) {
      const lines = text.split('\n');
      const i = lines.findIndex((l) => new RegExp('\\\\begin\\{filecontents\\*?\\}(\\[[^\\]]*\\])?\\{' + bib.replace(/[.]/g, '\\.') + '\\}').test(l));
      if (i >= 0) return { file, line: i + 1 + n };
    }
    return { file: null, line: null };
  };
  const citeLine = (key) => {
    for (const [file, text] of Object.entries(sources || {})) {
      const i = text.split('\n').findIndex((l) => new RegExp('\\\\\\w*cite\\w*\\*?(\\[[^\\]]*\\])*\\{[^}]*\\b' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(l));
      if (i >= 0) return { file, line: i + 1 };
    }
    return { file: null, line: null };
  };
  const lines = output.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m;
    if ((m = l.match(/^I was expecting a `,' or a `\}'---line (\d+) of file (\S+)/))) {
      const loc = bibLine(m[2], Math.max(1, +m[1] - 1));
      push({ type: 'error', ...loc, message: `BibTeX: formato incorrecto en ${m[2]} (línea ${m[1]})`, hint: 'Entrada mal escrita en la bibliografía: casi siempre falta la coma después de la clave (@book{clave,) o hay una llave de más o de menos' });
    } else if ((m = l.match(/^I couldn't open database file (\S+)/))) {
      const ln = findInSources(/\\bibliography\{/, sources, main);
      push({ type: 'error', file: ln ? main : null, line: ln, message: `BibTeX: no se encontró ${m[1]}`, hint: `No existe el archivo de bibliografía «${m[1]}»: revisa el nombre en \\bibliography{…} (sin .bib) o agrégalo al proyecto` });
    } else if ((m = l.match(/^I couldn't open style file (\S+)/))) {
      const ln = findInSources(/\\bibliographystyle\{/, sources, main);
      push({ type: 'error', file: ln ? main : null, line: ln, message: `BibTeX: no se encontró el estilo ${m[1]}`, hint: 'Estilo de bibliografía inexistente: prueba plain, unsrt, alpha, abbrv, ieeetr o plainnat (con natbib)' });
    } else if ((m = l.match(/^Warning--I didn't find a database entry for "([^"]+)"/)) || (m = l.match(/WARN - I didn't find a database entry for '([^']+)'/))) {
      const hint = `La clave «${m[1]}» no está en el archivo .bib: corrígela en \\cite{…} o agrega la entrada`;
      const latexWarn = existing.find((e) => e.type === 'warning' && e.message.includes('`' + m[1] + "'"));
      if (latexWarn) { latexWarn.hint = hint; continue; }
      push({ type: 'warning', ...citeLine(m[1]), message: `Cita «${m[1]}» sin entrada en la bibliografía`, hint });
    } else if ((m = l.match(/ERROR - (.*)/)) && /biber|BibTeX subsystem|\.bib/.test(l)) {
      const ln = m[1].match(/(\S+\.bib)[^\d]*line (\d+)/);
      const loc = ln ? bibLine(ln[1].split('/').pop(), +ln[2]) : { file: null, line: null };
      push({ type: 'error', ...loc, message: 'biber: ' + m[1].slice(0, 160), hint: 'Error en la bibliografía (biber): revisa la entrada indicada del .bib (comas, llaves y comillas)' });
    } else if (/biber: (command )?not found|Could not find biber|'biber' not found/i.test(l)) {
      const ln = findInSources(/\\usepackage(\[[^\]]*\])?\{biblatex\}/, sources, main);
      const src = ln && sources ? (sources[main] || '').split('\n')[ln - 1] || '' : '';
      const bb = src.match(/backend\s*=\s*biber/);
      push({ type: 'error', file: ln ? main : null, line: ln, message: 'No está instalado el programa biber',
        hint: bb ? 'El motor integrado no trae biber (el programa que pide backend=biber), pero sí BibTeX: con backend=bibtex la bibliografía sale igual'
          : 'biblatex usa el programa biber, que no está instalado. Alternativa: \\usepackage[backend=bibtex]{biblatex}',
        ...(bb ? { fix: { file: main, line: ln, find: bb[0], replace: 'backend=bibtex', label: 'Usar backend=bibtex' } } : {}) });
    }
  }
  return out;
}

export function summarize(entries) {
  return {
    cascades: entries.filter((e) => e.type === 'error' && e.cascade != null).length,
    errors: entries.filter((e) => e.type === 'error' && e.cascade == null).length,
    warnings: entries.filter((e) => e.type === 'warning' && e.cascade == null && !e.info).length,
    infos: entries.filter((e) => e.type === 'warning' && e.info).length,
    badboxes: entries.filter((e) => e.type === 'badbox').length,
  };
}
