// Pantalla de inicio: lista de proyectos, estado de Termux, crear e importar.
import { listProjects, createProject, deleteProject, duplicateProject, saveProject, touchProject, listFiles, getOutput, isTextPath, getSettings, setSettings } from '../store.js';
import { el, icon, logoSvg, brandName, toast, sheet, promptText, confirmDialog, pickFiles, esc } from '../ui.js';
import { saveAsTemplate } from './newproject.js';
import { ping, serverOutdated, ENGINE_LABEL } from '../compiler.js';
import { createZip, readZip } from '../zip.js';
import { shareBytes } from '../share.js';
import { timeAgo, sanitizeName, slug, readFileAsBytes } from '../util.js';

const dec = new TextDecoder();
const enc = new TextEncoder();

export async function renderHome(root, _params, navigate) {
  const status = el('button', { class: 'server-chip checking', onclick: () => navigate('termux') }, 'Buscando Termux…');
  const list = el('div', { class: 'project-list' });
  const RECENT_MAX = 8;
  let tab = getSettings().homeTab === 'all' ? 'all' : 'recent';
  let query = '';
  let projects = [];
  const tabBtn = (key, ic, label) => el('button', { dataset: { key }, onclick: () => { tab = key; setSettings({ homeTab: key }); query = ''; searchInput.value = ''; draw(); } });
  const recentBtn = tabBtn('recent');
  const allBtn = tabBtn('all');
  const searchInput = el('input', { class: 'input small', type: 'search', placeholder: 'Buscar por nombre…', 'aria-label': 'Buscar proyecto',
    oninput: (e) => { query = e.target.value; draw(); } });
  const searchBox = el('div', { class: 'home-search' }, searchInput);
  // Orden de «Todos». Los fijados siempre van arriba, con el mismo orden entre ellos.
  const SORTS = [
    ['az', 'Nombre (A → Z)'],
    ['za', 'Nombre (Z → A)'],
    ['mod-new', 'Modificados: recientes primero'],
    ['mod-old', 'Modificados: antiguos primero'],
    ['new', 'Creados: nuevos primero'],
    ['old', 'Creados: antiguos primero'],
  ];
  let sortKey = SORTS.some(([k]) => k === getSettings().homeSort) ? getSettings().homeSort : 'az';
  const sortBtn = el('button', { class: 'btn small home-sort', onclick: chooseSort });
  const tabsRow = el('div', { class: 'home-tabs' }, el('div', { class: 'seg', role: 'tablist' }, recentBtn, allBtn), searchBox, sortBtn);

  const screen = el('div', { class: 'screen home' },
    el('header', { class: 'home-head' },
      el('div', { class: 'brand', html: logoSvg(36) + brandName() }),
      el('button', { class: 'icon-btn', title: 'Ajustes', 'aria-label': 'Ajustes', html: icon('settings'), onclick: () => navigate('settings') })),
    status,
    el('div', { class: 'home-actions' },
      el('button', { class: 'btn primary big', html: icon('plus') + '<span>Nuevo proyecto</span>', onclick: () => navigate('new') }),
      el('button', { class: 'btn big', html: icon('upload') + '<span>Importar</span>', onclick: importProject })),
    tabsRow,
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
    return el('div', { class: 'project-card' + (p.pinned ? ' pinned' : '') },
      el('button', { class: 'project-open', onclick: () => navigate('editor', { id: p.id }) },
        el('span', { class: 'project-ico', html: icon('file') }),
        el('span', { class: 'project-meta', html: `<strong>${esc(p.name)}</strong><small>${esc(p.main)} · ${ENGINE_LABEL[p.lastEngine || p.engine] || esc(p.engine)} · ${when}</small>` })),
      el('button', { class: 'icon-btn pin-btn' + (p.pinned ? ' on' : ''), title: p.pinned ? 'Desfijar' : 'Fijar arriba', 'aria-label': p.pinned ? 'Desfijar' : 'Fijar arriba', 'aria-pressed': String(!!p.pinned), html: icon('pin'), onclick: () => togglePin(p) }),
      el('button', { class: 'icon-btn', 'aria-label': 'Opciones', html: icon('more'), onclick: () => projectMenu(p) }));
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
    recentBtn.innerHTML = `${icon('clock')}<span>Recientes</span>`;
    allBtn.innerHTML = `${icon('files')}<span>Todos</span><small>${projects.length}</small>`;
    recentBtn.classList.toggle('active', tab === 'recent');
    allBtn.classList.toggle('active', tab === 'all');
    searchBox.hidden = tab !== 'all' || projects.length < 6;
    sortBtn.hidden = tab !== 'all' || projects.length < 2;
    sortBtn.innerHTML = `${icon('sort')}<span>${(SORTS.find(([k]) => k === sortKey) || SORTS[0])[1]}</span>`;
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
