// Motor integrado (experimental, #1): pdfLaTeX dentro del APK, sin Termux.
// Lo hace el complemento nativo «Motor» (scripts/patch-android.mjs → MotorPlugin.java).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { bytesToBase64, base64ToBytes } from './util.js';

const Motor = registerPlugin('Motor');

/** { binario, datos, listo, version } o null si este APK/navegador no lo trae. */
export async function motorEstado() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const s = await Motor.estado();
    return s && s.binario && s.datos ? s : null;
  } catch {
    return null;
  }
}

export function motorPreparar() {
  return Motor.preparar();
}

export async function motorCompilar(project, files) {
  const data = await Motor.compilar({
    project: project.id,
    main: project.main,
    files: files.map((f) => (f.kind === 'binary' ? { path: f.path, base64: bytesToBase64(f.data) } : { path: f.path, text: f.text })),
  });
  return {
    ...data,
    elapsed: Math.round((data.elapsed || 0) * 10) / 10,
    pdf: data.pdf ? base64ToBytes(data.pdf) : null,
    synctex: data.synctex ? base64ToBytes(data.synctex) : null,
  };
}

/** Documento para «Probar motor integrado» en Ajustes. */
export const MOTOR_PRUEBA = String.raw`\documentclass{article}
\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage[spanish]{babel}
\usepackage{amsmath,amssymb,graphicx,xcolor,booktabs,siunitx,hyperref}
\begin{document}
\section{Prueba del motor integrado}\label{s}
¡Hola desde TeXsting sin Termux! Canción, pingüino, ñandú.
\begin{equation}\label{e} \tau = RC = \SI{1}{\milli\second}, \qquad \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt\pi}{2} \end{equation}
Ver la ecuación~\eqref{e} de la sección~\ref{s}. {\color{blue}Color} y una tabla:
\begin{center}\begin{tabular}{lr}\toprule Medida & Valor\\\midrule $V$ & \SI{5.0}{\volt}\\\bottomrule\end{tabular}\end{center}
\end{document}
`;
