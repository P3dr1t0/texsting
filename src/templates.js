// Plantillas para proyectos nuevos.
export const TEMPLATES = [
  {
    id: 'articulo',
    name: 'Documento básico',
    desc: 'Artículo en español con matemática y figuras',
    files: [{ path: 'main.tex', text: String.raw`\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish,es-tabla]{babel}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[margin=2.5cm]{geometry}
\usepackage{hyperref}

\title{Título del documento}
\author{Tu nombre}
\date{\today}

\begin{document}
\maketitle

\section{Introducción}
Escribe aquí. Una ecuación numerada:
\begin{equation}
  e^{i\pi} + 1 = 0
  \label{eq:euler}
\end{equation}
Como se ve en la ecuación~\eqref{eq:euler}, \dots

\section{Desarrollo}
% TODO: completar esta sección

\end{document}
` }],
  },
  {
    id: 'informe',
    name: 'Informe de laboratorio',
    desc: 'Carátula, circuitikz, siunitx, tablas y bibliografía',
    files: [
      { path: 'main.tex', text: String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish,es-tabla]{babel}
\usepackage[margin=2.5cm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{siunitx}
\sisetup{output-decimal-marker={.}}
\usepackage[european,siunitx]{circuitikz}
\usepackage{float}
\usepackage{hyperref}

\begin{document}
\input{caratula}

\tableofcontents
\newpage

\section{Objetivos}
\begin{itemize}
  \item Objetivo 1.
  \item Objetivo 2.
\end{itemize}

\section{Marco teórico}
Ley de Ohm: $V = I R$. Para el divisor de tensión de la figura~\ref{fig:divisor}:
\begin{equation}
  V_{o} = V_{s}\,\frac{R_2}{R_1 + R_2}
  \label{eq:divisor}
\end{equation}

\begin{figure}[H]
  \centering
  \begin{circuitikz}
    \draw (0,0) to[V, l=$V_s$] (0,3)
          to[R, l=$R_1$] (3,3)
          to[R, l=$R_2$, v^>=$V_o$] (3,0) -- (0,0);
  \end{circuitikz}
  \caption{Divisor de tensión}
  \label{fig:divisor}
\end{figure}

\section{Resultados}
\begin{table}[H]
  \centering
  \caption{Mediciones}
  \label{tab:mediciones}
  \begin{tabular}{ccc}
    \toprule
    $R$ (\si{\ohm}) & $V$ (\si{\volt}) & $I$ (\si{\milli\ampere}) \\
    \midrule
    1000 & 5.0 & 5.0 \\
    2200 & 5.0 & 2.3 \\
    \bottomrule
  \end{tabular}
\end{table}

\section{Conclusiones}
% TODO: conclusiones

\bibliographystyle{plain}
\bibliography{referencias}
\nocite{*}
\end{document}
` },
      { path: 'caratula.tex', text: String.raw`\begin{titlepage}
  \centering
  {\Large\textbf{Universidad}\par}
  \vspace{0.5cm}
  {\large Facultad\par}
  \vspace{2cm}
  {\LARGE\textbf{Informe de Laboratorio N.\textsuperscript{o} 1}\par}
  \vspace{0.5cm}
  {\Large Título de la experiencia\par}
  \vfill
  \begin{tabular}{rl}
    Curso: & Nombre del curso \\
    Alumno: & Tu nombre \\
    Código: & 20XXXXXXX \\
    Profesor: & Nombre del profesor \\
  \end{tabular}
  \vfill
  {\large \today\par}
\end{titlepage}
` },
      { path: 'referencias.bib', text: String.raw`@book{alexander,
  author    = {Charles K. Alexander and Matthew N. O. Sadiku},
  title     = {Fundamentos de circuitos eléctricos},
  publisher = {McGraw-Hill},
  year      = {2013},
  edition   = {5}
}
` },
    ],
  },
  {
    id: 'ejercicios',
    name: 'Hoja de ejercicios',
    desc: 'Problemas y soluciones con enumeración',
    files: [{ path: 'main.tex', text: String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish]{babel}
\usepackage[margin=2cm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{enumitem}

\newcounter{problema}
\newenvironment{problema}{\refstepcounter{problema}\par\medskip\noindent\textbf{Problema \theproblema.}\ }{\par}
\newenvironment{solucion}{\par\smallskip\noindent\textit{Solución.}\ }{\hfill$\blacksquare$\par}

\begin{document}
\begin{center}
  {\Large\textbf{Práctica dirigida N.\textsuperscript{o} 1}}\\[2pt]
  Curso --- \today
\end{center}

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
` }],
  },
  {
    id: 'beamer',
    name: 'Presentación (Beamer)',
    desc: 'Diapositivas para exposiciones',
    files: [{ path: 'main.tex', text: String.raw`\documentclass{beamer}
\usepackage[utf8]{inputenc}
\usepackage[spanish]{babel}
\usetheme{Madrid}

\title{Título de la exposición}
\author{Tu nombre}
\date{\today}

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

\begin{frame}{Una ecuación}
  \[
    \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
  \]
\end{frame}
\end{document}
` }],
  },
  {
    id: 'vacio',
    name: 'Vacío',
    desc: 'Solo lo mínimo',
    files: [{ path: 'main.tex', text: String.raw`\documentclass{article}
\begin{document}
Escribe aquí.
\end{document}
` }],
  },
];
