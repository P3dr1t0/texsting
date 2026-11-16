// Pantalla de inicio: lista de proyectos, estado del compilador, crear e importar.
import { listProjects, createProject, deleteProject, duplicateProject, saveProject, touchProject, listFiles, getOutput, isTextPath, getSettings, setSettings } from '../store.js';
import { el, icon, logoSvg, brandName, toast, sheet, promptText, confirmDialog, pickFiles, esc, pushBack } from '../ui.js';
import { saveAsTemplate } from './newproject.js';
import { ping, serverOutdated, ENGINE_LABEL } from '../compiler.js';
import { motorEstado, motorCalentar } from '../motor.js';
import { createZip, readZip } from '../zip.js';
import { shareBytes } from '../share.js';
import { timeAgo, sanitizeName, slug, readFileAsBytes } from '../util.js';

const dec = new TextDecoder();
const enc = new TextEncoder();

export async function renderHome(root, _params, navigate) {
  const status = el('button', { class: 'server-chip checking', onclick: () => navigate('termux') }, 'Comprobando el compilador…');
  const list = el('div', { class: 'project-list' });
  const RECENT_MAX = 8;
  let tab = getSettings().homeTab === 'all' ? 'all' : 'recent';
  let query = '';
  let projects = [];
  const tabBtn = (key, ic, label) => el('button', { dataset: { key }, onclick: () => { clearSelection(false); tab = key; setSettings({ homeTab: key }); query = ''; searchInput.value = ''; draw(); } });
  const recentBtn = tabBtn('recent');
  const allBtn = tabBtn('all');
  const searchInput = el('input', { class: 'input small', type: 'search', placeholder: 'Buscar…', 'aria-label': 'Buscar proyecto',
    oninput: (e) => { query = e.target.value; draw(); } });
  const searchBox = el('div', { class: 'home-search', html: icon('search') }, searchInput);
  // Orden de «Todos». Los fijados siempre van arriba, con el mismo orden entre ellos.
  // [clave, texto del menú, texto corto del botón]
  const SORTS = [
    ['az', 'Nombre (A → Z)', 'Nombre A → Z'],
    ['za', 'Nombre (Z → A)', 'Nombre Z → A'],
    ['mod-new', 'Modificados: recientes primero', 'Editados recientes'],
    ['mod-old', 'Modificados: antiguos primero', 'Editados antiguos'],
    ['new', 'Creados: nuevos primero', 'Creados recientes'],
    ['old', 'Creados: antiguos primero', 'Creados antiguos'],
  ];
  let sortKey = SORTS.some(([k]) => k === getSettings().homeSort) ? getSettings().homeSort : 'az';
  const sortBtn = el('button', { class: 'btn small home-sort', onclick: chooseSort });
  // Mismo esquema de dos columnas que «Nuevo proyecto | Importar»: pestañas a lo ancho y,
  // debajo, buscador y orden del mismo tamaño.
  const filterRow = el('div', { class: 'home-filter' }, searchBox, sortBtn);
  const tabsRow = el('div', { class: 'home-tabs' }, el('div', { class: 'seg', role: 'tablist' }, recentBtn, allBtn), filterRow);
  // Selección múltiple: se entra manteniendo presionado un proyecto.
  const selected = new Set();
  let dropBack = null;
  const selCount = el('strong', { class: 'sel-count' });
  const selBar = el('div', { class: 'sel-bar', hidden: true },
    el('button', { class: 'icon-btn', title: 'Salir de la selección', 'aria-label': 'Salir de la selección', html: icon('close'), onclick: () => clearSelection() }),
    selCount,
    el('div', { class: 'sel-actions' },
      el('button', { class: 'btn small', html: icon('selectall') + '<span>Todos</span>', title: 'Seleccionar todos los visibles', 'aria-label': 'Seleccionar todos', onclick: () => selectAllVisible() }),
      el('button', { class: 'btn small sel-pin', html: icon('pin') + '<span>Fijar</span>', title: 'Fijar / desfijar', 'aria-label': 'Fijar o desfijar', onclick: () => pinSelected() }),
      el('button', { class: 'btn small', html: icon('download') + '<span>Exportar</span>', title: 'Exportar en un .zip', 'aria-label': 'Exportar', onclick: () => exportSelected() }),
      el('button', { class: 'btn small danger', html: icon('trash') + '<span>Eliminar</span>', title: 'Eliminar', 'aria-label': 'Eliminar', onclick: () => deleteSelected() })));

  const screen = el('div', { class: 'screen home' },
    el('header', { class: 'home-head' },
      el('div', { class: 'brand', html: logoSvg(36) + brandName() }),
      el('button', { class: 'icon-btn', title: 'Ajustes', 'aria-label': 'Ajustes', html: icon('settings'), onclick: () => navigate('settings') })),
    status,
    el('div', { class: 'home-actions' },
      el('button', { class: 'btn primary big', html: icon('plus') + '<span>Nuevo proyecto</span>', onclick: () => navigate('new') }),
      el('button', { class: 'btn big', html: icon('upload') + '<span>Importar</span>', onclick: importProject })),
    tabsRow,
    selBar,
    list,
    el('p', { class: 'home-foot' }, `TeXsting ${__VERSION__} · Fase 1: Beta · software libre (GPL-3.0)`));
  root.append(screen);

  const lastUse = (p) => Math.max(p.opened || 0, p.updated || 0);
  const norm = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const cmpName = (a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });
  const created = (p) => p.created || p.updated || 0;
  const SORT_FN = {
    az: cmpName,
    za: (a, b) => cmpName(b, a),
    'mod-new': (a, b) => (b.updated || 0) - (a.updated || 0),
    'mod-old': (a, b) => (a.updated || 0) - (b.updated || 0),
    new: (a, b) => created(b) - created(a),
    old: (a, b) => created(a) - created(b),
  };

  async function chooseSort() {
    const k = await sheet('Ordenar proyectos', [
      ...SORTS.map(([v, t]) => ({ label: t + (v === sortKey ? '  ✓' : ''), value: v, icon: 'sort' })),
      '-',
      { label: 'Los proyectos fijados siempre quedan arriba', icon: 'pin', value: null, hint: 'Fija uno desde su menú ⋮ o con el alfiler' },
    ]);
    if (!k) return;
    sortKey = k; setSettings({ homeSort: k }); draw();
  }

  async function togglePin(p) {
    p.pinned = p.pinned ? 0 : Date.now();
    await touchProject(p.id, { pinned: p.pinned });
    toast(p.pinned ? `«${p.name}» fijado arriba` : `«${p.name}» ya no está fijado`);
    draw();
  }

  async function refresh() {
    projects = await listProjects();
    draw();
  }

  function card(p) {
    const when = tab === 'recent' && p.opened && p.opened > (p.updated || 0) ? 'abierto ' + timeAgo(p.opened) : timeAgo(p.updated);
    const isSel = selected.has(p.id);
    const openBtn = el('button', { class: 'project-open' },
      el('span', { class: 'project-ico', html: selected.size ? icon(isSel ? 'check2' : 'circle') : icon('file') }),
      el('span', { class: 'project-meta', html: `<strong>${esc(p.name)}</strong><small>${esc(p.main)} · ${ENGINE_LABEL[p.lastEngine || p.engine] || esc(p.engine)} · ${when}</small>` }));
    longPress(openBtn, () => toggleSelect(p.id), () => (selected.size ? toggleSelect(p.id) : navigate('editor', { id: p.id })));
    return el('div', { class: 'project-card' + (p.pinned ? ' pinned' : '') + (isSel ? ' selected' : '') + (selected.size ? ' selecting' : ''), dataset: { id: p.id } },
      openBtn,
      selected.size ? null : el('button', { class: 'icon-btn pin-btn' + (p.pinned ? ' on' : ''), title: p.pinned ? 'Desfijar' : 'Fijar arriba', 'aria-label': p.pinned ? 'Desfijar' : 'Fijar arriba', 'aria-pressed': String(!!p.pinned), html: icon('pin'), onclick: () => togglePin(p) }),
      selected.size ? null : el('button', { class: 'icon-btn', 'aria-label': 'Opciones', html: icon('more'), onclick: () => projectMenu(p) }));
  }

  // Mantener presionado (≈0,5 s) selecciona; un toque normal abre (o, seleccionando, marca/desmarca).
  // Con mouse también sirve el clic derecho.
  // Al seleccionar se vuelve a dibujar la lista, así que el «clic» que llega al soltar el dedo
  // cae en una tarjeta nueva: se ignora durante un momento para que no desmarque ni abra nada.
  let ignoreClickUntil = 0;
  function longPress(node, onLong, onTap) {
    let timer = null, fired = false, sx = 0, sy = 0;
    const cancel = () => { clearTimeout(timer); timer = null; };
    node.addEventListener('pointerdown', (e) => {
      if (e.button && e.button !== 0) return;
      fired = false; sx = e.clientX; sy = e.clientY;
      timer = setTimeout(() => { fired = true; timer = null; ignoreClickUntil = Date.now() + 700; try { navigator.vibrate && navigator.vibrate(25); } catch { /* sin vibración */ } onLong(); }, 480);
    });
    node.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel(); });
    node.addEventListener('pointerup', cancel);
    node.addEventListener('pointercancel', cancel);
    node.addEventListener('pointerleave', cancel);
    node.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!fired && Date.now() > ignoreClickUntil) { cancel(); fired = true; ignoreClickUntil = Date.now() + 700; onLong(); } });
    node.addEventListener('click', (e) => { if (fired || Date.now() < ignoreClickUntil) { fired = false; e.preventDefault(); return; } onTap(); });
  }

  function toggleSelect(id) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    if (selected.size && !dropBack) dropBack = pushBack(() => clearSelection());
    if (!selected.size) clearSelection(false);
    draw();
  }

  function clearSelection(redraw = true) {
    selected.clear();
    if (dropBack) { dropBack(); dropBack = null; }
    if (redraw) draw();
  }

  function visibleProjects() {
    return [...list.querySelectorAll('.project-card')].map((c) => projects.find((p) => p.id === c.dataset.id)).filter(Boolean);
  }

  function selectAllVisible() {
    const vis = visibleProjects();
    const all = vis.every((p) => selected.has(p.id));
    for (const p of vis) { if (all) selected.delete(p.id); else selected.add(p.id); }
    if (!selected.size) { clearSelection(); return; }
    draw();
  }

  const selProjects = () => projects.filter((p) => selected.has(p.id));

  async function pinSelected() {
    const sel = selProjects();
    const pin = !sel.every((p) => p.pinned);
    for (const p of sel) { p.pinned = pin ? (p.pinned || Date.now()) : 0; await touchProject(p.id, { pinned: p.pinned }); }
    toast(pin ? `${sel.length} fijado(s) arriba` : `${sel.length} desfijado(s)`);
    clearSelection();
  }

  async function exportSelected() {
    const sel = selProjects();
    const entries = [];
    const used = new Set();
    for (const p of sel) {
      let dir = slug(p.name); let k = 2;
      while (used.has(dir)) dir = slug(p.name) + '-' + k++;
      used.add(dir);
      for (const f of await listFiles(p.id)) entries.push({ path: `${dir}/${f.path}`, data: f.kind === 'binary' ? f.data : enc.encode(f.text) });
    }
    if (sel.length === 1) { const p = sel[0]; await shareBytes(createZip(entries.map((e) => ({ ...e, path: e.path.split('/').slice(1).join('/') }))), slug(p.name) + '.zip', 'application/zip', p.name); }
    else await shareBytes(createZip(entries), `texsting-${sel.length}-proyectos.zip`, 'application/zip', `${sel.length} proyectos`);
  }

  async function deleteSelected() {
    const sel = selProjects();
    if (!sel.length) return;
    const names = sel.slice(0, 6).map((p) => '«' + p.name + '»').join(', ') + (sel.length > 6 ? ` y ${sel.length - 6} más` : '');
    const pinned = sel.filter((p) => p.pinned).length;
    const msg = `Se borrarán ${sel.length === 1 ? 'este proyecto' : `estos ${sel.length} proyectos`} y todos sus archivos de este teléfono: ${names}.` +
      (pinned ? ` (${pinned} ${pinned === 1 ? 'está fijado' : 'están fijados'}).` : '') + ' No se puede deshacer.';
    if (!(await confirmDialog(sel.length === 1 ? 'Eliminar proyecto' : `Eliminar ${sel.length} proyectos`, msg, { ok: 'Eliminar', danger: true }))) return;
    for (const p of sel) await deleteProject(p.id);
    toast(sel.length === 1 ? 'Proyecto eliminado' : `${sel.length} proyectos eliminados`);
    clearSelection(false);
    refresh();
  }

  // Fijados arriba (con su título), luego el resto.
  function withPinned(arr, title) {
    const pinned = arr.filter((p) => p.pinned);
    const rest = arr.filter((p) => !p.pinned);
    if (!pinned.length) return rest.map(card);
    return [el('p', { class: 'home-group', html: `${icon('pin')}<span>Fijados</span>` }), ...pinned.map(card),
      rest.length ? el('p', { class: 'home-group' }, title) : '', ...rest.map(card)];
  }

  function draw() {
    selBar.hidden = !selected.size;
    tabsRow.hidden = !!selected.size;
    if (selected.size) {
      const sel = selProjects();
      selCount.textContent = `${sel.length} seleccionado${sel.length === 1 ? '' : 's'}`;
      selBar.querySelector('.sel-pin span').textContent = sel.length && sel.every((p) => p.pinned) ? 'Desfijar' : 'Fijar';
    }
    recentBtn.innerHTML = `${icon('clock')}<span>Recientes</span>`;
    allBtn.innerHTML = `${icon('files')}<span>Todos</span><small>${projects.length}</small>`;
    recentBtn.classList.toggle('active', tab === 'recent');
    allBtn.classList.toggle('active', tab === 'all');
    filterRow.hidden = tab !== 'all' || projects.length < 2;
    const curSort = SORTS.find(([k]) => k === sortKey) || SORTS[0];
    sortBtn.innerHTML = `${icon('sort')}<span>${curSort[2]}</span>`;
    sortBtn.title = 'Ordenar: ' + curSort[1];
    if (!projects.length) {
      list.replaceChildren(el('div', { class: 'empty', html: `${icon('file', 'big')}<p>Aún no tienes proyectos.</p><p class="muted">Crea uno con una plantilla o importa un .zip (por ejemplo, descargado de Overleaf) o archivos .tex.</p>` }));
      return;
    }
    if (tab === 'recent') {
      const pinned = projects.filter((p) => p.pinned).sort((a, b) => lastUse(b) - lastUse(a));
      const recent = projects.filter((p) => !p.pinned).sort((a, b) => lastUse(b) - lastUse(a)).slice(0, RECENT_MAX);
      const rest = projects.length - recent.length - pinned.length;
      list.replaceChildren(...withPinned([...pinned, ...recent], 'Recientes'),
        rest > 0 ? el('button', { class: 'btn ghost home-more', onclick: () => allBtn.click() }, `Ver los ${projects.length} proyectos`) : '');
      return;
    }
    const q = norm(query.trim());
    const all = [...projects]
      .filter((p) => !q || norm(p.name).includes(q) || norm(p.main).includes(q))
      .sort(SORT_FN[sortKey] || cmpName);
    list.replaceChildren(...(all.length ? withPinned(all, 'Los demás') : [el('p', { class: 'home-hint' }, `Ningún proyecto se llama «${query}».`)]));
  }

  async function projectMenu(p) {
    const out = await getOutput(p.id);
    const choice = await sheet(p.name, [
      { label: 'Abrir', icon: 'edit', value: 'open' },
      { label: p.pinned ? 'Desfijar' : 'Fijar arriba', icon: 'pin', value: 'pin', hint: p.pinned ? null : 'Queda primero en Recientes y en Todos, con cualquier orden' },
      out && out.pdf ? { label: 'Compartir último PDF', icon: 'share', value: 'pdf' } : null,
      { label: 'Exportar proyecto (.zip)', icon: 'download', value: 'zip' },
      { label: 'Renombrar', icon: 'edit', value: 'rename' },
      { label: 'Duplicar', icon: 'copy', value: 'dup' },
      { label: 'Guardar como plantilla', icon: 'star', value: 'tpl' },
      '-',
      { label: 'Eliminar', icon: 'trash', value: 'delete', danger: true },
    ].filter(Boolean));
    if (choice === 'open') navigate('editor', { id: p.id });
    if (choice === 'pin') await togglePin(p);
    if (choice === 'pdf') await shareBytes(out.pdf, slug(p.name) + '.pdf', 'application/pdf', p.name);
    if (choice === 'zip') {
      const files = await listFiles(p.id);
      const zip = createZip(files.map((f) => ({ path: f.path, data: f.kind === 'binary' ? f.data : enc.encode(f.text) })));
      await shareBytes(zip, slug(p.name) + '.zip', 'application/zip', p.name);
    }
    if (choice === 'rename') {
      const name = await promptText('Renombrar proyecto', { value: p.name });
      if (name) { p.name = sanitizeName(name); await saveProject(p); refresh(); }
    }
    if (choice === 'tpl') await saveAsTemplate(p);
    if (choice === 'dup') { await duplicateProject(p.id, p.name + ' (copia)'); refresh(); }
    if (choice === 'delete') {
      if (await confirmDialog('Eliminar proyecto', `Se borrará «${p.name}» y todos sus archivos de este teléfono. No se puede deshacer.`, { ok: 'Eliminar', danger: true })) {
        await deleteProject(p.id);
        toast('Proyecto eliminado');
        refresh();
      }
    }
  }

  async function importProject() {
    const files = await pickFiles({ accept: '.zip,.tex,.bib,.sty,.cls,.png,.jpg,.jpeg,.pdf,application/zip', multiple: true });
    if (!files.length) return;
    try {
      let entries = [];
      let name = files[0].name.replace(/\.[^.]+$/, '');
      for (const f of files) {
        const bytes = await readFileAsBytes(f);
        if (/\.zip$/i.test(f.name)) entries.push(...(await readZip(bytes)));
        else entries.push({ path: f.name, data: bytes });
      }
      // Si todo está dentro de una sola carpeta, la quitamos.
      const tops = new Set(entries.map((e) => e.path.split('/')[0]));
      if (tops.size === 1 && entries.every((e) => e.path.includes('/'))) {
        name = [...tops][0];
        entries = entries.map((e) => ({ ...e, path: e.path.split('/').slice(1).join('/') }));
      }
      if (!entries.length) throw new Error('No se encontraron archivos');
      const texs = entries.filter((e) => e.path.endsWith('.tex'));
      const withDoc = texs.find((e) => /\\documentclass/.test(dec.decode(e.data)) && /\\begin\{document\}/.test(dec.decode(e.data)));
      const main = (withDoc || texs.find((e) => e.path === 'main.tex') || texs[0] || entries[0]).path;
      const p = await createProject({
        name: sanitizeName(name) || 'Importado',
        main,
        files: entries.map((e) => (isTextPath(e.path) ? { path: e.path, text: dec.decode(e.data) } : { path: e.path, data: e.data })),
      });
      toast(`Importado: ${entries.length} archivo(s)`);
      navigate('editor', { id: p.id });
    } catch (e) {
      toast('No se pudo importar: ' + e.message, { kind: 'error' });
    }
  }

  async function checkServer() {
    // Con el motor integrado no hace falta Termux: el aviso dice que está listo y lleva a Ajustes.
    const mst = (getSettings().compilador || 'auto') !== 'termux' ? await motorEstado() : null;
    if (mst && !mst.listo) {
      status.className = 'server-chip';
      status.onclick = () => navigate('settings');
      status.innerHTML = `${icon('chip')}<span>Preparando el motor integrado (solo tras instalar o actualizar)…</span>`;
      try { await motorCalentar(); } catch (e) {
        status.className = 'server-chip warn';
        status.innerHTML = `${icon('chip')}<span>No se pudo preparar el motor: ${esc(String(e.message || e)).slice(0, 120)}</span>`;
        return;
      }
      return checkServer();
    }
    if (mst) {
      status.className = 'server-chip ok';
      status.onclick = () => navigate('settings');
      status.innerHTML = `${icon('check')}<span>Motor integrado listo · ${(mst.motores || ['pdflatex']).map((m) => ({ pdflatex: 'pdfLaTeX', lualatex: 'LuaLaTeX' })[m] || m).join(', ')}${getSettings().autoinstall ? ' · paquetes al vuelo' : ''}</span>`;
      return;
    }
    status.onclick = () => navigate('termux');
    try {
      const info = await ping();
      if (serverOutdated(info)) {
        status.className = 'server-chip warn';
        status.innerHTML = `${icon('terminal')}<span>Hay mejoras para Termux · <u>Actualizar (unos segundos)</u></span>`;
        return;
      }
      status.className = 'server-chip ok';
      status.innerHTML = `${icon('check')}<span>Termux conectado · ${esc((info.tex || 'TeX').replace(/\s*\(.*$/, ''))}${info.tlmgr ? ' · paquetes al vuelo' : ''}</span>`;
    } catch (e) {
      status.className = 'server-chip off';
      status.innerHTML = `${icon('terminal')}<span>${e.kind === 'auth' ? 'Token incorrecto' : 'Termux sin conexión'} · <u>Configurar</u></span>`;
    }
  }

  await refresh();
  checkServer();
  const onVis = () => { if (!document.hidden) checkServer(); };
  document.addEventListener('visibilitychange', onVis);
  return { cleanup: () => document.removeEventListener('visibilitychange', onVis) };
}
