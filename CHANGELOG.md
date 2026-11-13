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
