# TeXsting

![TeXsting — LaTeX en tu Android, sin internet](assets/play-store-feature-1024x500.png)

[![Compilar APK](https://github.com/P3dr1t0/texsting/actions/workflows/apk.yml/badge.svg)](https://github.com/P3dr1t0/texsting/actions/workflows/apk.yml) · [Descargar el último APK](https://github.com/P3dr1t0/texsting/releases)

Editor LaTeX libre para Android, inspirado en la forma de trabajar de TeXstudio.
Compila **en tu propio teléfono** con TeX Live, **sin instalar nada más**: el motor viene dentro de la app (pdfLaTeX, LuaLaTeX, BibTeX y makeindex). Gratis, sin internet tras la primera descarga de paquetes y sin límite de tiempo.

> **Estado:** Fase 2 — Beta con motor integrado (Termux ya es opcional). Novedades de cada versión en [CHANGELOG.md](CHANGELOG.md); pendientes en [Issues](https://github.com/P3dr1t0/texsting/issues).

> TeXsting no usa código, nombre ni logo de TeXstudio; solo toma ideas de su flujo de trabajo.
> Licencia: GPL-3.0-or-later.

## Qué hace (versión 0.1)

- **Editor** con resaltado LaTeX, números de línea, plegado, buscar/reemplazar, deshacer/rehacer y ajuste de línea.
- **Autocompletado** de comandos, entornos (`\begin{...}` → cierra solo), `\ref{}` con tus etiquetas y `\cite{}` con las claves de tus `.bib`.
- **Barra de teclas LaTeX** sobre el teclado del teléfono (`\ { } $ ^ _ & \\`…) y panel de **símbolos** (griego, operadores, relaciones, flechas…).
- **Estructura** del documento (secciones, figuras, tablas, `\input`, comentarios `% TODO`), tocando un elemento vas a esa línea.
- **Asistentes**: tabla, matriz, lista, figura, circuito (circuitikz), gráfica (pgfplots), código (listings), ecuaciones. Si falta el `\usepackage`, te ofrece agregarlo.
- **Compilación** dentro de la app con pdfLaTeX o LuaLaTeX; recompila referencias, bibliografía (BibTeX, también biblatex) e índice solo, como latexmk. Los documentos «de XeLaTeX» (fontspec, unicode-math, polyglossia) se compilan con LuaLaTeX; Termux solo hace falta para lo exclusivo de XeLaTeX (xeCJK, mathspec…).
- **Rápido**: guarda el preámbulo ya cargado y las figuras (TikZ, pgfplots, circuitikz) ya dibujadas, y solo redibuja las que cambian.
- **Paquetes al vuelo**, como MiKTeX: si un paquete falta, se descarga e instala automáticamente al compilar.
- **Mensajes** de error en español con la línea exacta; tocando el error, vas al código. También el log completo.
- **Visor PDF** con zoom (pellizco, doble toque, botones), conserva la posición al recompilar.
- **Compartir el PDF** (WhatsApp, Drive, correo…) y exportar/importar proyectos `.zip` (compatible con Overleaf).
- **Teléfono**: pestañas Archivos · Estructura · Código · PDF · Mensajes. **Tablet**: código y PDF lado a lado con división ajustable y panel lateral.
- Tema claro/oscuro, proyectos con varios archivos, imágenes y archivo principal.

## Cómo obtener el APK (sin computadora)

1. Crea una cuenta gratis en <https://github.com>.
2. Crea un repositorio nuevo llamado `texsting` y sube **todo el contenido** de esta carpeta
   (en el navegador: *Add file → Upload files*, arrastra todo, incluida la carpeta `.github`).
3. Ve a la pestaña **Actions**: se ejecuta solo «Compilar APK» (tarda ~5–8 min).
4. Cuando termine, ve a **Releases** (en la página principal del repositorio) y descarga `TeXsting.apk` desde el teléfono.
5. Ábrelo e instálalo (Android te pedirá permitir «instalar apps desconocidas» para el navegador o Archivos).

Cada vez que se cambie el código, se genera un APK nuevo que se instala encima del anterior sin perder tus proyectos.

## Termux (opcional)

No hace falta para compilar: el motor integrado viene en la app. Solo si un documento usa algo exclusivo de XeLaTeX, en la app: **Ajustes → Instalar o reparar TeX en Termux** y sigue los 4 pasos:

1. Instala **Termux** desde F-Droid o GitHub.
2. Toca **Copiar comando**.
3. Abre Termux, pega (mantén presionado → Pegar) y presiona Enter. Elige:
   - **Recomendada (~2 GB)**: lo usual en ingeniería (amsmath, TikZ, circuitikz, siunitx, pgfplots, español, bibliografía…). Lo que falte se instala solo.
   - **Completa (~6 GB)**: todo CTAN, como un MiKTeX completo.
4. Vuelve a TeXsting y toca **Probar conexión**.

Qué instala: un Debian dentro de Termux (`proot-distro`) con el **TeX Live oficial**. Se usa Debian porque el TeX Live nativo de Termux se rompe cada vez que cambia el año de TeX Live.

Comandos en Termux: `texsting` (iniciar), `texsting-stop` (detener), `texsting-setup` (reparar o cambiar la instalación).
El servidor arranca solo cada vez que abres Termux, y solo escucha dentro del teléfono (127.0.0.1) con un token.

**Si Android cierra Termux:** quítale la optimización de batería y, en Android 14+, activa en Opciones de desarrollador «Desactivar restricciones de procesos secundarios».

## Estructura del código

```
src/               app (JavaScript sin framework)
  screens/         inicio, editor, ajustes/Termux
  editor/cm.js     editor CodeMirror 6 (app real)
  editor/basic.js  editor simple (solo para pruebas en navegador)
  pdfview.js       visor pdf.js
  compiler.js      elige motor: integrado (motor.js) o el servidor de Termux
  logparser.js     lectura del log y traducción de errores
  structure.js     estructura, etiquetas y claves bib
termux/server.py   servidor de compilación (Python, sin dependencias)
termux/setup.sh    instalador para Termux
www/               HTML y CSS
scripts/           ajustes al proyecto Android
.github/workflows  compilación automática del APK
```

Compilar en una computadora (opcional): `npm install && npm run build && npm run android:prepare`, luego abrir `android/` en Android Studio.

## Publicar en Google Play (más adelante)

- Cuenta de desarrollador de Google Play (pago único de inscripción).
- Las cuentas personales nuevas deben hacer una **prueba cerrada con al menos 12 personas durante 14 días seguidos** antes de publicar.
- Hace falta firmar con una llave de publicación propia y generar `.aab` (se agregará al flujo de GitHub cuando llegue el momento).

## Próximos pasos previstos

- SyncTeX: tocar el PDF y saltar a la línea del código (y al revés).
- XeLaTeX dentro del motor integrado y biber.
- Revisión ortográfica en español.
- Marcar en el editor las líneas con error.

## Licencia, nombre y créditos

- **Código de TeXsting:** GPL-3.0-or-later (ver `LICENSE`). Puedes estudiarlo, modificarlo y compartirlo; si publicas una versión modificada, debe seguir siendo GPL, con su código abierto y los créditos originales.
- **Nombre y logo:** «TeXsting» y su ícono identifican la app oficial de Pedro de la Cruz Castillo. Las versiones modificadas deben usar otro nombre y otro ícono para no confundirse con la oficial.
- **Componentes de terceros** (cada uno con su propia licencia):
  - Motor integrado: pdfTeX, LuaHBTeX, BibTeX, makeindex y paquetes de [TeX Live](https://tug.org/texlive/) (GPL, LPPL y otras licencias libres), compilados por [Termux](https://github.com/termux/termux-packages); los paquetes extra se descargan de [CTAN](https://ctan.org/).
  - Bibliotecas de LuaHBTeX: HarfBuzz (MIT), FreeType (FTL), GLib (LGPL-2.1), Graphite2, libiconv, PCRE2, Brotli, bzip2, zlib y libpng (licencias libres), compiladas por Termux.
  - Editor: [CodeMirror 6](https://codemirror.net/) y Lezer (MIT).
  - Visor de PDF: [PDF.js](https://mozilla.github.io/pdf.js/) (Apache-2.0).
  - App Android: [Capacitor](https://capacitorjs.com/) (MIT) y [XZ for Java](https://tukaani.org/xz/java.html) (dominio público).
