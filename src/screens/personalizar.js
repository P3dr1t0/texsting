// Ventana «Personalizar plantilla»: datos básicos a la vista y el formato en «Personalización avanzada».
import { el, icon, dialog } from '../ui.js';
import { getSettings, setSettings } from '../store.js';
import { CAMPOS, RECORDAR, opcionesIniciales } from '../templates.js';

/** Devuelve { nombre, opciones } o null si se cancela. */
export async function personalizar(t) {
  const recordados = getSettings().plantillaDatos || {};
  const o = opcionesIniciales(t, recordados);
  const entradas = {};

  const campo = (k) => {
    const c = CAMPOS[k];
    const label = (t.etiquetas && t.etiquetas[k]) || c.label;
    let input;
    if (c.tipo === 'select') {
      input = el('select', { class: 'input' }, ...c.opciones.map(([v, txt]) => el('option', { value: v, selected: String(o[k]) === v }, txt)));
    } else if (c.tipo === 'check') {
      input = el('input', { type: 'checkbox', checked: !!o[k] });
      entradas[k] = input;
      return el('label', { class: 'pers-check' }, input, el('span', {}, label, c.hint ? el('small', {}, c.hint) : null));
    } else {
      // El texto de ejemplo de la plantilla va como pista (gris), para no tener que borrarlo.
      const ejemplo = (t.def || {})[k];
      const valor = o[k] && o[k] !== ejemplo ? o[k] : '';
      const pista = ejemplo || c.placeholder || '';
      input = c.tipo === 'area'
        ? el('textarea', { class: 'input', rows: 2, placeholder: pista || 'Uno por línea', autocapitalize: 'words' })
        : el('input', { type: 'text', class: 'input', placeholder: pista });
      input.value = valor;
    }
    entradas[k] = input;
    return el('div', { class: 'pers-campo' + (c.tipo === 'select' ? ' pers-sel' : '') },
      el('label', { class: 'field-label' }, label), input, c.hint ? el('small', { class: 'pers-hint' }, c.hint) : null);
  };

  const nombre = el('input', { type: 'text', class: 'input', value: t.name });
  // Los campos cortos van en dos columnas cuando hay espacio (tablet); título, autores y destinatario, a lo ancho.
  const ANCHOS = ['titulo', 'autor', 'destinatario'];
  const bas = t.basicos || [];
  const cortos = bas.filter((k) => !ANCHOS.includes(k)).map(campo);
  const basicos = [...bas.filter((k) => ANCHOS.includes(k)).map(campo), cortos.length ? el('div', { class: 'pers-grid' }, ...cortos) : null];
  const av = t.avanzados || [];
  const selects = av.filter((k) => CAMPOS[k].tipo === 'select').map(campo);
  const checks = av.filter((k) => CAMPOS[k].tipo === 'check').map(campo);
  const avBox = el('div', { class: 'pers-avanzado', hidden: true },
    selects.length ? el('div', { class: 'pers-grid' }, ...selects) : null, ...checks);
  const avBtn = el('button', { class: 'btn ghost pers-toggle', type: 'button', html: `${icon('settings')}<span>Personalización avanzada</span><span class="pers-flecha"></span>`,
    onclick: () => { avBox.hidden = !avBox.hidden; avBtn.classList.toggle('abierto', !avBox.hidden); } });

  const body = el('div', { class: 'pers' },
    el('div', { class: 'pers-campo' }, el('label', { class: 'field-label' }, 'Nombre del proyecto'), nombre),
    bas.length ? el('h3', { class: 'pers-titulo' }, 'Datos del documento') : null,
    ...basicos,
    RECORDAR.some((k) => (t.basicos || []).includes(k)) ? el('p', { class: 'muted small pers-nota' }, 'Tus datos (nombre, universidad, curso…) se recuerdan para la próxima plantilla.') : null,
    av.length ? avBtn : null,
    av.length ? avBox : null);

  const r = await dialog({
    title: t.name, body, wide: true,
    buttons: [{ label: 'Cancelar', value: null }, { label: 'Crear', primary: true, value: () => true }],
    autofocus: false,  // sin abrir el teclado de golpe: muchos solo cambian una o dos cosas
  });
  if (!r) return null;
  for (const [k, input] of Object.entries(entradas)) o[k] = input.type === 'checkbox' ? input.checked : input.value;
  // Si dejó un campo de texto vacío, la plantilla usa su texto de ejemplo.
  for (const [k, v] of Object.entries(t.def || {})) if (typeof v === 'string' && k in entradas && !String(o[k] || '').trim() && CAMPOS[k].tipo !== 'select') o[k] = v;
  const guardar = { ...recordados };
  for (const k of RECORDAR) if (k in entradas) guardar[k] = String(o[k] || '').trim();
  setSettings({ plantillaDatos: guardar });
  return { nombre: nombre.value.trim() || t.name, opciones: o };
}
