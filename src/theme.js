// Temas y colores de acento personalizables.
import { getSettings } from './store.js';

export const THEMES = [
  { id: 'system', name: 'Según el sistema', kind: null, swatch: ['#f7f5ef', '#12141a'] },
  { id: 'light', name: 'Claro', kind: 'light', swatch: ['#f7f5ef', '#ffffff'] },
  { id: 'sepia', name: 'Sepia', kind: 'light', swatch: ['#f1e7d3', '#fbf4e6'] },
  { id: 'gray', name: 'Gris', kind: 'dark', swatch: ['#2a2c31', '#34373d'] },
  { id: 'midnight', name: 'Azul noche', kind: 'dark', swatch: ['#0d1526', '#15203a'] },
  { id: 'dark', name: 'Oscuro', kind: 'dark', swatch: ['#12141a', '#1b1e26'] },
];

// [acento, acento para texto/íconos, texto sobre el acento] para temas claros y oscuros.
export const ACCENTS = [
  { id: 'miel', name: 'Miel', light: ['#e5a01a', '#a86f00', '#1d1f24'], dark: ['#f2b52e', '#ffc84d', '#16181d'] },
  { id: 'azul', name: 'Azul', light: ['#2f6fe0', '#1f56b8', '#ffffff'], dark: ['#5b9bff', '#8bb8ff', '#0b1220'] },
  { id: 'turquesa', name: 'Turquesa', light: ['#12a19a', '#0b7a74', '#ffffff'], dark: ['#33d1c9', '#6fe3dd', '#06201f'] },
  { id: 'verde', name: 'Verde', light: ['#2e9b5f', '#1f7a49', '#ffffff'], dark: ['#4cc97f', '#7ee0a6', '#0b1a12'] },
  { id: 'morado', name: 'Morado', light: ['#7b4fd6', '#6236b8', '#ffffff'], dark: ['#a688ff', '#c2adff', '#140c26'] },
  { id: 'rosa', name: 'Rosa', light: ['#d94c8a', '#b3336d', '#ffffff'], dark: ['#ff7eb6', '#ffa8cf', '#26081a'] },
  { id: 'rojo', name: 'Rojo', light: ['#d6453a', '#b3322a', '#ffffff'], dark: ['#ff6b5e', '#ff9a90', '#1f0a08'] },
  { id: 'naranja', name: 'Naranja', light: ['#ea6a1f', '#c25212', '#ffffff'], dark: ['#ff8a45', '#ffad7a', '#211005'] },
];

export function resolvedTheme(pref = getSettings().theme) {
  if (pref === 'system' || !THEMES.some((t) => t.id === pref)) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme() {
  const s = getSettings();
  const theme = resolvedTheme(s.theme);
  const kind = THEMES.find((t) => t.id === theme).kind;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.kind = kind;
  const acc = ACCENTS.find((a) => a.id === s.accent) || ACCENTS[0];
  const [accent, strong, on] = acc[kind];
  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-strong', strong);
  root.style.setProperty('--on-accent', on);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(root).getPropertyValue('--surface').trim() || '#ffffff';
}
