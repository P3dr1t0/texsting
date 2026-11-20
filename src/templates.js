// Plantillas para proyectos nuevos.
// Cada plantilla con «build» se personaliza en una ventana (datos básicos y, si se quiere, formato avanzado)
// y arma sus archivos con esas opciones. Las de «BLANKS» solo piden el nombre.

// ───────── Opciones ─────────
export const OPC_DEF = {
  titulo: '', autor: '', universidad: '', facultad: '', curso: '', docente: '', grado: '',
  correo: '', telefono: '', ciudad: '', destinatario: '',
  idioma: 'es', papel: 'a4', letra: '11', margen: 'normal', fuente: 'lm', interlineado: '1',
  acento: 'azul', cabecera: false, biblio: false, ecSeccion: false, tema: 'Madrid', proporcion: '169',
};

/** Campos de la ventana de personalización: etiqueta, tipo y opciones. */
export const CAMPOS = {
  titulo: { label: 'Título', tipo: 'text' },
  autor: { label: 'Autor(es)', tipo: 'area', hint: 'Uno por línea. Puedes poner tu código al lado.' },
  universidad: { label: 'Universidad', tipo: 'text' },
  facultad: { label: 'Facultad o escuela', tipo: 'text' },
  curso: { label: 'Curso', tipo: 'text' },
  docente: { label: 'Docente', tipo: 'text' },
  grado: { label: 'Título profesional al que optas', tipo: 'text', placeholder: 'Ingeniero Electrónico' },
  correo: { label: 'Correo', tipo: 'text' },
  telefono: { label: 'Teléfono', tipo: 'text' },
  ciudad: { label: 'Ciudad', tipo: 'text', placeholder: 'Lima' },
  destinatario: { label: 'Destinatario', tipo: 'area', hint: 'Nombre y cargo, uno por línea.' },
  idioma: { label: 'Idioma del documento', tipo: 'select', opciones: [['es', 'Español'], ['en', 'Inglés']],
    hint: 'Cambia las palabras automáticas (Índice, Figura, la fecha) y la separación en sílabas.' },
  papel: { label: 'Papel', tipo: 'select', opciones: [['a4', 'A4'], ['letter', 'Carta']] },
  letra: { label: 'Tamaño de letra', tipo: 'select', opciones: [['10', '10 pt'], ['11', '11 pt'], ['12', '12 pt']] },
  margen: { label: 'Márgenes', tipo: 'select', opciones: [['estrecho', 'Estrechos (1,5 cm)'], ['normal', 'Normales (2,5 cm)'], ['amplio', 'Amplios (3 cm)']] },
  fuente: { label: 'Tipo de letra', tipo: 'select', opciones: [['lm', 'Latin Modern (la clásica de LaTeX)'], ['times', 'Times'], ['palatino', 'Palatino'], ['sans', 'Sin serifa (tipo Helvetica)']] },
  interlineado: { label: 'Interlineado', tipo: 'select', opciones: [['1', 'Sencillo'], ['1.15', '1,15'], ['1.5', '1,5'], ['2', 'Doble']] },
  acento: { label: 'Color de acento', tipo: 'select', opciones: [['ninguno', 'Ninguno (todo en negro)'], ['azul', 'Azul'], ['rojo', 'Rojo'], ['verde', 'Verde'], ['morado', 'Morado'], ['naranja', 'Naranja']],
    hint: 'Para los títulos, los enlaces y los recuadros.' },
  cabecera: { label: 'Encabezado y pie de página', tipo: 'check', hint: 'Curso y autor arriba, número de página abajo.' },
  biblio: { label: 'Bibliografía', tipo: 'check', hint: 'Agrega referencias.bib con un ejemplo.' },
  ecSeccion: { label: 'Numerar ecuaciones por sección', tipo: 'check', hint: '(2.1), (2.2)… en lugar de (1), (2)…' },
  tema: { label: 'Tema', tipo: 'select', opciones: [['Madrid', 'Madrid'], ['Boadilla', 'Boadilla (sencillo)'], ['CambridgeUS', 'CambridgeUS'], ['Copenhagen', 'Copenhagen'], ['default', 'Minimalista']] },
  proporcion: { label: 'Proporción', tipo: 'select', opciones: [['169', '16:9 (pantallas actuales)'], ['43', '4:3 (proyectores antiguos)']] },
};

/** Datos que se recuerdan para la próxima plantilla (no el título). */
export const RECORDAR = ['autor', 'universidad', 'facultad', 'curso', 'docente', 'grado', 'correo', 'telefono', 'ciudad'];

const FORMATO = ['idioma', 'papel', 'letra', 'margen', 'fuente', 'interlineado', 'acento', 'cabecera', 'biblio', 'ecSeccion'];
const CARATULA = ['titulo', 'autor', 'universidad', 'facultad', 'curso', 'docente'];

// ───────── Ayudas para armar el LaTeX ─────────
const ESC = { '\\': '\\textbackslash{}', '&': '\\&', '%': '\\%', $: '\\$', '#': '\\#', _: '\\_', '{': '\\{', '}': '\\}', '~': '\\textasciitilde{}', '^': '\\textasciicircum{}' };
/** Texto del usuario listo para LaTeX (sin caracteres especiales sueltos). */
export const tex = (s) => String(s ?? '').trim().replace(/[\\&%$#_{}~^]/g, (c) => ESC[c]);
const lineas = (s) => String(s ?? '').split('\n').map((x) => x.trim()).filter(Boolean).map(tex);
const o_ = (o, k, def) => tex(o[k]) || def;
const o_MAY = (o, k, def) => tex(String(o[k] ?? '').toUpperCase()) || def.toUpperCase();
const autores = (o, def = 'Tu nombre') => { const l = lineas(o.autor); return l.length ? l : [def]; };

const COLORES = { azul: '1F4E9C', rojo: 'B22222', verde: '1B7F3B', morado: '6A3D9A', naranja: 'C8650A', ninguno: '333333' };
const MARGEN = { estrecho: '1.5cm', normal: '2.5cm', amplio: '3cm' };
const BABEL = { es: 'spanish,es-tabla,es-noshorthands', en: 'english' };
const FUENTE = {
  lm: '\\usepackage{lmodern}',
  times: '\\usepackage{mathptmx}\n\\usepackage{tgtermes}',
  palatino: '\\usepackage{mathpazo}\n\\usepackage{tgpagella}',
  sans: '\\usepackage{lmodern}\n\\usepackage{tgheros}\n\\renewcommand{\\familydefault}{\\sfdefault}',
};
const fechaTxt = (o) => (o.idioma === 'en' ? '\\today' : '\\today');

/**
 * Preámbulo común: clase, codificación, idioma, letra, márgenes, matemáticas, interlineado, color,
 * encabezado y enlaces (hyperref siempre al final). «extra»: paquetes propios de la plantilla.
 */
function preambulo(o, { clase = 'article', opClase = '', extra = '', capitulos = false, sinMargen = false, sinHyperref = false } = {}) {
  const l = [];
  l.push(`\\documentclass[${o.letra}pt,${o.papel}paper${opClase}]{${clase}}`);
  l.push('\\usepackage[utf8]{inputenc}', '\\usepackage[T1]{fontenc}', `\\usepackage[${BABEL[o.idioma] || BABEL.es}]{babel}`);
  l.push(FUENTE[o.fuente] || FUENTE.lm);
  if (!sinMargen) l.push(`\\usepackage[margin=${MARGEN[o.margen] || MARGEN.normal}]{geometry}`);
  l.push('\\usepackage{amsmath,amssymb}', '\\usepackage{graphicx}', '\\usepackage{xcolor}');
  l.push(`\\definecolor{acento}{HTML}{${COLORES[o.acento] || COLORES.ninguno}}`);
  if (extra) l.push(extra.trim());
  if (o.interlineado !== '1') {
    l.push('\\usepackage{setspace}');
    l.push(o.interlineado === '1.5' ? '\\onehalfspacing' : o.interlineado === '2' ? '\\doublespacing' : `\\setstretch{${o.interlineado}}`);
  }
  if (o.ecSeccion) l.push(capitulos ? '\\numberwithin{equation}{chapter}' : '\\numberwithin{equation}{section}');
  if (o.acento !== 'ninguno') {
    l.push('% Títulos en el color de acento');
    l.push('\\usepackage{titlesec}');
    if (capitulos) l.push('\\titleformat{\\chapter}[display]{\\normalfont\\huge\\bfseries\\color{acento}}{\\chaptertitlename\\ \\thechapter}{20pt}{\\Huge}');
    l.push('\\titleformat*{\\section}{\\normalfont\\Large\\bfseries\\color{acento}}');
    l.push('\\titleformat*{\\subsection}{\\normalfont\\large\\bfseries\\color{acento}}');
  }
  if (o.cabecera) {
    const izq = tex(o.curso) || tex(o.titulo) || '';
    l.push('% Encabezado y pie de página');
    l.push('\\usepackage{fancyhdr}', '\\pagestyle{fancy}', '\\fancyhf{}', '\\setlength{\\headheight}{15pt}');
    l.push(`\\fancyhead[L]{\\small ${izq}}`, `\\fancyhead[R]{\\small ${autores(o)[0]}}`, '\\fancyfoot[C]{\\thepage}');
  }
  if (!sinHyperref) {
    l.push(o.acento === 'ninguno' ? '\\usepackage[hidelinks]{hyperref}'
      : '\\usepackage[colorlinks=true,linkcolor=acento,citecolor=acento,urlcolor=acento]{hyperref}');
  }
  return l.join('\n');
}

const BIB = String.raw`@book{ejemplo,
  author    = {Apellido, Nombre},
  title     = {Título del libro},
  publisher = {Editorial},
  year      = {2024}
}

@article{ejemplo2,
  author  = {Apellido, Nombre and Otro, Autor},
  title   = {Título del artículo},
  journal = {Nombre de la revista},
  volume  = {10},
  number  = {2},
  pages   = {1--10},
  year    = {2023}
}
`;
const bibFin = (o, estilo = 'plain') => (o.biblio ? String.raw`
% Referencias: edita referencias.bib y cita con \cite{clave}.
% \nocite{*} muestra todas las del archivo aunque no las cites.
\nocite{*}
\bibliographystyle{${estilo}}
\bibliography{referencias}
` : '');
const bibArchivo = (o) => (o.biblio ? [{ path: 'referencias.bib', text: BIB }] : []);

const FIGURA = (etiqueta = 'fig:resultado', texto = 'Descripción de la figura') => String.raw`\begin{figure}[htbp]
  \centering
  % Para usar tu imagen: súbela en Archivos y cambia el recuadro por
  % \includegraphics[width=0.6\linewidth]{nombre-de-tu-imagen}
  \fbox{\parbox[c][4cm][c]{0.6\linewidth}{\centering Tu figura aquí}}
  \caption{${texto}}
  \label{${etiqueta}}
\end{figure}`;

/** Carátula universitaria (informe, tarea, circuitos, monografía). */
function caratula(o, tipo) {
  const a = autores(o);
  const filas = [
    `    Curso: & ${o_(o, 'curso', 'Nombre del curso')} \\\\`,
    `    Docente: & ${o_(o, 'docente', 'Nombre del docente')} \\\\`,
    `    ${a.length > 1 ? 'Integrantes' : 'Alumno'}: & ${a[0]} \\\\`,
    ...a.slice(1).map((x) => `    & ${x} \\\\`),
  ];
  return String.raw`\begin{titlepage}
  \centering
  % Logo: súbelo en Archivos y quita el % de la línea de abajo.
  % \includegraphics[width=3cm]{logo}\par\vspace{0.5cm}
  {\Large\textbf{${o_(o, 'universidad', 'Universidad')}}\par}
  \vspace{0.3cm}
  {\large ${o_(o, 'facultad', 'Facultad')}\par}
  \vspace{2.5cm}
  {\LARGE\textbf{${tipo}}\par}
  \vspace{0.6cm}
  {\Large ${o_(o, 'titulo', 'Título del trabajo')}\par}
  \vfill
  \begin{tabular}{rl}
${filas.join('\n')}
  \end{tabular}
  \vfill
  {\large ${o_(o, 'ciudad', 'Lima')}, ${fechaTxt(o)}\par}
\end{titlepage}
`;
}

// ───────── Plantillas ─────────
export const TEMPLATES = [
  // ─── Universidad ───
  {
    id: 'informe', grupo: 'Universidad',
    name: 'Informe de laboratorio',
    desc: 'Carátula, índice, procedimiento, resultados y bibliografía',
    shape: 'page', mark: 'Lab',
    basicos: CARATULA, avanzados: FORMATO,
    def: { titulo: 'Título de la experiencia', biblio: true },
    build: (o) => [
      { path: 'main.tex', text: `${preambulo(o, { extra: '\\usepackage{booktabs}\n\\usepackage{float}' })}

\\begin{document}
\\input{caratula}

\\tableofcontents
\\newpage
${String.raw`
\section{Objetivos}
\begin{itemize}
  \item Objetivo general.
  \item Objetivo específico.
\end{itemize}

\section{Fundamento teórico}
Describe aquí la teoría necesaria. Por ejemplo, una ecuación numerada:
\begin{equation}
  y = m x + b
  \label{eq:recta}
\end{equation}
que luego puedes citar como la ecuación~\eqref{eq:recta}.

\section{Materiales y equipos}
\begin{itemize}
  \item Material 1.
  \item Equipo 1.
\end{itemize}

\section{Procedimiento}
\begin{enumerate}
  \item Primer paso.
  \item Segundo paso.
\end{enumerate}

\section{Resultados}
\begin{table}[H]
  \centering
  \caption{Datos obtenidos}
  \label{tab:datos}
  \begin{tabular}{ccc}
    \toprule
    Medida & Valor 1 & Valor 2 \\
    \midrule
    1 & 0.00 & 0.00 \\
    2 & 0.00 & 0.00 \\
    \bottomrule
  \end{tabular}
\end{table}

`}${FIGURA()}
${String.raw`
\section{Análisis de resultados}
Comenta los resultados de la tabla~\ref{tab:datos} y la figura~\ref{fig:resultado}.

\section{Conclusiones}
% TODO: conclusiones
`}${bibFin(o)}
\\end{document}
` },
      { path: 'caratula.tex', text: caratula(o, 'Informe de Laboratorio N.\\textsuperscript{o} 1') },
      ...bibArchivo(o),
    ],
  },
  {
    id: 'circuitos', grupo: 'Universidad',
    name: 'Informe de circuitos',
    desc: 'Circuito con circuitikz, tabla con unidades y diagrama de Bode',
    shape: 'page', mark: 'Ω',
    basicos: CARATULA, avanzados: FORMATO,
    def: { titulo: 'Respuesta en frecuencia de un circuito RC' },
    build: (o) => [
      { path: 'main.tex', text: `${preambulo(o, { extra: String.raw`\usepackage{booktabs}
\usepackage{float}
\usepackage{siunitx}
\usepackage{circuitikz}
\usepackage{pgfplots}
\pgfplotsset{compat=1.18}` })}

\\begin{document}
\\input{caratula}

\\tableofcontents
\\newpage
${String.raw`
\section{Objetivos}
\begin{itemize}
  \item Medir la respuesta en frecuencia de un filtro RC pasabajos.
  \item Comparar la frecuencia de corte medida con la teórica.
\end{itemize}

\section{Fundamento teórico}
El circuito de la figura~\ref{fig:rc} es un filtro pasabajos de primer orden.
Su función de transferencia y su frecuencia de corte son
\begin{equation}
  H(j\omega) = \frac{V_C}{V_s} = \frac{1}{1 + j\omega RC},
  \qquad f_c = \frac{1}{2\pi RC}.
  \label{eq:fc}
\end{equation}
Con $R = \qty{1}{\kilo\ohm}$ y $C = \qty{100}{\nano\farad}$ resulta $f_c \approx \qty{1.59}{\kilo\hertz}$.

\begin{figure}[H]
  \centering
  \begin{circuitikz}
    \draw (0,0) to[V, l=$V_s$] (0,3)
          to[R, l=$R$] (3,3)
          to[C, l=$C$, v^=$V_C$] (3,0) -- (0,0);
  \end{circuitikz}
  \caption{Filtro RC pasabajos}
  \label{fig:rc}
\end{figure}

\section{Materiales y equipos}
\begin{itemize}
  \item Generador de funciones y osciloscopio.
  \item Resistencia de \qty{1}{\kilo\ohm} y condensador de \qty{100}{\nano\farad}.
\end{itemize}

\section{Resultados}
\begin{table}[H]
  \centering
  \caption{Mediciones con $V_s = \qty{5}{\volt}$ de amplitud}
  \label{tab:mediciones}
  \begin{tabular}{S[table-format=5.0] S[table-format=1.2] S[table-format=-2.1]}
    \toprule
    {$f$ (\unit{\hertz})} & {$V_C$ (\unit{\volt})} & {Ganancia (\unit{\decibel})} \\
    \midrule
    100   & 4.99 & -0.1 \\
    1000  & 4.22 & -1.5 \\
    1592  & 3.54 & -3.0 \\
    10000 & 0.78 & -16.1 \\
    \bottomrule
  \end{tabular}
\end{table}

\begin{figure}[H]
  \centering
  \begin{tikzpicture}
    \begin{semilogxaxis}[
        width=0.85\linewidth, height=6cm, grid=both,
        xlabel={Frecuencia (\unit{\hertz})}, ylabel={Ganancia (\unit{\decibel})},
        xmin=10, xmax=100000, ymin=-40, ymax=5]
      \addplot[thick, color=acento, domain=10:100000, samples=120] {-10*log10(1 + (x/1592)^2)};
      \addplot[only marks, mark=*] coordinates {(100,-0.1) (1000,-1.5) (1592,-3.0) (10000,-16.1)};
    \end{semilogxaxis}
  \end{tikzpicture}
  \caption{Diagrama de Bode (magnitud): curva teórica y puntos medidos}
  \label{fig:bode}
\end{figure}

\section{Análisis de resultados}
En la tabla~\ref{tab:mediciones} la ganancia cae \qty{3}{\decibel} cerca de la frecuencia de
corte calculada con la ecuación~\eqref{eq:fc}, como muestra la figura~\ref{fig:bode}.

\section{Conclusiones}
% TODO: conclusiones
`}${bibFin(o)}
\\end{document}
` },
      { path: 'caratula.tex', text: caratula(o, 'Informe de Laboratorio N.\\textsuperscript{o} 1') },
      ...bibArchivo(o),
    ],
  },
  {
    id: 'tarea', grupo: 'Universidad',
    name: 'Tarea con carátula',
    desc: 'Trabajo individual o en grupo con carátula y preguntas',
    shape: 'page', mark: 'T',
    basicos: CARATULA, avanzados: FORMATO,
    def: { titulo: 'Tarea N.° 1' },
    build: (o) => [
      { path: 'main.tex', text: `${preambulo(o, { extra: '\\usepackage{enumitem}' })}

\\begin{document}
\\input{caratula}
${String.raw`
\section*{Pregunta 1}
Copia aquí el enunciado.

\paragraph{Solución.}
Desarrolla tu respuesta. Por ejemplo:
\[
  \int_0^1 x^2\,dx = \left.\frac{x^3}{3}\right|_0^1 = \frac{1}{3}.
\]

\section*{Pregunta 2}
\begin{enumerate}[label=\alph*)]
  \item Primera parte.
  \item Segunda parte.
\end{enumerate}

\paragraph{Solución.}
% TODO
`}${bibFin(o)}
\\end{document}
` },
      { path: 'caratula.tex', text: caratula(o, o_(o, 'titulo', 'Tarea N.° 1')).replace(/\n {2}\\vspace\{0\.6cm\}\n {2}\{\\Large [^\n]*\\par\}/, '') },
      ...bibArchivo(o),
    ],
  },
  {
    id: 'ejercicios', grupo: 'Universidad',
    name: 'Práctica / ejercicios',
    desc: 'Problemas numerados con su solución',
    shape: 'page', mark: 'Σ',
    basicos: ['titulo', 'curso', 'autor'], avanzados: FORMATO.filter((k) => k !== 'biblio'),
    def: { titulo: 'Práctica dirigida N.° 1', margen: 'estrecho' },
    build: (o) => [{ path: 'main.tex', text: `${preambulo(o, { extra: '\\usepackage{enumitem}' })}
${String.raw`
\newcounter{problema}
\newenvironment{problema}{\refstepcounter{problema}\par\medskip\noindent\textbf{\color{acento}Problema \theproblema.}\ }{\par}
\newenvironment{solucion}{\par\smallskip\noindent\textit{Solución.}\ }{\hfill$\blacksquare$\par}

\begin{document}
\begin{center}
  {\Large\textbf{`}${o_(o, 'titulo', 'Práctica dirigida N.° 1')}}}\\\\[2pt]
  ${o_(o, 'curso', 'Curso')} --- ${autores(o).join(', ')} --- \\today
\\end{center}
${String.raw`
\begin{problema}
Halle la transformada de Laplace de $f(t) = e^{-at}\,u(t)$.
\end{problema}
\begin{solucion}
\[
  F(s) = \int_0^{\infty} e^{-at} e^{-st}\,dt = \frac{1}{s+a}, \qquad \operatorname{Re}\{s\} > -a.
\]
\end{solucion}

\begin{problema}
% TODO: siguiente problema
\end{problema}

\end{document}
`}` }],
  },
  {
    id: 'apuntes', grupo: 'Universidad',
    name: 'Apuntes de clase',
    desc: 'Cuaderno con cajas de definición, teorema, ejemplo y nota',
    shape: 'page', mark: '¶',
    basicos: ['titulo', 'autor', 'curso'], avanzados: FORMATO.filter((k) => k !== 'biblio'),
    def: { titulo: 'Apuntes de Cálculo', ecSeccion: true },
    build: (o) => [{ path: 'main.tex', text: `${preambulo(o, { extra: String.raw`\usepackage[theorems,skins,breakable]{tcolorbox}
% Cajas de los apuntes (cambia los colores a tu gusto)
\newtcbtheorem[number within=section]{definicion}{Definición}{enhanced, breakable, colback=acento!5, colframe=acento, fonttitle=\bfseries}{def}
\newtcbtheorem[number within=section]{teorema}{Teorema}{enhanced, breakable, colback=acento!10, colframe=acento!70!black, fonttitle=\bfseries}{teo}
\newtcolorbox{ejemplo}{enhanced, breakable, colback=black!3, colframe=black!45, title=Ejemplo, fonttitle=\bfseries}
\newtcolorbox{nota}{enhanced, breakable, colback=yellow!12, colframe=orange!75!black, title=Nota, fonttitle=\bfseries}` })}

\\title{${o_(o, 'titulo', 'Apuntes de clase')}}
\\author{${autores(o).join(' \\and ')}}
\\date{${tex(o.curso) ? tex(o.curso) + ' --- ' : ''}\\today}
${String.raw`
\begin{document}
\maketitle
\tableofcontents

\section{Límites}

\begin{definicion}{Límite de una función}{limite}
Se dice que $\displaystyle\lim_{x\to a} f(x) = L$ si para todo $\varepsilon > 0$ existe $\delta > 0$ tal que
$0 < |x - a| < \delta \implies |f(x) - L| < \varepsilon$.
\end{definicion}

\begin{teorema}{Límite notable}{seno}
\[
  \lim_{x\to 0} \frac{\sin x}{x} = 1.
\]
\end{teorema}

\begin{ejemplo}
Por el teorema~\ref{teo:seno},
$\displaystyle\lim_{x\to 0} \frac{\sin 3x}{x} = 3 \lim_{x\to 0} \frac{\sin 3x}{3x} = 3$.
\end{ejemplo}

\begin{nota}
Las cajas se numeran solas por sección y se pueden citar como la definición~\ref{def:limite}.
\end{nota}

\section{Derivadas}
% TODO: siguiente tema

\end{document}
`}` }],
  },
  {
    id: 'examen', grupo: 'Universidad',
    name: 'Examen / evaluación',
    desc: 'Encabezado con datos del alumno, indicaciones y puntajes',
    shape: 'page', mark: '✓',
    basicos: ['titulo', 'universidad', 'facultad', 'curso', 'docente'], avanzados: ['idioma', 'papel', 'letra', 'margen', 'fuente', 'acento'],
    def: { titulo: 'Examen parcial', margen: 'estrecho' },
    build: (o) => [{ path: 'main.tex', text: `${preambulo(o, { extra: '\\usepackage{enumitem}\n\\usepackage{tabularx}' })}
${String.raw`
% \pregunta{puntos}: título de cada pregunta con su puntaje
\newcounter{pregunta}
\newcommand{\pregunta}[1]{\stepcounter{pregunta}\par\bigskip\noindent
  {\color{acento}\textbf{Pregunta \thepregunta}}\hfill(#1~puntos)\par\nopagebreak\smallskip}
\pagestyle{empty}

\begin{document}
\begin{center}
  {\large\textbf{`}${o_(o, 'universidad', 'Universidad')}}}\\\\
  ${o_(o, 'facultad', 'Facultad')}\\\\[6pt]
  {\\Large\\textbf{${o_(o, 'titulo', 'Examen parcial')}}}\\\\[2pt]
  ${o_(o, 'curso', 'Curso')} --- Docente: ${o_(o, 'docente', 'Nombre del docente')}
\\end{center}
${String.raw`
\noindent
\begin{tabularx}{\linewidth}{@{}lXlp{3.2cm}@{}}
  Apellidos y nombres: & \hrulefill & Código: & \hrulefill \\[8pt]
  Fecha: & \today & Duración: & 110 minutos \\
\end{tabularx}

\medskip
\noindent\textbf{Indicaciones:}
\begin{itemize}[nosep]
  \item Sin copias ni apuntes. Se permite calculadora científica.
  \item Escriba con orden y justifique cada respuesta.
\end{itemize}
\hrule

\pregunta{5}
Resuelva la ecuación $x^2 - 5x + 6 = 0$.
\vspace{4cm}

\pregunta{5}
Calcule $\displaystyle\int_0^{\pi} \sin x \, dx$.
\vspace{4cm}

\pregunta{10}
\begin{enumerate}[label=\alph*)]
  \item Primera parte (4 puntos).
  \item Segunda parte (6 puntos).
\end{enumerate}

\end{document}
`}` }],
  },
  {
    id: 'formulario', grupo: 'Universidad',
    name: 'Hoja de fórmulas',
    desc: 'Formulario en 3 columnas y hoja horizontal, letra pequeña',
    shape: 'slide', mark: 'f(x)',
    basicos: ['titulo'], avanzados: ['idioma', 'papel', 'fuente', 'acento'],
    def: { titulo: 'Formulario de Matemáticas', letra: '10' },
    build: (o) => [{ path: 'main.tex', text: `${preambulo({ ...o, letra: '10', interlineado: '1', cabecera: false, ecSeccion: false }, { sinMargen: true, sinHyperref: true, extra: String.raw`\usepackage[landscape,margin=1cm]{geometry}
\usepackage{multicol}
\setlength{\columnseprule}{0.4pt}
\setlength{\parindent}{0pt}
\pagestyle{empty}` }).replace(/\\usepackage\{titlesec\}[\s\S]*?\\titleformat\*\{\\subsection\}[^\n]*\n?/, '')}
${String.raw`
% Títulos compactos
\newcommand{\tema}[1]{\par\medskip{\color{acento}\large\textbf{#1}}\par\nobreak\smallskip}

\begin{document}
\begin{center}{\Large\textbf{`}${o_(o, 'titulo', 'Formulario')}}}\\end{center}
\\small
${String.raw`\begin{multicols}{3}

\tema{Álgebra}
$(a \pm b)^2 = a^2 \pm 2ab + b^2$\\
$a^2 - b^2 = (a+b)(a-b)$\\
$x = \dfrac{-b \pm \sqrt{b^2 - 4ac}}{2a}$

\tema{Trigonometría}
$\sin^2\theta + \cos^2\theta = 1$\\
$\sin 2\theta = 2 \sin\theta \cos\theta$\\
$\cos 2\theta = \cos^2\theta - \sin^2\theta$\\
$e^{j\theta} = \cos\theta + j \sin\theta$

\tema{Derivadas}
$(uv)' = u'v + uv'$\\
$\left(\dfrac{u}{v}\right)' = \dfrac{u'v - uv'}{v^2}$\\
$\dfrac{d}{dx}\sin x = \cos x$, \quad $\dfrac{d}{dx} e^{x} = e^{x}$

\tema{Integrales}
$\displaystyle\int x^n\,dx = \frac{x^{n+1}}{n+1} + C$\\
$\displaystyle\int \frac{dx}{x} = \ln|x| + C$\\
$\displaystyle\int u\,dv = uv - \int v\,du$

\tema{Transformada de Laplace}
\begin{tabular}{@{}ll@{}}
  $u(t)$ & $1/s$ \\
  $e^{-at}$ & $1/(s+a)$ \\
  $\sin \omega t$ & $\omega/(s^2+\omega^2)$ \\
  $\cos \omega t$ & $s/(s^2+\omega^2)$ \\
\end{tabular}

\tema{Circuitos}
Ley de Ohm: $V = IR$\\
Divisor de tensión: $V_2 = V \dfrac{R_2}{R_1 + R_2}$\\
Potencia: $P = VI = I^2 R = V^2/R$\\
Impedancias: $Z_L = j\omega L$, \quad $Z_C = \dfrac{1}{j\omega C}$

\end{multicols}
\end{document}
`}` }],
  },

  // ─── Documentos ───
  {
    id: 'articulo', grupo: 'Documentos',
    name: 'Artículo / documento',
    desc: 'Texto con secciones, ecuaciones y figuras',
    shape: 'page', mark: 'Aa',
    basicos: ['titulo', 'autor'], avanzados: FORMATO,
    def: { titulo: 'Título del documento', letra: '12', acento: 'ninguno' },
    build: (o) => [
      { path: 'main.tex', text: `${preambulo(o)}

\\title{${o_(o, 'titulo', 'Título del documento')}}
\\author{${autores(o).join(' \\and ')}}
\\date{\\today}
${String.raw`
\begin{document}
\maketitle

\section{Introducción}
Escribe aquí. Una ecuación numerada:
\begin{equation}
  e^{i\pi} + 1 = 0
  \label{eq:euler}
\end{equation}
Como se ve en la ecuación~\eqref{eq:euler}, \dots

`}${FIGURA('fig:ejemplo', 'Una figura')}
${String.raw`
\section{Desarrollo}
% TODO: completar esta sección
`}${bibFin(o)}
\\end{document}
` },
      ...bibArchivo(o),
    ],
  },
  {
    id: 'ieee', grupo: 'Documentos',
    name: 'Artículo IEEE',
    desc: 'Formato de conferencia IEEE a dos columnas',
    shape: 'page', mark: 'IEEE',
    basicos: ['titulo', 'autor', 'universidad', 'correo'], avanzados: ['idioma'],
    def: { titulo: 'Título del artículo' },
    build: (o) => {
      const bloque = (n) => `\\IEEEauthorblockN{${n}}\n\\IEEEauthorblockA{${o_(o, 'universidad', 'Universidad')}\\\\\n${o_(o, 'ciudad', 'Lima')}, ${o.idioma === 'en' ? 'Peru' : 'Perú'}${tex(o.correo) ? '\\\\\n' + tex(o.correo) : ''}}`;
      return [
        { path: 'main.tex', text: `\\documentclass[conference]{IEEEtran}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[${BABEL[o.idioma] || BABEL.es}]{babel}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{cite}

\\begin{document}
\\title{${o_(o, 'titulo', 'Título del artículo')}}
\\author{${autores(o).map(bloque).join('\n\\and\n')}}
\\maketitle
${String.raw`
\begin{abstract}
Resumen del trabajo en 150 a 250 palabras: problema, método, resultados y conclusión.
\end{abstract}

\begin{IEEEkeywords}
palabra clave, otra palabra, tercera palabra
\end{IEEEkeywords}

\section{Introducción}
El texto va a dos columnas. Las referencias se citan así~\cite{ejemplo}.

\section{Método}
\begin{equation}
  P = V I
  \label{eq:potencia}
\end{equation}

\section{Resultados}
Ver la ecuación~\eqref{eq:potencia} y la figura~\ref{fig:ejemplo}.

\begin{figure}[htbp]
  \centering
  \fbox{\parbox[c][3cm][c]{0.8\columnwidth}{\centering Tu figura aquí}}
  \caption{Descripción de la figura}
  \label{fig:ejemplo}
\end{figure}

\section{Conclusiones}
% TODO

\bibliographystyle{IEEEtran}
\bibliography{referencias}
\end{document}
`}` },
        { path: 'referencias.bib', text: BIB },
      ];
    },
  },
  {
    id: 'monografia', grupo: 'Documentos',
    name: 'Monografía / investigación',
    desc: 'Capítulos en archivos separados, resumen, índices y anexos',
    shape: 'book', mark: 'Cap',
    basicos: CARATULA, avanzados: FORMATO,
    def: { titulo: 'Título de la monografía', letra: '12', interlineado: '1.5', biblio: true },
    build: (o) => [
      { path: 'main.tex', text: `${preambulo(o, { clase: 'report', capitulos: true, extra: '\\usepackage{booktabs}' })}

\\begin{document}
\\input{caratula}
${String.raw`\pagenumbering{roman}

\begin{abstract}
Resumen del trabajo en uno o dos párrafos.
\end{abstract}

\tableofcontents
\listoffigures
\listoftables
\clearpage
\pagenumbering{arabic}

\input{capitulos/introduccion}
\input{capitulos/desarrollo}
\input{capitulos/conclusiones}

\appendix
\input{capitulos/anexos}
`}${bibFin(o)}
\\end{document}
` },
      { path: 'caratula.tex', text: caratula(o, 'Monografía') },
      { path: 'capitulos/introduccion.tex', text: String.raw`\chapter{Introducción}
\section{Planteamiento del problema}
% TODO: describir el problema

\section{Objetivos}
\begin{itemize}
  \item Objetivo general.
  \item Objetivos específicos.
\end{itemize}
` },
      { path: 'capitulos/desarrollo.tex', text: `\\chapter{Desarrollo}
\\section{Marco teórico}
Texto del capítulo. Puedes referenciar la figura~\\ref{fig:ejemplo}.

${FIGURA('fig:ejemplo', 'Figura de ejemplo')}

\\begin{table}[htbp]
  \\centering
  \\caption{Tabla de ejemplo}
  \\begin{tabular}{lc}
    \\toprule
    Concepto & Valor \\\\
    \\midrule
    A & 1 \\\\
    B & 2 \\\\
    \\bottomrule
  \\end{tabular}
\\end{table}

\\section{Metodología}
% TODO
` },
      { path: 'capitulos/conclusiones.tex', text: String.raw`\chapter{Conclusiones}
% TODO: conclusiones y recomendaciones
` },
      { path: 'capitulos/anexos.tex', text: String.raw`\chapter{Anexos}
Material complementario.
` },
      ...bibArchivo(o),
    ],
  },
  {
    id: 'tesis', grupo: 'Documentos',
    name: 'Tesis / proyecto de grado',
    desc: 'Portada, dedicatoria, resumen, abstract, capítulos y anexos',
    shape: 'book', mark: 'Tesis',
    basicos: ['titulo', 'autor', 'universidad', 'facultad', 'grado', 'docente', 'ciudad'], avanzados: FORMATO,
    etiquetas: { docente: 'Asesor' },
    def: { titulo: 'Título de la tesis', letra: '12', interlineado: '1.5', margen: 'amplio', biblio: true },
    build: (o) => {
      const a = autores(o);
      return [
        { path: 'main.tex', text: `${preambulo(o, { clase: 'report', capitulos: true, opClase: ',oneside', extra: '\\usepackage{booktabs}' })}

\\begin{document}
\\input{portada}
${String.raw`\pagenumbering{roman}
\input{preliminares}

\tableofcontents
\listoffigures
\listoftables
\clearpage
\pagenumbering{arabic}

\input{capitulos/1-introduccion}
\input{capitulos/2-marco-teorico}
\input{capitulos/3-desarrollo}
\input{capitulos/4-resultados}
\input{capitulos/5-conclusiones}

\appendix
\input{capitulos/anexos}
`}${bibFin(o)}
\\end{document}
` },
        { path: 'portada.tex', text: String.raw`\begin{titlepage}
  \centering
  {\Large\bfseries ${o_MAY(o, 'universidad', 'Universidad')}\par}
  \vspace{0.2cm}
  {\large\bfseries ${o_MAY(o, 'facultad', 'Facultad')}\par}
  \vspace{1cm}
  % Logo: súbelo en Archivos y quita el % de la línea de abajo.
  % \includegraphics[width=3.5cm]{logo}\par
  \vspace{1.5cm}
  {\LARGE\bfseries ${o_(o, 'titulo', 'Título de la tesis')}\par}
  \vspace{1.5cm}
  {\large TESIS\par}
  \vspace{0.2cm}
  {\large Para optar el título profesional de\par}
  \vspace{0.2cm}
  {\large\bfseries ${o_(o, 'grado', 'Ingeniero')}\par}
  \vspace{1.5cm}
  {\large ELABORADO POR\par}
  \vspace{0.2cm}
  ${a.map((x) => `{\\large\\bfseries ${x}\\par}`).join('\n  ')}
  \vspace{1cm}
  {\large ASESOR\par}
  \vspace{0.2cm}
  {\large\bfseries ${o_(o, 'docente', 'Nombre del asesor')}\par}
  \vfill
  {\large ${o_MAY(o, 'ciudad', 'Lima')} -- ${o.idioma === 'en' ? 'PERU' : 'PERÚ'}\par}
  {\large \the\year\par}
\end{titlepage}
` },
        { path: 'preliminares.tex', text: String.raw`\chapter*{Dedicatoria}
\begin{flushright}
  \textit{A mi familia, \dots}
\end{flushright}

\chapter*{Agradecimientos}
Agradezco a \dots

\chapter*{Resumen}
Resumen de la tesis (250 a 300 palabras): problema, objetivo, método, resultados y conclusiones.

\noindent\textbf{Palabras clave:} palabra, otra palabra.

\chapter*{Abstract}
The same summary in English.

\noindent\textbf{Keywords:} word, another word.
` },
        { path: 'capitulos/1-introduccion.tex', text: String.raw`\chapter{Introducción}
\section{Planteamiento del problema}
% TODO
\section{Objetivos}
\subsection{Objetivo general}
% TODO
\subsection{Objetivos específicos}
\begin{itemize}
  \item Objetivo 1.
  \item Objetivo 2.
\end{itemize}
\section{Justificación}
% TODO
` },
        { path: 'capitulos/2-marco-teorico.tex', text: String.raw`\chapter{Marco teórico}
\section{Antecedentes}
% TODO
\section{Bases teóricas}
\begin{equation}
  E = m c^2
  \label{eq:ejemplo}
\end{equation}
` },
        { path: 'capitulos/3-desarrollo.tex', text: `\\chapter{Desarrollo}
\\section{Metodología}
% TODO

${FIGURA('fig:ejemplo', 'Figura de ejemplo')}
` },
        { path: 'capitulos/4-resultados.tex', text: String.raw`\chapter{Resultados}
\begin{table}[htbp]
  \centering
  \caption{Resultados obtenidos}
  \label{tab:resultados}
  \begin{tabular}{lc}
    \toprule
    Prueba & Valor \\
    \midrule
    1 & 0.00 \\
    2 & 0.00 \\
    \bottomrule
  \end{tabular}
\end{table}
` },
        { path: 'capitulos/5-conclusiones.tex', text: String.raw`\chapter{Conclusiones y recomendaciones}
\section{Conclusiones}
% TODO
\section{Recomendaciones}
% TODO
` },
        { path: 'capitulos/anexos.tex', text: String.raw`\chapter{Anexos}
Planos, código, hojas de datos, etc.
` },
        ...bibArchivo(o),
      ];
    },
  },

  // ─── Presentaciones y otros ───
  {
    id: 'beamer', grupo: 'Presentaciones y otros',
    name: 'Presentación',
    desc: 'Diapositivas para exposiciones (Beamer)',
    shape: 'slide', mark: '▶',
    basicos: ['titulo', 'autor', 'universidad'], avanzados: ['idioma', 'tema', 'proporcion', 'acento'],
    etiquetas: { universidad: 'Institución' },
    def: { titulo: 'Título de la exposición', acento: 'ninguno' },
    build: (o) => [{ path: 'main.tex', text: `\\documentclass[aspectratio=${o.proporcion === '43' ? '43' : '169'}]{beamer}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage[${BABEL[o.idioma] || BABEL.es}]{babel}
\\usepackage{lmodern}
\\usetheme{${o.tema || 'Madrid'}}
${o.acento !== 'ninguno' ? `\\definecolor{acento}{HTML}{${COLORES[o.acento]}}\n\\usecolortheme[named=acento]{structure}\n` : ''}
\\title{${o_(o, 'titulo', 'Título de la exposición')}}
\\author[${autores(o)[0]}${autores(o).length > 1 ? (o.idioma === 'en' ? ' et al.' : ' y otros') : ''}]{${autores(o).join(' \\and ')}}
\\institute[]{${o_(o, 'universidad', '')}}
\\date{\\today}
${String.raw`
\begin{document}
\frame{\titlepage}

\begin{frame}{Contenido}
  \tableofcontents
\end{frame}

\section{Introducción}
\begin{frame}{Introducción}
  \begin{itemize}
    \item<1-> Primer punto
    \item<2-> Segundo punto
  \end{itemize}
\end{frame}

\section{Desarrollo}
\begin{frame}{Una ecuación}
  \[
    \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
  \]
\end{frame}

\begin{frame}{Dos columnas}
  \begin{columns}
    \column{0.5\textwidth}
      Texto a la izquierda.
    \column{0.5\textwidth}
      \begin{block}{Importante}
        Un recuadro destacado.
      \end{block}
  \end{columns}
\end{frame}

\begin{frame}
  \centering\Huge ¡Gracias!
\end{frame}
\end{document}
`}` }],
  },
  {
    id: 'cv', grupo: 'Presentaciones y otros',
    name: 'Currículum',
    desc: 'CV de una página: educación, experiencia y habilidades',
    shape: 'page', mark: 'CV',
    basicos: ['autor', 'titulo', 'correo', 'telefono', 'ciudad'], avanzados: ['idioma', 'papel', 'fuente', 'acento'],
    etiquetas: { autor: 'Nombre completo', titulo: 'Perfil o carrera' },
    def: { titulo: 'Estudiante de Ingeniería', margen: 'estrecho', letra: '11' },
    build: (o) => [{ path: 'main.tex', text: `${preambulo({ ...o, margen: 'estrecho', interlineado: '1', cabecera: false, ecSeccion: false }, { extra: '\\usepackage{enumitem}' }).replace(/\\usepackage\{titlesec\}[\s\S]*?\\titleformat\*\{\\subsection\}[^\n]*\n?/, '')}
${String.raw`\usepackage{titlesec}
\titleformat{\section}{\large\bfseries\color{acento}}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{10pt}{6pt}
\setlist{nosep, leftmargin=*}
\setlength{\parindent}{0pt}
\pagestyle{empty}

\begin{document}
\begin{center}
  {\Huge\bfseries `}${autores(o, 'Tu nombre')[0]}}\\\\[4pt]
  {\\large ${o_(o, 'titulo', 'Estudiante')}}\\\\[4pt]
  ${[tex(o.correo) && `\\href{mailto:${tex(o.correo)}}{${tex(o.correo)}}`, tex(o.telefono), tex(o.ciudad)].filter(Boolean).join(' \\quad$\\cdot$\\quad ') || 'correo@ejemplo.com \\quad$\\cdot$\\quad 999 999 999 \\quad$\\cdot$\\quad Lima'}
\\end{center}
${String.raw`
\section{Perfil}
Dos o tres líneas sobre ti: qué estudias, qué te interesa y qué buscas.

\section{Educación}
\textbf{Universidad} \hfill 2021 -- actualidad\\
Ingeniería \dots{} --- tercio superior

\section{Experiencia}
\textbf{Cargo} --- Empresa \hfill 2025
\begin{itemize}
  \item Logro o tarea concreta, con un resultado si es posible.
  \item Otro logro.
\end{itemize}

\section{Proyectos}
\textbf{Nombre del proyecto} --- breve descripción y tecnologías usadas.

\section{Habilidades}
\begin{itemize}
  \item \textbf{Programación:} Python, C, MATLAB.
  \item \textbf{Herramientas:} \LaTeX, Git, Proteus.
\end{itemize}

\section{Idiomas}
Español (nativo) \quad$\cdot$\quad Inglés (intermedio)

\end{document}
`}` }],
  },
  {
    id: 'carta', grupo: 'Presentaciones y otros',
    name: 'Carta / solicitud formal',
    desc: 'Solicitud o carta con lugar, fecha, asunto y firma',
    shape: 'page', mark: '✉',
    basicos: ['autor', 'titulo', 'destinatario', 'ciudad', 'correo'], avanzados: ['idioma', 'papel', 'letra', 'margen', 'fuente'],
    etiquetas: { titulo: 'Asunto', autor: 'Tu nombre (y código si hace falta)' },
    def: { titulo: 'Solicito …', letra: '12', acento: 'ninguno' },
    build: (o) => {
      const dest = lineas(o.destinatario);
      const a = autores(o);
      return [{ path: 'main.tex', text: `${preambulo({ ...o, acento: 'ninguno', cabecera: false, ecSeccion: false, interlineado: '1' }, { sinHyperref: true })}
\\pagestyle{empty}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{8pt}

\\begin{document}
\\begin{flushright}
  ${o_(o, 'ciudad', 'Lima')}, \\today
\\end{flushright}

${(dest.length ? dest : ['Señor(a) Nombre del destinatario', 'Cargo', 'Institución']).join('\\\\\n')}\\\\
\\textit{Presente}.---

\\bigskip
\\textbf{Asunto:} ${o_(o, 'titulo', 'Solicito …')}

\\bigskip
De mi mayor consideración:

Yo, ${a[0]}, me dirijo a usted para saludarlo y solicitarle \\dots

Explica aquí el motivo de la solicitud y los detalles necesarios.

Agradeciendo de antemano su atención, quedo de usted.

Atentamente,

\\vspace{2cm}
\\rule{6cm}{0.4pt}\\\\
${a.join('\\\\\n')}${tex(o.correo) ? '\\\\\n' + tex(o.correo) : ''}
\\end{document}
` }];
    },
  },
  {
    id: 'figura', grupo: 'Presentaciones y otros',
    name: 'Figura TikZ suelta',
    desc: 'Un dibujo recortado a su tamaño, para exportar o usar en otro proyecto',
    shape: 'slide', mark: '◇',
    basicos: [], avanzados: [],
    build: () => [{ path: 'main.tex', text: String.raw`% Una figura sola: el PDF queda recortado al tamaño del dibujo.
% Puedes compartirla como imagen o subirla a otro proyecto e incluirla con \includegraphics.
\documentclass[tikz,border=8pt]{standalone}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usetikzlibrary{arrows.meta}

\begin{document}
\begin{tikzpicture}[>=Stealth, scale=1.2]
  % Ejes
  \draw[->] (-0.3,0) -- (6.6,0) node[right] {$t$};
  \draw[->] (0,-1.4) -- (0,1.6) node[above] {$v(t)$};
  % Señal senoidal
  \draw[thick, blue!70!black, domain=0:6.28, samples=100] plot (\x, {sin(\x r)});
  % Amortiguada
  \draw[thick, red!70!black, dashed, domain=0:6.28, samples=100] plot (\x, {exp(-0.3*\x)*sin(2*\x r)});
  \node[blue!70!black] at (1.6,1.25) {$\sin t$};
  \node[red!70!black] at (4.6,0.75) {$e^{-0.3t}\sin 2t$};
\end{tikzpicture}
\end{document}
` }],
  },
];

export const BLANKS = [
  {
    id: 'blanco',
    name: 'Documento en blanco',
    desc: 'Solo lo mínimo para empezar a escribir',
    shape: 'page', mark: '',
    files: [{ path: 'main.tex', text: String.raw`\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish]{babel}
\usepackage{amsmath,amssymb}

\begin{document}
Escribe aquí.
\end{document}
` }],
  },
  {
    id: 'blanco-presentacion',
    name: 'Presentación en blanco',
    desc: 'Beamer sin contenido',
    shape: 'slide', mark: '',
    files: [{ path: 'main.tex', text: String.raw`\documentclass{beamer}
\usepackage[utf8]{inputenc}
\usepackage[spanish]{babel}

\begin{document}
\begin{frame}{Título}
  Contenido
\end{frame}
\end{document}
` }],
  },
];

/** Opciones de partida de una plantilla: las generales, las suyas y los datos recordados. */
export function opcionesIniciales(t, recordados = {}) {
  const o = { ...OPC_DEF, ...(t.def || {}) };
  for (const k of RECORDAR) if (recordados[k] && (t.basicos || []).includes(k)) o[k] = recordados[k];
  return o;
}
