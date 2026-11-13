# Registro de cambios de TeXsting

Cada versión indica la **fase** del proyecto y la **compilación** (número del APK en *Releases*).
Las versiones 0.x son de beta; la 1.0 será el lanzamiento en Google Play.

## Fases del proyecto

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Prototipo: editor, compilación y PDF funcionando | ✅ Terminada (11 nov. 2026) |
| 1 | Beta con Termux: pulir la app con uso real en celular y tablet | 🔄 En curso |
| 2 | Motor integrado: sin Termux, instalación básica/completa dentro de la app ([#1](https://github.com/P3dr1t0/texsting/issues/1)) | Pendiente |
| 3 | Prueba cerrada en Google Play: 12 testers durante 14 días | Pendiente |
| 4 | Lanzamiento 1.0 | Pendiente |

**Objetivo transversal (todas las fases):** optimización de velocidad, fluidez, memoria y batería ([#8](https://github.com/P3dr1t0/texsting/issues/8)); requisito antes del lanzamiento.

---

## [0.2.7] — 13 nov. 2026 · Fase 1: Beta con Termux · compilación 17

### Mejorado (a partir de las capturas de Pedro con la serie 2)
- **Pestaña Mensajes rediseñada para el celular**: la explicación en español va primero y en grande; el mensaje original en inglés, debajo y en pequeño. La ubicación ahora dice «línea 16» arriba a la derecha y ya no ocupa media pantalla (antes el texto quedaba en una columna angosta).
- **Errores «en cadena» agrupados** dentro del error que los causa, plegados: «▸ 5 errores en cadena: se corrigen solos al arreglar este». Se despliegan con un toque.
- El aviso pgfplots «Axis range … is approximately empty» que sale tras un error en la misma gráfica se marca como consecuencia.
- El aviso «Listo en X s» ya no tapa la barra de zoom del PDF, y el aviso de errores se oculta al entrar a Mensajes.

### Resultado de la serie 2 en el Poco X7 Pro
- ✅ Pruebas 08–13: todas compilan. Tiempos: 4,7 s · 31,6 s · 25,4 s · 20,2 s · 8,2 s · 7,5 s (análisis en [#8](https://github.com/P3dr1t0/texsting/issues/8)).
- ✅ Errores E–J: todos detectados en su línea, con la explicación y sugerencia esperadas.

---

## [0.2.6] — 13 nov. 2026 · Fase 1: Beta con Termux · compilación 16

### Mejorado: explicaciones de errores (probado con la nueva serie 2 de pruebas)
- **«¿Quisiste decir…?»** también para comandos (`\textbff` → `\textbf`), entornos (`figrue` → `figure`), opciones de TikZ/pgfplots (`xlable` → `xlabel`, `resitor` → `resistor`), unidades de siunitx y funciones (`sen` → `sin`).
- **Comandos que necesitan un paquete**: p. ej. *«\mathbb necesita el paquete amssymb: agrega \usepackage{amssymb}»* (unos 70 comandos y 25 entornos conocidos).
- Explicación en español para 17 mensajes nuevos: falta `;` en TikZ, `\left` sin `\right`, columnas de más en tablas, tipo de columna inválido, `\caption` fuera de figura, división entre cero, valores demasiado grandes, nodos inexistentes, coordenadas sin coma, etiquetas repetidas, fuentes sustituidas, línea en blanco dentro de una ecuación, `_` en texto, entre otros.
- **Mejor ubicación**: el «falta ;» apunta a la línea del `\draw` (antes, a la siguiente); una opción mal escrita en `axis` apunta a su línea (antes, a `\end{axis}`); una etiqueta repetida, a la segunda aparición.
- **Más errores «en cadena»**: otros errores en la misma línea, la ecuación rota por una línea en blanco (de 6 errores a 1 + 5 en cadena) y la misma fila de más repetida en una tabla.

### Nuevo
- Serie 2 de pruebas (`pruebas/pruebas-texsting-serie2.zip`): 6 documentos pesados de electrónica (circuitos AC, Bode/Nyquist, campos 3D, digital, documento de 25 páginas, código) y 6 con errores, cada uno con sus soluciones al final.

---

## [0.2.5] — 13 nov. 2026 · Fase 1: Beta con Termux · compilación 15

### Mejorado (a partir de las pruebas `errores-B`, `C` y `D` de Pedro)
- **Paquete mal escrito**: el error ahora apunta a la línea del `\usepackage` (antes, a la siguiente) y sugiere el nombre correcto: *«No existe «amsmaht». ¿Quisiste decir «amsmath»?»*. Funciona con unos 60 paquetes comunes (amsmath, graphicx, tikz, siunitx…).
- **Llave sin cerrar**: la «parada de emergencia» que viene después se marca como *en cadena*; ahora `errores-B` muestra **1 error (+1 en cadena)**.
- **Falta `\end{document}`**: nuevo mensaje claro «Falta \end{document} al final del documento», en la última línea del archivo.
- Contexto más limpio: ya no aparece `^^M` ni palabras partidas («E ste texto»).

### Resultado de las pruebas
| Prueba | Qué muestra ahora |
|---|---|
| `errores-B-llave` | L7: falta una llave `}` en `\textbf` · +1 en cadena |
| `errores-C-paquete` | L5: ¿quisiste decir «amsmath»? · +1 en cadena |
| `errores-D-documento` | L5: texto antes de `\begin{document}` · L7: falta `\end{document}` (los dos son errores reales) |

---

## [0.2.4] — 12 nov. 2026 · Fase 1: Beta con Termux · compilación 14

### Mejorado (a partir de la prueba `errores-A` de Pedro en la tablet)
- **Errores «en cadena»**: los mensajes que son consecuencia de otro error se muestran atenuados con «Consecuencia del error de la línea N». En `errores-A` ahora se cuentan **7 errores reales (+3 en cadena)**, exactamente los escondidos.
- Explicación para «Command \' invalid in math mode» (tilde dentro de modo matemático: falta cerrar un `$`).
- «There were undefined references» ya no sugiere solo «compila otra vez»: indica revisar los avisos.
- Ya no se muestra un recuadro de contexto vacío.

### Resultado de la prueba `errores-A` (antes de esta versión)
- ✅ Los 8 errores escondidos detectados en su línea exacta, todos con explicación en español.

---

## [0.2.3] — 12 nov. 2026 · Fase 1: Beta con Termux · compilación 13

### Corregido (reportado por Pedro en la tablet)
- **Si Termux no está abierto, la app avisa al instante** (antes se quedaba esperando sin decir nada: 73 s en la prueba). El aviso trae el botón **«Abrir Termux»**.

### Medido
- Plantilla de Presentación (Beamer): ~3 s la primera compilación y ~1 s las siguientes (medido en servidor; en el teléfono dentro de Termux es algo más).

---

## [Instalador] — 12 nov. 2026 · sin APK nuevo (se aplica al pegar el comando)

### Instalación rápida de TeX Live ([#2](https://github.com/P3dr1t0/texsting/issues/2))
- **Antes:** el instalador oficial bajaba e instalaba **3593 paquetes uno por uno** → ~1 h 06 min en la Lenovo Idea Tab Pro.
- **Ahora:** GitHub arma TeX Live 2026 (recomendado) una sola vez en un servidor arm64, lo prueba con pdfLaTeX, XeLaTeX y LuaLaTeX, y lo publica como **un archivo de 485 MB** (1,3 GB instalado, con los formatos ya generados).
- La descarga se puede **reanudar** si se corta, se **verifica** (SHA-256) y se descomprime directamente.
- Si algo falla, vuelve solo al instalador oficial.
- Detecta instalaciones **incompletas** (por ejemplo, canceladas a medias) y las limpia antes de empezar.
- Mantiene Termux despierto desde el inicio para que Android no corte la instalación.

**Medición real (Lenovo Idea Tab Pro, Wi-Fi):** instalación completa desde cero (herramientas + Debian + TeX Live + prueba) en **7 min 11 s**, frente a ~1 h 06 min estimados con el método anterior → **unas 9 veces más rápido**.

---

## [0.2.2] — 12 nov. 2026 · Fase 1: Beta con Termux · compilación 11

### Corregido (reportado por Pedro al probar `prueba06-xelatex`)
- **«Motor para proyectos nuevos» en Ajustes no tenía efecto**: los proyectos se creaban siempre con pdfLaTeX.
- El mensaje «==> Fatal error occurred…» ya no aparece cuando el error viene de un paquete.
- **Instalador de Termux**: en una instalación desde cero (p. ej. la tablet) fallaba en el paso 3/3 con «install-texlive.sh: No such file or directory». Se corrige solo al volver a pegar el comando (no requiere APK nuevo).

### Nuevo
- **Detección automática de XeLaTeX**: si el documento carga `fontspec`, `unicode-math` o `polyglossia`, se compila con XeLaTeX y el proyecto queda con ese motor (con aviso).
- **Comentario mágico** como en TeXstudio: `% !TEX program = xelatex` (o `lualatex`, `pdflatex`) en las primeras líneas fija el motor.
- El motor se muestra junto al nombre del archivo cuando no es pdfLaTeX.
- Explicación en español para «fontspec requires XeTeX or LuaTeX».

### Resultados de la batería de pruebas (Poco X7 Pro)
- ✅ Prueba 1 básico · ✅ 2 matemática · ✅ 3 tablas y figuras · ✅ 4 TikZ/circuitos/pgfplots
- ✅ 5 **paquete instalado al vuelo** (IEEEtran) · ❌→✅ 6 XeLaTeX (corregido en esta versión) · ✅ 7 bibliografía

---

## [0.2.1] — 12 nov. 2026 · Fase 1: Beta con Termux · compilación 10

> Requiere actualizar el servidor de Termux: la app lo avisa; copia el comando de Ajustes → Instalar o reparar TeX en Termux (tarda segundos).

### Corregido (encontrado con la batería de pruebas)
- **Volver a compilar un documento con errores sin cambiarlo ya genera el PDF** (latexmk se negaba a repetir).
- **Llave sin cerrar**: ahora indica la línea donde empieza el problema y lo explica en español.
- Una **imagen que no existe** se explica como imagen (no como paquete) y ya no se busca inútilmente en internet.
- Se quitaron mensajes repetidos sin utilidad («Fatal error occurred…», «Writing or overwriting file…»).
- Explicación para entornos que se cierran con otro (`\begin{X}` cerrado con `\end{Y}`).

### Nuevo
- Aviso en Inicio cuando el servidor de Termux está desactualizado.
- Batería de pruebas (`pruebas-texsting.zip`): 7 documentos que deben compilar y 4 con errores a propósito.

---

## [0.2.0] — 12 nov. 2026 · Fase 1: Beta con Termux · compilaciones 7–9

### Nuevo
- **Temas**: Claro, Sepia, Gris, Azul noche, Oscuro o «Según el sistema».
- **Color de botones y detalles**: Miel, Azul, Turquesa, Verde, Morado, Rosa, Rojo, Naranja.
- **Tamaño de letra del código** con deslizador y vista previa; acceso rápido desde el editor (⋮ → Apariencia y tamaño de letra).
- **Galería de Nuevo proyecto**: En blanco (documento o presentación), 5 plantillas (Artículo, Informe de laboratorio, Práctica, Presentación, Monografía) y **Mis plantillas**.
- **Guardar como plantilla**: cualquier proyecto se puede reutilizar como base.
- Plantilla **Monografía / investigación** con capítulos en archivos separados.
- **Conservar datos al desinstalar**: Android ofrece la casilla «Conservar datos de la app» ([#3](https://github.com/P3dr1t0/texsting/issues/3)).
- **Reconexión rápida con Termux**: si TeX Live ya está instalado, el comando de la app solo actualiza el token en segundos.
- `texsting-setup completo` en Termux amplía la instalación recomendada a la completa.
- Registro de cambios (este archivo) y notas en cada APK.

### Corregido
- **Los APK nuevos ya se instalan encima del anterior** (antes cada compilación tenía una firma distinta y obligaba a desinstalar).

---

## [0.1.0] — 11 nov. 2026 · Fase 0: Prototipo · compilaciones 1–6

### Nuevo
- Editor LaTeX con resaltado, autocompletado de comandos, entornos, `\ref` y `\cite`, búsqueda, deshacer/rehacer.
- Barra de teclas LaTeX sobre el teclado y panel de símbolos.
- Panel de estructura (secciones, figuras, tablas, `\input`, `% TODO`).
- Asistentes: tabla, matriz, lista, figura, circuito, gráfica, código, ecuaciones.
- Compilación con pdfLaTeX, XeLaTeX o LuaLaTeX (latexmk) mediante TeX Live en Termux.
- Instalación automática de paquetes faltantes (al estilo MiKTeX).
- Mensajes de error en español con salto a la línea; log completo.
- Visor PDF con zoom y posición conservada al recompilar; compartir PDF.
- Proyectos con varios archivos e imágenes; exportar/importar `.zip` (compatible con Overleaf).
- Diseño para teléfono (pestañas) y tablet (código y PDF lado a lado).
- Plantilla general de **Informe de laboratorio** (carátula, índice, procedimiento, resultados, bibliografía).

### Corregido
- El comando de instalación para Termux ahora es de una sola línea (el anterior era tan largo que se cortaba al pegarlo).
- Los mensajes del log ya no salen cortados a 79 caracteres.
- Conflicto entre babel (español) y TikZ/circuitikz: la app explica la solución (`\usetikzlibrary{babel}`) y la ofrece al insertar un circuito.
