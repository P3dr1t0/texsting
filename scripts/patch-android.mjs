// Ajusta el proyecto Android que genera Capacitor (npx cap add android):
// - permite tráfico http solo hacia el servidor local de Termux (127.0.0.1)
// - declara que la app puede abrir Termux (visibilidad de paquetes, Android 11+)
// - el teclado redimensiona la pantalla (la barra de teclas LaTeX queda visible)
// - número de versión desde la compilación de GitHub Actions
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const app = path.join(root, 'android', 'app');
const manifestPath = path.join(app, 'src', 'main', 'AndroidManifest.xml');
if (!existsSync(manifestPath)) {
  console.error('No existe android/. Ejecuta primero: npx cap add android');
  process.exit(1);
}

const xmlDir = path.join(app, 'src', 'main', 'res', 'xml');
mkdirSync(xmlDir, { recursive: true });
writeFileSync(path.join(xmlDir, 'network_security_config.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">localhost</domain>
    </domain-config>
</network-security-config>
`);

let m = readFileSync(manifestPath, 'utf8');
if (!m.includes('networkSecurityConfig')) {
  m = m.replace('<application', '<application\n        android:networkSecurityConfig="@xml/network_security_config"');
}
if (!m.includes('com.termux')) {
  m = m.replace('</manifest>', '    <queries>\n        <package android:name="com.termux" />\n    </queries>\n</manifest>');
}
if (!m.includes('hasFragileUserData')) {
  m = m.replace('<application', '<application\n        android:hasFragileUserData="true"');
}
if (!m.includes('windowSoftInputMode')) {
  m = m.replace(/<activity(\s)/, '<activity\n            android:windowSoftInputMode="adjustResize"$1');
}
writeFileSync(manifestPath, m);

const gradlePath = path.join(app, 'build.gradle');
let g = readFileSync(gradlePath, 'utf8');
// Firma fija: sin esto cada compilación usa una llave nueva y Android no deja actualizar encima.
if (!g.includes('signingConfigs.texsting')) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        texsting {
            storeFile file("\${rootDir}/../android-config/debug.keystore")
            storePassword "android"
            keyAlias "androiddebugkey"
            keyPassword "android"
        }
    }`);
  if (/buildTypes\s*\{/.test(g)) {
    g = g.replace(/buildTypes\s*\{/, `buildTypes {
        debug {
            signingConfig signingConfigs.texsting
        }`);
  } else {
    g = g.replace(/android \{/, 'android {\n    buildTypes { debug { signingConfig signingConfigs.texsting } }');
  }
}
const build = parseInt(process.env.BUILD_NUMBER || '1', 10);
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
g = g.replace(/versionCode \d+/, `versionCode ${build}`).replace(/versionName "[^"]*"/, `versionName "${pkg.version}.${build}"`);
writeFileSync(gradlePath, g);

console.log(`Android ajustado (versión ${pkg.version}.${build}).`);
