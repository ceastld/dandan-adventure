import fs from 'node:fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(match => match[1]);
for (const ref of refs) if (!fs.existsSync(`dist/${ref.replace(/^\.\//, '')}`)) throw new Error(`Missing entry reference: ${ref}`);
for (const name of ['islands', ...[0, 1, 2].map(i => `hero-${i}`), ...[0, 1, 2, 3, 4, 5].map(i => `item-${i}`)]) if (!fs.existsSync(`dist/assets/${name}.webp`)) throw new Error(`Missing art: ${name}`);
console.log('Verified production entry references and all 10 optimized art assets.');
