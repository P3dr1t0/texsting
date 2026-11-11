// Asistentes rápidos (tabla, matriz, lista, ecuación), al estilo de los de TeXstudio.
import { dialog, el } from './ui.js';

function numField(label, value, min = 1, max = 30) {
  const input = el('input', { type: 'number', class: 'input', value, min, max, inputmode: 'numeric' });
  return [el('label', { class: 'field-label' }, label), input];
}

function select(label, options, value) {
  const s = el('select', { class: 'input' }, ...options.map(([v, t]) => el('option', { value: v, selected: v === value }, t)));
  return [el('label', { class: 'field-label' }, label), s];
}

export async function tableWizard() {
  const [lr, rows] = numField('Filas', 3);
  const [lc, cols] = numField('Columnas', 3);
  const [la, align] = select('Alineación', [['c', 'Centrada'], ['l', 'Izquierda'], ['r', 'Derecha']], 'c');
  const [ls, style] = select('Estilo', [['booktabs', 'Profesional (booktabs)'], ['lines', 'Con todas las líneas'], ['none', 'Sin líneas']], 'booktabs');
  const float = el('input', { type: 'checkbox', checked: true });
  const body = el('div', { class: 'form-grid' }, lr, rows, lc, cols, la, align, ls, style,
    el('label', { class: 'check' }, float, ' Como tabla flotante con leyenda'));
  const ok = await dialog({ title: 'Asistente de tabla', body, buttons: [{ label: 'Cancelar', value: false }, { label: 'Insertar', value: true, primary: true }] });
  if (!ok) return null;
  const r = Math.max(1, +rows.value || 1), c = Math.max(1, +cols.value || 1);
  const a = align.value;
  const st = style.value;
  const spec = st === 'lines' ? '|' + Array(c).fill(a).join('|') + '|' : Array(c).fill(a).join('');
  const row = (i) => Array.from({ length: c }, (_, j) => (i === 0 ? `Col ${j + 1}` : '${}')).join(' & ') + ' \\\\';
  const lines = [];
  lines.push(`\\begin{tabular}{${spec}}`);
  lines.push(st === 'booktabs' ? '  \\toprule' : st === 'lines' ? '  \\hline' : null);
  for (let i = 0; i < r; i++) {
    lines.push('  ' + row(i));
    if (i === 0 && st === 'booktabs') lines.push('  \\midrule');
    else if (st === 'lines') lines.push('  \\hline');
  }
  if (st === 'booktabs') lines.push('  \\bottomrule');
  lines.push('\\end{tabular}');
  let out = lines.filter(Boolean).join('\n');
  if (float.checked) {
    out = `\\begin{table}[htbp]\n  \\centering\n  \\caption{\${leyenda}}\n  \\label{tab:\${etiqueta}}\n${out.split('\n').map((l) => '  ' + l).join('\n')}\n\\end{table}`;
  }
  return { snippet: out, needs: st === 'booktabs' ? ['booktabs'] : [] };
}

export async function matrixWizard() {
  const [lr, rows] = numField('Filas', 3, 1, 12);
  const [lc, cols] = numField('Columnas', 3, 1, 12);
  const [lt, type] = select('Delimitador', [['pmatrix', '( ) paréntesis'], ['bmatrix', '[ ] corchetes'], ['vmatrix', '| | determinante'], ['Bmatrix', '{ } llaves'], ['matrix', 'sin delimitador']], 'bmatrix');
  const ok = await dialog({ title: 'Asistente de matriz', body: el('div', { class: 'form-grid' }, lr, rows, lc, cols, lt, type), buttons: [{ label: 'Cancelar', value: false }, { label: 'Insertar', value: true, primary: true }] });
  if (!ok) return null;
  const r = Math.max(1, +rows.value || 1), c = Math.max(1, +cols.value || 1);
  const body = Array.from({ length: r }, () => '  ' + Array.from({ length: c }, () => '${}').join(' & ')).join(' \\\\\n');
  return { snippet: `\\begin{${type.value}}\n${body}\n\\end{${type.value}}`, needs: ['amsmath'] };
}

export async function listWizard() {
  const [lt, type] = select('Tipo de lista', [['itemize', 'Viñetas'], ['enumerate', 'Numerada'], ['description', 'Descripción']], 'itemize');
  const [ln, n] = numField('Elementos', 3, 1, 50);
  const ok = await dialog({ title: 'Asistente de lista', body: el('div', { class: 'form-grid' }, lt, type, ln, n), buttons: [{ label: 'Cancelar', value: false }, { label: 'Insertar', value: true, primary: true }] });
  if (!ok) return null;
  const item = type.value === 'description' ? '\\item[${término}] ${}' : '\\item ${}';
  const items = Array.from({ length: Math.max(1, +n.value || 1) }, () => '  ' + item).join('\n');
  return { snippet: `\\begin{${type.value}}\n${items}\n\\end{${type.value}}`, needs: [] };
}

export const QUICK_INSERTS = [
  { label: 'Ecuación numerada', value: '\\begin{equation}\n  ${sel}\n  \\label{eq:${etiqueta}}\n\\end{equation}' },
  { label: 'Ecuaciones alineadas', value: '\\begin{align}\n  ${a} &= ${b} \\\\\n  ${c} &= ${d}\n\\end{align}' },
  { label: 'Función por partes (cases)', value: 'f(x) = \\begin{cases}\n  ${a} & \\text{si } ${x < 0} \\\\\n  ${b} & \\text{si } ${x \\geq 0}\n\\end{cases}' },
  { label: 'Figura con imagen', value: '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${archivo}}\n  \\caption{${leyenda}}\n  \\label{fig:${etiqueta}}\n\\end{figure}' },
  { label: 'Circuito (circuitikz)', value: '\\begin{circuitikz}\n  \\draw (0,0) to[V, l=$V_s$] (0,3)\n        to[R, l=$R_1$] (3,3)\n        to[C, l=$C_1$] (3,0) -- (0,0);\n\\end{circuitikz}' },
  { label: 'Gráfica (pgfplots)', value: '\\begin{tikzpicture}\n  \\begin{axis}[xlabel={$t$}, ylabel={$f(t)$}, grid=major]\n    \\addplot[domain=0:5, samples=100, thick]{${exp(-x)*cos(deg(2*x))}};\n  \\end{axis}\n\\end{tikzpicture}' },
  { label: 'Código fuente (listings)', value: '\\begin{lstlisting}[language=${Python}]\n${sel}\n\\end{lstlisting}' },
  { label: 'Dos columnas (minipage)', value: '\\begin{minipage}{0.48\\linewidth}\n  ${izquierda}\n\\end{minipage}\\hfill\n\\begin{minipage}{0.48\\linewidth}\n  ${derecha}\n\\end{minipage}' },
];
