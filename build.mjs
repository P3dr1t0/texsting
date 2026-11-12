// Construye la app web en www/ (lo que Capacitor empaqueta dentro del APK).
//   node build.mjs          -> producción (CodeMirror + plugins Capacitor reales)
//   node build.mjs --test   -> prueba local (editor simple y plugins simulados)
import { build } from 'esbuild';
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const TEST = process.argv.includes('--test');
const VERSION = JSON.parse((await import('node:fs')).readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
const root = path.dirname(new URL(import.meta.url).pathname);
const out = path.join(root, 'www');
const extraNodePaths = TEST ? ['/opt/npm-tools/node_modules'] : [];

rmSync(path.join(out, 'assets'), { recursive: true, force: true });
mkdirSync(path.join(out, 'assets'), { recursive: true });

const alias = {
  '#editor-impl': path.join(root, 'src', 'editor', TEST ? 'basic.js' : 'cm.js'),
};
if (TEST) {
  for (const p of ['core', 'share', 'filesystem', 'app', 'app-launcher', 'clipboard']) {
    alias['@capacitor/' + p] = path.join(root, 'src', 'shims', 'capacitor.js');
  }
}

await build({
  entryPoints: [path.join(root, 'src', 'main.js')],
  bundle: true,
  format: 'esm',
  target: ['chrome90'],
  outfile: path.join(out, 'assets', 'app.js'),
  minify: !TEST,
  sourcemap: TEST ? 'inline' : false,
  loader: { '.py': 'text', '.sh': 'text' },
  alias,
  nodePaths: extraNodePaths,
  define: { __TEST__: String(TEST), __VERSION__: JSON.stringify(VERSION) },
  logLevel: 'info',
});

// Worker de pdf.js
const require = createRequire(import.meta.url);
let pdfjsDir;
try {
  pdfjsDir = path.dirname(require.resolve('pdfjs-dist/package.json', { paths: [root, ...extraNodePaths] }));
} catch {
  pdfjsDir = '/opt/npm-tools/node_modules/pdfjs-dist';
}
const worker = path.join(pdfjsDir, 'legacy', 'build', 'pdf.worker.min.mjs');
if (!existsSync(worker)) throw new Error('No se encontró el worker de pdf.js: ' + worker);
cpSync(worker, path.join(out, 'assets', 'pdf.worker.min.mjs'));
cpSync(path.join(pdfjsDir, 'cmaps'), path.join(out, 'assets', 'cmaps'), { recursive: true });
cpSync(path.join(pdfjsDir, 'standard_fonts'), path.join(out, 'assets', 'standard_fonts'), { recursive: true });
console.log('Listo: www/ (' + (TEST ? 'prueba' : 'producción') + ')');
