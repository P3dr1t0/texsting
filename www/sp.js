(() => {
  // stub.js
  var SearchQuery = class {
    constructor(o) {
      Object.assign(this, { search: "", replace: "", caseSensitive: false, wholeWord: false, regexp: false, valid: true }, o);
    }
    eq(o) {
      return JSON.stringify(this) === JSON.stringify(o);
    }
    getCursor() {
      let i = 0;
      return { next: () => i++ < 12 ? { done: false, value: { from: i, to: i } } : { done: true } };
    }
  };
  var setSearchQuery = { of: (v) => ({ v }) };
  function getSearchQuery() {
    return new SearchQuery({ search: "\\underline", caseSensitive: true });
  }
  var findNext = () => {
  };
  var findPrevious = () => {
  };
  var replaceNext = () => {
  };
  var replaceAll = () => {
  };
  var closeSearchPanel = () => {
  };

  // ../../home/claude/texsting/src/ui.js
  var ICONS = {
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
    check2: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16.2 9.6"/>',
    circle: '<circle cx="12" cy="12" r="8.5"/>',
    selectall: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12.3l2.8 2.8L16.2 9.6"/>',
    pin: '<path d="M9 4h6l-1 6 3 3v2H7v-2l3-3z"/><path d="M12 15v5"/>',
    sort: '<path d="M7 5v14M4 16l3 3 3-3M14 7h6M14 12h4.5M14 17h3"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.5v.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    left: '<path d="M14 6l-6 6 6 6"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    down: '<path d="M6 10l6 6 6-6"/>',
    right: '<path d="M10 6l6 6-6 6"/>',
    split: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M12 4.5v15"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'
  };
  function icon(name, cls = "") {
    return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  // ../../home/claude/texsting/src/editor/searchpanel.js
  var MAX_COUNT = 5e3;
  function createSearchPanel(view2) {
    const q0 = getSearchQuery(view2.state);
    const el = (tag, attrs = {}, ...kids) => {
      const n = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "class") n.className = v;
        else if (k === "html") n.innerHTML = v;
        else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
        else n.setAttribute(k, v);
      }
      for (const c of kids) n.append(c);
      return n;
    };
    const search = el("input", { class: "ts-s-input", type: "text", placeholder: "Buscar", "aria-label": "Buscar", "main-field": "true", enterkeyhint: "search", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const replace = el("input", { class: "ts-s-input", type: "text", placeholder: "Reemplazar por", "aria-label": "Reemplazar por", enterkeyhint: "done", autocapitalize: "off", autocomplete: "off", spellcheck: "false" });
    const count = el("span", { class: "ts-s-count", "aria-live": "polite" });
    search.value = q0.search;
    replace.value = q0.replace;
    const opts = { caseSensitive: q0.caseSensitive, wholeWord: q0.wholeWord, regexp: q0.regexp };
    const chip = (key, label, title) => {
      const b = el("button", { type: "button", class: "ts-s-chip", title, "aria-pressed": String(!!opts[key]) }, label);
      b.addEventListener("click", () => {
        opts[key] = !opts[key];
        b.setAttribute("aria-pressed", String(opts[key]));
        commit();
        search.focus();
      });
      return b;
    };
    const btn = (cls, content, title, run) => el("button", { type: "button", class: "ts-s-btn " + cls, title, "aria-label": title, html: content, onclick: () => {
      commit();
      run(view2);
    } });
    const prev = btn("icon", icon("up"), "Anterior (May\xFAs + Enter)", findPrevious);
    const next = btn("icon", icon("down"), "Siguiente (Enter)", findNext);
    const one = btn("", "Cambiar", "Reemplazar esta coincidencia", replaceNext);
    const all = btn("", "Todas", "Reemplazar todas", replaceAll);
    const close = el("button", { type: "button", class: "ts-s-close", title: "Cerrar (Esc)", "aria-label": "Cerrar", html: icon("close"), onclick: () => {
      closeSearchPanel(view2);
      view2.focus();
    } });
    const dom = el(
      "div",
      { class: "ts-search", role: "search" },
      el("div", { class: "ts-s-field" }, el("span", { class: "ts-s-ico", html: icon("search") }), search, count),
      el("div", { class: "ts-s-pair" }, prev, next),
      el("div", { class: "ts-s-field" }, el("span", { class: "ts-s-ico", html: icon("edit") }), replace),
      el("div", { class: "ts-s-pair" }, one, all),
      el(
        "div",
        { class: "ts-s-opts" },
        chip("caseSensitive", "Aa", "Distinguir may\xFAsculas y min\xFAsculas"),
        chip("wholeWord", "Palabra completa", "Solo palabras completas"),
        chip("regexp", ".* Regex", "Usar expresi\xF3n regular"),
        el("span", { class: "ts-s-grow" }),
        close
      )
    );
    function query() {
      return new SearchQuery({ search: search.value, replace: replace.value, caseSensitive: opts.caseSensitive, wholeWord: opts.wholeWord, regexp: opts.regexp });
    }
    function commit() {
      const q = query();
      if (!q.eq(getSearchQuery(view2.state))) view2.dispatch({ effects: setSearchQuery.of(q) });
    }
    let timer = null;
    function recount() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = getSearchQuery(view2.state);
        if (!q.search) {
          count.textContent = "";
          dom.classList.remove("none");
          return;
        }
        if (!q.valid) {
          count.textContent = "Regex no v\xE1lida";
          dom.classList.add("none");
          return;
        }
        const sel = view2.state.selection.main;
        let n = 0, cur = 0;
        const it = q.getCursor(view2.state);
        for (let r = it.next(); !r.done; r = it.next()) {
          n++;
          if (r.value.from === sel.from && r.value.to === sel.to) cur = n;
          if (n >= MAX_COUNT) break;
        }
        dom.classList.toggle("none", n === 0);
        count.textContent = n === 0 ? "Sin resultados" : `${cur ? cur + " de " : ""}${n >= MAX_COUNT ? MAX_COUNT + "+" : n}`;
      }, 120);
    }
    search.addEventListener("input", () => {
      commit();
      recount();
    });
    replace.addEventListener("input", commit);
    search.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        (e.shiftKey ? findPrevious : findNext)(view2);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSearchPanel(view2);
        view2.focus();
      }
    });
    replace.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
        (e.ctrlKey || e.metaKey ? replaceAll : replaceNext)(view2);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeSearchPanel(view2);
        view2.focus();
      }
    });
    return {
      dom,
      top: true,
      mount() {
        recount();
      },
      update(u) {
        for (const tr of u.transactions) for (const ef of tr.effects) {
          if (ef.is(setSearchQuery) && !ef.value.eq(query())) {
            const q = ef.value;
            search.value = q.search;
            replace.value = q.replace;
            opts.caseSensitive = q.caseSensitive;
            opts.wholeWord = q.wholeWord;
            opts.regexp = q.regexp;
            dom.querySelectorAll(".ts-s-chip").forEach((b, i) => b.setAttribute("aria-pressed", String(!![opts.caseSensitive, opts.wholeWord, opts.regexp][i])));
          }
        }
        if (u.docChanged || u.selectionSet || u.transactions.some((tr) => tr.effects.some((ef) => ef.is(setSearchQuery)))) recount();
      }
    };
  }

  // main.js
  var view = { state: { selection: { main: { from: 3, to: 3 } } }, dispatch() {
  }, focus() {
  } };
  var p = createSearchPanel(view);
  document.getElementById("host").append(p.dom);
  p.mount();
})();
