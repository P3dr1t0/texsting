// Simulación de los plugins de Capacitor para probar la app en un navegador.
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
export const Directory = { Cache: 'CACHE', Documents: 'DOCUMENTS' };
export const Encoding = { UTF8: 'utf8' };
export const Filesystem = {
  async writeFile({ path }) { return { uri: 'file:///mock/' + path }; },
};
export const Share = {
  async share(opts) { window.__lastShare = opts; return {}; },
  async canShare() { return { value: false }; },
};
export const App = {
  addListener() { return { remove() {} }; },
  exitApp() {},
};
export const AppLauncher = { async openUrl(o) { window.__lastLaunch = o; return { completed: false }; } };
export const Clipboard = {
  async write({ string }) { window.__clipboard = string; },
};
