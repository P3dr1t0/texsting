// Pantalla "Nuevo proyecto": en blanco, plantillas por tipo de documento y plantillas propias.
import { createProject, listTemplates, saveTemplate, deleteTemplate, listFiles, newId } from '../store.js';
import { el, icon, toast, promptText, confirmDialog, sheet } from '../ui.js';
import { TEMPLATES, BLANKS } from '../templates.js';
import { sanitizeName, timeAgo } from '../util.js';

function thumb(t) {
  const lines = t.shape === 'slide' ? 3 : 7;
  return el('div', { class: `tpl-thumb shape-${t.shape || 'page'}` },
    el('div', { class: 'tpl-paper' },
      t.mark ? el('span', { class: 'tpl-mark' }, t.mark) : null,
      ...Array.from({ length: lines }, (_, i) => el('i', { style: `width:${[92, 78, 86, 60, 88, 70, 50][i % 7]}%` }))));
}

function card(t, onClick, extra) {
  return el('div', { class: 'tpl-card' },
    el('button', { class: 'tpl-open', onclick: onClick },
      thumb(t),
      el('span', { class: 'tpl-text' }, el('strong', {}, t.name), el('small', {}, t.desc || ''))),
    extra || null);
}

export async function renderNewProject(root, _p, navigate) {
  async function createFrom(t, defaultName) {
    const name = await promptText('Nombre del proyecto', { value: defaultName || t.name, ok: 'Crear' });
    if (!name) return;
    const p = await createProject({
      name: sanitizeName(name) || 'Proyecto',
      main: t.main || 'main.tex',
      engine: t.engine || undefined,
      files: t.files.map((f) => ({ ...f })),
    });
    navigate('editor', { id: p.id });
  }

  const mine = el('div', { class: 'tpl-grid' });
  async function renderMine() {
    const list = await listTemplates();
    if (!list.length) {
      mine.replaceChildren(el('p', { class: 'muted tpl-empty' }, 'Aún no tienes plantillas propias. En cualquier proyecto toca ⋮ → «Guardar como plantilla» para reutilizar tu propio formato (por ejemplo, tu carátula de la universidad).'));
      return;
    }
    mine.replaceChildren(...list.map((t) => card(
      { ...t, shape: t.shape || 'page', mark: '★', desc: t.desc || `${t.files.length} archivo(s) · ${timeAgo(t.created)}` },
      () => createFrom(t, t.name),
      el('button', { class: 'icon-btn sm tpl-more', 'aria-label': 'Opciones de ' + t.name, html: icon('more'), onclick: async () => {
        const c = await sheet(t.name, [{ label: 'Renombrar', icon: 'edit', value: 'rename' }, '-', { label: 'Eliminar plantilla', icon: 'trash', value: 'del', danger: true }]);
        if (c === 'rename') {
          const n = await promptText('Renombrar plantilla', { value: t.name });
          if (n) { t.name = sanitizeName(n); await saveTemplate(t); renderMine(); }
        }
        if (c === 'del' && await confirmDialog('Eliminar plantilla', `¿Eliminar la plantilla «${t.name}»? Tus proyectos no se ven afectados.`, { ok: 'Eliminar', danger: true })) {
          await deleteTemplate(t.id);
          renderMine();
        }
      } }))));
  }

  root.append(el('div', { class: 'screen newproject' },
    el('header', { class: 'topbar simple' },
      el('button', { class: 'icon-btn', 'aria-label': 'Atrás', html: icon('back'), onclick: () => navigate('home') }),
      el('h1', {}, 'Nuevo proyecto')),
    el('div', { class: 'np-body' },
      el('h3', { class: 'section-title' }, 'En blanco'),
      el('div', { class: 'tpl-grid' }, ...BLANKS.map((t) => card(t, () => createFrom(t, t.id === 'blanco' ? 'Documento' : 'Presentación')))),
      el('h3', { class: 'section-title' }, 'Plantillas'),
      el('div', { class: 'tpl-grid' }, ...TEMPLATES.map((t) => card(t, () => createFrom(t)))),
      el('h3', { class: 'section-title' }, 'Mis plantillas'),
      mine)));
  await renderMine();
  return {};
}

/** Guarda una copia de los archivos del proyecto como plantilla reutilizable. */
export async function saveAsTemplate(project) {
  const name = await promptText('Guardar como plantilla', { value: project.name, label: 'Nombre de la plantilla', ok: 'Guardar' });
  if (!name) return;
  const files = await listFiles(project.id);
  await saveTemplate({
    id: newId(),
    name: sanitizeName(name),
    desc: '',
    created: Date.now(),
    main: project.main,
    engine: project.engine,
    files: files.map((f) => (f.kind === 'binary' ? { path: f.path, data: f.data } : { path: f.path, text: f.text })),
  });
  toast(`Plantilla «${name}» guardada. La verás en Nuevo proyecto → Mis plantillas.`, { ms: 4500 });
}
