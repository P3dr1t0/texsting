// Datos de LaTeX: comandos para autocompletar, entornos y paneles de símbolos.
// Las plantillas usan la sintaxis de campos ${nombre}; ${sel} se reemplaza por la selección.

const C = (label, template, info, section = 'general') => ({ label, template: template || label, info, section });

export const COMMANDS = [
  // Estructura
  C('\\documentclass', '\\documentclass[${opciones}]{${article}}', 'Clase del documento', 'estructura'),
  C('\\usepackage', '\\usepackage{${paquete}}', 'Cargar paquete', 'estructura'),
  C('\\usepackage[]', '\\usepackage[${opciones}]{${paquete}}', 'Paquete con opciones', 'estructura'),
  C('\\title', '\\title{${título}}', 'Título', 'estructura'),
  C('\\author', '\\author{${autor}}', 'Autor', 'estructura'),
  C('\\date', '\\date{${\\today}}', 'Fecha', 'estructura'),
  C('\\maketitle', '\\maketitle', 'Imprime el título', 'estructura'),
  C('\\tableofcontents', '\\tableofcontents', 'Índice', 'estructura'),
  C('\\listoffigures', '\\listoffigures', 'Índice de figuras', 'estructura'),
  C('\\listoftables', '\\listoftables', 'Índice de tablas', 'estructura'),
  C('\\part', '\\part{${sel}}', 'Parte', 'estructura'),
  C('\\chapter', '\\chapter{${sel}}', 'Capítulo', 'estructura'),
  C('\\section', '\\section{${sel}}', 'Sección', 'estructura'),
  C('\\subsection', '\\subsection{${sel}}', 'Subsección', 'estructura'),
  C('\\subsubsection', '\\subsubsection{${sel}}', 'Subsubsección', 'estructura'),
  C('\\paragraph', '\\paragraph{${sel}}', 'Párrafo', 'estructura'),
  C('\\section*', '\\section*{${sel}}', 'Sección sin número', 'estructura'),
  C('\\subsection*', '\\subsection*{${sel}}', 'Subsección sin número', 'estructura'),
  C('\\appendix', '\\appendix', 'Apéndices', 'estructura'),
  C('\\input', '\\input{${archivo}}', 'Incluir archivo', 'estructura'),
  C('\\include', '\\include{${archivo}}', 'Incluir capítulo', 'estructura'),
  C('\\newpage', '\\newpage', 'Nueva página', 'estructura'),
  C('\\clearpage', '\\clearpage', 'Vaciar flotantes y nueva página', 'estructura'),
  C('\\label', '\\label{${etiqueta}}', 'Etiqueta', 'referencias'),
  C('\\ref', '\\ref{${etiqueta}}', 'Referencia', 'referencias'),
  C('\\eqref', '\\eqref{${etiqueta}}', 'Referencia a ecuación', 'referencias'),
  C('\\pageref', '\\pageref{${etiqueta}}', 'Página de referencia', 'referencias'),
  C('\\autoref', '\\autoref{${etiqueta}}', 'Referencia con nombre', 'referencias'),
  C('\\cref', '\\cref{${etiqueta}}', 'Referencia (cleveref)', 'referencias'),
  C('\\cite', '\\cite{${clave}}', 'Cita bibliográfica', 'referencias'),
  C('\\footnote', '\\footnote{${sel}}', 'Nota al pie', 'referencias'),
  C('\\url', '\\url{${url}}', 'URL', 'referencias'),
  C('\\href', '\\href{${url}}{${texto}}', 'Enlace', 'referencias'),
  C('\\bibliography', '\\bibliography{${archivo}}', 'Bibliografía BibTeX', 'referencias'),
  C('\\bibliographystyle', '\\bibliographystyle{${plain}}', 'Estilo de bibliografía', 'referencias'),
  C('\\addbibresource', '\\addbibresource{${archivo.bib}}', 'Bibliografía biblatex', 'referencias'),
  C('\\printbibliography', '\\printbibliography', 'Imprime bibliografía (biblatex)', 'referencias'),
  // Formato de texto
  C('\\textbf', '\\textbf{${sel}}', 'Negrita', 'texto'),
  C('\\textit', '\\textit{${sel}}', 'Cursiva', 'texto'),
  C('\\underline', '\\underline{${sel}}', 'Subrayado', 'texto'),
  C('\\emph', '\\emph{${sel}}', 'Énfasis', 'texto'),
  C('\\texttt', '\\texttt{${sel}}', 'Monoespaciado', 'texto'),
  C('\\textsc', '\\textsc{${sel}}', 'Versalitas', 'texto'),
  C('\\textcolor', '\\textcolor{${red}}{${sel}}', 'Texto en color', 'texto'),
  C('\\tiny', '\\tiny', 'Tamaño diminuto', 'texto'),
  C('\\small', '\\small', 'Tamaño pequeño', 'texto'),
  C('\\large', '\\large', 'Tamaño grande', 'texto'),
  C('\\Large', '\\Large', 'Tamaño más grande', 'texto'),
  C('\\huge', '\\huge', 'Tamaño enorme', 'texto'),
  C('\\centering', '\\centering', 'Centrar', 'texto'),
  C('\\noindent', '\\noindent', 'Sin sangría', 'texto'),
  C('\\vspace', '\\vspace{${1em}}', 'Espacio vertical', 'texto'),
  C('\\hspace', '\\hspace{${1em}}', 'Espacio horizontal', 'texto'),
  C('\\item', '\\item ${}', 'Elemento de lista', 'texto'),
  C('\\today', '\\today', 'Fecha de hoy', 'texto'),
  C('\\LaTeX', '\\LaTeX', 'Logo LaTeX', 'texto'),
  C('\\newcommand', '\\newcommand{\\${nombre}}[${1}]{${definición}}', 'Nuevo comando', 'texto'),
  C('\\renewcommand', '\\renewcommand{\\${nombre}}{${definición}}', 'Redefinir comando', 'texto'),
  C('\\includegraphics', '\\includegraphics[width=${0.8}\\linewidth]{${archivo}}', 'Insertar imagen', 'figuras'),
  C('\\caption', '\\caption{${sel}}', 'Leyenda', 'figuras'),
  C('\\hline', '\\hline', 'Línea horizontal', 'tablas'),
  C('\\multicolumn', '\\multicolumn{${2}}{${c}}{${texto}}', 'Combinar columnas', 'tablas'),
  C('\\toprule', '\\toprule', 'Línea superior (booktabs)', 'tablas'),
  C('\\midrule', '\\midrule', 'Línea media (booktabs)', 'tablas'),
  C('\\bottomrule', '\\bottomrule', 'Línea inferior (booktabs)', 'tablas'),
  // Matemática
  C('\\frac', '\\frac{${num}}{${den}}', 'Fracción', 'mate'),
  C('\\dfrac', '\\dfrac{${num}}{${den}}', 'Fracción grande', 'mate'),
  C('\\sqrt', '\\sqrt{${sel}}', 'Raíz cuadrada', 'mate'),
  C('\\sqrt[]', '\\sqrt[${n}]{${x}}', 'Raíz n-ésima', 'mate'),
  C('\\sum', '\\sum_{${i=1}}^{${n}}', 'Sumatoria', 'mate'),
  C('\\prod', '\\prod_{${i=1}}^{${n}}', 'Productoria', 'mate'),
  C('\\int', '\\int_{${a}}^{${b}} ${f(x)}\\,dx', 'Integral', 'mate'),
  C('\\iint', '\\iint_{${D}}', 'Integral doble', 'mate'),
  C('\\oint', '\\oint_{${C}}', 'Integral de línea cerrada', 'mate'),
  C('\\lim', '\\lim_{${x \\to 0}}', 'Límite', 'mate'),
  C('\\left(', '\\left( ${sel} \\right)', 'Paréntesis ajustables', 'mate'),
  C('\\left[', '\\left[ ${sel} \\right]', 'Corchetes ajustables', 'mate'),
  C('\\left\\{', '\\left\\{ ${sel} \\right\\}', 'Llaves ajustables', 'mate'),
  C('\\left|', '\\left| ${sel} \\right|', 'Barras ajustables', 'mate'),
  C('\\mathrm', '\\mathrm{${sel}}', 'Texto recto en mate', 'mate'),
  C('\\mathbf', '\\mathbf{${sel}}', 'Negrita en mate', 'mate'),
  C('\\mathbb', '\\mathbb{${R}}', 'Pizarra (ℝ, ℕ...)', 'mate'),
  C('\\mathcal', '\\mathcal{${L}}', 'Caligráfica', 'mate'),
  C('\\vec', '\\vec{${v}}', 'Vector', 'mate'),
  C('\\hat', '\\hat{${x}}', 'Sombrero', 'mate'),
  C('\\bar', '\\bar{${x}}', 'Barra', 'mate'),
  C('\\overline', '\\overline{${sel}}', 'Línea superior', 'mate'),
  C('\\dot', '\\dot{${x}}', 'Derivada temporal', 'mate'),
  C('\\ddot', '\\ddot{${x}}', 'Segunda derivada temporal', 'mate'),
  C('\\text', '\\text{${sel}}', 'Texto dentro de mate', 'mate'),
  C('\\operatorname', '\\operatorname{${nombre}}', 'Operador', 'mate'),
  C('\\partial', '\\partial', 'Derivada parcial ∂', 'mate'),
  C('\\nabla', '\\nabla', 'Nabla ∇', 'mate'),
  C('\\infty', '\\infty', 'Infinito ∞', 'mate'),
  C('\\cdot', '\\cdot', 'Punto ·', 'mate'),
  C('\\times', '\\times', 'Por ×', 'mate'),
  C('\\pm', '\\pm', 'Más menos ±', 'mate'),
  C('\\approx', '\\approx', 'Aproximado ≈', 'mate'),
  C('\\neq', '\\neq', 'Distinto ≠', 'mate'),
  C('\\leq', '\\leq', 'Menor o igual ≤', 'mate'),
  C('\\geq', '\\geq', 'Mayor o igual ≥', 'mate'),
  C('\\to', '\\to', 'Flecha →', 'mate'),
  C('\\Rightarrow', '\\Rightarrow', 'Implica ⇒', 'mate'),
  C('\\Leftrightarrow', '\\Leftrightarrow', 'Equivale ⇔', 'mate'),
  C('\\angle', '\\angle', 'Ángulo ∠', 'mate'),
  C('\\degree', '^\\circ', 'Grados °', 'mate'),
  C('\\sin', '\\sin', 'Seno', 'mate'), C('\\cos', '\\cos', 'Coseno', 'mate'), C('\\tan', '\\tan', 'Tangente', 'mate'),
  C('\\ln', '\\ln', 'Logaritmo natural', 'mate'), C('\\log', '\\log', 'Logaritmo', 'mate'), C('\\exp', '\\exp', 'Exponencial', 'mate'),
  C('\\max', '\\max', 'Máximo', 'mate'), C('\\min', '\\min', 'Mínimo', 'mate'),
  C('\\Re', '\\Re', 'Parte real', 'mate'), C('\\Im', '\\Im', 'Parte imaginaria', 'mate'),
  C('\\quad', '\\quad', 'Espacio en mate', 'mate'), C('\\qquad', '\\qquad', 'Espacio doble', 'mate'),
  C('\\,', '\\,', 'Espacio fino', 'mate'),
  // Ingeniería
  C('\\SI', '\\SI{${valor}}{${\\ohm}}', 'Cantidad con unidad (siunitx)', 'ingenieria'),
  C('\\si', '\\si{${\\volt}}', 'Unidad (siunitx)', 'ingenieria'),
  C('\\qty', '\\qty{${valor}}{${\\ohm}}', 'Cantidad (siunitx v3)', 'ingenieria'),
  C('\\num', '\\num{${1e3}}', 'Número (siunitx)', 'ingenieria'),
  C('\\ohm', '\\ohm', 'Ohm (siunitx)', 'ingenieria'),
  C('\\mathcal{L}', '\\mathcal{L}\\left\\{ ${f(t)} \\right\\}', 'Transformada de Laplace', 'ingenieria'),
  C('\\mathcal{F}', '\\mathcal{F}\\left\\{ ${x(t)} \\right\\}', 'Transformada de Fourier', 'ingenieria'),
  C('\\phasor', '${V}\\angle ${\\theta}^\\circ', 'Fasor', 'ingenieria'),
  C('\\draw', '\\draw (${0,0}) to[${R=$R_1$}] (${2,0});', 'Elemento circuitikz/TikZ', 'ingenieria'),
];

const GREEK = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'];
for (const g of GREEK) COMMANDS.push(C('\\' + g, '\\' + g, 'Letra griega', 'griego'));

export const ENVIRONMENTS = [
  ['document', ''], ['itemize', '\\item '], ['enumerate', '\\item '], ['description', '\\item[${término}] '],
  ['equation', ''], ['equation*', ''], ['align', ''], ['align*', ''], ['gather', ''], ['gather*', ''], ['multline', ''],
  ['split', ''], ['cases', ''], ['matrix', ''], ['pmatrix', ''], ['bmatrix', ''], ['vmatrix', ''], ['array', ''],
  ['figure', '\\centering\n\t\\includegraphics[width=0.8\\linewidth]{${archivo}}\n\t\\caption{${leyenda}}\n\t\\label{fig:${etiqueta}}'],
  ['table', '\\centering\n\t\\caption{${leyenda}}\n\t\\label{tab:${etiqueta}}\n\t\\begin{tabular}{${ccc}}\n\t\t${}\n\t\\end{tabular}'],
  ['tabular', ''], ['center', ''], ['flushleft', ''], ['flushright', ''], ['minipage', ''], ['abstract', ''],
  ['quote', ''], ['verbatim', ''], ['lstlisting', ''], ['minted', ''], ['tikzpicture', ''], ['circuitikz', '\\draw (0,0) to[${R=$R_1$}] (2,0);'],
  ['axis', ''], ['frame', '\\frametitle{${título}}\n\t'], ['columns', ''], ['column', ''], ['block', ''], ['theorem', ''], ['proof', ''],
  ['definition', ''], ['lemma', ''], ['example', ''], ['subfigure', ''], ['thebibliography', ''], ['titlepage', ''], ['multicols', ''],
];

export const ENV_ARGS = {
  tabular: '{${ccc}}', array: '{${cc}}', minipage: '{${0.45\\linewidth}}', figure: '[${htbp}]', table: '[${htbp}]',
  lstlisting: '[language=${Python}]', minted: '{${python}}', frame: '', column: '{${0.5\\textwidth}}', columns: '',
  block: '{${título}}', subfigure: '{${0.45\\linewidth}}', thebibliography: '{${99}}', multicols: '{${2}}',
};

export function envSnippet(name) {
  const body = (ENVIRONMENTS.find((e) => e[0] === name) || [name, ''])[1] || '${}';
  const args = ENV_ARGS[name] || '';
  return `\\begin{${name}}${args}\n\t${body}\n\\end{${name}}`;
}

// Paneles de símbolos (como la barra lateral de TeXstudio).
export const SYMBOLS = [
  { name: 'Griego', items: [
    ['α', '\\alpha'], ['β', '\\beta'], ['γ', '\\gamma'], ['δ', '\\delta'], ['ε', '\\epsilon'], ['ϵ', '\\varepsilon'], ['ζ', '\\zeta'],
    ['η', '\\eta'], ['θ', '\\theta'], ['ϑ', '\\vartheta'], ['ι', '\\iota'], ['κ', '\\kappa'], ['λ', '\\lambda'], ['μ', '\\mu'], ['ν', '\\nu'],
    ['ξ', '\\xi'], ['π', '\\pi'], ['ρ', '\\rho'], ['σ', '\\sigma'], ['τ', '\\tau'], ['υ', '\\upsilon'], ['ϕ', '\\phi'], ['φ', '\\varphi'],
    ['χ', '\\chi'], ['ψ', '\\psi'], ['ω', '\\omega'], ['Γ', '\\Gamma'], ['Δ', '\\Delta'], ['Θ', '\\Theta'], ['Λ', '\\Lambda'], ['Ξ', '\\Xi'],
    ['Π', '\\Pi'], ['Σ', '\\Sigma'], ['Φ', '\\Phi'], ['Ψ', '\\Psi'], ['Ω', '\\Omega'],
  ] },
  { name: 'Operadores', items: [
    ['±', '\\pm'], ['∓', '\\mp'], ['×', '\\times'], ['÷', '\\div'], ['·', '\\cdot'], ['∘', '\\circ'], ['∗', '\\ast'], ['⊕', '\\oplus'],
    ['⊗', '\\otimes'], ['∩', '\\cap'], ['∪', '\\cup'], ['∧', '\\wedge'], ['∨', '\\vee'], ['∑', '\\sum'], ['∏', '\\prod'], ['∫', '\\int'],
    ['∬', '\\iint'], ['∮', '\\oint'], ['∂', '\\partial'], ['∇', '\\nabla'], ['√', '\\sqrt{${}}'], ['a/b', '\\frac{${}}{${}}'],
    ['xⁿ', '^{${}}'], ['xₙ', '_{${}}'], ['lim', '\\lim_{${x\\to 0}}'],
  ] },
  { name: 'Relaciones', items: [
    ['≤', '\\leq'], ['≥', '\\geq'], ['≠', '\\neq'], ['≈', '\\approx'], ['≡', '\\equiv'], ['∼', '\\sim'], ['≃', '\\simeq'], ['∝', '\\propto'],
    ['≪', '\\ll'], ['≫', '\\gg'], ['∈', '\\in'], ['∉', '\\notin'], ['⊂', '\\subset'], ['⊆', '\\subseteq'], ['⊃', '\\supset'], ['⊇', '\\supseteq'],
    ['∀', '\\forall'], ['∃', '\\exists'], ['∅', '\\emptyset'], ['⊥', '\\perp'], ['∥', '\\parallel'], ['≜', '\\triangleq'], [':=', '\\coloneqq'],
  ] },
  { name: 'Flechas', items: [
    ['→', '\\to'], ['←', '\\leftarrow'], ['↔', '\\leftrightarrow'], ['⇒', '\\Rightarrow'], ['⇐', '\\Leftarrow'], ['⇔', '\\Leftrightarrow'],
    ['↦', '\\mapsto'], ['↑', '\\uparrow'], ['↓', '\\downarrow'], ['⟶', '\\longrightarrow'], ['⟹', '\\Longrightarrow'], ['⇌', '\\rightleftharpoons'],
    ['↗', '\\nearrow'], ['↘', '\\searrow'],
  ] },
  { name: 'Diversos', items: [
    ['∞', '\\infty'], ['ℝ', '\\mathbb{R}'], ['ℕ', '\\mathbb{N}'], ['ℤ', '\\mathbb{Z}'], ['ℚ', '\\mathbb{Q}'], ['ℂ', '\\mathbb{C}'], ['ℒ', '\\mathcal{L}'],
    ['ℱ', '\\mathcal{F}'], ['ℏ', '\\hbar'], ['ℓ', '\\ell'], ['∠', '\\angle'], ['°', '^\\circ'], ['′', "'"], ['…', '\\ldots'], ['⋯', '\\cdots'],
    ['⋮', '\\vdots'], ['⋱', '\\ddots'], ['ℜ', '\\Re'], ['ℑ', '\\Im'], ['†', '^\\dagger'], ['x̂', '\\hat{${}}'], ['x̄', '\\bar{${}}'],
    ['x⃗', '\\vec{${}}'], ['ẋ', '\\dot{${}}'],
  ] },
  { name: 'Delimitadores', items: [
    ['( )', '\\left( ${sel} \\right)'], ['[ ]', '\\left[ ${sel} \\right]'], ['{ }', '\\left\\{ ${sel} \\right\\}'], ['| |', '\\left| ${sel} \\right|'],
    ['‖ ‖', '\\left\\| ${sel} \\right\\|'], ['⟨ ⟩', '\\left\\langle ${sel} \\right\\rangle'], ['⌊ ⌋', '\\left\\lfloor ${sel} \\right\\rfloor'],
    ['⌈ ⌉', '\\left\\lceil ${sel} \\right\\rceil'],
  ] },
];

// Teclas de la barra rápida sobre el teclado del teléfono.
export const KEYBAR = [
  ['\\', '\\'], ['{ }', '{${sel}}'], ['$ $', '$${sel}$'], ['^', '^{${}}'], ['_', '_{${}}'], ['&', '&'], ['\\\\', '\\\\\n'],
  ['[ ]', '[${sel}]'], ['( )', '(${sel})'], ['%', '% '], ['a/b', '\\frac{${}}{${}}'], ['√', '\\sqrt{${sel}}'], ['~', '~'], ['#', '#'],
];

export const ENGINES = [
  ['pdflatex', 'pdfLaTeX'],
  ['xelatex', 'XeLaTeX'],
  ['lualatex', 'LuaLaTeX'],
];
