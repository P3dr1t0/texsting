// Editor principal basado en CodeMirror 6.
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, highlightSpecialChars } from '@codemirror/view';
import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, toggleComment } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches, openSearchPanel, search } from '@codemirror/search';
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap, snippet, acceptCompletion } from '@codemirror/autocomplete';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, indentOnInput, foldKeymap, indentUnit } from '@codemirror/language';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { tags as t } from '@lezer/highlight';
import { COMMANDS, ENVIRONMENTS, envSnippet } from '../latex-data.js';

// CodeMirror interpreta \{ y \} en plantillas como llaves escapadas: los duplicamos.
const cmTemplate = (tpl) => tpl.replace(/\\([{}])/g, '\\\\$1');

const latexHighlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--syn-cmd)' },
  { tag: t.tagName, color: 'var(--syn-cmd)' },
  { tag: t.atom, color: 'var(--syn-cmd)' },
  { tag: t.bracket, color: 'var(--syn-bracket)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.string, color: 'var(--syn-math)' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.variableName, color: 'var(--syn-env)' },
  { tag: t.typeName, color: 'var(--syn-env)' },
  { tag: t.meta, color: 'var(--syn-env)' },
  { tag: t.invalid, color: 'var(--danger)' },
]);

const baseTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--editor-bg)', color: 'var(--text)' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--accent)', paddingBottom: '40vh' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-gutters': { backgroundColor: 'var(--editor-gutter)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--editor-active)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--editor-active)', color: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--editor-sel) !important' },
  '.cm-matchingBracket': { backgroundColor: 'var(--editor-match)', outline: 'none' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' },
  '.cm-tooltip-autocomplete ul li': { padding: '6px 10px !important', fontFamily: 'var(--mono)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent) !important', color: 'var(--on-accent) !important' },
  '.cm-completionDetail': { fontFamily: 'var(--ui)', opacity: 0.7, marginLeft: '10px', fontStyle: 'normal' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-panel.cm-search': { padding: '8px', fontFamily: 'var(--ui)' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontSize: '15px', minHeight: '34px' },
  '.cm-textfield': { borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' },
  '.cm-button': { borderRadius: '8px', backgroundImage: 'none', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' },
  '.cm-foldGutter span': { padding: '0 4px' },
  '.cm-line.ts-error-line': { backgroundColor: 'var(--danger-soft)' },
});

export function createEditor(parent, { onChange, onSave, onCompile, getContext }) {
  const fontSize = new Compartment();
  const wrap = new Compartment();
  const gutter = new Compartment();
  const completion = new Compartment();
  const readOnly = new Compartment();
  const states = new Map();
  let currentKey = null;
  let cfg = { fontSize: 15, lineWrap: true, lineNumbers: true, autocomplete: true };

  function latexCompletions(ctx) {
    const before = ctx.state.sliceDoc(Math.max(0, ctx.pos - 200), ctx.pos);
    const c = getContext ? getContext() : { labels: [], cites: [], commands: [] };
    let m = before.match(/\\(?:ref|eqref|pageref|autoref|cref|Cref|nameref|vref)\{([^}]*)$/);
    if (m) {
      return { from: ctx.pos - m[1].length, options: c.labels.map((l) => ({ label: l.name, type: 'variable', detail: l.file + ':' + l.line })), validFor: /^[^}]*$/ };
    }
    m = before.match(/\\(?:cite|citep|citet|parencite|textcite|autocite|nocite)(?:\[[^\]]*\])*\{([^}]*,)?([^},]*)$/);
    if (m) {
      return { from: ctx.pos - m[2].length, options: c.cites.map((k) => ({ label: k, type: 'text', detail: 'bib' })), validFor: /^[^},]*$/ };
    }
    m = before.match(/\\begin\{([A-Za-z*]*)$/);
    if (m) {
      const from = ctx.pos - m[1].length - 7; // incluye "\begin{"
      return {
        from: from,
        options: ENVIRONMENTS.map(([name]) => ({ label: '\\begin{' + name + '}', displayLabel: name, type: 'class', detail: 'entorno', apply: snippet(cmTemplate(envSnippet(name))) })),
        validFor: /^\\begin\{[A-Za-z*]*$/,
      };
    }
    m = before.match(/\\[A-Za-z@]*\*?$/);
    if (!m || (m[0].length < 2 && !ctx.explicit)) return null;
    const user = (c.commands || []).map((name) => ({ label: name, type: 'function', detail: 'tuyo' }));
    return {
      from: ctx.pos - m[0].length,
      options: [
        ...COMMANDS.map((cmd) => ({ label: cmd.label, type: cmd.section === 'mate' ? 'function' : 'keyword', detail: cmd.info, apply: snippet(cmTemplate(cmd.template.replace('${sel}', '${}'))) })),
        ...user,
      ],
      validFor: /^\\[A-Za-z@]*\*?$/,
    };
  }

  const keys = [
    { key: 'Mod-s', run: () => { onSave && onSave(); return true; } },
    { key: 'Mod-Enter', run: () => { onCompile && onCompile(); return true; } },
    { key: 'F5', run: () => { onCompile && onCompile(); return true; } },
    { key: 'Mod-b', run: (v) => { insertIn(v, '\\textbf{${sel}}'); return true; } },
    { key: 'Mod-i', run: (v) => { insertIn(v, '\\textit{${sel}}'); return true; } },
    { key: 'Mod-t', run: toggleComment },
    { key: 'Tab', run: acceptCompletion },
  ];

  function makeState(text, ro) {
    return EditorState.create({
      doc: text,
      extensions: [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        highlightSelectionMatches(),
        search({ top: true }),
        indentUnit.of('  '),
        StreamLanguage.define(stex),
        EditorState.languageData.of(() => [{ closeBrackets: { brackets: ['(', '[', '{'] }, commentTokens: { line: '%' } }]),
        syntaxHighlighting(latexHighlight),
        keymap.of([...keys, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, indentWithTab]),
        fontSize.of(EditorView.theme({ '&': { fontSize: cfg.fontSize + 'px' } })),
        wrap.of(cfg.lineWrap ? EditorView.lineWrapping : []),
        gutter.of(cfg.lineNumbers ? [lineNumbers(), foldGutter()] : []),
        completion.of(cfg.autocomplete ? autocompletion({ override: [latexCompletions], icons: false, activateOnTyping: true, maxRenderedOptions: 60 }) : []),
        readOnly.of(EditorState.readOnly.of(!!ro)),
        EditorView.contentAttributes.of({ autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
        baseTheme,
        EditorView.updateListener.of((u) => { if (u.docChanged && onChange) onChange(u.state.doc.toString()); }),
      ],
    });
  }

  const view = new EditorView({ state: makeState('', true), parent });

  function insertIn(v, template) {
    const sel = v.state.selection.main;
    const selected = v.state.sliceDoc(sel.from, sel.to);
    const tpl = template.includes('${sel}') ? template.replace('${sel}', selected ? selected.replace(/\$\{/g, '$ {') : '${}') : template;
    if (!/[$#]\{/.test(tpl)) {
      v.dispatch(v.state.replaceSelection(tpl));
    } else {
      snippet(cmTemplate(tpl))(v, null, sel.from, sel.to);
    }
    v.focus();
  }

  function reconfigure() {
    view.dispatch({
      effects: [
        fontSize.reconfigure(EditorView.theme({ '&': { fontSize: cfg.fontSize + 'px' } })),
        wrap.reconfigure(cfg.lineWrap ? EditorView.lineWrapping : []),
        gutter.reconfigure(cfg.lineNumbers ? [lineNumbers(), foldGutter()] : []),
        completion.reconfigure(cfg.autocomplete ? autocompletion({ override: [latexCompletions], icons: false, activateOnTyping: true, maxRenderedOptions: 60 }) : []),
      ],
    });
  }

  return {
    open(key, text, { readOnly: ro = false } = {}) {
      if (currentKey) states.set(currentKey, view.state);
      currentKey = key;
      let st = states.get(key);
      if (!st || st.doc.toString() !== text) st = makeState(text, ro);
      view.setState(st);
      reconfigure();
    },
    forget(key) { states.delete(key); if (key === currentKey) currentKey = null; },
    getText() { return view.state.doc.toString(); },
    insertSnippet(tpl) { insertIn(view, tpl); },
    gotoLine(line) {
      const n = Math.max(1, Math.min(line, view.state.doc.lines));
      const l = view.state.doc.line(n);
      view.dispatch({ selection: EditorSelection.cursor(l.from), effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
      view.focus();
      // destello breve en la línea de destino (saltos desde el PDF o desde Mensajes)
      requestAnimationFrame(() => {
        try {
          const node = view.domAtPos(l.from).node;
          const lineEl = (node.nodeType === 1 ? node : node.parentElement)?.closest('.cm-line');
          if (lineEl) { lineEl.classList.add('cm-flash'); setTimeout(() => lineEl.classList.remove('cm-flash'), 1500); }
        } catch { /* la línea no está dibujada */ }
      });
    },
    getCursorLine() { return view.state.doc.lineAt(view.state.selection.main.head).number; },
    moveCursor(delta) {
      const pos = Math.max(0, Math.min(view.state.doc.length, view.state.selection.main.head + delta));
      view.dispatch({ selection: EditorSelection.cursor(pos), scrollIntoView: true });
      view.focus();
    },
    focus() { view.focus(); },
    blur() { view.contentDOM.blur(); },
    configure(patch) { cfg = { ...cfg, ...patch }; reconfigure(); },
    undo() { undo(view); view.focus(); },
    redo() { redo(view); view.focus(); },
    openSearch() { openSearchPanel(view); },
    refresh() { view.requestMeasure(); },
  };
}
