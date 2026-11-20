// Ajustes → Enviar una sugerencia al editor: hasta 200 palabras, una vez por semana.
// Llega al formulario de Google de texsting.app@gmail.com (ver docs/privacidad.md).
import { el, icon, toast } from '../ui.js';
import { motorEquipo, motorEnviarSugerencia } from '../motor.js';

export const MAX_PALABRAS = 200;
const SEMANA = 7 * 24 * 3600 * 1000;
const K_ULTIMA = 'texsting.sugerencia.ultima';
const K_BORRADOR = 'texsting.sugerencia.borrador';
const PRIVACIDAD = 'https://p3dr1t0.github.io/texsting/privacidad';

const leer = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };

export const contarPalabras = (t) => (String(t).trim().match(/\S+/g) || []).length;

/** Fecha desde la que se puede enviar otra sugerencia (null = ya se puede). */
export function proximaSugerencia(ahora = Date.now()) {
  const u = Number(leer(K_ULTIMA));
  if (!u || u > ahora) return null;  // sin envíos, o reloj cambiado hacia atrás
  return u + SEMANA > ahora ? new Date(u + SEMANA) : null;
}

const fecha = (d) => d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export async function renderSugerencias(root, _p, navigate) {
  const equipo = await motorEquipo();
  const version = `TeXsting ${__VERSION__}`;

  const area = el('textarea', {
    class: 'sug-texto', rows: 9, maxlength: 4000,
    placeholder: 'Por ejemplo: «Me gustaría poder…», «Al compilar X pasa Y…», «Sería útil que…»',
    oninput: () => { guardar(K_BORRADOR, area.value || null); pintar(); },
  });
  area.value = leer(K_BORRADOR) || '';
  const contador = el('div', { class: 'sug-contador small' });
  const adjuntar = el('input', { type: 'checkbox', checked: true });
  const datos = el('label', { class: 'sug-adjuntar small' }, adjuntar,
    el('span', {}, 'Incluir la versión de la app y el modelo del equipo', el('br'),
      el('span', { class: 'muted' }, [version, equipo].filter(Boolean).join(' · '))));
  const aviso = el('div', { class: 'sug-aviso small' });
  const enviar = el('button', { class: 'btn primary', html: icon('upload') + '<span>Enviar sugerencia</span>', onclick: () => mandar() });
  let enviando = false;

  function pintar() {
    const n = contarPalabras(area.value);
    const prox = proximaSugerencia();
    contador.textContent = `${n} / ${MAX_PALABRAS} palabras`;
    contador.classList.toggle('excedido', n > MAX_PALABRAS);
    aviso.textContent = prox
      ? `Ya enviaste una sugerencia esta semana. Podrás enviar otra desde el ${fecha(prox)}; mientras tanto, lo que escribas aquí se queda guardado.`
      : n > MAX_PALABRAS ? `Quita ${n - MAX_PALABRAS} palabra${n - MAX_PALABRAS === 1 ? '' : 's'} para poder enviarla.` : '';
    aviso.hidden = !aviso.textContent;
    enviar.disabled = enviando || !!prox || n === 0 || n > MAX_PALABRAS;
  }

  async function mandar() {
    const texto = area.value.trim();
    if (!texto || contarPalabras(texto) > MAX_PALABRAS || proximaSugerencia()) return;
    enviando = true; pintar();
    enviar.querySelector('span').textContent = 'Enviando…';
    try {
      await motorEnviarSugerencia({ texto, version: adjuntar.checked ? version : '', equipo: adjuntar.checked ? (equipo || '') : '' });
      guardar(K_ULTIMA, String(Date.now()));
      guardar(K_BORRADOR, null);
      cuerpo.replaceChildren(
        el('div', { class: 'sug-gracias' },
          el('div', { class: 'sug-gracias-icono', html: icon('check') }),
          el('h2', {}, '¡Gracias!'),
          el('p', {}, 'Tu sugerencia llegó al editor. Cada idea se lee con calma: muchas mejoras de TeXsting salieron así.'),
          el('p', { class: 'muted small' }, `Podrás enviar otra desde el ${fecha(proximaSugerencia())}.`),
          el('button', { class: 'btn', onclick: () => navigate('settings') }, 'Volver a Ajustes')));
    } catch (e) {
      const sinRed = /conexi|network|host|timeout|failed to fetch/i.test(String(e.message));
      toast(sinRed ? 'Sin conexión a internet: tu sugerencia quedó guardada aquí; envíala cuando tengas señal.' : `No se pudo enviar (${e.message}). Tu texto quedó guardado; prueba en un rato.`, { kind: 'error', ms: 7000 });
    } finally {
      enviando = false;
      const s = enviar.querySelector('span'); if (s) s.textContent = 'Enviar sugerencia';
      pintar();
    }
  }

  const cuerpo = el('div', { class: 'settings-body' },
    el('p', {}, '¿Una idea para mejorar TeXsting, algo que no funciona como esperabas o algo que te gustaría ver? Escríbela aquí: la lee directamente el editor.'),
    el('p', { class: 'muted small' }, `Hasta ${MAX_PALABRAS} palabras y una sugerencia por semana, para que cada una se lea con calma.`),
    area, contador, datos, aviso, enviar,
    el('p', { class: 'muted small' }, 'Se envía sin tu nombre ni tu correo. No escribas datos personales. ',
      el('a', { href: PRIVACIDAD, target: '_blank', rel: 'noopener' }, 'Política de privacidad')));

  root.append(el('div', { class: 'screen settings' },
    el('header', { class: 'topbar simple' },
      el('button', { class: 'icon-btn', 'aria-label': 'Atrás', html: icon('back'), onclick: () => navigate('settings') }),
      el('h1', {}, 'Enviar una sugerencia')),
    cuerpo));
  pintar();
  return { onBack: () => (navigate('settings'), true) };
}
