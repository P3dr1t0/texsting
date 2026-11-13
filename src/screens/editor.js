// Pantalla del editor: código + PDF lado a lado (tablet) o en pestañas (teléfono),
// con archivos, estructura, símbolos, mensajes de compilación y asistentes.
import { createEditor } from '#editor-impl';
import { getProject, saveProject, listFiles, putFile, deleteFile, renameFile, getOutput, saveOutput, getSettings, setSettings, isTextPath } from '../store.js';
import { el, icon, toast, sheet, panel, promptText, confirmDialog, dialog, pickFiles, esc } from '../ui.js';
import { createPdfViewer } from '../pdfview.js';
import { compileProject, CompileError } from '../compiler.js';
import { parseLog, summarize } from '../logparser.js';
import { analyzeProject } from '../structure.js';
import { SYMBOLS, KEYBAR, ENGINES, envSnippet } from '../latex-data.js';
import { tableWizard, matrixWizard, listWizard, QUICK_INSERTS } from '../wizards.js';
import { shareBytes } from '../share.js';
import { createZip } from '../zip.js';
import { debounce, readFileAsBytes, slug, extOf, IMAGE_EXT } from '../util.js';
import { appearance } from './settings.js';
import { openTermux } from '../termux.js';
import { saveAsTemplate } from './newproject.js';

const enc = new TextEncoder();
const WIDE = window.matchMedia('(min-width: 900px)');

export async function renderEditor(root, { id }, navigate) {
  const project = await getProject(id);
  if (!project) { navigate('home'); return {}; }
  let files = await listFiles(id);
  let currentPath = project.current && files.some((f) => f.path === project.current && f.kind === 'text') ? project.current : project.main;
  let lastResult = null;
  let messages = [];
  let analysis = { outline: [], labels: [], cites: [], commands: [] };
  let compiling = false;
  let dirty = false;

  // ---------- Estructura de la pantalla ----------
  const fileBtn = el('button', { class: 'file-switch', onclick: () => showPanel('files') });
  const compileBtn = el('button', { class: 'compile-btn', title: 'Compilar (Ctrl+Enter / F5)', onclick: () => compile() });
  const topbar = el('header', { class: 'topbar' },
    el('button', { class: 'icon-btn', 'aria-label': 'Volver a proyectos', html: icon('back'), onclick: () => navigate('home') }),
    el('div', { class: 'title-block' }, el('span', { class: 'project-name' }, project.name), fileBtn),
    el('div', { class: 'top-actions' },
      el('button', { class: 'icon-btn wide-only', title: 'Deshacer', 'aria-label': 'Deshacer', html: icon('undo'), onclick: () => editor.undo() }),
      el('button', { class: 'icon-btn wide-only', title: 'Rehacer', 'aria-label': 'Rehacer', html: icon('redo'), onclick: () => editor.redo() }),
      el('button', { class: 'icon-btn', title: 'Buscar y reemplazar', 'aria-label': 'Buscar', html: icon('search'), onclick: () => { showPanel('code'); editor.openSearch(); } }),
      el('button', { class: 'icon-btn wide-only', title: 'Asistentes', 'aria-label': 'Asistentes', html: icon('wand'), onclick: () => wizardsMenu() }),
      compileBtn,
      el('button', { class: 'icon-btn', title: 'Compartir PDF', 'aria-label': 'Compartir PDF', html: icon('share'), onclick: () => sharePdf() }),
      el('button', { class: 'icon-btn', title: 'Más opciones', 'aria-label': 'Más opciones', html: icon('more'), onclick: () => moreMenu() })));

  const filesList = el('div', { class: 'side-list' });
  const outlineList = el('div', { class: 'side-list' });
  const symbolsBox = el('div', { class: 'symbols' });
  const sideTabs = el('div', { class: 'side-tabs' });
  const sidebar = el('aside', { class: 'sidebar' }, sideTabs,
    el('div', { class: 'side-section', dataset: { section: 'files' } },
      el('div', { class: 'side-head' }, el('span', {}, 'Archivos'),
        el('button', { class: 'icon-btn sm', title: 'Nuevo archivo', 'aria-label': 'Nuevo archivo', html: icon('plus'), onclick: () => newFile() }),
        el('button', { class: 'icon-btn sm', title: 'Importar archivos', 'aria-label': 'Importar archivos', html: icon('upload'), onclick: () => importFiles() })),
      filesList),
    el('div', { class: 'side-section', dataset: { section: 'outline' } }, el('div', { class: 'side-head' }, el('span', {}, 'Estructura')), outlineList),
    el('div', { class: 'side-section', dataset: { section: 'symbols' } }, el('div', { class: 'side-head' }, el('span', {}, 'Símbolos')), symbolsBox));

  const editorHost = el('div', { class: 'editor-host' });
  const keybar = el('div', { class: 'keybar', role: 'toolbar', 'aria-label': 'Teclas LaTeX' });
  const editorPane = el('section', { class: 'pane editor-pane' }, editorHost, keybar);
  const pdfHost = el('div', { class: 'pdf-host' });
  const pdfPane = el('section', { class: 'pane pdf-pane' }, pdfHost);
  const splitter = el('div', { class: 'splitter', role: 'separator', 'aria-label': 'Ajustar división' });

  const msgCounts = el('span', { class: 'msg-counts' });
  const msgList = el('div', { class: 'msg-list' });
  const rawLog = el('pre', { class: 'raw-log', hidden: true });
  const msgFilter = { error: true, warning: true, badbox: false };
  const filterBtns = el('div', { class: 'msg-filters' });
  const messagesPane = el('section', { class: 'messages' },
    el('div', { class: 'msg-head' },
      el('strong', {}, 'Mensajes'), msgCounts, filterBtns,
      el('button', { class: 'btn ghost sm', onclick: () => { rawLog.hidden = !rawLog.hidden; msgList.hidden = !rawLog.hidden; } }, 'Log completo'),
      el('button', { class: 'icon-btn sm wide-only', 'aria-label': 'Cerrar mensajes', html: icon('close'), onclick: () => screen.classList.remove('show-messages') })),
    msgList, rawLog);

  const workspace = el('div', { class: 'workspace' }, sidebar, editorPane, splitter, pdfPane, messagesPane);
  const tabs = [
    ['files', 'Archivos', 'files'], ['outline', 'Estructura', 'outline'], ['code', 'Código', 'code'], ['pdf', 'PDF', 'pdf'], ['messages', 'Mensajes', 'log'],
  ];
  const bottomnav = el('nav', { class: 'bottomnav' }, ...tabs.map(([k, label, ic]) => el('button', { dataset: { tab: k }, onclick: () => showPanel(k), html: `${icon(ic)}<span>${label}</span><i class="badge" hidden></i>` })));
  const screen = el('div', { class: 'screen editor-screen', dataset: { tab: 'code' } }, topbar, workspace, bottomnav);
  root.append(screen);

  // ---------- Editor y visor ----------
  const saveSoon = debounce(saveCurrent, 700);
  const analyzeSoon = debounce(analyze, 900);
  const editor = createEditor(editorHost, {
    onChange: () => { dirty = true; saveSoon(); analyzeSoon(); },
    onSave: async () => { saveSoon.flush(); toast('Guardado'); if (getSettings().compileOnSave) compile(); },
    onCompile: () => compile(),
    getContext: () => analysis,
  });
  const s = getSettings();
  editor.configure({ fontSize: s.fontSize, lineWrap: s.lineWrap, lineNumbers: s.lineNumbers, autocomplete: s.autocomplete });
  const viewer = createPdfViewer(pdfHost);

  // ---------- Paneles / pestañas ----------
  function showPanel(name) {
    if (WIDE.matches) {
      if (name === 'messages') { screen.classList.toggle('show-messages'); return; }
      if (name === 'files' || name === 'outline' || name === 'symbols') { setSideTab(name); screen.classList.add('show-sidebar'); return; }
      if (name === 'code') editor.focus();
      return;
    }
    screen.dataset.tab = name;
    if (name !== 'code') editor.blur();
    bottomnav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    if (name === 'code') setTimeout(() => editor.refresh(), 30);
  }

  function setSideTab(name) {
    sideTabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.section === name));
    sidebar.dataset.active = name;
  }
  sideTabs.append(...[['files', 'files', 'Archivos'], ['outline', 'outline', 'Estructura'], ['symbols', 'symbols', 'Símbolos']].map(([k, ic, t]) =>
    el('button', { dataset: { section: k }, title: t, 'aria-label': t, html: icon(ic), onclick: () => setSideTab(k) })));
  sideTabs.append(el('button', { class: 'side-collapse', title: 'Ocultar panel', 'aria-label': 'Ocultar panel', html: icon('left'), onclick: () => screen.classList.remove('show-sidebar') }));
  setSideTab('outline');
  if (WIDE.matches) screen.classList.add('show-sidebar');
  showPanel('code');

  // División ajustable editor | PDF (tablet).
  function applySplit() { workspace.style.setProperty('--split', String(getSettings().splitRatio)); }
  applySplit();
  splitter.addEventListener('pointerdown', (e) => {
    splitter.setPointerCapture(e.pointerId);
    const rect = workspace.getBoundingClientRect();
    const side = screen.classList.contains('show-sidebar') ? sidebar.getBoundingClientRect().width : 0;
    const move = (ev) => {
      const r = Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left - side) / (rect.width - side)));
      workspace.style.setProperty('--split', String(r));
    };
    const up = () => {
      splitter.removeEventListener('pointermove', move);
      setSettings({ splitRatio: +workspace.style.getPropertyValue('--split') || 0.5 });
      editor.refresh();
    };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up, { once: true });
  });

  // ---------- Archivos ----------
  function fileIcon(f) {
    if (f.kind === 'binary') return IMAGE_EXT.includes(extOf(f.path)) ? 'image' : 'file';
    return f.path.endsWith('.tex') ? 'code' : 'file';
  }

  function renderFiles() {
    const engineTag = project.engine && project.engine !== 'pdflatex' ? `<em class="eng">${(ENGINES.find((e) => e[0] === project.engine) || [0, project.engine])[1]}</em>` : '';
    fileBtn.innerHTML = `<span>${esc(currentPath)}</span>${currentPath === project.main ? '<em>principal</em>' : ''}${engineTag}<svg viewBox="0 0 24 24" class="ico caret"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
    filesList.replaceChildren(...files.map((f) => el('div', { class: 'side-item file' + (f.path === currentPath ? ' active' : '') },
      el('button', { class: 'side-main', onclick: () => openFile(f.path) },
        el('span', { html: icon(fileIcon(f)) }),
        el('span', { class: 'label' }, f.path),
        f.path === project.main ? el('em', { class: 'tag' }, 'principal') : null),
      el('button', { class: 'icon-btn sm', 'aria-label': 'Opciones de ' + f.path, html: icon('more'), onclick: () => fileMenu(f) }))));
  }

  async function openFile(path) {
    const f = files.find((x) => x.path === path);
    if (!f) return;
    if (f.kind === 'binary') { previewBinary(f); return; }
    saveSoon.flush();
    currentPath = path;
    editor.open(path, f.text);
    project.current = path;
    saveProject(project);
    renderFiles();
    showPanel('code');
  }

  async function saveCurrent() {
    if (!dirty) return;
    dirty = false;
    const text = editor.getText();
    const f = files.find((x) => x.path === currentPath);
    if (f) f.text = text;
    await putFile(project.id, { path: currentPath, text });
  }

  async function previewBinary(f) {
    const isImg = IMAGE_EXT.includes(extOf(f.path));
    let url = null;
    const body = el('div', { class: 'preview' });
    if (isImg) {
      url = URL.createObjectURL(new Blob([f.data], { type: extOf(f.path) === 'svg' ? 'image/svg+xml' : 'image/' + extOf(f.path) }));
      body.append(el('img', { src: url, alt: f.path }));
    }
    body.append(el('p', { class: 'muted' }, `${f.path} · ${(f.data.length / 1024).toFixed(0)} KB`));
    const r = await dialog({ title: f.path, body, buttons: [{ label: 'Cerrar', value: null }, isImg || extOf(f.path) === 'pdf' ? { label: 'Insertar en el documento', value: 'insert', primary: true } : null].filter(Boolean) });
    if (url) URL.revokeObjectURL(url);
    if (r === 'insert') insertGraphic(f.path);
  }

  function insertGraphic(path) {
    const f = files.find((x) => x.path === currentPath);
    if (!f || !currentPath.endsWith('.tex')) openFile(project.main);
    editor.insertSnippet(`\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=\${0.8}\\linewidth]{${path}}\n  \\caption{\${leyenda}}\n  \\label{fig:\${${slug(path.replace(/\.[^.]+$/, '').split('/').pop())}}}\n\\end{figure}`);
    ensurePackage('graphicx');
    showPanel('code');
  }

  async function fileMenu(f) {
    const choice = await sheet(f.path, [
      { label: 'Abrir', icon: 'edit', value: 'open' },
      f.kind === 'text' && f.path.endsWith('.tex') && f.path !== project.main ? { label: 'Usar como archivo principal', icon: 'star', value: 'main' } : null,
      f.kind === 'binary' ? { label: 'Insertar en el documento', icon: 'image', value: 'insert' } : null,
      { label: 'Renombrar', icon: 'edit', value: 'rename' },
      { label: 'Compartir archivo', icon: 'share', value: 'share' },
      '-',
      { label: 'Eliminar', icon: 'trash', value: 'delete', danger: true },
    ].filter(Boolean));
    if (choice === 'open') openFile(f.path);
    if (choice === 'main') { project.main = f.path; await saveProject(project); renderFiles(); analyze(); toast('Archivo principal: ' + f.path); }
    if (choice === 'insert') insertGraphic(f.path);
    if (choice === 'share') await shareBytes(f.kind === 'binary' ? f.data : enc.encode(f.text), f.path.split('/').pop(), 'application/octet-stream');
    if (choice === 'rename') {
      const to = await promptText('Renombrar archivo', { value: f.path });
      if (!to || to === f.path) return;
      if (files.some((x) => x.path === to)) { toast('Ya existe un archivo con ese nombre'); return; }
      saveSoon.flush();
      await renameFile(project.id, f.path, to);
      editor.forget(f.path);
      if (project.main === f.path) project.main = to;
      if (currentPath === f.path) currentPath = to;
      await saveProject(project);
      files = await listFiles(project.id);
      if (currentPath === to) editor.open(to, files.find((x) => x.path === to).text);
      renderFiles();
    }
    if (choice === 'delete') {
      if (f.path === project.main) { toast('No puedes eliminar el archivo principal'); return; }
      if (!(await confirmDialog('Eliminar archivo', `¿Eliminar ${f.path}?`, { ok: 'Eliminar', danger: true }))) return;
      await deleteFile(project.id, f.path);
      editor.forget(f.path);
      files = files.filter((x) => x.path !== f.path);
      if (currentPath === f.path) openFile(project.main);
      renderFiles();
      analyze();
    }
  }

  async function newFile() {
    const name = await promptText('Nuevo archivo', { placeholder: 'capitulo1.tex', label: 'Nombre (puede incluir carpeta, p. ej. secciones/intro.tex)', ok: 'Crear' });
    if (!name) return;
    const path = name.includes('.') ? name : name + '.tex';
    if (files.some((x) => x.path === path)) { toast('Ya existe'); return; }
    const text = path.endsWith('.bib') ? '' : path.endsWith('.tex') ? `% ${path}\n` : '';
    await putFile(project.id, { path, text });
    files = await listFiles(project.id);
    renderFiles();
    openFile(path);
    if (path.endsWith('.tex') && path !== project.main) toast(`Inclúyelo en ${project.main} con \\input{${path.replace(/\.tex$/, '')}}`, { ms: 5000 });
  }

  async function importFiles() {
    const picked = await pickFiles({ multiple: true });
    if (!picked.length) return;
    for (const file of picked) {
      const bytes = await readFileAsBytes(file);
      const isText = isTextPath(file.name);
      await putFile(project.id, isText ? { path: file.name, text: new TextDecoder().decode(bytes) } : { path: file.name, data: bytes });
    }
    files = await listFiles(project.id);
    renderFiles();
    analyze();
    toast(`${picked.length} archivo(s) agregado(s)`);
    if (picked.length === 1 && IMAGE_EXT.includes(extOf(picked[0].name)) && currentPath.endsWith('.tex')) {
      toast('Imagen agregada', { action: 'Insertar', onAction: () => insertGraphic(picked[0].name), ms: 6000 });
    }
  }

  // ---------- Estructura ----------
  function analyze() {
    const textFiles = files.filter((f) => f.kind === 'text').map((f) => (f.path === currentPath ? { path: f.path, text: editor.getText() } : f));
    analysis = analyzeProject(project.main, textFiles);
    const ICON = { section: 'outline', label: 'edit', input: 'file', figure: 'image', table: 'split', todo: 'star' };
    const items = analysis.outline.filter((i) => i.type !== 'label');
    if (!items.length) {
      outlineList.replaceChildren(el('p', { class: 'muted pad' }, 'Aquí aparecerán tus secciones, figuras, tablas e \\input. Agrega un \\section{...}.'));
      return;
    }
    outlineList.replaceChildren(...items.map((it) => el('button', {
      class: `side-item outline-item t-${it.type}`,
      style: `--lvl:${(it.type === 'section' ? it.level - 2 : 3) + it.depth}`,
      onclick: () => jumpTo(it.file, it.line),
    }, el('span', { html: icon(ICON[it.type] || 'file') }), el('span', { class: 'label' }, it.type === 'todo' ? 'POR HACER: ' + it.title : it.title), el('small', {}, String(it.line)))));
  }

  function jumpTo(file, line) {
    if (file && file !== currentPath) {
      const f = files.find((x) => x.path === file);
      if (f && f.kind === 'text') openFile(file);
    }
    showPanel('code');
    if (line) setTimeout(() => editor.gotoLine(line), 40);
  }

  // ---------- Símbolos y barra de teclas ----------
  function symbolGrid(onPick) {
    const box = el('div', { class: 'symbol-groups' });
    for (const g of SYMBOLS) {
      box.append(el('h4', {}, g.name), el('div', { class: 'symbol-grid' }, ...g.items.map(([glyph, tpl]) =>
        el('button', { class: 'sym', title: tpl.replace(/\$\{[^}]*\}/g, '…'), onclick: () => onPick(tpl) }, glyph))));
    }
    return box;
  }
  symbolsBox.append(symbolGrid((tpl) => editor.insertSnippet(tpl)));

  keybar.append(
    el('button', { class: 'kb kb-ico', 'aria-label': 'Izquierda', html: icon('left'), onclick: () => editor.moveCursor(-1) }),
    el('button', { class: 'kb kb-ico', 'aria-label': 'Derecha', html: icon('right'), onclick: () => editor.moveCursor(1) }),
    el('button', { class: 'kb kb-accent', onclick: () => {
      const close = panel('Símbolos', symbolGrid((tpl) => { close(); editor.insertSnippet(tpl); }));
    } }, 'Ω'),
    el('button', { class: 'kb kb-accent', onclick: () => insertEnvironment() }, 'begin'),
    ...KEYBAR.map(([label, tpl]) => el('button', { class: 'kb', onclick: () => editor.insertSnippet(tpl) }, label)),
    el('button', { class: 'kb kb-ico', 'aria-label': 'Deshacer', html: icon('undo'), onclick: () => editor.undo() }),
    el('button', { class: 'kb kb-ico', 'aria-label': 'Rehacer', html: icon('redo'), onclick: () => editor.redo() }),
    el('button', { class: 'kb kb-ico', 'aria-label': 'Asistentes', html: icon('wand'), onclick: () => wizardsMenu() }));
  keybar.addEventListener('pointerdown', (e) => { if (e.target.closest('.kb')) e.preventDefault(); }); // no cerrar teclado

  async function insertEnvironment() {
    const envs = ['itemize', 'enumerate', 'equation', 'align*', 'figure', 'table', 'tabular', 'center', 'cases', 'bmatrix', 'tikzpicture', 'circuitikz', 'minipage', 'frame', 'verbatim'];
    const choice = await sheet('Insertar entorno', envs.map((e) => ({ label: e, value: e, icon: 'code' })));
    if (choice) editor.insertSnippet(envSnippet(choice).replace('\t${}', '\t${sel}'));
  }

  async function ensurePackage(pkg) {
    const main = files.find((f) => f.path === project.main);
    if (!main || main.kind !== 'text') return;
    const text = currentPath === project.main ? editor.getText() : main.text;
    if (new RegExp('\\\\usepackage(\\[[^\\]]*\\])?\\{[^}]*\\b' + pkg + '\\b').test(text)) return;
    toast(`Este código necesita \\usepackage{${pkg}}`, { action: 'Agregar', ms: 7000, onAction: async () => {
      const t = currentPath === project.main ? editor.getText() : main.text;
      const idx = t.indexOf('\\begin{document}');
      if (idx < 0) return;
      const nt = t.slice(0, idx) + `\\usepackage{${pkg}}\n` + t.slice(idx);
      main.text = nt;
      await putFile(project.id, { path: project.main, text: nt });
      if (currentPath === project.main) { editor.forget(project.main); editor.open(project.main, nt); }
      toast(`Agregado \\usepackage{${pkg}}`);
    } });
  }

  async function wizardsMenu() {
    const choice = await sheet('Asistentes e inserciones', [
      { label: 'Tabla…', icon: 'split', value: 'table' },
      { label: 'Matriz…', icon: 'symbols', value: 'matrix' },
      { label: 'Lista…', icon: 'outline', value: 'list' },
      { label: 'Imagen desde el teléfono…', icon: 'image', value: 'image' },
      '-',
      ...QUICK_INSERTS.map((q, i) => ({ label: q.label, icon: 'code', value: 'q' + i })),
    ]);
    if (!choice) return;
    let r = null;
    if (choice === 'table') r = await tableWizard();
    else if (choice === 'matrix') r = await matrixWizard();
    else if (choice === 'list') r = await listWizard();
    else if (choice === 'image') {
      const picked = await pickFiles({ accept: 'image/*,.pdf', multiple: false });
      if (!picked.length) return;
      const name = 'figuras/' + picked[0].name.replace(/\s+/g, '_');
      await putFile(project.id, { path: name, data: await readFileAsBytes(picked[0]) });
      files = await listFiles(project.id);
      renderFiles();
      insertGraphic(name);
      return;
    } else if (choice.startsWith('q')) {
      const q = QUICK_INSERTS[+choice.slice(1)];
      r = { snippet: q.value, needs: /circuitikz/.test(q.value) ? ['circuitikz'] : /axis/.test(q.value) ? ['pgfplots'] : /lstlisting/.test(q.value) ? ['listings'] : /align|cases/.test(q.value) ? ['amsmath'] : /includegraphics/.test(q.value) ? ['graphicx'] : [] };
    }
    if (!r) return;
    showPanel('code');
    editor.insertSnippet(r.snippet);
    for (const p of r.needs || []) ensurePackage(p);
    if (/tikzpicture|circuitikz/.test(r.snippet)) ensureTikzBabel();
  }

  // babel en español activa > y <, lo que rompe opciones de TikZ/circuitikz.
  function ensureTikzBabel() {
    const main = files.find((f) => f.path === project.main);
    if (!main || main.kind !== 'text') return;
    const text = currentPath === project.main ? editor.getText() : main.text;
    if (!/\\usepackage(\[[^\]]*spanish[^\]]*\])\{babel\}/.test(text) || /\\usetikzlibrary\{[^}]*babel/.test(text)) return;
    setTimeout(() => toast('Con babel en español, TikZ necesita \\usetikzlibrary{babel}', { action: 'Agregar', ms: 8000, onAction: async () => {
      const t = currentPath === project.main ? editor.getText() : main.text;
      const idx = t.indexOf('\\begin{document}');
      if (idx < 0) return;
      const nt = t.slice(0, idx) + '\\usetikzlibrary{babel}\n' + t.slice(idx);
      main.text = nt;
      await putFile(project.id, { path: project.main, text: nt });
      if (currentPath === project.main) { editor.forget(project.main); editor.open(project.main, nt); }
      toast('Agregado \\usetikzlibrary{babel}');
    } }), 7500);
  }

  // ---------- Compilación ----------
  function setCompileState(state, extra = '') {
    compileBtn.className = 'compile-btn ' + state;
    compileBtn.innerHTML = state === 'busy'
      ? `<span class="spinner"></span><span class="lbl">${extra || 'Compilando'}</span>`
      : `${icon('play')}<span class="lbl">Compilar</span>`;
  }
  setCompileState('idle');

  async function compile() {
    if (compiling) return;
    compiling = true;
    saveSoon.flush();
    await saveCurrent();
    const t0 = Date.now();
    setCompileState('busy');
    const tick = setInterval(() => setCompileState('busy', Math.round((Date.now() - t0) / 1000) + ' s'), 1000);
    try {
      files = await listFiles(project.id);
      const r = await compileProject(project, files);
      lastResult = r;
      messages = parseLog(r.log, project.main, Object.fromEntries(files.filter((f) => f.kind === 'text').map((f) => [f.path, f.text])));
      renderMessages(r);
      rawLog.textContent = r.log || r.output || '';
      if (r.pdf) {
        await viewer.load(r.pdf);
        await saveOutput(project.id, { pdf: r.pdf, log: r.log, status: r.status });
      }
      const sm = summarize(messages);
      if (r.engineReason === 'fontspec' && project.engine !== 'xelatex') {
        project.engine = 'xelatex';
        await saveProject(project);
        renderFiles();
        toast('El documento usa fontspec: se compiló con XeLaTeX y el proyecto queda con ese motor', { ms: 6000 });
      }
      if (r.installed && r.installed.length) toast('Paquetes instalados: ' + r.installed.join(', '), { ms: 5000 });
      if (r.status === 'success') {
        toast(`Listo en ${r.elapsed} s${sm.warnings ? ` · ${sm.warnings} advertencia(s)` : ''}`, { kind: 'ok' });
        if (!WIDE.matches) showPanel('pdf');
      } else if (r.status === 'timeout') {
        toast('La compilación tardó demasiado y se detuvo', { kind: 'error' });
      } else {
        const n = sm.errors || 1;
        toast(`${n} error(es)${r.pdf ? ' (el PDF se generó igual)' : ''}`, { kind: 'error', action: 'Ver', ms: 6000, onAction: () => showPanel('messages') });
        if (WIDE.matches) screen.classList.add('show-messages');
        if (r.missing && r.missing.length) toast('No se encontró: ' + r.missing.join(', '), { kind: 'error', ms: 7000 });
      }
    } catch (e) {
      if (e instanceof CompileError && e.kind === 'offline') {
        toast(e.message, { kind: 'error', action: 'Abrir Termux', ms: 9000, onAction: async () => { if (!(await openTermux())) navigate('termux'); } });
      } else if (e instanceof CompileError && e.kind === 'auth') {
        toast(e.message, { kind: 'error', action: 'Configurar', ms: 8000, onAction: () => navigate('termux') });
      } else {
        toast('Error: ' + e.message, { kind: 'error', ms: 6000 });
      }
    } finally {
      clearInterval(tick);
      compiling = false;
      setCompileState('idle');
    }
  }

  function renderMessages(r) {
    const sm = summarize(messages);
    msgCounts.innerHTML = `<span class="c-err">${sm.errors} errores</span> <span class="c-warn">${sm.warnings} advertencias</span> <span class="c-box">${sm.badboxes} cajas</span>`;
    const badge = bottomnav.querySelector(':scope > [data-tab="messages"] .badge');
    badge.hidden = !sm.errors;
    badge.textContent = sm.errors;
    filterBtns.replaceChildren(...[['error', 'Errores'], ['warning', 'Advertencias'], ['badbox', 'Cajas']].map(([k, t]) =>
      el('button', { class: 'chip' + (msgFilter[k] ? ' on' : ''), onclick: () => { msgFilter[k] = !msgFilter[k]; renderMessages(r); } }, t)));
    const shown = messages.filter((m) => msgFilter[m.type]);
    const head = [];
    if (r && r.status === 'failed' && !messages.some((m) => m.type === 'error')) {
      const empty = /No pages of output/.test((r.log || '') + (r.output || ''));
      head.push(el('div', { class: 'msg error' }, el('span', { class: 'msg-type' }, 'Error'), el('span', { class: 'msg-text' },
        empty ? 'El documento está vacío: escribe algo entre \\begin{document} y \\end{document}.' : 'No se generó el PDF. Revisa el log completo.')));
    }
    if (!shown.length && !head.length) {
      msgList.replaceChildren(el('p', { class: 'muted pad' }, r ? (r.status === 'success' ? '✔ Sin errores.' : 'Sin mensajes para mostrar.') : 'Compila para ver errores y advertencias aquí.'));
      return;
    }
    msgList.replaceChildren(...head, ...shown.map((m) => el('button', {
      class: 'msg ' + m.type,
      onclick: () => { if (m.line) jumpTo(m.file, m.line); },
    },
    el('span', { class: 'msg-type' }, m.type === 'error' ? 'Error' : m.type === 'warning' ? 'Aviso' : 'Caja'),
    el('span', { class: 'msg-text' },
      el('span', {}, m.message),
      m.hint ? el('small', { class: 'hint' }, m.hint) : null,
      m.context ? el('code', {}, m.context) : null),
    m.line ? el('span', { class: 'msg-loc' }, `${(m.file || '').split('/').pop()}:${m.line}`) : null)));
  }

  async function sharePdf() {
    const out = lastResult && lastResult.pdf ? lastResult.pdf : (await getOutput(project.id))?.pdf;
    if (!out) { toast('Primero compila el documento'); return; }
    await shareBytes(out, slug(project.name) + '.pdf', 'application/pdf', project.name);
  }

  async function moreMenu() {
    const engineName = (ENGINES.find((e) => e[0] === project.engine) || ENGINES[0])[1];
    const choice = await sheet(project.name, [
      { label: 'Compartir PDF', icon: 'share', value: 'pdf' },
      { label: 'Motor: ' + engineName, hint: 'pdfLaTeX, XeLaTeX o LuaLaTeX', icon: 'settings', value: 'engine' },
      { label: 'Asistentes e inserciones', icon: 'wand', value: 'wizards' },
      { label: 'Buscar y reemplazar', icon: 'search', value: 'search' },
      { label: 'Archivos del proyecto', icon: 'files', value: 'files' },
      { label: 'Exportar proyecto (.zip)', icon: 'download', value: 'zip' },
      { label: 'Guardar como plantilla', icon: 'star', value: 'template' },
      '-',
      { label: 'Apariencia y tamaño de letra', icon: 'sun', value: 'look' },
      { label: 'Ajustes', icon: 'settings', value: 'settings' },
    ]);
    if (choice === 'look') panel('Apariencia', appearance({ onFont: (v) => editor.configure({ fontSize: v }) }));
    if (choice === 'template') { saveSoon.flush(); await saveCurrent(); await saveAsTemplate(project); }
    if (choice === 'pdf') sharePdf();
    if (choice === 'wizards') wizardsMenu();
    if (choice === 'search') { showPanel('code'); editor.openSearch(); }
    if (choice === 'files') showPanel('files');
    if (choice === 'settings') navigate('settings');
    if (choice === 'zip') {
      saveSoon.flush();
      files = await listFiles(project.id);
      await shareBytes(createZip(files.map((f) => ({ path: f.path, data: f.kind === 'binary' ? f.data : enc.encode(f.text) }))), slug(project.name) + '.zip', 'application/zip');
    }
    if (choice === 'engine') {
      const e = await sheet('Motor de compilación', ENGINES.map(([v, t]) => ({ label: t + (v === project.engine ? '  ✓' : ''), value: v, icon: 'play',
        hint: v === 'pdflatex' ? 'El clásico; el más rápido' : v === 'xelatex' ? 'Fuentes del sistema (fontspec)' : 'Moderno, con Lua' })));
      if (e) { project.engine = e; await saveProject(project); renderFiles(); toast('Motor del proyecto: ' + (ENGINES.find((x) => x[0] === e) || [0, e])[1]); }
    }
  }

  // ---------- Inicio ----------
  renderFiles();
  const startFile = files.find((f) => f.path === currentPath);
  editor.open(currentPath, startFile ? startFile.text : '');
  analyze();
  renderMessages(null);
  const prev = await getOutput(project.id);
  if (prev && prev.pdf) {
    viewer.load(prev.pdf).catch(() => {});
    messages = parseLog(prev.log, project.main);
    renderMessages({ status: prev.status });
    rawLog.textContent = prev.log || '';
  }
  const onWide = () => { if (WIDE.matches) screen.classList.add('show-sidebar'); showPanel(WIDE.matches ? 'code' : screen.dataset.tab); };
  WIDE.addEventListener('change', onWide);
  const onHide = () => { if (document.hidden) saveSoon.flush(); };
  document.addEventListener('visibilitychange', onHide);
  // Oculta la barra inferior cuando el teclado del teléfono está abierto.
  let maxH = window.innerHeight;
  const onResize = () => {
    maxH = Math.max(maxH, window.innerHeight);
    screen.classList.toggle('kb-open', window.innerHeight < maxH * 0.78);
  };
  window.addEventListener('resize', onResize);

  return {
    onBack: () => {
      if (!WIDE.matches && screen.dataset.tab !== 'code') { showPanel('code'); return true; }
      return false;
    },
    cleanup: async () => {
      saveSoon.flush();
      await saveCurrent();
      WIDE.removeEventListener('change', onWide);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('resize', onResize);
      viewer.clear();
    },
  };
}
