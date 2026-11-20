// Ajustes → Licencias y créditos: autor, licencia de TeXsting y componentes de terceros con su licencia y su código.
import { el, icon } from '../ui.js';

const REPO = 'https://github.com/P3dr1t0/texsting';

// texto: archivo de www/licencias/ (se muestra dentro de la app) o enlace a la licencia oficial.
const LIC = {
  'GPL-3.0': { archivo: 'GPL-3.0.txt' },
  'GPL-2.0': { archivo: 'GPL-2.0.txt' },
  'LGPL-2.1': { archivo: 'LGPL-2.1.txt' },
  'Apache-2.0': { archivo: 'Apache-2.0.txt' },
  MIT: { archivo: 'MIT.txt' },
  LPPL: { url: 'https://www.latex-project.org/lppl/' },
  GFL: { url: 'https://www.gust.org.pl/projects/e-foundry/licenses' },
  'OFL-1.1': { url: 'https://openfontlicense.org/' },
  'Unicode-3.0': { url: 'https://www.unicode.org/license.txt' },
  FTL: { url: 'https://gitlab.freedesktop.org/freetype/freetype/-/blob/master/docs/FTL.TXT' },
  'BSD-3-Clause': { url: 'https://opensource.org/license/bsd-3-clause' },
  Zlib: { url: 'https://zlib.net/zlib_license.html' },
  libpng: { url: 'http://www.libpng.org/pub/png/src/libpng-LICENSE.txt' },
  'bzip2-1.0.6': { url: 'https://sourceware.org/bzip2/' },
  'MPL-2.0': { url: 'https://www.mozilla.org/MPL/2.0/' },
};

const GRUPOS = [
  ['Motor de LaTeX', [
    { nombre: 'TeX Live: pdfTeX, XeTeX, LuaHBTeX, xdvipdfmx, Kpathsea, BibTeX y makeindex', para: 'Compilar los documentos dentro de la app.',
      lic: ['GPL-2.0', 'LPPL'], cr: 'TeX Users Group y los autores de cada programa. Programas compilados para Android por el proyecto Termux.',
      fuente: 'https://tug.org/texlive/', fuente2: ['Recetas de compilación de Termux', 'https://github.com/termux/termux-packages'] },
    { nombre: 'Paquetes y clases de LaTeX (CTAN)', para: 'Los que trae la app y los que se descargan al compilar (amsmath, TikZ, pgfplots, circuitikz, babel…).',
      lic: ['LPPL'], cr: 'LaTeX Project y los autores de cada paquete; cada uno indica su propia licencia libre.', fuente: 'https://ctan.org/' },
    { nombre: 'Fuentes Latin Modern y TeX Gyre', para: 'Las fuentes por defecto de los documentos y la letra del logo.',
      lic: ['GFL'], cr: 'GUST e-foundry (B. Jackowski, J. M. Nowacki y P. Strzelczyk).', fuente: 'https://www.gust.org.pl/projects/e-foundry' },
    { nombre: 'MetaPost (mplib) y Lua', para: 'Dibujos con MetaPost y código Lua dentro de LuaLaTeX.',
      lic: ['LPPL', 'MIT'], cr: 'John Hobby y el equipo de MetaPost; Lua.org, PUC-Rio.', fuente: 'https://tug.org/metapost.html' },
  ]],
  ['Bibliotecas del motor (XeLaTeX y LuaLaTeX)', [
    { nombre: 'ICU', para: 'Texto Unicode (datos reducidos a lo necesario por TeXsting).', lic: ['Unicode-3.0'], cr: 'Unicode, Inc.', fuente: 'https://github.com/unicode-org/icu' },
    { nombre: 'HarfBuzz', para: 'Dibujar el texto con fuentes OpenType.', lic: ['MIT'], cr: 'Google, Inc. y otros.', fuente: 'https://github.com/harfbuzz/harfbuzz' },
    { nombre: 'FreeType', para: 'Leer fuentes.', lic: ['FTL'], cr: 'The FreeType Project (www.freetype.org).', fuente: 'https://freetype.org/' },
    { nombre: 'Fontconfig', para: 'Encontrar fuentes por su nombre.', lic: ['MIT'], cr: 'Keith Packard, Red Hat, Inc. y otros.', fuente: 'https://gitlab.freedesktop.org/fontconfig/fontconfig' },
    { nombre: 'GLib, TECkit, Graphite2 y libiconv', para: 'Utilidades de texto de XeTeX.', lic: ['LGPL-2.1', 'MPL-2.0'], cr: 'Proyecto GNOME, SIL International, Free Software Foundation y otros.',
      fuente: 'https://gitlab.gnome.org/GNOME/glib', fuente2: ['TECkit y Graphite2 (SIL)', 'https://github.com/silnrsi'] },
    { nombre: 'Expat, PCRE2, Brotli, bzip2, zlib, libpng y libpaper', para: 'Lectura de archivos, compresión e imágenes.',
      lic: ['MIT', 'BSD-3-Clause', 'bzip2-1.0.6', 'Zlib', 'libpng', 'LGPL-2.1'], cr: 'Los autores de cada biblioteca.', fuente: 'https://github.com/termux/termux-packages' },
  ]],
  ['Aplicación', [
    { nombre: 'CodeMirror 6 y Lezer', para: 'El editor de código.', lic: ['MIT'], cr: 'Marijn Haverbeke y otros.', fuente: 'https://codemirror.net/' },
    { nombre: 'PDF.js', para: 'El visor de PDF. Incluye CMaps de Adobe y fuentes estándar (Foxit y Liberation).',
      lic: ['Apache-2.0', 'BSD-3-Clause', 'OFL-1.1'], cr: 'Mozilla Foundation y otros.', fuente: 'https://github.com/mozilla/pdf.js' },
    { nombre: 'Capacitor y AndroidX', para: 'Convertir la app web en app de Android.', lic: ['MIT', 'Apache-2.0'], cr: 'Drifty Co. (Ionic) y Google LLC.', fuente: 'https://github.com/ionic-team/capacitor' },
    { nombre: 'XZ for Java', para: 'Descomprimir los paquetes que se descargan de CTAN.', lic: [], libre: 'Dominio público', cr: 'Lasse Collin.', fuente: 'https://tukaani.org/xz/java.html' },
  ]],
];

const enlace = (texto, url) => el('a', { href: url, target: '_blank', rel: 'noopener' }, texto);

export async function renderLicencias(root, _p, navigate) {
  let visor = null;  // texto de una licencia abierto (el botón Atrás lo cierra primero)

  async function verTexto(nombre) {
    const pre = el('pre', { class: 'lic-texto' }, 'Cargando…');
    const caja = el('div', { class: 'lic-visor' },
      el('div', { class: 'lic-visor-top' }, el('strong', {}, nombre),
        el('button', { class: 'icon-btn', 'aria-label': 'Cerrar', html: icon('close'), onclick: () => cerrar() })),
      pre);
    visor = caja;
    document.body.append(caja);
    try {
      const r = await fetch('licencias/' + LIC[nombre].archivo);
      pre.textContent = r.ok ? await r.text() : 'No se pudo abrir el texto.';
    } catch { pre.textContent = 'No se pudo abrir el texto.'; }
  }
  function cerrar() { if (visor) { visor.remove(); visor = null; return true; } return false; }

  const chip = (nombre) => LIC[nombre] && LIC[nombre].archivo
    ? el('button', { class: 'lic-chip', onclick: () => verTexto(nombre) }, nombre)
    : el('a', { class: 'lic-chip', href: (LIC[nombre] || {}).url, target: '_blank', rel: 'noopener' }, nombre);

  const item = (c) => el('div', { class: 'lic-item' },
    el('div', { class: 'lic-nombre' }, c.nombre),
    el('div', { class: 'muted' }, c.para),
    el('div', { class: 'lic-chips' }, ...c.lic.map(chip), c.libre ? el('span', { class: 'lic-chip' }, c.libre) : null),
    el('div', { class: 'muted small' }, '© ', c.cr),
    el('div', { class: 'small' }, enlace('Código fuente', c.fuente), c.fuente2 ? ' · ' : '', c.fuente2 ? enlace(c.fuente2[0], c.fuente2[1]) : ''));

  root.append(el('div', { class: 'screen settings' },
    el('header', { class: 'topbar simple' },
      el('button', { class: 'icon-btn', 'aria-label': 'Atrás', html: icon('back'), onclick: () => navigate('settings') }),
      el('h1', {}, 'Licencias y créditos')),
    el('div', { class: 'settings-body' },
      el('h3', { class: 'section-title' }, 'TeXsting'),
      el('div', { class: 'lic-item' },
        el('div', { class: 'lic-nombre' }, `TeXsting ${__VERSION__}`),
        el('div', {}, 'Creado por ', el('strong', {}, 'Pedro de la Cruz Castillo'), '.'),
        el('div', { class: 'muted' }, 'Editor LaTeX libre y gratuito para Android.'),
        el('div', { class: 'lic-chips' }, chip('GPL-3.0')),
        el('div', { class: 'muted small' }, '© 2026 Pedro de la Cruz Castillo. Puedes usar, estudiar, modificar y compartir el código según la GPL-3.0 o posterior. ' +
          'El nombre «TeXsting» y su ícono identifican la app oficial: las versiones modificadas deben usar otro nombre y otro ícono.'),
        el('div', { class: 'small' }, enlace('Código fuente en GitHub', REPO), ' · ', enlace('Novedades de cada versión', REPO + '/blob/main/CHANGELOG.md'))),
      el('p', { class: 'muted' }, 'Inspirado en la forma de trabajar de TeXstudio; no usa su código, nombre ni logo.'),
      ...GRUPOS.flatMap(([titulo, lista]) => [el('h3', { class: 'section-title' }, titulo), ...lista.map(item)]),
      el('p', { class: 'muted small' }, 'Los programas del motor son software libre: su código fuente está en los enlaces de cada uno. ' +
        'Los ajustes que TeXsting hace al motor (datos de ICU reducidos y la biblioteca complex-math) están en la carpeta tools/apk del repositorio.'))));

  return { onBack: () => cerrar() || (navigate('settings'), true), cleanup: () => { cerrar(); } };
}
