// Editor simple (textarea) con la misma interfaz que cm.js.
// Se usa para probar la app en un navegador sin las dependencias de CodeMirror.
export function createEditor(parent, { onChange, onSave, onCompile }) {
  const ta = document.createElement('textarea');
  ta.className = 'basic-editor';
  ta.spellcheck = false;
  ta.setAttribute('autocapitalize', 'off');
  ta.setAttribute('autocorrect', 'off');
  parent.appendChild(ta);
  const docs = new Map();
  let current = null;
  ta.addEventListener('input', () => onChange && onChange(ta.value));
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave && onSave(); }
    if (((e.ctrlKey || e.metaKey) && e.key === 'Enter') || e.key === 'F5') { e.preventDefault(); onCompile && onCompile(); }
  });

  function insert(template) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    const selected = ta.value.slice(s, e);
    let tpl = template.replace('${sel}', selected || '\u0000');
    let cursor = -1;
    tpl = tpl.replace(/\$\{[^}]*\}/g, (m) => { return '\u0000'; });
    cursor = tpl.indexOf('\u0000');
    tpl = tpl.replace(/\u0000/g, '');
    ta.setRangeText(tpl, s, e, 'end');
    if (cursor >= 0) ta.selectionStart = ta.selectionEnd = s + cursor;
    ta.focus();
    onChange && onChange(ta.value);
  }

  return {
    open(key, text, { readOnly = false } = {}) {
      if (current) docs.set(current, ta.value);
      current = key;
      ta.value = text;
      ta.readOnly = readOnly;
    },
    forget(key) { docs.delete(key); },
    getText() { return ta.value; },
    insertSnippet: insert,
    gotoLine(line) {
      const lines = ta.value.split('\n');
      let pos = 0;
      for (let i = 0; i < Math.min(line - 1, lines.length); i++) pos += lines[i].length + 1;
      ta.focus();
      ta.selectionStart = ta.selectionEnd = pos;
      ta.dataset.gotoLine = String(line);
    },
    getCursorLine() { return ta.value.slice(0, ta.selectionStart).split('\n').length; },
    moveCursor(d) { const p = Math.max(0, ta.selectionStart + d); ta.selectionStart = ta.selectionEnd = p; ta.focus(); },
    focus() { ta.focus(); },
    blur() { ta.blur(); },
    configure(cfg) { if (cfg.fontSize) ta.style.fontSize = cfg.fontSize + 'px'; ta.style.whiteSpace = cfg.lineWrap === false ? 'pre' : 'pre-wrap'; },
    undo() { document.execCommand('undo'); },
    redo() { document.execCommand('redo'); },
    openSearch() {},
    refresh() {},
  };
}
