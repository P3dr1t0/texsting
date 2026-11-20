// Arma todas las plantillas con varias combinaciones de opciones en <carpeta>/<plantilla>-<variante>/
// (para compilarlas en CI y comprobar que ninguna sale con errores).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { TEMPLATES, opcionesIniciales } from '../../src/templates.js';

const dest = process.argv[2] || '/tmp/plantillas';
const VARIANTES = {
  normal: {},
  todo: {
    autor: 'Ana Pérez (2021001A)\nLuis Gómez & Cía_50% #1', universidad: 'Universidad Nacional de Ingeniería',
    facultad: 'Facultad de Ingeniería Eléctrica y Electrónica', curso: 'Circuitos Eléctricos I', docente: 'Ing. María Ruiz',
    grado: 'Ingeniero Electrónico', correo: 'ana@uni.pe', telefono: '999 888 777', ciudad: 'Lima',
    destinatario: 'Dr. Juan Torres\nDecano de la FIEE', titulo: 'Título con ñ, tildes y $ & %',
    idioma: 'en', papel: 'letter', letra: '12', margen: 'amplio', fuente: 'palatino', interlineado: '1.5',
    acento: 'rojo', cabecera: true, biblio: true, ecSeccion: true, tema: 'CambridgeUS', proporcion: '43',
  },
  nada: { idioma: 'es', papel: 'a4', letra: '10', margen: 'estrecho', fuente: 'times', interlineado: '1.15',
    acento: 'ninguno', cabecera: false, biblio: false, ecSeccion: false, tema: 'default' },
  sans: { fuente: 'sans', interlineado: '2', acento: 'morado', tema: 'Copenhagen' },
};
for (const t of TEMPLATES) {
  for (const [v, extra] of Object.entries(VARIANTES)) {
    if (!t.build) continue;
    const o = { ...opcionesIniciales(t), ...extra };
    const dir = path.join(dest, `${t.id}-${v}`);
    for (const f of t.build(o)) {
      mkdirSync(path.dirname(path.join(dir, f.path)), { recursive: true });
      writeFileSync(path.join(dir, f.path), f.text);
    }
  }
}
console.log('listo en', dest);
