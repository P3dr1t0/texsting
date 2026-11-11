// Generación del comando de instalación para Termux y apertura de la app Termux.
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor } from '@capacitor/core';
import serverPy from '../termux/server.py';
import setupSh from '../termux/setup.sh';

export const TERMUX_FDROID = 'https://f-droid.org/packages/com.termux/';
export const TERMUX_GITHUB = 'https://github.com/termux/termux-app/releases';

/** Comando que se pega en Termux: escribe los scripts y ejecuta la instalación. */
export function bootstrapCommand(token) {
  const safeToken = String(token).replace(/[^A-Za-z0-9]/g, '');
  return [
    'mkdir -p ~/.texsting',
    "cat > ~/.texsting/server.py <<'TEXSTING_SERVER_EOF'",
    serverPy.trimEnd(),
    'TEXSTING_SERVER_EOF',
    "cat > ~/.texsting/setup.sh <<'TEXSTING_SETUP_EOF'",
    setupSh.trimEnd(),
    'TEXSTING_SETUP_EOF',
    `bash ~/.texsting/setup.sh ${safeToken}`,
    '',
  ].join('\n');
}

export async function openTermux() {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const r = await AppLauncher.openUrl({ url: 'com.termux' });
    return r.completed;
  } catch {
    return false;
  }
}
