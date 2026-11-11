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
    desc: 'Carátula, índice, secciones típicas, tabla, figura y bibliografía',
    files: [
      { path: 'main.tex', text: String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[spanish,es-tabla]{babel}
\usepackage[margin=2.5cm]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{float}
\usepackage{hyperref}

\begin{document}
\input{caratula}

\tableofcontents
\newpage

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

\begin{figure}[H]
  \centering
  % Sube tu imagen en Archivos y cambia "example-image" por su nombre.
  \includegraphics[width=0.6\linewidth]{example-image}
  \caption{Descripción de la figura}
  \label{fig:resultado}
\end{figure}

\section{Análisis de resultados}
Comenta los resultados de la tabla~\ref{tab:datos} y la figura~\ref{fig:resultado}.

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
      { path: 'referencias.bib', text: String.raw`@book{ejemplo,
  author    = {Apellido, Nombre},
  title     = {Título del libro},
  publisher = {Editorial},
  year      = {2024}
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
