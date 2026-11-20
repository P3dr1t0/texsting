# Registro de cambios de TeXsting

Cada versión indica la **fase** del proyecto y la **compilación** (número del APK en *Releases*).
Las versiones 0.x son de beta; la 1.0 será el lanzamiento en Google Play.

## Fases del proyecto

| Fase | Nombre | Estado |
|---|---|---|
| 0 | Prototipo: editor, compilación y PDF funcionando | ✅ Terminada (11 nov. 2026) |
| 1 | Beta con Termux: pulir la app con uso real en celular y tablet | ✅ Terminada |
| 2 | Motor integrado: sin Termux, instalación básica/completa dentro de la app ([#1](https://github.com/P3dr1t0/texsting/issues/1)) | 🔄 En curso |
| 3 | Prueba cerrada en Google Play: 12 testers durante 14 días | Pendiente |
| 4 | Lanzamiento 1.0 | Pendiente |

**Objetivo transversal (todas las fases):** optimización de velocidad, fluidez, memoria y batería ([#8](https://github.com/P3dr1t0/texsting/issues/8)); requisito antes del lanzamiento.

---

## [0.9.15] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 102

### Teclado en Android 15 y 16
- **Arreglado: al abrir el teclado desaparecía la barra de teclas LaTeX** (Ω, begin, llaves…).
  - Causa: desde la 0.9.12 la app apunta a Android 16, que dibuja las apps de borde a borde y ya no achica la pantalla cuando sale el teclado. El teclado quedaba encima de la barra.
  - Ahora TeXsting reserva el espacio del teclado: la barra de teclas queda justo encima de él y la barra inferior (Archivos… Mensajes) se oculta mientras escribes, como antes.
- Los márgenes de la barra de estado, la barra de gestos y la cámara frontal (en horizontal) los maneja ahora TeXsting directamente.

## [0.9.14] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 101

### Descargas grandes en partes
- **Los paquetes de más de 8 MB se bajan en 4 partes a la vez**, todas del mismo espejo. Por ejemplo cm-super (~60 MB), que es más de la mitad de los paquetes básicos.
  - Motivo: con un espejo lejano, una sola conexión no pasaba de ~0,6 MB/s aunque el wifi diera más. En la 0.9.13 los básicos tardaban 165 s con wifi.
  - Si un espejo no acepta descargas por partes, el paquete se baja de corrido como antes.
- **La barra muestra el último paquete que empezó a bajar**, en lugar de quedarse en «cm-super» mientras se bajaban otros.

## [0.9.13] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 100

### «Usar sin internet» más rápido
- **Los paquetes se bajan de 4 en 4** en lugar de uno por uno. Los más pesados (como las fuentes cm-super) empiezan primero, para que ninguno quede bajando solo al final.
- **Una sola conexión por espejo.** Antes, cada paquete pasaba por mirror.ctan.org, que redirige a un espejo cercano: eran dos conexiones nuevas por paquete. Ahora TeXsting recuerda a qué espejo lo mandaron y reutiliza la conexión. Esa espera se notaba sobre todo en los avanzados, que son unos 3850 paquetes.
- **La barra avanza mientras baja un paquete grande**, en lugar de quedarse quieta hasta que termina.
- Al compilar, si un documento necesita varios paquetes nuevos, también se bajan a la vez («Descargando N paquetes…»).

### Papelera a la vista
- **Botón de papelera en la pantalla principal**, en el lado opuesto a Ajustes (el logo queda al centro). Siempre está, aunque la papelera esté vacía, y un globito muestra cuántas cosas tiene.
- Antes solo aparecía un botón al final de la lista de proyectos cuando había algo eliminado, y era fácil no verlo.

## [0.9.12] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 98

### Preparación para Google Play
- **Nuevo identificador de la app: `io.github.p3dr1t0.texsting`** (antes `io.github.texsting`). Es el que tendrá en Google Play y ya no cambiará.
  - Android la ve como una app distinta. Al instalarla, empieza vacía.
  - En Ajustes → Carpeta de proyectos, elige Documentos/Projects_LaTeX para recuperar tus proyectos.
  - Después desinstala la versión anterior.
- **Apunta a Android 16 (API 36)**, como exige Google Play desde el 31 de agosto de 2026.
- **Versión final firmada:** cuando el repositorio tiene la llave de subida, cada compilación sale firmada para Google Play. Se publica como APK, para instalar a mano, y como AAB, para subir a Play Console.

---

## [0.9.11] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 97

### Nuevo
- **Enviar una sugerencia** (Ajustes → Acerca de): escribe una idea, un problema o algo que te gustaría ver, y le llega directo al editor sin salir de la app.
  - Hasta 200 palabras, con contador, y una sugerencia por semana.
  - Lo que escribas se queda guardado aunque cierres la pantalla, o si no hay internet en ese momento.
  - Opcionalmente incluye la versión de la app y el modelo del equipo.
  - Se envía sin nombre ni correo.
- **Contacto y política de privacidad** en Ajustes: texsting.app@gmail.com y https://p3dr1t0.github.io/texsting/privacidad

---

## [0.9.10] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 96

### Mejorado
- **Descargas de paquetes más resistentes.** Si un servidor de CTAN no responde, ahora se prueban 5 espejos en vez de 2, empezando por el último que funcionó. Si se cortó internet un momento, se espera un par de segundos y se intenta otra vez. El motivo del fallo sale en palabras simples («sin conexión a internet»), y cada paquete aparece una sola vez en el resumen.
- **Idiomas de babel que no vienen en el APK:**
  - un idioma en las opciones de babel que vive en otro paquete (p. ej. `ngerman` → `babel-german`) se baja solo;
  - lo mismo con `\babelprovide[import]{greek}`, `{russian}`, etc., que necesitan los archivos completos de babel.
  - Antes salía «Unknown option 'ngerman'» o «There is no ini file…».

---

## [0.9.9] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 95

### Corregido
- **Un paquete que faltaba podía quedarse sin bajar.** Le pasó al Jefe 3 con `xstring` (lo pide `circuitikz`): la compilación se detenía con «File `xstring.sty' not found» y no se veía por qué.
  - Si un paquete figura como descargado pero LaTeX no encuentra sus archivos, ahora se vuelve a bajar (una vez).
  - Si la descarga falla, el panel de Mensajes muestra «No se pudo descargar el paquete …» con el motivo.
  - El resumen del «Log completo» lista los paquetes que no se pudieron bajar.

---

## [0.9.8] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 94

### Corregido
- **biber dejaba de funcionar después de actualizar la app.**
  - El síntoma: la bibliografía salía vacía y las citas sin definir.
  - La causa: Android cambia de lugar las bibliotecas del APK en cada actualización, y los enlaces de biber seguían apuntando al lugar viejo. biber se detenía con «Can't locate loadable object for module Cwd».
  - Ahora la app se da cuenta del cambio y vuelve a enlazarlas sola. Toma un instante y no hace falta reinstalar ni borrar nada.

---

## [0.9.7] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 93

### Mejorado
- **Cuando biber falla, ahora se ve por qué:**
  - el panel de Mensajes muestra un error «biber no pudo armar la bibliografía» con el motivo;
  - al principio del «Log completo», debajo de la línea «biblatex:», salen las últimas líneas que escribió biber.
  - Antes solo se veían las citas sin definir: los mensajes de biber no quedan en el registro de LaTeX.

---

## [0.9.6] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 92

### Nuevo
- **Agrandar el panel de mensajes (tablet):** un botón junto a «Log completo» lleva el panel a toda la pantalla de trabajo, encima del código y del PDF. Sirve para leer muchos errores con calma o fotografiarlos. El mismo botón lo devuelve a su tamaño.
- **Copiar los mensajes como texto (teléfono y tablet):**
  - con la lista abierta, copia los errores y avisos visibles con su línea, la explicación y el texto original;
  - con el «Log completo» abierto, copia el registro entero;
  - se puede pegar en WhatsApp, en un correo o en un chat para pedir ayuda, en vez de mandar fotos.

---

## [0.9.5] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 91

### Corregido
- **Jefe 1: la bibliografía salía vacía («Citation … undefined», «Please (re)run Biber»).** En la nube, el biber de la app procesa bien el `.bcf` de la tesis (7 citas, 0,6 s), así que el problema estaba en cuándo la app decide correrlo. Se corrigieron dos causas posibles:
  - Si en el registro quedaba algo «faltante» que ya se había intentado bajar (o un aviso que no se va), la app cortaba cada pasada para buscar paquetes y nunca llegaba a correr biber, glosarios ni índices. Ahora solo corta si hay algo **nuevo** que intentar.
  - BibTeX, makeindex (índices, glosarios, nomenclatura) y biber tienen cada uno su propio manejo de errores: si uno falla, los demás igual se corren.
- El «Log completo» dice qué pasó con biber en esa compilación: si armó la bibliografía, si terminó con error, o si no hizo falta correrlo.

---

## [0.9.4] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 90

### Corregido
- **glossaries en español:** el aviso «No language module detected for `spanish'… glossaries-spanish» ahora hace que la app baje `glossaries-spanish` sola, y los títulos del glosario salen en español.
- Jefe 1: se arregló la prueba, no la app. Usaba `\nomunit`, que hay que definir aparte (no viene en `nomencl`). El script de referencia ahora también cuenta los errores que vienen de archivos auxiliares, como `main.nls`.

---

## [0.9.3] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 89

### Nuevo
- **Glosarios y siglas** (`glossaries`, `\makeglossaries`): la app hace lo mismo que `makeglossaries` en Overleaf. Cada glosario del documento (principal, siglas…) se arma con makeindex y su estilo, solo cuando cambia.
- **Nomenclatura** (`nomencl`, `\makenomenclature`): se arma la lista de símbolos con el estilo `nomencl.ist`.
- **Varios índices alfabéticos** (`imakeidx`, `\makeindex[name=autores]`): se arman todos los `.idx`, no solo el principal.

### Pruebas
- «Jefes»: cinco proyectos difíciles en `tools/diag/jefes/` (tesis completa, tablas, figuras, beamer y Unicode con LuaLaTeX). Compilan sin errores en TeX Live 2026 de escritorio (`tools/diag/jefes.sh`), así que cualquier falla en la app es de la app.

---

## [0.9.2] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 88

### Corregido
- **`style=ieee` (y otros estilos de biblatex que vienen en paquetes aparte) fallaba con «Style 'ieee' not found»**: la app no sabía que tenía que bajar `biblatex-ieee`. Ahora:
  - antes de compilar, lee las opciones de `\usepackage[style=…]{biblatex}` (también `bibstyle` y `citestyle`) y baja el paquete del estilo;
  - si igual falta un estilo, reconoce el error y lo baja.
- El «Log completo» dice si biblatex usó biber o BibTeX.

---

## [0.9.1] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 87

### Nuevo
- **biber dentro del motor** ([#1](https://github.com/P3dr1t0/texsting/issues/1)). Los documentos con `biblatex` ahora compilan igual que en Overleaf o TeXstudio, con biber, sin cambiar nada. Antes la app forzaba BibTeX, que no sirve para estilos como `style=ieee` ni para varias opciones de biblatex.
  - Biber 2.22, la misma versión que pide el biblatex de TeX Live 2026. Funciona con el Perl de Termux compilado para Android.
  - En la prueba, en un equipo Android (aarch64), el `.bbl` sale idéntico al del biber oficial y tarda unos 0,6 s.
  - Corre solo cuando hace falta, como latexmk: cuando cambian las citas o el `.bib`.
  - La primera vez descomprime sus módulos (≈40 MB, solo una vez).
  - Todas las bibliotecas quedan alineadas a 16 KB, como pide Google Play. `libandroid-utimes` se quitó: Android 8 o superior ya trae esas funciones.
  - Lo arma `.github/workflows/biber.yml` (`tools/biber/`) y queda en la release `biber-android`. El APK lo toma de ahí, y si no estuviera, vuelve a usar BibTeX como antes.

---

## [0.9.0] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 85

### Nuevo
- **Usar sin internet** (Ajustes) ([#1](https://github.com/P3dr1t0/texsting/issues/1)). Con conexión, todo sigue igual: cada documento descarga solo los paquetes que necesita al compilar. Para estar sin conexión (en clase, en un examen) se pueden descargar antes:
  - **Paquetes básicos:** lo de un curso de ingeniería o ciencias (TikZ, pgfplots, circuitikz, siunitx, tcolorbox, beamer, biblatex, listings, chemfig, fuentes…).
  - **Paquetes avanzados:** casi todo LaTeX, como una instalación completa de MiKTeX o TeX Live. Antes de empezar avisa el tamaño y recomienda wifi.
  - Cada opción muestra cuántos paquetes faltan y cuánto pesan, con barra de avance y **Cancelar**. La descarga sigue aunque salgas de Ajustes y avisa al terminar.
  - **Borrar** libera el espacio de los paquetes descargados; se vuelven a bajar solos cuando un documento los pide.
  - Las listas se arman al compilar el APK a partir de TeX Live (`tools/apk/sin_internet.py`), sin los paquetes que el APK ya trae.

---

## [0.8.0] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 84

### Nuevo
- **Papelera** ([#20](https://github.com/P3dr1t0/texsting/issues/20)). Eliminar un proyecto o un archivo ya no lo borra de inmediato: va a la papelera y **se borra solo a los 15 días**.
  - Al eliminar aparece «Deshacer», y en el inicio un botón **Papelera · N** lleva a la lista. Ahí cada elemento dice cuántos días le quedan y tiene **Restaurar** y **Eliminar ahora**. También se puede vaciar toda la papelera.
  - La carpeta de un proyecto eliminado se mueve a `Projects_LaTeX/Papelera de TeXsting` (visible desde Archivos). Al restaurarlo vuelve a su lugar.
  - Una carpeta abierta desde otro lugar («Abrir → Carpeta del teléfono») nunca se mueve ni se borra: solo se quita de TeXsting.
  - Un archivo eliminado dentro de un proyecto se restaura en el mismo proyecto. Si ya existe otro con ese nombre, se restaura como «(restaurado)».

### Corregido
- **Aviso falso de «Se eliminó la carpeta…».** Al crear un proyecto, la revisión de la carpeta podía leer la lista justo antes de que su carpeta se creara y avisar que se había eliminado. Ahora el aviso solo sale si la carpeta existió y, al volver a comprobarla una por una, de verdad ya no está.

---

## [0.7.3] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 83

### Nuevo
- **Avisos cuando una carpeta cambia desde fuera** (desde Archivos, la PC u otra app). Los proyectos nunca se borran de TeXsting por esto.
  - **Se borró `Projects_LaTeX`, se movió o se le cambió el nombre:** en el inicio aparece «No se encuentra la carpeta…», con dos opciones.
    - **Volver a crearla:** se crea en el mismo lugar con todos los proyectos.
    - **Buscarla:** si la renombraste o la moviste, la eliges y cada proyecto vuelve a encontrar su carpeta.
  - **Se borró la carpeta de un proyecto:** aviso «Se eliminó la carpeta de "Informe"», con **Volver a crearla** o **Dejar solo en la app**.
  - **Se le cambió el nombre a la carpeta de un proyecto:** TeXsting la reconoce por sus archivos y sigue usándola. El proyecto toma el nuevo nombre, y un aviso lo dice.
  - Si abres un proyecto cuya carpeta ya no está, también se avisa.
  - Mientras la carpeta falta, TeXsting no intenta escribir en ella (antes salía «No se pudo guardar en la carpeta»).
- Antes, si se borraba la carpeta de un proyecto, la app la volvía a crear sin decir nada. Ahora pregunta.

### Pruebas
- `tests/carpetas.mjs` agrega estos casos: carpeta de proyecto renombrada y borrada, `Projects_LaTeX` borrada y renombrada, y escribir después de todo.

---

## [0.7.2] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 82

### Cambiado
- **Elegir la carpeta de proyectos es más directo.** La tarjeta del inicio ofrece tres opciones:
  - **Crear la carpeta Projects_LaTeX:** TeXsting crea `Documentos/Projects_LaTeX` y abre el selector de Android ya ahí. Solo queda tocar «Usar esta carpeta» y «Permitir»: ya no hace falta crearla a mano.
  - **Otra carpeta:** se usa la que elijas. Si eliges Documentos o la raíz del teléfono, adentro se crea `Projects_LaTeX`, para no tomar como proyectos tus otras carpetas.
  - **Ahora no.**
  - Lo mismo está en Ajustes → Carpeta de proyectos.

---

## [0.7.1] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 81

### Corregido
- **Al abrir con TeXsting un `.tex` de `Projects_LaTeX` (desde Archivos), la app ofrecía importarlo como proyecto nuevo.** Ahora reconoce que el archivo es de uno de tus proyectos y abre ese proyecto en ese archivo, con los cambios de la carpeta ya traídos. Funciona también con carpetas abiertas con «Abrir → Carpeta del teléfono», y con carpetas nuevas en `Projects_LaTeX` que todavía no eran proyecto.

---

## [0.7.0] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 79

### Nuevo
- **Carpeta propia: Documentos/Projects_LaTeX** ([#4](https://github.com/P3dr1t0/texsting/issues/4)).
  - En el inicio aparece «Guarda tus proyectos en una carpeta del teléfono». Con «Elegir carpeta» se elige Documentos, TeXsting crea `Projects_LaTeX` y copia ahí todos los proyectos, uno por carpeta. También se puede hacer o cambiar en Ajustes → Carpeta de proyectos.
  - Desde ese momento cada cambio se guarda también en la carpeta: se ve desde Archivos o la PC y no se pierde si desinstalas la app.
  - Lo que cambies desde fuera (la PC, otra app) aparece al abrir el proyecto o al volver a TeXsting, con el aviso «Actualizado desde la carpeta».
  - Una carpeta nueva copiada a `Projects_LaTeX` (por ejemplo, desde la PC) aparece sola como proyecto.
  - Al compilar se guarda el PDF junto al `.tex`.
  - Renombrar un proyecto renombra su carpeta. Eliminarlo borra su carpeta, y el mensaje de confirmación lo dice.
- **Abrir una carpeta que ya existe** ([#7](https://github.com/P3dr1t0/texsting/issues/7)). El botón «Importar» ahora se llama «Abrir» y ofrece:
  - **Carpeta del teléfono:** un proyecto que ya tienes. TeXsting detecta el archivo principal (el `.tex` con `\documentclass` y `\begin{document}`) y trabaja sobre esa carpeta, en su lugar. Si lo quitas de TeXsting, la carpeta queda intacta.
  - **Archivos .tex o .zip:** como antes, se copian a la app.
- En **Licencias y créditos** se reconoce la ayuda de Claude (Anthropic) como asistente de programación.

### Pruebas
- `tests/carpetas.mjs` prueba todo el recorrido con una carpeta simulada: elegir la carpeta, editar desde fuera, escribir en la app, abrir una carpeta existente, carpetas nuevas, renombrar y eliminar.

---

## [0.6.5] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 78

### Nuevo
- **Pantalla «Licencias y créditos»** (Ajustes → Acerca de → Licencias y créditos) ([#17](https://github.com/P3dr1t0/texsting/issues/17)).
  - Autor: Pedro de la Cruz Castillo. Licencia GPL-3.0 y enlace al código en GitHub.
  - Nota: el nombre «TeXsting» y su ícono identifican la app oficial.
  - Cada componente de terceros aparece con lo que hace en la app, su licencia, sus autores y el enlace a su código fuente: TeX Live, paquetes de CTAN, fuentes Latin Modern y TeX Gyre, MetaPost y Lua, las bibliotecas de XeTeX y LuaTeX, CodeMirror, PDF.js, Capacitor y XZ for Java.
  - Los textos completos de GPL-3.0, GPL-2.0, LGPL-2.1, Apache-2.0 y MIT vienen dentro de la app y se abren tocando su etiqueta. Las demás licencias abren su página oficial.

---

## [0.6.4] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 77

### Corregido
- **MetaPost en LuaLaTeX (`luamplib`, `mplibcode`) fallaba con «I can't open file `plain.mp'».** Los archivos base de MetaPost no venían en el motor y la app no sabía qué paquete bajar. Ahora los descarga solos la primera vez (paquete `metapost`, o `metafun` para los que empiezan con `mp-`).
- **La barra decía «Pasada 5 (índice y referencias)» cuando en realidad repetía por los paquetes que acababa de descargar.** Ahora esa pasada dice «(con los paquetes nuevos)».

---

## [0.6.3] — 20 nov. 2026 · Fase 2: Beta con motor integrado · compilación 76

### Cambiado
- **El progreso se muestra en porcentaje.** La barra dice «Pasada 1 · 45 %» y el botón de compilar muestra el mismo porcentaje, en lugar de los segundos.
  - Si la app todavía no sabe cuánto tarda ese tipo de compilación (por ejemplo, la primera con ⚡), la barra se mueve sin número en vez de mostrar un porcentaje equivocado.
- **El trabajo en segundo plano también tiene porcentaje:** «Guardando figuras · 40 %» o «Guardando el preámbulo · 70 %».
  - El motor avisa en qué etapa va (revisar el documento, dibujar las figuras, comprobar el resultado) y cuánto debería tardar cada una según lo que demoró la compilación normal.
- **TeXsting ya no usa Termux.** En el teléfono y la tablet compila siempre con el motor integrado (pdfLaTeX, XeLaTeX y LuaLaTeX).
  - Se quitaron de Ajustes «Compilar con» y la sección de Termux.
  - También se quitaron los avisos «Abrir Termux» y el chip de Termux de la pantalla de inicio.
  - Lo único que solo estaba en Termux era **biber**: los documentos con `biblatex` se compilan con BibTeX, que sirve para los estilos estándar. Estilos como `ieee` necesitan biber y quedan pendientes ([#1](https://github.com/P3dr1t0/texsting/issues/1)).

### Pruebas
- Tres documentos para probar LuaLaTeX en `tools/diag/lua/`:
  - cálculos en Lua y unicode-math;
  - gráficas con datos calculados en Lua, pgfplots y MetaPost (luamplib);
  - tipografía: fuentes OpenType, microtype y lua-ul.

---

## [0.6.2] — 18 nov. 2026 · Fase 2: Beta con motor integrado · compilación 75

### Nuevo
- **Indicador de progreso al compilar.** Bajo la barra superior aparece una barra de avance con el paso actual y los segundos (por ejemplo «Pasada 1 · 12 s de ~40 s», «Armando el PDF», «Descargando el paquete…»).
  - La barra estima el avance con lo que tardó ese documento la última vez. La app recuerda dos tiempos, con ⚡ y sin ⚡, y la primera pasada dice cuál toca.
  - La primera vez, sin ese dato, la barra se mueve sin porcentaje.
- **Indicador de trabajo en segundo plano.** Mientras se guardan las figuras o el preámbulo aparece «Guardando figuras para la próxima compilación…» con una barra en movimiento. Desaparece cuando llega el aviso «Listo en segundo plano».

### Corregido
- **Dos pasadas completas al volver a compilar antes de que terminara el guardado en segundo plano** (en Circuitos, dos veces 40 s).
  - Mientras guardaba las figuras, la app compilaba el documento sin ellas y dejaba el índice y las referencias con otros números de página. La compilación siguiente veía el índice cambiado y repetía la pasada.
  - Ahora esos archivos (.aux, .toc…) se guardan antes y se reponen al terminar o al cortarse.

## [0.6.1] — 18 nov. 2026 · Fase 2: Beta con motor integrado · compilación 74

### Más rápido
- **Las figuras se guardan usando varios núcleos a la vez.** Con 8 figuras o más, se reparten entre hasta 3 compilaciones simultáneas (una por cada par de núcleos). Cada una dibuja solo su parte.
  - En la tablet (8 núcleos), el aviso «Listo en segundo plano» debería llegar en aproximadamente la mitad del tiempo. Circuitos tiene 136 figuras.
  - También acelera la compilación cuando cambias varias figuras a la vez.

## [0.6.0] — 18 nov. 2026 · Fase 2: Beta con motor integrado · compilación 73

### Más liviana
- **La app ocupa ~21 MB menos en el teléfono, y el APK pesa 7 MB menos** (de 63 a 56 MB; dentro del APK esos datos van comprimidos). Los datos de idiomas de ICU que trae XeLaTeX pasan de 33.6 MB a 12.8 MB.
  - ICU tiene una parte para cortes de línea, conversión de texto y normalización, que XeLaTeX sí usa. La otra parte (orden alfabético, fechas, monedas, unidades, husos horarios) ni siquiera viene en la app, así que sus datos nunca se leían y se quitaron.
  - Lo que queda es idéntico byte por byte al original.
- **Todas las librerías están alineadas a 16 KB**, como exige Google Play. La única que faltaba (`libandroid-complex-math`, de la que LuaLaTeX solo usa una función, `cpow`) se reemplazó por una propia de 20 líneas, con resultados idénticos a los de la biblioteca estándar.

### Más rápido (pdfLaTeX)
- **El preámbulo guardado y las figuras guardadas ahora se usan juntos.** Antes eran excluyentes y la app usaba el que hubiera sido más rápido. En Física Moderna con pdfLaTeX (medido en una PC): 1.7 s con las figuras, 1.1 s con las dos cosas.

### Corregido
- **Con el preámbulo guardado de pdfLaTeX, la primera página salía unos 13 pt más arriba** que compilando normal. Se notaba en portadas con `\vspace*` al inicio. El formato guardado perdía un valor interno de TeX (`\prevdepth`) que la clase del documento deja en 0. Ahora se anota al guardar el preámbulo y se repone, y la página sale idéntica. Los preámbulos guardados se rehacen solos una vez.

### Cambios
- **«Log completo» ya no empieza con una línea larga de código de la app**: lo que activa las figuras guardadas va en un archivo aparte.

## [0.5.6] — 18 nov. 2026 · Fase 2: Beta con motor integrado · compilación 72

### Corregido
- **Portada en blanco y páginas de más con las figuras guardadas.** Los dibujos que van sobre la página (portadas con franja, marcos: `remember picture` u `overlay`) se guardaban como una figura del tamaño de una hoja entera. Al ponerla en su lugar empujaba todo, así que la primera página salía en blanco y aparecían páginas de más (Física 42 → 43, Trigonometría 55 → 57).
  - Ahora esos dibujos se dejan sin guardar y se dibujan normalmente; las demás figuras sí se guardan.
  - Como seguro adicional, si con las figuras guardadas cambia el número de páginas, la app no las usa y compila como siempre, y «Log completo» dice por qué.
  - Las figuras que se guardaron con el problema se vuelven a armar solas.

## [0.5.5] — 18 nov. 2026 · Fase 2: Beta con motor integrado · compilación 71

### Cambios
- **Aviso cuando las figuras o el preámbulo quedan guardados.** Al terminar en segundo plano aparece «Listo en segundo plano: la próxima compilación será más rápida ⚡». Así sabes cuándo conviene volver a compilar. En el celular, un documento con muchas figuras puede tardar un par de minutos en guardarlas.
- **Se vuelve a intentar guardar las figuras de los documentos donde antes no se pudo.** Las versiones anteriores marcaban algunos documentos como «no se pueden guardar aparte» (Trigonometría, por ejemplo). Esa marca seguía valiendo aunque el método nuevo de la 0.5.4 sí pueda guardarlas.
- **Si de verdad no se pueden guardar, «Log completo» dice por qué**, con el error que aparece, para poder corregirlo.

## [0.5.4] — 17 nov. 2026 · Fase 2: Beta con motor integrado · compilación 70

### Más rápido
- **Las figuras TikZ se guardan en una sola compilación, y no en una por figura.** Las figuras dibujadas se guardan para no redibujarlas cada vez que compilas. Antes eso costaba una compilación del documento entero por cada figura: 31 figuras eran 31 compilaciones en segundo plano. En XeLaTeX eso podía tomar varios minutos, y si volvías a compilar antes, se cortaba.
  - Ahora una sola compilación saca todas las figuras juntas y la app las separa en centésimas de segundo.
  - En Física Moderna, guardar las 31 figuras pasó de 56 s a 7 s en XeLaTeX y de 39 s a 6 s en pdfLaTeX (medido en una PC; en el celular la proporción es parecida).
  - Las compilaciones siguientes pasan de ~7 s a ~2 s en esa misma PC (⚡ en el aviso).
  - Sirve para pdfLaTeX, XeLaTeX y LuaLaTeX, y el PDF queda idéntico. Si algún documento no se deja, se usa el método anterior.
- **Los circuitos (`circuitikz`) con babel en español ya se pueden guardar como figuras.** En español, babel le da otro significado a `<` y `>`, y opciones como `i>^=` daban error al guardar cada circuito. Por eso esos documentos se compilaban siempre completos, sin ⚡. Ahora esos caracteres se apagan mientras se lee el circuito, como hace TikZ con sus propios dibujos.
- **Si un documento no deja guardar sus figuras aparte** (p. ej. `karnaugh-map` o `tikz-timing`), la app lo detecta con la primera prueba y no lo vuelve a intentar en cada compilación.

### Cambios
- **Tiempos de cada paso en «Log completo»**: cuánto tomó cada pasada, el armado del PDF y las figuras, y si se usaron las figuras o el preámbulo guardados. Así se ve qué es lo lento de cada documento.
- **Los documentos preparados para los dos motores ya no se pasan solos a XeLaTeX.** Si un documento carga fontspec solo dentro de `\ifPDFTeX … \else … \fi`, ya está listo para pdfLaTeX, y la app ya no lo cambia a XeLaTeX.
- **Sugerencia de usar pdfLaTeX.** Si un documento así se compila con XeLaTeX o LuaLaTeX y tarda, la app sugiere una vez pasarlo a pdfLaTeX, que es varias veces más rápido, con un botón «Usar pdfLaTeX».

## [0.5.3] — 17 nov. 2026 · Fase 2: Beta con motor integrado · compilación 69

### Corregido
- **XeLaTeX hacía una sola pasada.** fontspec y polyglossia escriben «not found» en mensajes que son solo informativos. El motor lo tomaba como un paquete faltante y cortaba las pasadas, así que el índice, las referencias y las portadas con TikZ (`remember picture`) quedaban a medias. Por eso salían «Las etiquetas cambiaron: vuelve a compilar» y la portada de Circuitos casi en blanco. Ahora solo corta si de verdad falta un archivo.
- **XeLaTeX: «Cannot proceed without .vf or "physical" font»** (Física Moderna). El programa que arma el PDF no encontraba una letra Type 1 de un paquete de símbolos, como esint. Ahora la app la busca, la descarga y vuelve a armar el PDF. Si no la encuentra, el aviso dice qué letra falta.

### Cambios
- **El aviso de «Listo en…» también cuenta la preparación de XeLaTeX y LuaLaTeX** («de ellos X s preparando el motor») la primera vez que se usan.

## [0.5.2] — 17 nov. 2026 · Fase 2: Beta con motor integrado · compilación 68

### Corregido
- **XeLaTeX: «xdvipdfmx:fatal: Unrecognized paper format: a4»**, que impedía armar el PDF en todos los documentos de XeLaTeX. El programa que convierte el resultado en PDF busca la lista de tamaños de papel en la carpeta de Termux, y dentro de TeXsting esa carpeta no existe. Ahora la app le da su propia lista (A0–A10, Carta, Oficio, Tabloide, B4, B5…) con A4 por defecto.

## [0.5.1] — 16 nov. 2026 · Fase 2: Beta con motor integrado · compilación 67

### Corregido
- **XeLaTeX: «No se generó el PDF» sin ningún error** (p. ej. en el Cuaderno de Trigonometría). XeTeX escribe primero un archivo intermedio (.xdv) y otro programa, xdvipdfmx, lo convierte en PDF. Antes XeTeX lo llamaba por su cuenta, y si fallaba no quedaba rastro.
  - Ahora la app corre xdvipdfmx aparte, una sola vez al final y no en cada pasada, así que también es más rápido.
  - Si xdvipdfmx falla, sus mensajes aparecen en Mensajes como «XeLaTeX compiló, pero no se pudo armar el PDF».
- **«Falta el archivo errbabel.def» con `\usepackage[provide=*]{babel}` y `\babelprovide[import,main]{spanish}`** (Física Moderna, Circuitos Eléctricos I). El motor no traía los archivos de idioma nuevos de babel (`babel-es.ini`). Ahora los trae, y esa forma de cargar babel funciona en XeLaTeX y LuaLaTeX.

## [0.5.0] — 16 nov. 2026 · Fase 2: Beta con motor integrado · compilación 66

### Nuevo: XeLaTeX dentro de la app
- **XeLaTeX en el motor integrado, sin Termux.** Usa XeTeX real, con xdvipdfmx para armar el PDF: fontspec, polyglossia, unicode-math, xeCJK, mathspec y `\XeTeX…` funcionan como en Overleaf. Con esto, el motor integrado trae los tres: **pdfLaTeX, XeLaTeX y LuaLaTeX**.
- **Fuentes del teléfono en XeLaTeX.** Se puede usar `\setmainfont{Roboto}`, `{Noto Serif}` y cualquier fuente instalada en Android, además de las de TeX. Las de TeX que falten (TeX Gyre, Libertinus, Fira…) se bajan solas.
- **Los formatos de XeLaTeX y LuaLaTeX se preparan solos** al abrir la app, en segundo plano, después de pdfLaTeX. Así la primera compilación con esos motores no tiene que esperarlos. Si compilas mientras se preparan, se pausan y siguen la próxima vez.
- **Ya no se cambia XeLaTeX por LuaLaTeX:** cada documento se compila con el motor que pide.

### Cambios
- **Ajustes:** «Probar motor integrado» prueba los tres motores. Termux queda como respaldo opcional.
- **Pantalla de inicio:** el aviso dice «Motor integrado listo · pdfLaTeX, LuaLaTeX, XeLaTeX».

### Nota
- **APK más grande:** unos 60 MB. Casi todo es ICU (33 MB sin comprimir), la biblioteca de idiomas que XeTeX necesita para cortar líneas y manejar el texto en otros alfabetos. Más adelante se puede recortar ICU a lo que XeTeX usa de verdad, pero ese recorte hay que probarlo en un teléfono.

## [0.4.1] — 16 nov. 2026 · Fase 2: Beta con motor integrado · compilación 65

### Más rápido
- **El motor se prepara al abrir la app, no al compilar.** Después de instalar o actualizar, TeXsting tiene que descomprimir TeX y armar su formato. Antes eso pasaba en la primera compilación, y era gran parte de los ~40 s del informe IEEE. Ahora empieza solo apenas abres la app, y la pantalla de inicio dice «Preparando el motor integrado…» hasta que termina.
- **Las figuras guardadas sobreviven a las actualizaciones.** Antes, cada versión nueva de la app obligaba a redibujar todas las figuras (TikZ, pgfplots, circuitikz) de cada proyecto. Ahora se conservan y solo se redibujan las que cambiaste.
- **Si una compilación tuvo que preparar el motor, el aviso lo dice:** «Listo en N s, de ellos M s preparando el motor (solo tras actualizar)». Así se distingue del tiempo real del documento.

## [0.4.0] — 16 nov. 2026 · Fase 2: Beta con motor integrado · compilación 64

### Nuevo: LuaLaTeX dentro de la app
- **LuaLaTeX en el motor integrado**, sin Termux: fuentes OpenType con `fontspec`, matemática Unicode con `unicode-math`, `polyglossia`, `luacode`… La primera vez que se usa, se prepara unos segundos.
- **Los documentos «de XeLaTeX» se compilan con LuaLaTeX.** fontspec, unicode-math y polyglossia funcionan igual en los dos, así que esos documentos ya no necesitan Termux. Solo lo exclusivo de XeLaTeX (xeCJK, mathspec, `\XeTeX…`) sigue yendo a Termux.
- **Fuentes que faltan, al vuelo.** Con `\setmainfont{TeX Gyre Termes}`, `{Libertinus Serif}`, `{Fira Sans}`, etc., si la fuente no está se busca su paquete en CTAN, se descarga y se vuelve a compilar.
- **biblatex sin biber (en prueba).** El motor le pide a biblatex que use BibTeX, que sí viene en la app. Si el documento dice `backend=biber` y aun así falla, el aviso ofrece **«Usar backend=bibtex»**.
  - **Sin confirmar:** en la prueba en la nube BibTeX corrió sin errores, pero las citas todavía salían como «no definidas». Se sigue revisando.

### Cambios
- **Ajustes:**
  - «Probar motor integrado» prueba pdfLaTeX y LuaLaTeX.
  - La sección Termux explica que solo hace falta para lo exclusivo de XeLaTeX.
- **Pantalla de inicio:** el aviso dice «Motor integrado listo · pdfLaTeX, LuaLaTeX».
- **README:** Termux pasa a ser opcional.

### Nota
- **APK más grande:** unos 44 MB, por las bibliotecas de LuaLaTeX (HarfBuzz, FreeType…) y las fuentes OpenType Latin Modern.
- **Primera vez tras actualizar:** el motor se prepara de nuevo. Los paquetes que ya habías descargado se conservan.

## [0.3.1] — 15 nov. 2026 · Fase 2: Beta con motor integrado · compilación 63

### Más rápido
- **Los circuitos de circuitikz también se guardan ya dibujados.** Antes solo se guardaban las figuras de TikZ y pgfplots; los `\begin{circuitikz}` se volvían a dibujar en cada compilación, y en informes con varios circuitos eso era la mayor parte del tiempo. Funciona también con opciones (`[scale=0.8]`) y dentro de `\resizebox`.
  - La primera compilación después de actualizar dibuja una vez los circuitos; las siguientes los reutilizan.

## [0.3.0] — 15 nov. 2026 · Fase 2: Beta con motor integrado · compilación 62

### Nuevo: el motor integrado pasa a ser el principal
- **Ya no hace falta Termux para compilar con pdfLaTeX.** En Ajustes → Compilación, la nueva opción **«Compilar con»** viene en **Automático**: usa el motor integrado de TeXsting y solo recurre a Termux si un documento necesita XeLaTeX o LuaLaTeX. También se puede elegir «Solo motor integrado» o «Solo Termux».
- **El aviso de la pantalla de inicio** ahora dice «Motor integrado listo» y ya no pide abrir Termux. Ajustes separa la sección **Termux (opcional)**.
- **BibTeX y makeindex dentro del APK.** Las bibliografías con `\bibliography{…}` y los índices alfabéticos con `\makeindex` se arman solos al compilar, como latexmk. Los estilos más comunes (plain, alpha, abbrv, unsrt…) vienen incluidos, y los demás (IEEEtran.bst, apalike…) se descargan solos.
  - **Limitación:** biblatex con biber todavía no funciona en el motor integrado. Usa `\usepackage[backend=bibtex]{biblatex}`.

### Más rápido
- **Documentos con cajas de tcolorbox y muchas figuras (p. ej. Física Moderna): de 31 s a unos pocos segundos.** Las figuras guardadas fallaban cuando el documento usaba cajas de `tcolorbox`, así que cada compilación volvía a dibujarlo todo. Arreglado: en la prueba bajó de 6,2 s a 1,4 s por compilación (unas 4 veces más rápido).
- **Las figuras se dibujan en paralelo:** varias a la vez, según los núcleos del equipo. Las 31 figuras de Física Moderna tardan la mitad.

### Corregido
- **Archivos con espacios o paréntesis en el nombre** (p. ej. `fisica_moderna (1).tex`): el preámbulo guardado y las figuras no funcionaban con esos nombres. Ahora sí.

### Nota
- La primera vez tras actualizar, el motor se prepara de nuevo (unos segundos), porque ahora trae BibTeX y makeindex. Los paquetes que ya habías descargado se conservan.

## [0.2.50] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 61

### Corregido
- **«Font esint10 at 657 not found» con el motor integrado.** Pasaba con `\usepackage{esint}` (integrales cerradas `\oint`): el paquete trae la medida de las letras, pero su dibujo viene aparte, en `esint-type1`. El motor no reconocía este mensaje y no bajaba nada.
  - Ahora lo reconoce, descarga la letra que falta (unos 30 KB) y vuelve a compilar solo.
  - Sirve para cualquier paquete de símbolos con el mismo problema.

## [0.2.49] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 60

### Mejorado
- **Avisos más claros, con arreglo de un toque:**
  - **Tilde dentro de una fórmula** (`\operatorname{Máx}`, `\mathrm{Mín}`…): antes decía «probablemente falta cerrar un $», que no era la causa. Ahora explica que en una fórmula las tildes no funcionan y ofrece **«Usar \text{Máx}»**.
  - **Tamaño de letra no disponible** (p. ej. un título con `\fontsize{38}`): antes salía en inglés. Ahora dice qué tamaño usó LaTeX en su lugar y ofrece **«Agregar \RequirePackage{fix-cm}»** para tener el tamaño exacto.

## [0.2.48] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 59

### Corregido
- **«xpdf: reading PDF image failed» con figuras de TikZ (motor integrado).** Si una figura se quedaba a medio guardar (por ejemplo, al compilar mientras se preparaban las figuras en segundo plano), el PDF quedaba roto y la compilación fallaba.
  - Ahora cada figura se verifica al terminar y, si no salió completa, se borra.
  - Si aun así aparece una figura dañada, la app la detecta, la vuelve a dibujar y compila de nuevo sola.
- **«Giving up on this path. Did you forget a semicolon?» cuando el «;» sí está.** Pasa con `\underline{…}` dentro de un `\node` de TikZ: la versión de LaTeX de noviembre de 2026 (la del motor integrado y Termux actualizado) cambió `\underline`. Overleaf aún usa la versión anterior, por eso allí no falla.
  - La pantalla de errores ahora explica la causa real y ofrece el botón **«Poner \underline entre llaves»**, que lo cambia por `{\underline{…}}`.

### Más rápido
- **Primera compilación del cuaderno: de ~150 s a mucho menos.** Las letras de cm-super (letras con tildes en T1) ya no se bajan como paquete completo (~60 MB): solo se descarga cada letra que el documento usa (~100–150 KB cada una).
- Todas las letras que faltan se piden juntas en una sola vuelta, en lugar de una compilación por letra.

## [0.2.47] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 58

### Nuevo
- **Compartir ya no es solo el PDF.** El botón de compartir (y ⋮ → «Compartir…») abre un menú:
  - **PDF**: el documento listo para entregar o imprimir.
  - **Código .tex**: el archivo principal.
  - **Este archivo**: el que tienes abierto, si no es el principal (proyectos con varios archivos).
  - **Proyecto completo (.zip)**: todos los archivos, para seguir editándolo en otra app u Overleaf (proyectos con varios archivos).
  - **Proyecto + PDF (.zip)** (o «Código + PDF» si es un solo archivo): todo junto, para entregar el trabajo.

### Mejorado
- **Íconos más claros:**
  - «Ajustes» ahora es la tuerca de siempre; antes parecía un sol.
  - «Apariencia y tamaño de letra» es un pincel.
  - «Motor» usa un chip.

## [0.2.46] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 57

### Mejorado
- **Panel «Buscar y reemplazar» nuevo, ordenado y en español.** El de antes quedaba desordenado en el teléfono y la tablet.
  - Dos columnas iguales: a la izquierda las casillas «Buscar» y «Reemplazar por», a la derecha dos botones del mismo tamaño (↑ ↓ y «Cambiar» / «Todas»).
  - Debajo, las opciones como botones que se encienden: «Aa» (mayúsculas), «Palabra completa» y «.* Regex». Y «Cerrar» (✕).
  - Muestra cuántas coincidencias hay y en cuál estás («3 de 12»). Si no hay ninguna, dice «Sin resultados» en rojo.
  - Atajos: Enter → siguiente; Mayús+Enter → anterior; Enter en «Reemplazar por» → cambia esta; Ctrl+Enter → todas; Esc → cerrar.

### Corregido
- **Mensajes cortados a la mitad**, como «Giving up on this path. Did you forge».
  - TeX corta cada línea del registro a 79 caracteres. Ahora la app las vuelve a unir antes de leerlas, así que esos errores salen completos y explicados en español.
  - Ese mismo arreglo mejoró varias de las pruebas de errores:
    - opción mal escrita: «¿Quisiste decir «resistor»?», «xlabel»;
    - falta «;»: ahora marca la línea correcta;
    - texto antes del primer \item;
    - «\begin{enumerate} se cerró con \end{itemize}».
- **Motor integrado:** la «versión» de TeX se calcula según su contenido. Así la app solo se vuelve a preparar al actualizar cuando TeX cambió de verdad.

## [0.2.45] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 56

### Mejorado (optimización, #8): figuras guardadas
- **Motor integrado: las figuras de TikZ y pgfplots ya no se redibujan en cada compilación.**
  - Después de compilar, el motor guarda en segundo plano cada figura ya dibujada.
  - Desde ahí, cada compilación solo dibuja de nuevo las figuras cuyo código cambió (avisa «Dibujando la figura que cambió…»). Las demás se pegan ya hechas.
  - En un documento de prueba con 8 gráficas de pgfplots, una compilación pasó de 4,2 s a 1,3 s (−69 %).
- **Los circuitos de circuitikz se siguen dibujando normal**, porque no se pueden guardar así. Son rápidos.
- **Se vuelven a dibujar todas** si cambias el preámbulo (p. ej. `\pgfplotsset`) o un archivo de datos (.csv, imágenes). Así nunca queda una figura vieja.
- **El trabajo en segundo plano se corta en cuanto tocas Compilar**, así que nunca te hace esperar. Si se interrumpe, sigue después donde quedó.
- **En cada proyecto se usa lo que resulte más rápido:** el preámbulo guardado o las figuras guardadas. Las dos se muestran con ⚡.
- Si un proyecto da más errores con las figuras guardadas que sin ellas, la app lo detecta y en ese proyecto compila como siempre.
- Verificado en la compilación del APK con TeX Live 2026: IEEEtran + circuitikz + pgfplots, sin errores.

## [0.2.44] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 55

### Corregido
- **Al actualizar la app, el motor integrado borraba los paquetes ya descargados** y había que volver a bajarlos todos. Por eso la primera compilación después de instalar la 0.2.43 tardó 57,3 s.
  - Ahora, al actualizar, solo se renuevan TeX y su formato. Los paquetes descargados se conservan y sus fuentes se vuelven a registrar solas.

### Medido en el Poco X7 Pro (Informe IEEE de 8 páginas)
- Motor integrado con preámbulo guardado (⚡): **12,3 s**. Termux: **13,87 s**. El motor integrado ya es ~11 % más rápido que Termux.

## [0.2.43] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 54

### Mejorado (optimización, #8): motor integrado más rápido
- **Preámbulo guardado:** después de compilar, el motor guarda en segundo plano tu preámbulo ya cargado, con todos los `\usepackage`, TikZ, pgfplots y las letras.
  - Desde la siguiente compilación, TeX se salta esa parte. Cuando pasa, el aviso dice «Listo en … s (motor integrado ⚡)».
  - En la prueba IEEE del servidor de compilación, una pasada bajó de 0,81 s a 0,30 s (−63 %). En tu Informe, lo que se ahorra es la parte de cargar paquetes. Lo que tarda dibujar las gráficas de pgfplots sigue igual.
  - Si cambias el preámbulo, se vuelve a guardar solo. Si un proyecto no se lleva bien con esto (algunos paquetes no se pueden «congelar»), la app lo detecta y en ese proyecto compila como siempre.
- **La primera compilación baja todo de una vez:** el APK trae una tabla con lo que piden los paquetes y clases más usados. Por ejemplo, IEEEtran → Times; circuitikz y pgfplots → pgf (TikZ); beamer → pgf.
  - Esa tabla cubre 42 de ellos y se calcula al armar el APK, compilando cada uno desde cero.
  - Con eso, antes de compilar se bajan juntos los paquetes y sus dependencias. En la prueba IEEE pasaron de 7 compilaciones extra a **ninguna**.
- Al guardar el preámbulo de IEEEtran también se bajan, en silencio, las letras que la clase deja listas (Courier y Helvetica).

## [0.2.42] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 53

### Corregido
- **Motor integrado: tu Informe IEEE salía con la letra equivocada.**
  - **Prueba en el Poco X7 Pro:** el Informe compiló sin Termux. La primera vez tardó 50,6 s porque bajó 7 paquetes; desde la segunda, 13,4 s.
  - **Las 14 advertencias** («la fuente no tiene esa combinación de estilos») venían de que IEEEtran usa Times. LaTeX no encontró su descripción (`ot1ptm.fd`) y, sin dar error, puso Computer Modern en su lugar.
  - **Ahora el motor también reconoce ese aviso** y baja lo necesario para Times: psnfss, times y la codificación 8r. Comprobado: el PDF lleva Times (utmr8a, utmb8a…) y no queda ninguna advertencia de fuentes.
  - **Lo que hacía fallar la detección:** TeX corta el registro a 79 caracteres, y eso partía el mensaje «Metric (TFM) file not found» en dos líneas. Ahora las líneas se vuelven a unir antes de buscar.
  - Cuando una fuente nueva ya estaba en el mapa de fuentes, pdfTeX avisaba «already exists» por cada una. Ya no se duplican.

### Mejorado (optimización, #8)
- **Antes de compilar, el motor lee los `\documentclass` y `\usepackage` del proyecto** y baja de una vez los que faltan. Antes hacía una compilación completa por cada paquete que faltaba (7 rondas en tu Informe).
- Los errores de pdfTeX al armar el PDF («!pdfTeX error … cannot open Type 1 font file») ahora aparecen en Mensajes, explicados en español.

## [0.2.41] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 52

### Nuevo
- **Motor integrado: los paquetes que faltan se descargan solos**, como en MiKTeX o con Termux. Ya no hace falta Termux para usar TikZ, circuitikz, pgfplots y el resto de CTAN.
  - Al compilar, si falta un paquete, la app lo busca en un índice de TeX Live que viene en el APK: 145 000 archivos de casi 5000 paquetes, en 0,5 MB.
  - Lo descarga de CTAN y vuelve a compilar. Mientras tanto avisa «Descargando el paquete «pgf» (x MB)… (solo la primera vez)».
  - Si ese paquete pide otro, también lo baja. Por ejemplo, circuitikz → pgf (TikZ).
  - Los paquetes quedan guardados en el teléfono: desde la segunda vez compila sin internet.
  - Si un paquete trae fuentes nuevas, también quedan listas para usar.
  - Respeta el ajuste «Instalar paquetes faltantes».
  - Si no hay internet, la app dice qué no pudo descargar.
- Verificado en la compilación del APK: un documento con circuitikz + pgfplots, sin nada instalado, baja circuitikz, pgf y pgfplots en 3 rondas y compila sin errores.

### Mejorado (optimización, #8)
- El motor integrado solo reescribe los archivos del proyecto que cambiaron, y borra los que eliminaste en la app.

## [0.2.40] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 50

### Corregido
- **Una llave sin cerrar se marcaba en la línea equivocada.**
  - Ejemplo: en `\usepackage{xcolor` (línea 9), los Mensajes señalaban la línea 13, donde había un `\def\BibTeX{…}` repartido en dos líneas.
  - Ahora la app lee el párrafo como lo lee TeX, llave por llave, y marca **la primera llave que nunca se cerró**. Antes buscaba hacia atrás la línea con más `{` que `}`.
  - El botón «Agregar la } que falta» la pone al final del código de esa línea, antes de un comentario `%` si lo hay.
  - Los comandos que se definían dentro del tramo «tragado» ahora cuentan como errores en cadena de este mismo error, no como errores aparte. Por ejemplo, «\BibTeX no existe».

### Mejorado (para evitarlo en general)
- **El mismo método se usa en otros errores que TeX nota tarde:**
  - **Un `$` sin cerrar:** TeX avisa «Missing $» en la línea en blanco del final del párrafo. Ahora la app marca la línea donde se abrió la fórmula. Los errores de en medio pasan a ser errores en cadena: «letra con tilde dentro de una fórmula», «falta una llave»…
  - **Una llave sin cerrar hasta el final del archivo** (p. ej. `\textbf{…` sin cerrar): se marca la línea donde se abrió, y «Falta \end{document}» pasa a ser un error en cadena.
  - **Código literal (verbatim) sin cerrar:** se marca el `\begin{verbatim}` del bloque.
  - Al ubicar el texto que TeX muestra tras «Runaway argument?», la app ya no se confunde por los espacios que TeX agrega después de los comandos.
- Nuevo mensaje en español para «Please use \mathaccent for accents in math mode»: hay una letra con tilde dentro de una fórmula.

## [0.2.39] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 49

### Corregido
- **Motor integrado: «El registro tiene errores» en la prueba de Ajustes.**
  - **Primera prueba en el Poco X7 Pro:** el motor funcionó a la primera. El PDF de prueba salió en **0,9 s**.
  - **Causa del error:** faltaban algunos tamaños de letra (5 y 7 pt), que se usan en subíndices y exponentes de documentos de 10 pt. El paquete solo traía los tamaños que usaron los documentos de prueba.
  - **Solución:** ahora trae las familias de fuentes completas (Computer Modern, Latin Modern, AMS) y cada paquete de LaTeX entero. También se prueban documentos de 10, 11 y 12 pt con todos los tamaños y estilos.
  - **Tamaño:** el APK pasa de ~13 a ~30 MB. En la versión final, esta parte se descargará dentro de la app (instalación «básica», #1).
  - Si la prueba vuelve a dar errores, Ajustes ahora muestra las primeras líneas del error.

## [0.2.38] — 15 nov. 2026 · Fase 1: Beta con Termux · compilación 48

### Mejorado
- **Pantalla de inicio más ordenada y simétrica:**
  - Todo queda en dos columnas iguales: «Nuevo proyecto | Importar», «Recientes | Todos» y «Buscar | Orden».
  - «Nuevo proyecto» ya no se parte en dos líneas.
  - Las pestañas ocupan todo el ancho y cada una mide lo mismo.
  - El buscador tiene lupa y el mismo alto que el botón de orden. El botón ya no queda montado bajo el buscador.
  - El botón de orden usa textos cortos: «Nombre A → Z», «Editados recientes», «Creados antiguos»…
  - En la tablet, las pestañas quedan bajo «Nuevo proyecto» y el buscador con el orden bajo «Importar».
  - El buscador aparece desde 2 proyectos, junto con el botón de orden.

## [0.2.37] — 15 nov. 2026 · Fase 1: Beta con Termux (primer paso de la Fase 2) · compilación 47

### Nuevo (experimental)
- **Motor integrado: compilar sin Termux** ([#1](https://github.com/P3dr1t0/texsting/issues/1)). Es la primera prueba de que TeXsting puede compilar sola.
  - Está en **Ajustes → Motor integrado (experimental)**:
    - «**Probar motor integrado**» compila un documento de prueba y muestra cuánto tardó.
    - «**Usar el motor integrado**» hace que el botón Compilar lo use en tus proyectos, sin abrir Termux.
  - Por ahora solo trae **pdfLaTeX** y los paquetes más comunes: amsmath, amssymb, graphicx, xcolor, geometry, booktabs, multirow, siunitx, hyperref, babel en español, enumitem, fancyhdr, caption, float, titlesec, csquotes, lmodern, entre otros.
    - Si un documento necesita otro paquete o XeLaTeX/LuaLaTeX, la app lo avisa; desactiva la opción para seguir con Termux.
  - La primera vez se prepara solo, en unos segundos (descomprime TeX y crea el formato de LaTeX).
  - Es el mismo TeX Live 2026 de Termux, pero dentro del APK. El APK pasa de ~7 MB a ~14 MB.
  - Va con Google Play: los programas vienen dentro del APK y no se descargan aparte.

## [0.2.36] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 46

### Corregido
- **En la tablet, al ocultar el panel izquierdo** (Archivos / Estructura / Símbolos) con «<», no quedaba ningún botón para volver a mostrarlo.
  - Ahora queda una franja angosta a la izquierda con «>» y los íconos de Archivos, Estructura y Símbolos. Cada ícono abre el panel directamente en esa sección.
  - La app recuerda si dejaste el panel oculto o visible, también al cerrar y volver a abrir el proyecto.

---

## [0.2.35] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 45

### Resultado de la serie 4 (errores Q–V) en el celular
- Las 6 pruebas mostraron cada error en su línea y con una explicación correcta: texto pegado, referencias, tablas largas, código, estructura y datos.

### Nuevo: más arreglos con un toque
- **Falta un paquete** (`\multirow`, `\cref`, `\eqref`, `\toprule`, `[H]`…): botón «Agregar \usepackage{X}», que lo pone debajo del último `\usepackage`. No aparece si el paquete ya está escrito, por ejemplo cuando se lo «tragó» una llave sin cerrar.
- **Falta `\\` antes de `\hline`**: botón «Agregar \\ en la línea N». La explicación ahora dice en qué fila falta.
- **`_` en texto**: botón «Escribir mi\_variable».
- **`#` en texto**: botón «Escribir \#».
- **Ω, °, á, ≤… dentro de código (listings)**: botón para cambiarlos por texto simple («ohm», «grados», «a», «<=»…).
- Con varios arreglos, «Aplicar los N arreglos» los hace todos: en la prueba T quedan 0 errores de 4; en la S, solo el que hay que decidir a mano (qué columna sobra).

### Mejorado
- Los avisos de resumen («There were undefined references», «There were multiply-defined labels») pasan a ser **informativos**: repetían los de arriba y se contaban dos veces.
- En la pestaña PDF del celular ya no aparece el aviso rojo de abajo si la franja de arriba ya avisa de los errores.

---

## [0.2.34] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 44

### Resultado de la serie 4 (válidas) en el celular (Poco X7 Pro)
| Prueba | Tiempo | Resultado |
|---|---|---|
| 23 tabla larga | 5,5 s | ✅ 2 páginas, encabezado repetido |
| 24 código | 3,7 s | ✅ |
| 25 gráficas pesadas | 24,7 s | ✅ (la más pesada; el eje de tiempo salía con números repetidos) |
| 27 ejercicios | 9,5 s | ✅ referencias «el ejercicio 1.1», «el teorema 1.1» |
| 28 digital | 8,8 s | ✅ Karnaugh, compuertas y diagrama de tiempos |
| 29 física | 3,7 s | ✅ |
| 22 libro | — | ❌ error de la prueba: babel en español + flecha `->` de TikZ. TeXsting lo diagnosticó bien |
| 26 tipografía | — | ❌ error de la prueba: opción de csquotes inexistente |

### Pruebas corregidas (serie 4 actualizada)
- 22: `\usetikzlibrary{babel}`.
- 25: tiempo en milisegundos y la tabla de primeras filas, que no se mostraba; ahora con líneas y coma decimal.
- 26: `\usepackage[autostyle]{csquotes}`.

### Mejorado
- **Conflicto babel (español) + TikZ:** botón **«Agregar \usetikzlibrary{babel}»**, que lo inserta debajo de `\usepackage{tikz}` (o circuitikz/pgfplots).
- **csquotes con un estilo que no existe:** explicación en español, ubicada en la línea del `\usepackage`, con el botón «Usar [autostyle]».
- Los errores que ocurren dentro de un paquete ahora también pueden ubicarse en el documento cuando se sabe de qué línea vienen.
- Al aplicar varios arreglos juntos se procesan de abajo hacia arriba, así uno que agrega una línea no corre a los demás.

---

## [0.2.33] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 43

### Pruebas
- **Serie 4** en `pruebas/pruebas-texsting-serie4.zip`, 8 válidas y 6 con errores:
  - válidas: libro con índice alfabético, longtable, código con colores, gráficas pesadas, tipografía en español, ejercicios con tcolorbox y cleveref, electrónica digital (Karnaugh y diagramas de tiempos) y physics;
  - con errores: texto pegado de Word, referencias cruzadas, tablas largas, código, estructura de documentos largos y gráficas con datos.

### Mejorado: diagnósticos nuevos (encontrados al preparar la serie 4)
- **Caracteres pegados de Word, un PDF o la web**: espacio invisible, signo menos tipográfico «−», emojis, «≤», «×», letras griegas, ligaduras…
  - Cada uno con su explicación y un botón para quitarlo o cambiarlo por el comando correcto: `\leq` dentro de una fórmula, `$\leq$` en texto.
  - En el código mostrado, los caracteres invisibles se marcan como ⟦?⟧.
- **Errores en archivos que no son .tex**, por ejemplo el `.m` que lee `\lstinputlisting`: antes la app decía «con errores» pero mostraba 0. Explicación para «Invalid UTF-8 byte» (listings no acepta Ω ni emojis).
- **listings**: un lenguaje mal escrito sugiere el correcto («¿Quisiste decir Python?») con botón de arreglo.
- **Comandos de otra clase**: `\chapter`, `\frontmatter` o `\mainmatter` en un article explican qué clase los tiene.
- **`\input` o `\include` de un archivo que no existe**: dice que falta en el proyecto (y sugiere uno parecido).
- **Tablas**:
  - «Misplaced \noalign»: falta `\\` antes de `\hline`;
  - «Misplaced \omit»: una columna de más;
  - `\multirow`, `\cref`, `\printindex` y `\lstinline` indican qué paquete necesitan.
- **pgfplots con datos**:
  - una columna que no existe muestra las columnas que sí tiene el archivo;
  - un archivo de datos que falta se explica;
  - los avisos que vienen de esos errores («sin coordenadas», «rango vacío») se agrupan en cadena;
  - «Dimension too large» repetido cuenta una sola vez.
- `#` en texto se explica (se escribe `\#`).
- Avisos explicados: karnaugh-map con la forma vieja, cleveref sin nombre para un tipo de referencia, y lipsum en latín (informativo).
- La tarjeta «Arreglo» ya no dice que todos los arreglos son de fuentes.

---

## [0.2.32] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 42

### Nuevo
- **Aviso sobre un PDF que salió con errores.** Cuando hay errores pero LaTeX igual termina el PDF, ese PDF puede estar incompleto o verse mal. Por ejemplo, con un paquete sin cargar el índice sale en inglés y faltan tablas o figuras. Antes no había ninguna señal y parecía un PDF normal.
  - Ahora aparece una franja roja arriba del PDF: «Este PDF salió con N errores: puede faltar o verse mal parte del contenido · Ver».
  - Al tocarla se abren los Mensajes. Se ve también al volver a abrir el proyecto.
- La franja del **PDF anterior** (cuando la compilación no genera PDF) es ahora ámbar, con el PDF atenuado y «Ver errores».
- Las dos desaparecen al compilar bien. Funcionan igual en el celular y en la tablet.

---

## [0.2.31] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 41

### Mejorado: una llave sin cerrar en el preámbulo (visto en el celular con la plantilla Informe)
- Con `\usepackage[T1]{fontenc` sin su `}`, la app mostraba 8 errores. El primero apuntaba a la línea 11, con «Párrafo terminado antes de completar \@fileswith@ptions». Los demás decían «falta amsmath», «falta booktabs» o «falta float», aunque esos paquetes sí estaban escritos.
- Ahora:
  - **1 error, en la línea correcta (3)**, con la explicación: «A esta línea le falta la llave de cierre }. Por eso los \usepackage que siguen no se cargaron».
  - Botón **«Agregar la } que falta»**.
  - Los «falta el paquete…» de paquetes que sí están en el preámbulo, y lo que se rompe en esas mismas líneas, se agrupan como **en cadena** (9 en el ejemplo).
- Cualquier «Paragraph ended before…» o «File ended while scanning…» sin ubicación ahora busca hacia atrás la línea con una llave sin cerrar.
- Nueva explicación: «Unknown float option H» → necesita `\usepackage{float}`.

### Aclaración
- La franja «PDF de la compilación anterior» aparece solo cuando la compilación **no** genera PDF. Si hay errores pero LaTeX termina el PDF («el PDF se generó igual»), lo que se ve es el PDF nuevo.

---

## [0.2.30] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 40

### Corregido
- **En el celular, el PDF ocupaba solo la mitad izquierda de la pantalla** y la barra de zoom quedaba apretada («1 / 4» en vertical).
  - Era un error de la 0.2.22: la regla de estilo de la franja «PDF de la compilación anterior» pisaba la del diseño de celular, y el visor tomaba la proporción de la pantalla dividida de la tablet.
  - Ahora vuelve a ocupar toda la pantalla; la franja sigue funcionando en los dos diseños.
  - La prueba automática que se corre antes de cada versión ahora mide el ancho del visor en el celular, para que no se repita.

---

## [0.2.29] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 39

### Mejorado
- **Avisos «solo informativos».** Algunos avisos de paquetes no piden hacer nada; antes salían en inglés y contaban como advertencias. Ahora:
  - se explican en español;
  - se marcan como «Info» en gris;
  - van al final de la lista;
  - no suman al contador de advertencias (se muestran aparte, «N informativos»).
- Avisos que se reconocen como informativos:
  - unicode-math + mathtools (`\overbracket`, `\coloneqq`…), los dos que salían en el Cuaderno de Trigonometría;
  - «Token not allowed in a PDF string» de hyperref (fórmulas en títulos, con la sugerencia `\texorpdfstring`);
  - tamaños y variantes de letra sustituidos;
  - caption con una clase desconocida.
- Avisos que ahora se explican (y sí conviene atender):
  - pgfplots en modo compatible: sugiere `\pgfplotsset{compat=1.18}`;
  - `\headheight` demasiado pequeño en fancyhdr.

---

## [0.2.28] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 38

### Resultado en la tablet
- El *Cuaderno de Trigonometría* (XeLaTeX con Latin Modern por nombre, varios capítulos y TikZ) compila entero: 55 páginas.
  - 40 s la primera vez, mientras el servidor armaba el índice de fuentes.
  - 20 s las siguientes.

### Corregido
- **En la tablet no había cómo ver las advertencias.** Con errores el panel de Mensajes se abre solo, pero si la compilación salía bien con advertencias no había forma de abrirlo.
  - **Botón de Mensajes en la barra superior** (tablet), con contador: rojo con los errores o, si no hay errores, ámbar con las advertencias. Abre y cierra el panel.
  - El aviso verde «Listo en … · N advertencia(s)» trae ahora el botón **«Ver»**.
  - En el celular, la pestaña Mensajes también muestra el contador ámbar cuando solo hay advertencias.

---

## [0.2.27] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 37 · servidor Termux 0.2.5

### Corregido: XeLaTeX no encontraba por su nombre las fuentes de TeX Live (Cuaderno de Trigonometría)
- Un documento con `\setmainfont{Latin Modern Roman}` y `\setmathfont{Latin Modern Math}` daba 172 errores (+513 en cadena) en la tablet.
  - Las fuentes sí están instaladas, pero en Termux el buscador de fuentes que usa XeLaTeX (fontconfig) no mira las carpetas de TeX Live.
  - **Servidor 0.2.5:** al arrancar, prepara una configuración de fuentes que incluye las carpetas de TeX Live (OpenType y TrueType). Además construye la caché en segundo plano.
  - Ahora Latin Modern, TeX Gyre, Libertinus, STIX Two y demás se encuentran por su nombre, como en una computadora.
- **Explicación corregida.** Antes decía «no está instalada» y sugería otra fuente. Ahora, si la fuente viene con TeX Live, lo dice y da la forma por archivo, que siempre funciona (`\setmainfont{lmroman10}[Extension=.otf, …]`). Con Latin Modern, recuerda que se puede borrar la línea porque ya es la fuente por defecto.
- Si la misma fuente está en dos líneas (`\setmainfont` y `\setsansfont`), cada error señala su propia línea.
- «\textfont N is undefined» (falta la fuente matemática) se explica y se agrupa como consecuencia de la fuente que no cargó.

### Nuevo
- **Arreglar con un toque.**
  - Las tarjetas de fuentes traen un botón que reescribe la línea: «Usar el archivo de la fuente» o «Cambiar por texgyreheros».
  - Si hay varias, una tarjeta «Arreglo» las aplica todas juntas.
  - Los cambios se pueden deshacer, y un aviso ofrece «Compilar».

---

## [0.2.26] — 14 nov. 2026 · Fase 1: Beta con Termux · compilación 36

### Nuevo
- **Selección múltiple de proyectos en el inicio.**
  - Se entra **manteniendo presionado** un proyecto (vibra al seleccionar); con mouse, clic derecho.
  - Mientras se selecciona, cada toque marca o desmarca un proyecto en vez de abrirlo.
  - Barra de acciones:
    - **Todos**: marca todos los visibles (respeta el buscador) y, si ya están todos, los desmarca.
    - **Fijar / Desfijar**.
    - **Exportar**: un solo .zip con una carpeta por proyecto.
    - **Eliminar**: pide una sola confirmación con los nombres.
  - Se sale con la ✕, el botón Atrás o Esc. Cambiar entre Recientes y Todos también sale de la selección.
  - En el celular, la barra muestra solo íconos para caber en una fila.

### Corregido
- Si se abría un diálogo con la selección activa, al cerrarlo la pantalla podía quedar sin responder a los toques. Era un efecto del bloqueo de fondo de la versión 0.2.25.

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
