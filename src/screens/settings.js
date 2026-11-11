// Ajustes y guía de instalación de Termux.
import { Clipboard } from '@capacitor/clipboard';
import { getSettings, setSettings, ensureToken } from '../store.js';
import { el, icon, toast, esc } from '../ui.js';
import { ping } from '../compiler.js';
import { bootstrapCommand, openTermux, TERMUX_FDROID, TERMUX_GITHUB } from '../termux.js';
import { ENGINES } from '../latex-data.js';
import { applyTheme } from '../main.js';

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

export async function renderSettings(root, _p, navigate) {
  const s = getSettings();
  const theme = el('select', { class: 'input small', onchange: (e) => { setSettings({ theme: e.target.value }); applyTheme(); } },
    ...[['system', 'Según el sistema'], ['light', 'Claro'], ['dark', 'Oscuro']].map(([v, t]) => el('option', { value: v, selected: s.theme === v }, t)));
  const font = el('input', { type: 'number', class: 'input small', min: 10, max: 28, value: s.fontSize, onchange: (e) => setSettings({ fontSize: Math.max(10, Math.min(28, +e.target.value || 15)) }) });
  const engine = el('select', { class: 'input small', onchange: (e) => setSettings({ defaultEngine: e.target.value }) },
    ...ENGINES.map(([v, t]) => el('option', { value: v, selected: s.defaultEngine === v }, t)));
  const url = el('input', { class: 'input', value: s.serverUrl, autocapitalize: 'off', onchange: (e) => setSettings({ serverUrl: e.target.value.trim() || 'http://127.0.0.1:8765' }) });
  const token = el('input', { class: 'input mono', value: ensureToken(), autocapitalize: 'off', onchange: (e) => setSettings({ token: e.target.value.trim() }) });
  const result = el('p', { class: 'muted' });

  root.append(el('div', { class: 'screen settings' },
    header('Ajustes', navigate),
    el('div', { class: 'settings-body' },
      el('h3', { class: 'section-title' }, 'Compilación (Termux)'),
      el('button', { class: 'btn primary', html: icon('terminal') + '<span>Instalar o reparar TeX en Termux</span>', onclick: () => navigate('termux') }),
      row('Motor por defecto', engine),
      row('Instalar paquetes faltantes', toggle('autoinstall'), 'Como MiKTeX: si falta un paquete, se descarga al compilar'),
      row('Compilar al guardar (Ctrl+S)', toggle('compileOnSave')),
      row('Dirección del servidor', url),
      row('Token', token, 'Debe coincidir con el de Termux'),
      el('button', { class: 'btn', onclick: async () => {
        result.textContent = 'Probando…';
        try {
          const i = await ping();
          result.innerHTML = `✔ Conectado. ${esc(i.tex || '')}<br>Motores: ${esc(i.engines.join(', '))} · latexmk: ${i.latexmk ? 'sí' : 'no'} · paquetes al vuelo: ${i.tlmgr ? 'sí' : 'no'}`;
        } catch (e) { result.textContent = '✘ ' + e.message; }
      } }, 'Probar conexión'),
      result,
      el('h3', { class: 'section-title' }, 'Editor'),
      row('Tema', theme),
      row('Tamaño de letra', font),
      row('Ajuste de línea', toggle('lineWrap')),
      row('Números de línea', toggle('lineNumbers')),
      row('Autocompletado', toggle('autocomplete')),
      el('h3', { class: 'section-title' }, 'Acerca de'),
      el('p', { class: 'muted', html: 'TeXsting 0.1 — editor LaTeX libre para Android (GPL-3.0).<br>Inspirado en la forma de trabajar de TeXstudio; no usa su código, nombre ni logo.<br>Compila con TeX Live dentro de Termux, en tu propio teléfono.' }))));
  return {};
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
        el('p', { class: 'muted' }, 'Incluye todo lo necesario y tu token de seguridad.'),
        el('button', { class: 'btn primary', html: icon('copy') + '<span>Copiar comando</span>', onclick: copyCmd })),
      step(3, 'Pégalo en Termux',
        el('p', { class: 'muted' }, 'Abre Termux, mantén presionado en la pantalla → Pegar → Enter. Elige la instalación recomendada (~2 GB) o la completa (~6 GB). Tarda según tu internet: deja Termux abierto hasta que diga «TeXsting está listo».'),
        el('button', { class: 'btn', html: icon('terminal') + '<span>Abrir Termux</span>', onclick: async () => { if (!(await openTermux())) toast('Abre Termux desde el menú de apps'); } })),
      step(4, 'Vuelve y prueba',
        el('p', { class: 'muted' }, 'Desde ahora, cada vez que abras Termux el servidor se inicia solo. Si TeXsting dice «sin conexión», solo abre Termux un momento.'),
        el('button', { class: 'btn primary', onclick: check }, 'Probar conexión')),
      el('details', { class: 'tips' },
        el('summary', {}, 'Si Android cierra Termux'),
        el('ul', {},
          el('li', {}, 'Ajustes de Android → Apps → Termux → Batería → Sin restricciones.'),
          el('li', {}, 'Android 14 o superior: Opciones de desarrollador → «Desactivar restricciones de procesos secundarios».'),
          el('li', {}, 'En Termux puedes usar: texsting (iniciar), texsting-stop (detener), texsting-setup (reparar o cambiar instalación).'))),
      el('details', { class: 'tips' },
        el('summary', {}, 'Tu token'),
        el('p', { class: 'mono' }, token)))));
  check();
  const onVis = () => { if (!document.hidden) check(); };
  document.addEventListener('visibilitychange', onVis);
  return { cleanup: () => document.removeEventListener('visibilitychange', onVis) };
}
