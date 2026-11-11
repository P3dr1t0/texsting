// TeXsting — punto de entrada: tema, navegación y botón Atrás de Android.
import { App } from '@capacitor/app';
import { getSettings } from './store.js';
import { closeTopLayer } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderEditor } from './screens/editor.js';
import { renderSettings, renderTermuxSetup } from './screens/settings.js';

const root = document.getElementById('app');
let current = null; // { name, cleanup, onBack }

export function applyTheme() {
  const pref = getSettings().theme;
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#12141a' : '#f7f5ef';
}

export async function navigate(name, params = {}) {
  if (current && current.cleanup) {
    try { await current.cleanup(); } catch (e) { console.error(e); }
  }
  root.replaceChildren();
  const screens = { home: renderHome, editor: renderEditor, settings: renderSettings, termux: renderTermuxSetup };
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
navigate('home');
