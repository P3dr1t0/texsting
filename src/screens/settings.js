// Ajustes y guía de instalación de Termux.
import { Clipboard } from '@capacitor/clipboard';
import { getSettings, setSettings, ensureToken } from '../store.js';
import { el, icon, toast, esc, confirmDialog } from '../ui.js';
import { ping, serverOutdated } from '../compiler.js';
import { motorEstado, motorPreparar, motorCompilar, MOTOR_PRUEBA, MOTOR_PRUEBA_LUA, motorSinInternet, motorDescargarSinInternet, motorCancelarDescarga, motorBorrarDescargados, motorAlDescargar, motorNotificaciones, motorPedirNotificaciones, motorAjustesNotificaciones, motorProbarAviso } from '../motor.js';
import { bootstrapCommand, openTermux, TERMUX_FDROID, TERMUX_GITHUB } from '../termux.js';
import { ENGINES } from '../latex-data.js';
import { disponible as hayCarpetas, raiz, elegirRaiz, exportarTodos } from '../carpetas.js';
import { applyTheme, THEMES, ACCENTS, resolvedTheme } from '../theme.js';
import { MONTOS, productos as productosDonacion, donar } from '../donaciones.js';

function header(title, navigate, back = 'home') {
  return el('header', { class: 'topbar simple' },
    el('button', { class: 'icon-btn', 'aria-label': 'Atrás', html: icon('back'), onclick: () => navigate(back) }),
    el('h1', {}, title));
}

function row(label, control, hint) {
  return el('label', { class: 'set-row' }, el('span', { class: 'set-label' }, label, hint ? el('small', {}, hint) : null), control);
}

function toggle(key) {
  const s = getSettings();
  return el('input', { type: 'checkbox', class: 'switch', checked: !!s[key], onchange: (e) => { setSettings({ [key]: e.target.checked }); } });
}

/** Selector de tema, color de acento y tamaño de letra (reutilizable). */
export function appearance({ onFont } = {}) {
  const s = getSettings();
  const box = el('div', { class: 'appearance' });
  const themes = el('div', { class: 'swatch-row' });
  const accents = el('div', { class: 'swatch-row' });
  function paintThemes() {
    const cur = getSettings().theme;
    themes.replaceChildren(...THEMES.map((t) => el('button', {
      class: 'theme-swatch' + (cur === t.id ? ' on' : ''), title: t.name, 'aria-label': 'Tema ' + t.name,
      onclick: () => { setSettings({ theme: t.id }); applyTheme(); paintThemes(); paintAccents(); },
    }, el('span', { class: 'theme-chip', style: `background: linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }), el('small', {}, t.name))));
  }
  function paintAccents() {
    const cur = getSettings().accent;
    const kind = THEMES.find((t) => t.id === resolvedTheme()).kind;
    accents.replaceChildren(...ACCENTS.map((a) => el('button', {
      class: 'accent-swatch' + (cur === a.id ? ' on' : ''), title: a.name, 'aria-label': 'Color ' + a.name,
      onclick: () => { setSettings({ accent: a.id }); applyTheme(); paintAccents(); },
    }, el('span', { class: 'accent-dot', style: `background:${a[kind][0]}` }), el('small', {}, a.name))));
  }
  const preview = el('pre', { class: 'font-preview' }, '\\section{Resultados}\n$V_o = V_s\\,\\frac{R_2}{R_1+R_2}$ % vista previa');
  const val = el('strong', {}, s.fontSize + ' px');
  const range = el('input', { type: 'range', min: 11, max: 26, step: 1, value: s.fontSize, class: 'range',
    oninput: (e) => {
      const v = +e.target.value;
      preview.style.fontSize = v + 'px';
      val.textContent = v + ' px';
      setSettings({ fontSize: v });
      onFont && onFont(v);
    } });
  preview.style.fontSize = s.fontSize + 'px';
  paintThemes();
  paintAccents();
  box.append(
    el('div', { class: 'field-label' }, 'Tema'), themes,
    el('div', { class: 'field-label' }, 'Color de botones y detalles'), accents,
    el('div', { class: 'field-label font-row' }, el('span', {}, 'Tamaño de letra del código'), val), range, preview);
  return box;
}

export async function renderSettings(root, _p, navigate) {
  const s = getSettings();
  const engine = el('select', { class: 'input small', onchange: (e) => setSettings({ defaultEngine: e.target.value }) },
    ...ENGINES.map(([v, t]) => el('option', { value: v, selected: s.defaultEngine === v }, t)));
  const url = el('input', { class: 'input', value: s.serverUrl, autocapitalize: 'off', onchange: (e) => setSettings({ serverUrl: e.target.value.trim() || 'http://127.0.0.1:8765' }) });
  const token = el('input', { class: 'input mono', value: ensureToken(), autocapitalize: 'off', onchange: (e) => setSettings({ token: e.target.value.trim() }) });
  const result = el('p', { class: 'muted' });
  const motorResult = el('div', { class: 'muted motor-result' });
  // «Usar sin internet»: con conexión los paquetes se bajan solos al compilar; aquí se bajan todos de una vez.
  const sinInternet = el('div', { class: 'sin-internet', hidden: true });
  const MB = (b) => (b >= 1e9 ? (b / 1e9).toFixed(1).replace('.', ',') + ' GB' : Math.max(1, Math.round(b / 1e6)) + ' MB');
  const NIVELES = {
    basicos: ['Paquetes básicos', 'Lo de un curso de ingeniería o ciencias: TikZ, pgfplots, circuitikz, siunitx, tcolorbox, beamer, biblatex, listings, chemfig, fuentes y más.'],
    avanzados: ['Paquetes avanzados', 'Casi todo LaTeX, como una instalación completa de MiKTeX o TeX Live: miles de paquetes, estilos de revistas y universidades.'],
  };
  let descarga = null;  // { nivel, hechos, total, paquete, bytes, bytesTotal }
  async function pintarSinInternet() {
    const st = await motorSinInternet();
    if (!st) { sinInternet.hidden = true; return; }
    sinInternet.hidden = false;
    const tarjeta = (nivel) => {
      const n = st[nivel];
      const [titulo, texto] = NIVELES[nivel];
      const listo = n.listos >= n.total;
      const activa = descarga && descarga.nivel === nivel;
      let estado;
      let accion;
      if (activa) {
        const pct = descarga.bytesTotal ? Math.round(100 * descarga.bytes / descarga.bytesTotal) : 0;
        estado = el('div', {},
          el('div', { class: 'cp-track dl-track' }, el('div', { class: 'cp-bar', style: `width:${pct}%` })),
          el('small', { class: 'muted' }, `Descargando ${descarga.hechos} de ${descarga.total}${descarga.paquete ? ' · ' + descarga.paquete : ''} · ${pct} %`));
        accion = el('button', { class: 'btn small', onclick: () => motorCancelarDescarga() }, 'Cancelar');
      } else if (listo) {
        estado = el('small', { class: 'ok-txt' }, `✔ Listo: los ${n.total} paquetes están en el teléfono`);
      } else {
        estado = el('small', { class: 'muted' }, `${n.total - n.listos} paquetes por descargar · ${MB(n.descarga)} de descarga (ocupan ~${MB(n.instalado)})`);
        accion = el('button', { class: 'btn small primary', disabled: !!descarga, onclick: () => bajar(nivel, n) }, 'Descargar');
      }
      return el('div', { class: 'lic-item' }, el('div', { class: 'lic-nombre' }, titulo), el('div', { class: 'muted small' }, texto), estado,
        accion ? el('div', { class: 'papelera-btns' }, accion) : null);
    };
    sinInternet.replaceChildren(
      el('h3', { class: 'section-title' }, 'Usar sin internet'),
      el('p', { class: 'muted' }, 'Con internet, TeXsting descarga solo lo que cada documento necesita al compilar. Si vas a estar sin conexión (en clase, en un examen, de viaje), descarga antes los paquetes:'),
      tarjeta('basicos'), tarjeta('avanzados'),
      st.paquetes ? el('div', { class: 'set-row' },
        el('span', { class: 'set-label' }, `Paquetes descargados: ${st.paquetes}`, el('small', {}, `Ocupan ${MB(st.ocupado)}. Si los borras, se vuelven a descargar solos cuando un documento los pida.`)),
        el('button', { class: 'btn small', disabled: !!descarga, onclick: borrar }, 'Borrar')) : null);
  }
  async function bajar(nivel, n) {
    const grande = n.descarga > 300e6;
    if (grande && !(await confirmDialog('Descarga grande', `Son ${MB(n.descarga)} de descarga y ocupan ~${MB(n.instalado)} en el teléfono. Conviene hacerlo con wifi. Puedes seguir usando la app mientras tanto.`, { ok: 'Descargar' }))) return;
    try {
      descarga = { nivel, hechos: 0, total: n.total - n.listos, paquete: '', bytes: 0, bytesTotal: n.descarga };
      await motorDescargarSinInternet(nivel);
    } catch (e) { descarga = null; toast(e.message || String(e), { kind: 'error' }); }
    pintarSinInternet();
  }
  async function borrar() {
    if (!(await confirmDialog('Borrar paquetes descargados', 'Se liberará el espacio. Cuando un documento necesite un paquete, se volverá a descargar solo (con internet).', { ok: 'Borrar', danger: true }))) return;
    try { const r = await motorBorrarDescargados(); toast(`Listo: se liberaron ${MB(r.liberado || 0)}`, { kind: 'ok' }); } catch (e) { toast(e.message || String(e), { kind: 'error' }); }
    pintarSinInternet();
  }
  let ultimoPintado = 0;
  const dejarDeEscuchar = await motorAlDescargar((e) => {
    descarga = e.fin ? null : e;
    // Pintar a lo más dos veces por segundo (con miles de paquetes llegan muchos avisos).
    if (e.fin || Date.now() - ultimoPintado > 500) { ultimoPintado = Date.now(); pintarSinInternet(); }
  });
  motorSinInternet().then((st) => { if (st && st.descargando) descarga = descarga || { nivel: '?', hechos: 0, total: 0, bytes: 0, bytesTotal: 0 }; pintarSinInternet(); });
  const carpetaTxt = el('p', { class: 'muted' });
  const pintarCarpeta = () => {
    const r = raiz();
    carpetaTxt.innerHTML = r
      ? `Tus proyectos se guardan en <strong>${esc(r.ruta)}</strong>: cada uno es una carpeta que puedes abrir desde Archivos o la PC. Lo que cambies ahí aparece en TeXsting al abrir el proyecto.`
      : 'Por ahora tus proyectos están solo dentro de la app. Elige una carpeta (por ejemplo Documentos) y TeXsting creará <strong>Projects_LaTeX</strong> con un proyecto por carpeta, visible desde Archivos o la PC.';
  };
  pintarCarpeta();
  async function cambiarCarpeta(modo) {
    try { await elegirRaiz(modo); } catch (e) { if (e.code !== 'CANCELADO' && !/cancelado/.test(e.message)) toast('No se pudo usar esa carpeta: ' + e.message, { kind: 'error' }); return; }
    pintarCarpeta();
    carpetaTxt.innerHTML += '<br>Copiando tus proyectos…';
    const n = await exportarTodos();
    pintarCarpeta();
    toast(n ? `Listo: ${n} proyecto${n === 1 ? '' : 's'} copiados a ${raiz().ruta}` : 'Listo', { kind: 'ok', ms: 5000 });
  }
  // Solo en la versión web de pruebas (sin motor integrado): el servidor de TeX de la PC. En el teléfono y la
  // tablet no aparece: TeXsting compila siempre con su propio motor.
  const servidorPruebas = el('div', {});
  motorEstado().then((st) => {
    if (st) return;
    servidorPruebas.append(
      el('h3', { class: 'section-title' }, 'Servidor de pruebas (solo versión web)'),
      el('button', { class: 'btn', html: icon('terminal') + '<span>Instrucciones del servidor</span>', onclick: () => navigate('termux') }),
      row('Dirección del servidor', url),
      row('Token', token),
      el('button', { class: 'btn', onclick: async () => {
        result.textContent = 'Probando…';
        try {
          const i = await ping();
          result.innerHTML = `✔ Conectado. ${esc(i.tex || '')}<br>Motores: ${esc(i.engines.join(', '))} · latexmk: ${i.latexmk ? 'sí' : 'no'} · paquetes al vuelo: ${i.tlmgr ? 'sí' : 'no'}`;
        } catch (e) { result.textContent = '✘ ' + e.message; }
      } }, 'Probar conexión'),
      result);
  }).catch(() => {});
  const seg = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
  async function probarMotor() {
    motorResult.textContent = 'Comprobando…';
    const est = await motorEstado();
    if (!est) { motorResult.textContent = '✘ Esta versión no trae el motor integrado (solo funciona en el APK del teléfono o la tablet).'; return; }
    motorResult.textContent = est.listo ? 'Compilando el documento de prueba…' : 'Preparando el motor (solo la primera vez, unos segundos)…';
    try {
      const prep = await motorPreparar();
      const first = prep.primeraVez ? `<br>Preparación inicial: descomprimir ${seg(prep.unzipMs)} · crear el formato ${seg(prep.fmtMs)}` : '';
      const lineas = [];
      const pruebas = [['pdflatex', MOTOR_PRUEBA]];
      if ((est.motores || []).includes('xelatex')) pruebas.push(['xelatex', MOTOR_PRUEBA_LUA]);
      if ((est.motores || []).includes('lualatex')) pruebas.push(['lualatex', MOTOR_PRUEBA_LUA]);
      for (const [eng, doc] of pruebas) {
        const L = { lualatex: 'LuaLaTeX', xelatex: 'XeLaTeX' }[eng] || 'pdfLaTeX';
        motorResult.innerHTML = lineas.join('<br>') + (lineas.length ? '<br>' : '') + `Compilando con ${L}…` + (eng !== 'pdflatex' ? ` (la primera vez prepara ${L}: puede tardar un poco)` : '');
        const r = await motorCompilar({ id: 'prueba-motor-' + eng, main: 'prueba.tex' }, [{ path: 'prueba.tex', kind: 'text', text: doc }], { engine: eng });
        if (r.pdf) {
          lineas.push(`✔ ${L}: PDF de ${Math.max(1, Math.round(r.pdf.length / 1024))} KB en ${seg(r.texMs)} (${r.pasadas} pasada${r.pasadas === 1 ? '' : 's'})${r.status !== 'success' ? `<br>⚠ El registro tiene errores:<pre class="motor-log">${esc((String(r.log || '').match(/^(?:! .*|.*:\d+: .*)$/gm) || []).slice(0, 4).join('\n'))}</pre>` : ''}`);
        } else {
          lineas.push(`✘ ${L}: no salió el PDF.<pre class="motor-log">${esc(String(r.log || r.output || '').slice(-2000))}</pre>`);
        }
      }
      motorResult.innerHTML = lineas.join('<br>') + first;
    } catch (e) {
      motorResult.innerHTML = `✘ ${esc(e.message || String(e))}`;
    }
  }

  root.append(el('div', { class: 'screen settings' },
    header('Ajustes', navigate),
    el('div', { class: 'settings-body' },
      el('h3', { class: 'section-title' }, 'Compilación'),
      row('Motor para proyectos nuevos', engine, 'Cada proyecto puede cambiarlo en ⋮ → Motor'),
      row('Instalar paquetes faltantes', toggle('autoinstall'), 'Si falta un paquete, se descarga solo al compilar (necesita internet esa vez)'),
      row('Compilar al guardar (Ctrl+S)', toggle('compileOnSave')),
      avisoCompilando(),
      el('p', { class: 'muted' }, 'El motor integrado compila dentro de TeXsting, sin instalar nada más: pdfLaTeX, XeLaTeX y LuaLaTeX (fuentes OpenType con fontspec, incluso las del teléfono como Roboto o Noto), BibTeX y makeindex. Los paquetes que falten (TikZ, pgfplots, circuitikz…) se descargan solos de CTAN la primera vez que los uses.'),
      el('button', { class: 'btn', onclick: probarMotor }, 'Probar motor integrado'),
      motorResult,
      sinInternet,
      servidorPruebas,
      ...(hayCarpetas() ? [
        el('h3', { class: 'section-title' }, 'Carpeta de proyectos'),
        carpetaTxt,
        raiz() ? null : el('button', { class: 'btn primary', html: icon('files') + '<span>Crear Documentos/Projects_LaTeX</span>', onclick: () => cambiarCarpeta('crear') }),
        el('button', { class: 'btn', html: icon('files') + `<span>${raiz() ? 'Cambiar carpeta' : 'Elegir otra carpeta'}</span>`, onclick: () => cambiarCarpeta('otra') }),
      ] : []),
      el('h3', { class: 'section-title' }, 'Apariencia'),
      appearance(),
      el('h3', { class: 'section-title' }, 'Editor'),
      row('Ajuste de línea', toggle('lineWrap')),
      row('Números de línea', toggle('lineNumbers')),
      row('Autocompletado', toggle('autocomplete')),
      el('h3', { class: 'section-title' }, 'Apoyar TeXsting'),
      apoyo(),
      el('h3', { class: 'section-title' }, 'Acerca de'),
      el('p', { class: 'muted', html: `TeXsting ${__VERSION__} (Fase 2: Beta con motor integrado) — editor LaTeX libre para Android (GPL-3.0), creado por Pedro de la Cruz Castillo.<br><a href="https://github.com/P3dr1t0/texsting/blob/main/CHANGELOG.md" target="_blank" rel="noopener">Ver novedades de cada versión</a>` }),
      el('button', { class: 'btn', html: icon('edit') + '<span>Enviar una sugerencia</span>', onclick: () => navigate('sugerencias') }),
      el('button', { class: 'btn', html: icon('info') + '<span>Licencias y créditos</span>', onclick: () => navigate('licencias') }),
      el('p', { class: 'muted small', html: 'Contacto: <a href="mailto:texsting.app@gmail.com">texsting.app@gmail.com</a> · <a href="https://p3dr1t0.github.io/texsting/privacidad" target="_blank" rel="noopener">Política de privacidad</a>' }))));
  return { cleanup: () => dejarDeEscuchar() };
}

/** Notificación «Compilando…»: hace que la compilación siga rápida si sales de la app (Android 13+ pide permiso). */
function avisoCompilando() {
  const boton = el('button', { class: 'btn small' }, '…');
  const probar = el('button', { class: 'btn small ghost' }, 'Probar');
  const resultado = el('p', { class: 'muted small', hidden: true });
  probar.onclick = async () => {
    probar.disabled = true;
    resultado.hidden = false;
    resultado.textContent = 'Mostrando la notificación por 8 segundos: baja la cortina para verla…';
    try {
      const r = await motorProbarAviso();
      resultado.textContent = r.estado === 'mostrado'
        ? 'Android aceptó la notificación.' + (r.activas ? ' Si no la ves en la cortina, tu sistema la está ocultando: revisa en Ajustes de Android → Notificaciones → TeXsting.' : ' Pero las notificaciones de TeXsting están desactivadas.')
        : 'No se mostró: ' + r.estado + (r.activas ? '' : ' (las notificaciones de TeXsting están desactivadas)');
    } catch (e) { resultado.textContent = 'No se pudo probar: ' + (e.message || e); }
    setTimeout(() => { probar.disabled = false; }, 8000);
  };
  const fila = el('div', {},
    el('div', { class: 'set-row' },
      el('span', { class: 'set-label' }, 'Notificación «Compilando…»',
        el('small', {}, 'Mientras compila, sigue a toda velocidad aunque cambies de app o apagues la pantalla')),
      el('div', { class: 'set-botones' }, probar, boton)),
    resultado);
  fila.hidden = true;
  const pintar = async () => {
    const n = await motorNotificaciones();
    if (!n) return;
    fila.hidden = false;
    boton.textContent = n.activas ? 'Activada' : 'Activar';
    boton.disabled = n.activas;
    boton.onclick = async () => {
      // La primera vez, el aviso de Android; si ya se negó, Android ya no lo muestra: se abren sus ajustes.
      if (n.sePuedePedir && !getSettings().notifPedidas) { setSettings({ notifPedidas: true }); await motorPedirNotificaciones(); }
      else await motorAjustesNotificaciones();
    };
  };
  pintar();
  const alVolver = () => { if (!document.hidden) pintar(); };
  document.addEventListener('visibilitychange', alVolver);
  return fila;
}

/** Donaciones: un apartado tranquilo en Ajustes, sin avisos ni ventanas que interrumpan. */
function apoyo() {
  const gracias = () => (getSettings().donaciones || 0) > 0;
  const nota = el('p', { class: 'muted small apoyo-nota' });
  const botones = MONTOS.map((m) => el('button', { class: 'btn apoyo-btn', disabled: true }, `${m.usd} US$`));
  const fila = el('div', { class: 'apoyo-fila' }, ...botones);
  const caja = el('div', { class: 'apoyo' },
    el('p', { class: 'apoyo-texto', html: `${icon('heart')}<span>TeXsting es gratis y completo para todos, sin anuncios. Si te sirve, puedes apoyar su desarrollo con una donación única. No desbloquea nada: es solo un gracias.</span>` }),
    fila, nota);
  const ponerGracias = () => { if (gracias()) caja.classList.add('ya-apoyo'); nota.textContent = gracias() ? '¡Gracias por tu apoyo! Puedes volver a donar cuando quieras.' : 'El pago lo hace Google Play; TeXsting no ve tus datos de pago.'; };
  ponerGracias();
  productosDonacion().then((lista) => {
    MONTOS.forEach((m, i) => {
      const p = lista.find((x) => x.id === m.id);
      if (!p) return;
      botones[i].textContent = p.precio;
      botones[i].disabled = false;
      botones[i].onclick = async () => {
        botones.forEach((b) => { b.disabled = true; });
        try {
          const estado = await donar(m.id);
          if (estado === 'gracias') {
            setSettings({ donaciones: (getSettings().donaciones || 0) + 1 });
            toast('¡Muchas gracias por apoyar TeXsting!');
          } else if (estado === 'pendiente') {
            toast('Tu pago quedó pendiente. Cuando se confirme, Google te avisará. ¡Gracias!');
          }
        } catch (e) {
          toast(e.message || 'No se pudo completar la donación', { kind: 'error' });
        }
        botones.forEach((b, j) => { b.disabled = !lista.find((x) => x.id === MONTOS[j].id); });
        ponerGracias();
      };
    });
    if (!lista.length) nota.textContent = 'Las donaciones aún no están disponibles. Vuelve a intentarlo más tarde.';
  }).catch(() => {
    nota.textContent = 'Las donaciones funcionan cuando TeXsting está instalado desde Google Play.';
  });
  return caja;
}

export async function renderTermuxSetup(root, _p, navigate) {
  const token = ensureToken();
  const status = el('div', { class: 'server-chip checking' }, 'Comprobando…');
  const step = (n, title, ...content) => el('section', { class: 'step' }, el('div', { class: 'step-n' }, String(n)), el('div', { class: 'step-body' }, el('h3', {}, title), ...content));

  async function copyCmd() {
    const cmd = bootstrapCommand(token);
    try {
      await Clipboard.write({ string: cmd });
    } catch {
      try { await navigator.clipboard.writeText(cmd); } catch { /* sin portapapeles */ }
    }
    toast('Comando copiado. Pégalo en Termux y presiona Enter.', { ms: 5000 });
  }

  async function check() {
    try {
      const i = await ping();
      if (serverOutdated(i)) {
        status.className = 'server-chip warn';
        status.innerHTML = `${icon('terminal')}<span>Conectado, pero hay una versión nueva del servidor: copia el comando del paso 2 y pégalo en Termux (tarda segundos).</span>`;
        return;
      }
      status.className = 'server-chip ok';
      status.innerHTML = `${icon('check')}<span>¡Conectado! ${esc(i.tex || '')}</span>`;
    } catch (e) {
      status.className = 'server-chip off';
      status.innerHTML = `${icon('terminal')}<span>${esc(e.message)}</span>`;
    }
  }

  root.append(el('div', { class: 'screen termux' },
    header('Compilar con Termux', navigate),
    el('div', { class: 'settings-body' },
      el('p', {}, 'TeXsting compila en tu propio teléfono usando TeX Live (la misma distribución que usan las computadoras) dentro de Termux. Se instala una sola vez; después funciona sin internet, gratis y sin límite de tiempo.'),
      status,
      step(1, 'Instala Termux',
        el('p', { class: 'muted' }, 'Descárgala de F-Droid o de GitHub (la versión antigua de Play Store no sirve).'),
        el('div', { class: 'btn-row' },
          el('a', { class: 'btn', href: TERMUX_FDROID, target: '_blank', rel: 'noopener' }, 'F-Droid'),
          el('a', { class: 'btn', href: TERMUX_GITHUB, target: '_blank', rel: 'noopener' }, 'GitHub'))),
      step(2, 'Copia el comando de instalación',
        el('p', { class: 'muted' }, 'Es una sola línea con tu token de seguridad. Si TeX ya estaba instalado (por ejemplo, reinstalaste TeXsting), este mismo comando solo reconecta la app en segundos, sin descargar nada.'),
        el('pre', { class: 'cmd' }, bootstrapCommand(token)),
        el('button', { class: 'btn primary', html: icon('copy') + '<span>Copiar comando</span>', onclick: copyCmd })),
      step(3, 'Pégalo en Termux',
        el('p', { class: 'muted' }, 'Es una sola línea. Abre Termux, mantén presionado en la pantalla → Pegar → Enter. Elige la instalación recomendada (~2 GB) o la completa (~6 GB). Tarda según tu internet: deja Termux abierto hasta que diga «TeXsting está listo».'),
        el('button', { class: 'btn', html: icon('terminal') + '<span>Abrir Termux</span>', onclick: async () => { if (!(await openTermux())) toast('Abre Termux desde el menú de apps'); } })),
      step(4, 'Vuelve y prueba',
        el('p', { class: 'muted' }, 'Desde ahora, cada vez que abras Termux el servidor se inicia solo. Si TeXsting dice «sin conexión», solo abre Termux un momento.'),
        el('button', { class: 'btn primary', onclick: check }, 'Probar conexión')),
      el('details', { class: 'tips' },
        el('summary', {}, 'Si Android cierra Termux'),
        el('ul', {},
          el('li', {}, 'Ajustes de Android → Apps → Termux → Batería → Sin restricciones.'),
          el('li', {}, 'Android 14 o superior: Opciones de desarrollador → «Desactivar restricciones de procesos secundarios».'),
          el('li', {}, 'Si Termux se queda con líneas que empiezan con «>», toca CTRL y luego la letra c para cancelar, y vuelve a pegar el comando.'),
          el('li', {}, 'En Termux puedes usar: texsting (iniciar), texsting-stop (detener), texsting-setup (reparar) y texsting-setup completo (pasar a la instalación completa).'))),
      el('details', { class: 'tips' },
        el('summary', {}, 'Tu token'),
        el('p', { class: 'mono' }, token)))));
  check();
  const onVis = () => { if (!document.hidden) check(); };
  document.addEventListener('visibilitychange', onVis);
  return { cleanup: () => document.removeEventListener('visibilitychange', onVis) };
}
