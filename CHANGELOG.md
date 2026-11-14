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

## [0.2.25] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 35

### Corregido
- **Con un menú abierto, el fondo se desplazaba.** Por ejemplo, al deslizar sobre la hoja «Ordenar proyectos» se movía la lista de proyectos de atrás (visto en la tablet).
  - Ahora, mientras hay un menú o diálogo abierto, la pantalla de atrás queda fija y no recibe toques.
  - Al cerrarlo, todo queda en la misma posición.
  - Los menús largos (en el celular) se siguen pudiendo desplazar por dentro.

---

## [0.2.24] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 34

### Nuevo
- **Ordenar los proyectos en «Todos»** con el botón de orden junto al buscador. Opciones:
  - nombre de la A a la Z;
  - nombre de la Z a la A;
  - modificados (recientes o antiguos primero);
  - creados (nuevos o antiguos primero).
  - La app recuerda el orden elegido.
- **Fijar proyectos.**
  - Se fija con el alfiler de cada tarjeta o con ⋮ → «Fijar arriba».
  - Los fijados quedan siempre arriba, en el grupo «Fijados», con cualquier orden y también en «Recientes».
  - Entre ellos siguen el mismo orden elegido.
  - Fijar no cambia la fecha de modificación del proyecto.

---

## [0.2.23] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 33

### Resultado en la tablet
- El proyecto de varios archivos (.zip con carpetas, imagen y bibliografía) se importó entero y compiló las 6 páginas en 5,5 s. La Estructura siguió los `\include` hasta un segundo nivel (`tabla.tex`).

### Nuevo
- **Árbol de carpetas en Archivos.**
  - Las carpetas (p. ej. `capitulos/`, `figuras/`) se muestran plegables, con la cantidad de archivos.
  - Primero van las carpetas y después los archivos sueltos, con el principal arriba.
  - La app recuerda qué carpetas dejaste cerradas.
  - Si el archivo abierto está en una carpeta cerrada, su contador se resalta.

### Mejorado
- **Estructura más ordenada en proyectos con varios archivos.**
  - Las sangrías siguen el nivel real: un `\chapter` queda al ras y una figura, un nivel debajo de su sección.
  - Ya no aparece una fila aparte por cada `\include` que aporta contenido.
  - Al lado del número de línea se indica de qué archivo es, en la primera fila de cada archivo.
- En beamer, las diapositivas quedan debajo de su `\section`.

---

## [0.2.22] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 32

### Resultado en la tablet
- La prueba M (fuentes) ya no tarda.
- La prueba L (beamer) en sus tres variantes da el error correcto con su línea: falta `fragile`, diapositiva sin cerrar y tema inexistente («¿Quisiste decir \usetheme{Madrid}?»).

### Corregido
- En la tablet, el aviso rojo «No se encontró: …» tapaba la tarjeta del error. Ya no aparece ahí: el panel de Mensajes ya lo explica. En el celular sigue.
- El aviso de la compilación anterior («Listo en…») se oculta al empezar una nueva.

### Nuevo
- **PDF de la compilación anterior:** si una compilación falla sin generar PDF, el que queda a la vista es el anterior. Ahora se ve atenuado, con la franja «PDF de la compilación anterior: esta no generó PDF», para que no parezca el resultado actual.

---

## [0.2.21] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 31 · servidor Termux 0.2.4

### Resultado de las pruebas de errores K–P en la tablet
- K (bibliografía), N (paquetes), O (listas) y P (matemáticas): todos los errores detectados y explicados.
- La M (fuentes) ya no tarda: salen los errores en segundos.

### Corregido
- **Errores de fontspec sin explicación (prueba M).** En la versión de fontspec que tiene Termux, el texto del error va en una segunda línea; la tarjeta solo decía «Package fontspec Error:» y apuntaba a la línea equivocada.
  - Ahora se juntan las líneas de continuación, para fontspec y para cualquier paquete que escriba así.
  - Vuelve la explicación «La fuente Arial no está instalada…» con su alternativa TeX Gyre, en la línea correcta.
  - El servidor también reconoce ese formato para no buscar la fuente en CTAN.
- **«Se cargó dos veces con opciones distintas» (prueba N)** apuntaba a la línea siguiente. Ahora marca la segunda carga del paquete y dice en qué línea está la primera.
- **Texto suelto dentro de una lista (prueba O):** ahora se señala la línea del texto suelto, con una explicación más clara, en vez de la línea del `\item` siguiente.

### Nuevo
- **Beamer:**
  - El panel Estructura muestra las diapositivas numeradas con su título.
  - Una diapositiva sin `\end{frame}` se señala en su línea, con la explicación correspondiente.
  - Un tema que no existe (`\usetheme{Madrid2}`) sugiere el más parecido («¿Quisiste decir \usetheme{Madrid}?»).
- **Cuando un error detiene la compilación** (no hay PDF), el panel de Mensajes avisa que los errores que vengan después aparecerán al corregirlo. Esto explica por qué la prueba L mostraba un solo error de tres.

---

## [0.2.20] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 30 · servidor Termux 0.2.3

### Corregido: XeLaTeX tardaba más de un minuto con una fuente que no existe (prueba de errores M)
- El aviso decía «No se encontró: Arial.tex, BI.tex, B.tex, I.tex, Consolas.tex». La demora tenía dos causas:
  - TeX intentaba *fabricar* la fuente Arial con METAFONT, una vez por cada variante (normal, negrita, cursiva, negrita cursiva).
  - El servidor tomaba esos fallos por archivos de paquete y buscaba cada uno en todo CTAN, cinco búsquedas por compilación.
- Ahora, en XeLaTeX, no se intenta fabricar fuentes, y los nombres de fuentes del sistema que faltan ya no se buscan en CTAN. El error («no se encontró la fuente Arial», con sus alternativas TeX Gyre) sale en segundos.
- El servidor recuerda por 7 días los archivos que no existen en CTAN, para no volver a buscarlos en cada compilación.
- Requiere actualizar el servidor de Termux: la app lo ofrece en el inicio («Hay mejoras para Termux»).

---

## [0.2.19] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 29

### Nuevo
- **Inicio con dos pestañas: «Recientes» y «Todos».**
  - «Recientes» muestra los 8 proyectos que abriste o editaste últimamente.
  - «Todos» los ordena alfabéticamente (prueba2 va antes de prueba10) y, desde 6 proyectos, trae un buscador por nombre.
  - La app recuerda qué pestaña dejaste abierta.
- **El motor siempre está a la vista.** Junto al nombre del archivo aparece una etiqueta (pdfLaTeX, XeLaTeX o LuaLaTeX) con el motor con que se va a compilar de verdad, contando la línea «% !TEX program». Al tocarla se abre el menú del motor.
- **Menú del motor más claro.**
  - Cada opción explica para qué sirve.
  - Abajo dice con qué motor se compila ahora y por qué (por ejemplo «Lo pide la línea 1»).
  - Si eliges un motor que no se va a usar (porque la línea «% !TEX program» manda, o porque el documento no puede compilar con él), un aviso te explica qué pasará.

### Mejorado: el motor se elige solo con más casos
- `\directlua`, `luacode` y otros paquetes Lua pasan a LuaLaTeX.
- xeCJK, mathspec y similares pasan a XeLaTeX.
- fontspec, unicode-math, polyglossia y `\setmainfont` nunca se compilan con pdfLaTeX.
- La búsqueda también mira los archivos incluidos (capítulos).
- **Si la línea «% !TEX program» pide un motor que no sirve** para ese documento, se compila con el correcto y se avisa:
  - en el aviso al terminar, con el botón «Corregir línea»;
  - en una tarjeta «Motor» del panel de Mensajes.
  - La etiqueta del motor se pone en ámbar hasta que se corrige.
- Mensajes de error nuevos para comandos de otro motor:
  - `\directlua` → «solo existe en LuaLaTeX»;
  - `\XeTeX…` → «solo existe en XeLaTeX»;
  - `\pdf…` → «propio de pdfLaTeX».
- La lista de proyectos muestra el motor real de cada uno.
- En el celular se oculta la etiqueta «principal» del encabezado para que quepa el nombre del archivo.

---

## [0.2.18] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 28

### Resultado de la serie 3 en la tablet (Lenovo Idea Tab Pro)
- ✅ 14 biblatex + biber, 15 BibTeX/natbib, 16 beamer (8 páginas, 4,2 s), 17 química (5,5 s; chemfig instaló lo que le faltaba), 18 geometría (5,7 s), 19 LuaLaTeX (el motor se eligió solo), 20 datos CSV (4,7 s), 21 algoritmos y física (2,1 s).
- La 19 tenía un error de la prueba (usaba `\dfrac` sin cargar amsmath): TeXsting lo detectó y explicó bien. Corregida la prueba, y también el diseño de la 17 (las moléculas quedan en una fila con su nombre debajo).

### Corregido
- En la tablet, el aviso rojo «N error(es) — Ver» tapaba la primera tarjeta del panel de Mensajes, que ya se abre solo. Ahora en la tablet no aparece (el panel ya dice cuántos errores hay); en el celular sigue.
- Tocar «Ver» con el panel de Mensajes ya abierto lo cerraba.

---

## [0.2.17] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 27 · servidor Termux 0.2.2

### Nuevo
- **Errores de bibliografía (BibTeX y biber)**: antes no aparecían porque los da otro programa. Ahora salen en Mensajes, explicados y en su línea, incluso si el `.bib` se escribe dentro del documento con `filecontents`: entrada mal escrita (falta la coma tras la clave), clave inexistente, archivo `.bib` o estilo que no existe, biber que no está instalado.
- **Servidor de Termux 0.2.2** (la app avisa «Hay mejoras para Termux»; se actualiza en segundos):
  - instala solo los archivos de apoyo que piden algunos paquetes (p. ej. chemfig necesita `simplekv.tex`); antes solo buscaba `.sty`/`.cls`;
  - instala el programa **biber** si un documento usa biblatex y no lo encuentra.
- **Serie 3 de pruebas** (`pruebas/pruebas-texsting-serie3.zip`): biblatex, BibTeX/natbib, beamer, química, geometría con tkz-euclide, LuaLaTeX con cálculos en Lua, datos desde CSV con ajuste lineal, pseudocódigo y física, un proyecto de varios archivos para importar, y 6 documentos con errores nuevos.

### Mejorado: explicaciones de errores
- **Fuentes de Windows en XeLaTeX** (Arial, Consolas, Times New Roman, Calibri…): dice que no están instaladas y sugiere la equivalente de TeX Live lista para copiar (TeX Gyre Heros, Termes, Pagella, Cursor), con el mismo comando de tu línea (`\setmainfont`, `\setmonofont`…). Apunta a la línea correcta (fontspec avisa una línea después) y marca como «en cadena» las fuentes que no cargan por eso.
- **beamer**: código literal en una diapositiva sin `[fragile]` → explica que falta `\begin{frame}[fragile]` y apunta al `verbatim`.
- Nuevas explicaciones: paquete cargado dos veces con opciones distintas, `\usepackage` dentro del documento, comando ya definido, `\item` fuera de una lista, texto antes del primer `\item`, `\\` sin línea que terminar, colores no definidos (las mezclas como `blue!60!black` necesitan xcolor), archivos que pide un paquete.
- **Columnas de más según dónde ocurre**: en `cases` («admite solo 2 columnas»), matrices, `tabular`/`array`; y `&` en texto normal («se escribe \&»).

---

## [0.2.16] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 26

### Mejorado (pedido de Pedro)
- **Marca con la tipografía de LaTeX**: en la pantalla de inicio, «TeXsting» va en Latin Modern (la letra de TeX) con la **E bajada** como el logo de Knuth, y la «T» del cuadrito también es la de Latin Modern. Solo se incluyen las letras necesarias (2,8 kB).
- **Ícono más grande y nítido**: las letras ocupan casi todo el ancho del ícono (≈94 %, con un pequeño margen) y caben completas incluso en lanzadores con ícono circular.
  - Causa de que se vieran chicas y algo borrosas: el generador automático dejaba la capa del logo en 192 px; ahora cada densidad de pantalla lleva su tamaño correcto (hasta 432 px).
- **Ícono temático (Android 13+)**: si usas íconos temáticos con los colores del fondo de pantalla, TeXsting muestra las letras «TeX's» en ese estilo.

---

## [0.2.15] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 25

### Nuevo: identidad visual (issue [#5](https://github.com/P3dr1t0/texsting/issues/5))
- **Ícono nuevo**: «TeX's» en 3D, letras blancas con borde negro fino y volumen gris, con la E bajada como el logo de TeX, en el encuadre del cuadro final de una intro de cine clásica mirando un poco más hacia abajo (variante 3, elegida por Pedro), sobre azul noche.
- **Ícono adaptable de Android**: el logo va en una capa aparte dentro de la zona segura, así ningún lanzador (círculo, squircle, gota) le corta las letras.
- **Pantalla de arranque** con el logo sobre azul noche.
- **Para Play Store**: ícono de 512 px e imagen destacada de 1024×500 con el lema *«LaTeX en tu Android, sin internet»* (también es la portada del README en GitHub).
- El render 3D se hace con un script propio (`tools/icono/`), así se puede regenerar o ajustar cuando haga falta.

---

## [0.2.14] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 24

### Corregido (reporte de Pedro)
- En el celular, el menú **⋮ → Ver esta línea en el PDF** sugería «doble clic en el código», pero ese gesto está desactivado con el dedo (para que seleccionar una palabra no cambie de pestaña). Ahora la ayuda dice lo que hace en cada pantalla: en el celular, «Lleva al PDF la línea donde está el cursor»; en la tablet y con mouse, «También: doble clic en el código».

---

## [0.2.13] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 23

### Corregido (reporte de Pedro: el zoom con doble clic no iba donde apuntaba y al alejar saltaba páginas)
- **El zoom se ancla al punto bajo el mouse o el dedo**: ese punto de la página se queda quieto al acercar y al alejar. Antes solo se respetaba la altura (se acercaba hacia el borde izquierdo).
- **Volver a «Ajustar» ya no salta de página**: antes el desplazamiento se quedaba en el mismo número de píxeles mientras el documento se encogía, y terminaba varias páginas más abajo (a veces en la última).
- Aplica a todas las formas de zoom: doble clic, doble toque, pellizco, Ctrl + rueda y los botones − / Ajustar / +.
- Doble clic sobre un enlace del PDF ya no hace zoom (solo sigue el enlace).

---

## [0.2.12] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 22

### Nuevo: enlaces del PDF tocables (como en TeXstudio)
- Con el paquete **hyperref**, ahora funcionan dentro del visor: las entradas del **índice**, las listas de figuras y tablas, los `\ref`/`\eqref` («Fig. 1», «ecuación (2)»), las citas `\cite` y las notas al pie.
- Al saltar, una **línea dorada** marca dónde empieza el destino y aparece **«← Volver»** arriba del PDF para regresar a donde estabas leyendo (hasta 20 saltos atrás).
- Los `\url{…}` y `\href{…}{…}` se abren en el **navegador**.
- Con mouse, los enlaces se iluminan al pasar por encima. Arrastrar desde un enlace mueve el PDF (no lo abre), y **Ctrl + clic** sobre un enlace sigue llevando al código.
- Las plantillas de TeXsting ya incluyen hyperref; en documentos propios agrega `\usepackage{hyperref}` (al final del preámbulo).

---

## [0.2.11] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 21

### Nuevo: saltar entre el código y el PDF (SyncTeX, como en Overleaf)
- **Código → PDF**: **doble clic** en una línea del código lleva al lugar del PDF que generó y lo **resalta** unos segundos. En el celular (con el dedo) se hace desde **⋮ → Ver esta línea en el PDF**, para que seleccionar una palabra no te cambie de pestaña.
- **PDF → código**: **Ctrl + clic** (mouse) o **mantener presionado** (dedo, vibra al cumplirse) sobre una palabra, ecuación o figura lleva a la línea del código que la produjo, en el archivo correcto aunque esté en un `\input`. La línea destino destella.
- Funciona sin internet y también con el último PDF guardado al volver a abrir el proyecto.
- Comparado con la herramienta oficial `synctex` en un documento de 23 páginas: 84/84 líneas en la misma página y altura, y 99 % de los puntos del PDF a la misma línea.
- Si escribiste líneas nuevas después de compilar, compila otra vez para que el salto sea exacto.

---

## [0.2.10] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 20

### Nuevo: visor PDF con mouse (idea de Pedro, para tablet + mini PC de escritorio)
- **Arrastrar con el clic de la ruedita** (o con el clic izquierdo) mueve el PDF como un dedo, en vertical y en horizontal, con **inercia** al soltar rápido.
- **Doble clic** acerca el zoom donde hiciste clic; otro doble clic vuelve a «Ajustar».
- El cursor cambia a una mano (✋) sobre el PDF y a mano cerrada mientras arrastras.
- Siguen igual: la rueda para desplazarse, **Ctrl + rueda** para zoom y, en pantalla táctil, el dedo, el pellizco y el doble toque.

---

## [0.2.9] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 19

### Corregido (reporte de Pedro: un .tex distinto ofrecía «Actualizar» el proyecto anterior)
- Causa: algunas apps mandan el archivo **sin su nombre**; TeXsting lo llamaba `documento.tex` y lo confundía con otro proyecto importado con ese mismo nombre por defecto.
- **Nombre real del archivo**: un complemento nativo nuevo se lo pregunta a Android aunque la app que lo envía no lo incluya.
- **Cada archivo se reconoce por su origen y su contenido**, no solo por el nombre:
  - Mismo contenido → «Ya importaste este mismo archivo como «X»»: **Abrir «X»** o **Crear copia**.
  - Mismo archivo de origen con cambios → **Actualizar…** (opción secundaria).
  - Cualquier otro caso → solo **Crear proyecto**. Los proyectos importados antes de esta versión nunca se ofrecen para actualizar.
- **Actualizar ya no es de un toque**: pide confirmación (muestra líneas actuales y nuevas) y guarda la versión anterior como `archivo.anterior.tex` dentro del proyecto.
- El diálogo muestra el **título o la primera sección** del documento, las líneas y el tamaño, para reconocerlo aunque no traiga nombre; ese título se propone como nombre del proyecto.

---

## [0.2.8] — 13 nov. 2026 · Fase 1: Beta con Termux · compilación 18

### Nuevo: «Abrir con → TeXsting» (issue [#7](https://github.com/P3dr1t0/texsting/issues/7), primera parte)
- TeXsting aparece en **Abrir con** para archivos LaTeX (`.tex`, `.ltx`, `.bib`, `.sty`, `.cls`) desde Archivos, WhatsApp, Drive, Gmail, etc.
- Pregunta **«¿Deseas importar «archivo.tex»?»** y ofrece:
  - **Crear proyecto** (nombre editable) si el archivo es un documento completo (tiene `\documentclass`).
  - **Agregar a un proyecto** que ya tengas si es un archivo suelto (un capítulo, una bibliografía…).
  - **Actualizar** el proyecto si ya lo habías importado antes (reemplaza el archivo con la versión nueva).
- Si el documento usa imágenes o `\input` que no vinieron con el `.tex`, avisa cuáles faltan y cómo agregarlos.
- Si se abre algo que no es LaTeX (un PDF, una foto), lo rechaza con un aviso en vez de importarlo.

### Pendiente de #7
- Guardar los cambios de vuelta en el archivo original y abrir la carpeta completa (con sus imágenes) en un solo paso.

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
