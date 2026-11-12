// Pantalla de inicio: lista de proyectos, estado de Termux, crear e importar.
import { listProjects, createProject, deleteProject, duplicateProject, saveProject, listFiles, getOutput, isTextPath } from '../store.js';
import { el, icon, logoSvg, toast, sheet, promptText, confirmDialog, pickFiles, esc } from '../ui.js';
import { saveAsTemplate } from './newproject.js';
import { ping } from '../compiler.js';
import { createZip, readZip } from '../zip.js';
import { shareBytes } from '../share.js';
import { timeAgo, sanitizeName, slug, readFileAsBytes } from '../util.js';

const dec = new TextDecoder();
const enc = new TextEncoder();

export async function renderHome(root, _params, navigate) {
  const status = el('button', { class: 'server-chip checking', onclick: () => navigate('termux') }, 'Buscando Termux…');
  const list = el('div', { class: 'project-list' });

  const screen = el('div', { class: 'screen home' },
    el('header', { class: 'home-head' },
      el('div', { class: 'brand', html: logoSvg(34) + '<span>TeX<b>sting</b></span>' }),
      el('button', { class: 'icon-btn', title: 'Ajustes', 'aria-label': 'Ajustes', html: icon('settings'), onclick: () => navigate('settings') })),
    status,
    el('div', { class: 'home-actions' },
      el('button', { class: 'btn primary big', html: icon('plus') + '<span>Nuevo proyecto</span>', onclick: () => navigate('new') }),
      el('button', { class: 'btn big', html: icon('upload') + '<span>Importar</span>', onclick: importProject })),
    el('h3', { class: 'section-title' }, 'Tus proyectos'),
    list,
    el('p', { class: 'home-foot' }, `TeXsting ${__VERSION__} · Fase 1: Beta · software libre (GPL-3.0)`));
  root.append(screen);

  async function refresh() {
    const projects = await listProjects();
    if (!projects.length) {
      list.replaceChildren(el('div', { class: 'empty', html: `${icon('file', 'big')}<p>Aún no tienes proyectos.</p><p class="muted">Crea uno con una plantilla o importa un .zip (por ejemplo, descargado de Overleaf) o archivos .tex.</p>` }));
      return;
    }
    list.replaceChildren(...projects.map((p) => el('div', { class: 'project-card' },
      el('button', { class: 'project-open', onclick: () => navigate('editor', { id: p.id }) },
        el('span', { class: 'project-ico', html: icon('file') }),
        el('span', { class: 'project-meta', html: `<strong>${esc(p.name)}</strong><small>${esc(p.main)} · ${esc(p.engine)} · ${timeAgo(p.updated)}</small>` })),
      el('button', { class: 'icon-btn', 'aria-label': 'Opciones', html: icon('more'), onclick: () => projectMenu(p) }))));
  }

  async function projectMenu(p) {
    const out = await getOutput(p.id);
    const choice = await sheet(p.name, [
      { label: 'Abrir', icon: 'edit', value: 'open' },
      out && out.pdf ? { label: 'Compartir último PDF', icon: 'share', value: 'pdf' } : null,
      { label: 'Exportar proyecto (.zip)', icon: 'download', value: 'zip' },
      { label: 'Renombrar', icon: 'edit', value: 'rename' },
      { label: 'Duplicar', icon: 'copy', value: 'dup' },
      { label: 'Guardar como plantilla', icon: 'star', value: 'tpl' },
      '-',
      { label: 'Eliminar', icon: 'trash', value: 'delete', danger: true },
    ].filter(Boolean));
    if (choice === 'open') navigate('editor', { id: p.id });
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
