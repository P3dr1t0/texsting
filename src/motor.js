// Motor integrado (#1): pdfLaTeX, XeLaTeX y LuaLaTeX dentro del APK, sin Termux.
// Lo hace el complemento nativo «Motor» (scripts/patch-android.mjs → MotorPlugin.java).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { bytesToBase64, base64ToBytes } from './util.js';

// Las pruebas automáticas pueden poner un motor falso en window.__motorPrueba.
const Motor = (typeof window !== 'undefined' && window.__motorPrueba) || registerPlugin('Motor');

/** { binario, datos, listo, version, motores: ['pdflatex', 'lualatex'] } o null si este APK/navegador no lo trae. */
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

let calentando = null;
/**
 * Prepara el motor en segundo plano apenas abre la app (tras instalar o actualizar: descomprimir TeX y
 * armar el formato). Así la primera compilación no carga con esos segundos. Devuelve siempre la misma promesa.
 */
export function motorCalentar() {
  if (!calentando) {
    calentando = (async () => {
      const st = await motorEstado();
      if (!st) return null;
      // «todos»: después de pdfLaTeX, en segundo plano, también XeLaTeX y LuaLaTeX.
      await Motor.preparar({ todos: true });
      if (st.listo) return st;
      return { ...st, listo: true };
    })().catch((e) => { calentando = null; throw e; });
  }
  return calentando;
}

/** Avisos mientras compila (p. ej. «Descargando el paquete…»). Devuelve una función para dejar de escuchar. */
export async function motorAlProgresar(cb) {
  try {
    const h = await Motor.addListener('progreso', (e) => cb(e && e.texto));
    return () => { try { h.remove(); } catch { /* nada */ } };
  } catch {
    return () => {};
  }
}

/** Pasos de la compilación («Pasada 2», «Armando el PDF») para la barra de progreso. Devuelve cómo dejar de escuchar. */
export async function motorAlPaso(cb) {
  try {
    const h = await Motor.addListener('paso', (e) => cb(e && e.texto));
    return () => { try { h.remove(); } catch { /* nada */ } };
  } catch {
    return () => {};
  }
}

/** Trabajo en segundo plano: cb({ activo, texto }) al empezar y al terminar. Devuelve cómo dejar de escuchar. */
export async function motorAlFondo(cb) {
  try {
    const h = await Motor.addListener('fondoEstado', (e) => cb(e || {}));
    return () => { try { h.remove(); } catch { /* nada */ } };
  } catch {
    return () => {};
  }
}

/** Avisos de lo que termina en segundo plano (figuras o preámbulo guardados). */
export async function motorAlTerminarFondo(cb) {
  try {
    await Motor.addListener('fondo', (e) => cb(e && e.texto));
  } catch { /* sin motor integrado */ }
}

export async function motorCompilar(project, files, { autoinstall = true, engine = 'pdflatex' } = {}) {
  const data = await Motor.compilar({
    project: project.id,
    main: project.main,
    autoinstall,
    engine,
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

/** Documento para probar XeLaTeX y LuaLaTeX (fuentes OpenType con fontspec y matemática Unicode). */
export const MOTOR_PRUEBA_LUA = String.raw`\documentclass{article}
\usepackage{fontspec}
\usepackage[spanish]{babel}
\usepackage{amsmath}
\usepackage{unicode-math}
\begin{document}
\section{Prueba de LuaLaTeX}
¡Hola desde TeXsting! Canción, pingüino, ñandú — «comillas» € ½ ≤ ≥ → ∞.
\[ \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{π}}{2}, \qquad α + β = γ \]
\textbf{Negrita}, \textit{cursiva} y \texttt{monoespaciada}.
\end{document}
`;

// ───────── «Usar sin internet»: paquetes básicos o avanzados descargados de una vez ─────────
/** { basicos: {total, listos, descarga, instalado}, avanzados: {...}, ocupado, paquetes, descargando } o null. */
export async function motorSinInternet() {
  try { return await Motor.sinInternet(); } catch { return null; }
}
export function motorDescargarSinInternet(nivel) { return Motor.descargarSinInternet({ nivel }); }
export function motorCancelarDescarga() { return Motor.cancelarDescarga(); }
export function motorBorrarDescargados() { return Motor.borrarDescargados(); }
/** Avance de la descarga: cb({ nivel, hechos, total, paquete, bytes, bytesTotal, fin, fallos, cancelado }). */
export async function motorAlDescargar(cb) {
  try {
    const h = await Motor.addListener('descargaPaquetes', (e) => cb(e || {}));
    return () => { try { h.remove(); } catch { /* nada */ } };
  } catch {
    return () => {};
  }
}
