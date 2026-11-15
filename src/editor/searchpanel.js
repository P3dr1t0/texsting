// Panel de «Buscar y reemplazar» propio (el de CodeMirror quedaba desordenado en el teléfono y la tablet).
// Todo en dos columnas iguales: casillas a la izquierda y dos botones del mismo ancho a la derecha;
// debajo, las opciones como botones que se encienden y apagan, y «Cerrar».
import { SearchQuery, setSearchQuery, getSearchQuery, findNext, findPrevious, replaceNext, replaceAll, closeSearchPanel } from '@codemirror/search';
import { icon } from '../ui.js';

const MAX_COUNT = 5000;

export function createSearchPanel(view) {
  const q0 = getSearchQuery(view.state);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of kids) n.append(c);
    return n;
  };

  const search = el('input', { class: 'ts-s-input', type: 'text', placeholder: 'Buscar', 'aria-label': 'Buscar', 'main-field': 'true', enterkeyhint: 'search', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
  const replace = el('input', { class: 'ts-s-input', type: 'text', placeholder: 'Reemplazar por', 'aria-label': 'Reemplazar por', enterkeyhint: 'done', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false' });
  const count = el('span', { class: 'ts-s-count', 'aria-live': 'polite' });
  search.value = q0.search;
  replace.value = q0.replace;

  const opts = { caseSensitive: q0.caseSensitive, wholeWord: q0.wholeWord, regexp: q0.regexp };
  const chip = (key, label, title) => {
    const b = el('button', { type: 'button', class: 'ts-s-chip', title, 'aria-pressed': String(!!opts[key]) }, label);
    b.addEventListener('click', () => { opts[key] = !opts[key]; b.setAttribute('aria-pressed', String(opts[key])); commit(); search.focus(); });
    return b;
  };
  const btn = (cls, content, title, run) => el('button', { type: 'button', class: 'ts-s-btn ' + cls, title, 'aria-label': title, html: content, onclick: () => { commit(); run(view); } });

  const prev = btn('icon', icon('up'), 'Anterior (Mayús + Enter)', findPrevious);
  const next = btn('icon', icon('down'), 'Siguiente (Enter)', findNext);
  const one = btn('', 'Cambiar', 'Reemplazar esta coincidencia', replaceNext);
  const all = btn('', 'Todas', 'Reemplazar todas', replaceAll);
  const close = el('button', { type: 'button', class: 'ts-s-close', title: 'Cerrar (Esc)', 'aria-label': 'Cerrar', html: icon('close'), onclick: () => { closeSearchPanel(view); view.focus(); } });

  const dom = el('div', { class: 'ts-search', role: 'search' },
    el('div', { class: 'ts-s-field' }, el('span', { class: 'ts-s-ico', html: icon('search') }), search, count), el('div', { class: 'ts-s-pair' }, prev, next),
    el('div', { class: 'ts-s-field' }, el('span', { class: 'ts-s-ico', html: icon('edit') }), replace), el('div', { class: 'ts-s-pair' }, one, all),
    el('div', { class: 'ts-s-opts' },
      chip('caseSensitive', 'Aa', 'Distinguir mayúsculas y minúsculas'),
      chip('wholeWord', 'Palabra completa', 'Solo palabras completas'),
      chip('regexp', '.* Regex', 'Usar expresión regular'),
      el('span', { class: 'ts-s-grow' }), close));

  function query() {
    return new SearchQuery({ search: search.value, replace: replace.value, caseSensitive: opts.caseSensitive, wholeWord: opts.wholeWord, regexp: opts.regexp });
  }
  function commit() {
    const q = query();
    if (!q.eq(getSearchQuery(view.state))) view.dispatch({ effects: setSearchQuery.of(q) });
  }

  // «3 de 12»: cuántas coincidencias hay y en cuál está el cursor.
  let timer = null;
  function recount() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const q = getSearchQuery(view.state);
      if (!q.search) { count.textContent = ''; dom.classList.remove('none'); return; }
      if (!q.valid) { count.textContent = 'Regex no válida'; dom.classList.add('none'); return; }
      const sel = view.state.selection.main;
      let n = 0, cur = 0;
      const it = q.getCursor(view.state);
      for (let r = it.next(); !r.done; r = it.next()) {
        n++;
        if (r.value.from === sel.from && r.value.to === sel.to) cur = n;
        if (n >= MAX_COUNT) break;
      }
      dom.classList.toggle('none', n === 0);
      count.textContent = n === 0 ? 'Sin resultados' : `${cur ? cur + ' de ' : ''}${n >= MAX_COUNT ? MAX_COUNT + '+' : n}`;
    }, 120);
  }

  search.addEventListener('input', () => { commit(); recount(); });
  replace.addEventListener('input', commit);
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); (e.shiftKey ? findPrevious : findNext)(view); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearchPanel(view); view.focus(); }
  });
  replace.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); (e.ctrlKey || e.metaKey ? replaceAll : replaceNext)(view); }
    else if (e.key === 'Escape') { e.preventDefault(); closeSearchPanel(view); view.focus(); }
  });

  return {
    dom,
    top: true,
    mount() { recount(); },
    update(u) {
      for (const tr of u.transactions) for (const ef of tr.effects) {
        if (ef.is(setSearchQuery) && !ef.value.eq(query())) {
          const q = ef.value;
          search.value = q.search; replace.value = q.replace;
          opts.caseSensitive = q.caseSensitive; opts.wholeWord = q.wholeWord; opts.regexp = q.regexp;
          dom.querySelectorAll('.ts-s-chip').forEach((b, i) => b.setAttribute('aria-pressed', String(!![opts.caseSensitive, opts.wholeWord, opts.regexp][i])));
        }
      }
      if (u.docChanged || u.selectionSet || u.transactions.some((tr) => tr.effects.some((ef) => ef.is(setSearchQuery)))) recount();
    },
  };
}
