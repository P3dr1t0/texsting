// TeXsting — punto de entrada: tema, navegación y botón Atrás de Android.
import { App } from '@capacitor/app';
import { applyTheme } from './theme.js';
import { closeTopLayer, toast } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderEditor } from './screens/editor.js';
import { renderSettings, renderTermuxSetup } from './screens/settings.js';
import { renderLicencias } from './screens/licencias.js';
import { renderPapelera } from './screens/papelera.js';
import { purgeTrash } from './store.js';
import { renderNewProject } from './screens/newproject.js';
import { initOpenWith } from './openwith.js';
import { motorCalentar, motorAlTerminarFondo, motorAlDescargar } from './motor.js';
import { getSettings } from './store.js';

const root = document.getElementById('app');
let current = null; // { name, cleanup, onBack }

export { applyTheme };

export async function navigate(name, params = {}) {
  if (current && current.cleanup) {
    try { await current.cleanup(); } catch (e) { console.error(e); }
  }
  root.replaceChildren();
  const screens = { new: renderNewProject, home: renderHome, editor: renderEditor, settings: renderSettings, termux: renderTermuxSetup, licencias: renderLicencias, papelera: renderPapelera };
  current = { name, ...(await screens[name](root, params, navigate)) };
  window.scrollTo(0, 0);
}

function handleBack() {
  if (closeTopLayer()) return;
  if (current && current.onBack && current.onBack()) return;
  if (current && current.name !== 'home') { navigate('home'); return; }
  App.exitApp();
}

App.addListener('backButton', handleBack);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && closeTopLayer()) e.preventDefault(); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

applyTheme();
navigate('home').then(() => initOpenWith(navigate));
// El motor integrado se prepara solo al abrir la app (solo trabaja la primera vez tras instalar o actualizar).
motorCalentar().catch(() => {});
// Lo que lleva más de 15 días en la papelera se borra de verdad.
purgeTrash().catch(() => {});
// Cuando termina de guardar figuras o el preámbulo en segundo plano, se avisa: ya conviene volver a compilar.
motorAlTerminarFondo((texto) => texto && toast(texto, { ms: 4500 }));
// Fin de la descarga de «Usar sin internet» (sigue aunque se salga de Ajustes).
motorAlDescargar((e) => {
  if (!e.fin) return;
  const nombre = e.nivel === 'avanzados' ? 'los paquetes avanzados' : 'los paquetes básicos';
  if (e.cancelado) toast(`Descarga cancelada: ${e.hechos} de ${e.total} paquetes quedaron en el teléfono`);
  else if (e.fallos) toast(`Se descargaron ${e.hechos - e.fallos} de ${e.total}; ${e.fallos} no se pudieron (revisa la conexión y vuelve a tocar Descargar)`, { kind: 'error', ms: 7000 });
  else toast(`Listo: ${nombre} están en el teléfono. Ya puedes compilar sin internet.`, { kind: 'ok', ms: 6000 });
});
