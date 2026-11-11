// Componentes de interfaz: íconos, avisos, diálogos y hojas inferiores.

const ICONS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  more: '<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>',
  files: '<path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10l2 2h6.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/>',
  file: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20 16l-5-5-8 8"/>',
  outline: '<path d="M5 6h14M8 12h11M11 18h8"/><circle cx="5" cy="12" r=".8" fill="currentColor"/><circle cx="8" cy="18" r=".8" fill="currentColor"/>',
  symbols: '<path d="M17 5H7l6 7-6 7h10"/>',
  code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
  pdf: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M9 13h6M9 17h4"/>',
  log: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  wand: '<path d="M4 20L15 9M14 4v3M19 9h-3M17.5 5.5l-2 2M11 6.5l1 1M17.5 12.5l-1-1"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  terminal: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 9.5l3 2.5-3 2.5M12.5 15h4.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  star: '<path d="M12 4l2.5 5.2 5.5.8-4 3.9.9 5.6L12 16.8 7.1 19.5 8 13.9 4 10l5.5-.8z"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  left: '<path d="M14 6l-6 6 6 6"/>',
  right: '<path d="M10 6l6 6-6 6"/>',
  split: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

export function logoSvg(size = 28) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="var(--logo-bg)"/>
    <path d="M16 18h32v8H36v26h-8V26H16z" fill="var(--logo-fg)"/>
    <path d="M36 44l10 8-12-2z" fill="var(--accent)"/>
  </svg>`;
}

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let toastTimer;
export function toast(msg, { action, onAction, ms = 3200, kind = '' } = {}) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('div', { class: 'toast', role: 'status' }); document.body.appendChild(t); }
  t.className = 'toast show ' + kind;
  t.replaceChildren(el('span', {}, msg));
  if (action) t.append(el('button', { class: 'toast-act', onclick: () => { t.classList.remove('show'); onAction && onAction(); } }, action));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// Pila de capas (diálogos/hojas) para manejar el botón Atrás de Android.
const layers = [];
export function closeTopLayer() {
  const top = layers[layers.length - 1];
  if (top) { top(); return true; }
  return false;
}

function mountLayer(node, onClose) {
  const backdrop = el('div', { class: 'backdrop' });
  backdrop.append(node);
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('show'));
  let closed = false;
  const close = (v) => {
    if (closed) return;
    closed = true;
    const i = layers.indexOf(closer);
    if (i >= 0) layers.splice(i, 1);
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 180);
    onClose && onClose(v);
  };
  const closer = () => close(undefined);
  layers.push(closer);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(undefined); });
  return close;
}

/** Diálogo genérico. buttons: [{label, value, primary, danger}] */
export function dialog({ title, body, buttons = [{ label: 'Aceptar', value: true, primary: true }], wide = false }) {
  return new Promise((resolve) => {
    const box = el('div', { class: 'dialog' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' });
    if (title) box.append(el('h2', {}, title));
    const content = el('div', { class: 'dialog-body' });
    if (typeof body === 'string') content.innerHTML = body; else if (body) content.append(body);
    box.append(content);
    const row = el('div', { class: 'dialog-buttons' });
    let close;
    for (const b of buttons) {
      row.append(el('button', { class: 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: () => close(typeof b.value === 'function' ? b.value(content) : b.value) }, b.label));
    }
    box.append(row);
    close = mountLayer(box, resolve);
    const first = box.querySelector('input, textarea, select');
    if (first) setTimeout(() => first.focus(), 60);
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { const p = buttons.find((b) => b.primary); if (p) close(typeof p.value === 'function' ? p.value(content) : p.value); }
      if (e.key === 'Escape') close(undefined);
    });
  });
}

export async function promptText(title, { value = '', placeholder = '', label = '', ok = 'Aceptar' } = {}) {
  const input = el('input', { type: 'text', class: 'input', value, placeholder, autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' });
  const body = el('div', {}, label ? el('label', { class: 'field-label' }, label) : null, input);
  const r = await dialog({ title, body, buttons: [{ label: 'Cancelar', value: null }, { label: ok, primary: true, value: () => input.value }] });
  return r == null ? null : String(r).trim();
}

export async function confirmDialog(title, message, { ok = 'Aceptar', danger = false } = {}) {
  return !!(await dialog({ title, body: el('p', {}, message), buttons: [{ label: 'Cancelar', value: false }, { label: ok, value: true, primary: !danger, danger }] }));
}

/** Hoja inferior de opciones. items: [{label, icon, value, danger, hint}] o '-' */
export function sheet(title, items) {
  return new Promise((resolve) => {
    const box = el('div', { class: 'sheet', role: 'menu' });
    box.append(el('div', { class: 'sheet-handle' }));
    if (title) box.append(el('div', { class: 'sheet-title' }, title));
    let close;
    for (const it of items) {
      if (it === '-') { box.append(el('hr')); continue; }
      box.append(el('button', { class: 'sheet-item' + (it.danger ? ' danger' : ''), role: 'menuitem', onclick: () => close(it.value) },
        el('span', { class: 'sheet-ico', html: it.icon ? icon(it.icon) : '' }),
        el('span', { class: 'sheet-label' }, it.label, it.hint ? el('small', {}, it.hint) : null)));
    }
    close = mountLayer(box, resolve);
  });
}

/** Panel inferior con contenido libre (símbolos, etc.). Devuelve función para cerrar. */
export function panel(title, content, { onClose } = {}) {
  const box = el('div', { class: 'sheet panel' });
  box.append(el('div', { class: 'sheet-handle' }));
  if (title) box.append(el('div', { class: 'sheet-title' }, title));
  box.append(content);
  return mountLayer(box, onClose);
}

export function pickFiles({ accept = '', multiple = true } = {}) {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, multiple, style: 'display:none' });
    input.addEventListener('change', () => { resolve(Array.from(input.files || [])); input.remove(); });
    document.body.append(input);
    input.click();
  });
}
