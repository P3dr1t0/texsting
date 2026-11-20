// Papelera: proyectos y archivos eliminados. Se pueden restaurar durante 15 días; después se borran solos.
import { listTrash, restoreProject, restoreFile, deleteProject, deleteTrashFile, DIAS_PAPELERA } from '../store.js';
import { el, icon, toast, confirmDialog, esc } from '../ui.js';
import { vinculo } from '../carpetas.js';

const dias = (ts) => Math.max(0, Math.ceil((ts + DIAS_PAPELERA * 864e5 - Date.now()) / 864e5));
const quedan = (ts) => { const d = dias(ts); return d <= 1 ? 'se borra mañana' : `se borra en ${d} días`; };

export async function renderPapelera(root, _p, navigate) {
  const lista = el('div', { class: 'settings-body' });
  const vaciarBtn = el('button', { class: 'icon-btn', title: 'Vaciar papelera', 'aria-label': 'Vaciar papelera', html: icon('trash'), onclick: vaciar });
  root.append(el('div', { class: 'screen settings' },
    el('header', { class: 'topbar simple' },
      el('button', { class: 'icon-btn', 'aria-label': 'Atrás', html: icon('back'), onclick: () => navigate('home') }),
      el('h1', {}, 'Papelera'), vaciarBtn),
    lista));

  async function pintar() {
    const { proyectos, archivos } = await listTrash();
    vaciarBtn.hidden = !proyectos.length && !archivos.length;
    const filas = [];
    filas.push(el('p', { class: 'muted' }, `Lo que eliminas en TeXsting espera aquí ${DIAS_PAPELERA} días por si lo necesitas; después se borra solo. Mientras tanto, las carpetas de los proyectos eliminados quedan en Projects_LaTeX/Papelera de TeXsting.`));
    if (!proyectos.length && !archivos.length) {
      filas.push(el('div', { class: 'empty', html: `${icon('trash', 'big')}<p>La papelera está vacía.</p>` }));
    }
    if (proyectos.length) filas.push(el('h3', { class: 'section-title' }, 'Proyectos'));
    for (const p of proyectos) {
      const v = vinculo(p.id);
      filas.push(el('div', { class: 'lic-item papelera-item' },
        el('div', { class: 'lic-nombre' }, p.name),
        el('div', { class: 'muted small' }, `${p.main} · eliminado ${new Date(p.papelera).toLocaleDateString('es-PE')} · ${quedan(p.papelera)}${v && v.externa ? ' · su carpeta «' + (v.ruta || v.nombre) + '» sigue en su lugar' : ''}`),
        el('div', { class: 'papelera-btns' },
          el('button', { class: 'btn small danger ghost', onclick: async () => {
            if (!(await confirmDialog('Eliminar para siempre', `«${p.name}» se borrará ahora${v && !v.externa ? ', también su carpeta' : ''}. No se puede deshacer.`, { ok: 'Eliminar', danger: true }))) return;
            await deleteProject(p.id); toast('Eliminado para siempre'); pintar();
          } }, 'Eliminar ahora'),
          el('button', { class: 'btn small primary', onclick: async () => { await restoreProject(p.id); toast(`«${p.name}» restaurado`, { kind: 'ok', action: 'Abrir', onAction: () => navigate('editor', { id: p.id }) }); pintar(); } }, 'Restaurar'))));
    }
    if (archivos.length) filas.push(el('h3', { class: 'section-title' }, 'Archivos'));
    for (const a of archivos) {
      filas.push(el('div', { class: 'lic-item papelera-item' },
        el('div', { class: 'lic-nombre' }, a.path),
        el('div', { class: 'muted small' }, `de «${a.proyecto}» · eliminado ${new Date(a.borrado).toLocaleDateString('es-PE')} · ${quedan(a.borrado)}`),
        el('div', { class: 'papelera-btns' },
          el('button', { class: 'btn small danger ghost', onclick: async () => { await deleteTrashFile(a.id); toast('Eliminado para siempre'); pintar(); } }, 'Eliminar ahora'),
          el('button', { class: 'btn small primary', onclick: async () => {
            try { const r = await restoreFile(a.id); toast(`«${r.path}» volvió a «${r.project.name}»`, { kind: 'ok', action: 'Abrir', onAction: () => navigate('editor', { id: r.project.id }) }); }
            catch (e) { toast('No se pudo restaurar: ' + e.message, { kind: 'error' }); }
            pintar();
          } }, 'Restaurar'))));
    }
    lista.replaceChildren(...filas);
  }

  async function vaciar() {
    const { proyectos, archivos } = await listTrash();
    const n = proyectos.length + archivos.length;
    if (!n || !(await confirmDialog('Vaciar papelera', `Se borrarán para siempre ${n} elemento${n === 1 ? '' : 's'}${proyectos.some((p) => vinculo(p.id) && !vinculo(p.id).externa) ? ' (también las carpetas de esos proyectos)' : ''}. No se puede deshacer.`, { ok: 'Vaciar', danger: true }))) return;
    for (const p of proyectos) await deleteProject(p.id);
    for (const a of archivos) await deleteTrashFile(a.id);
    toast('Papelera vacía');
    pintar();
  }

  await pintar();
  return {};
}
