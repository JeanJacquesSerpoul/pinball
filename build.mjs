// Assemble les sources de src/ en un fichier index.html autonome
// (un seul fichier : fonctionne aussi en ouvrant index.html directement, sans serveur).
// Usage : node build.mjs [--check]   (--check : échoue si index.html n'est pas à jour)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = p => readFileSync(join(root, 'src', p), 'utf8');

export function gameFiles() {
  return readdirSync(join(root, 'src', 'js')).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
}
export function gameSource() {
  return gameFiles().map(f => src('js/' + f)).join('');
}

export function build() {
  return src('template.html')
    .replace('/*@CSS*/\n', () => src('style.css'))
    .replace('//@GAME\n', () => gameSource())
    .replace('//@RENDER3D\n', () => src('js/render3d.js'));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = build(), target = join(root, 'index.html');
  if (process.argv.includes('--check')) {
    const cur = readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    if (cur !== out) { console.error('index.html n\'est pas à jour : lancez « node build.mjs »'); process.exit(1); }
    console.log('index.html est à jour');
  } else {
    writeFileSync(target, out);
    console.log(`index.html généré (${(out.length / 1024).toFixed(0)} Ko)`);
  }
}
