import fs from 'node:fs/promises';
import sharp from 'sharp';
const names = ['islands', ...[0, 1, 2].map(i => `hero-${i}`), ...[0, 1, 2, 3, 4, 5].map(i => `item-${i}`)];
for (const name of names) {
  const input = `public/assets/${name}.png`, output = `public/assets/${name}.webp`;
  await sharp(input).webp({ quality: 88, alphaQuality: 100, effort: 5 }).toFile(output);
  const metadata = await sharp(output).metadata();
  if (name !== 'islands' && !metadata.hasAlpha) throw new Error(`Lost alpha: ${name}`);
  console.log(`${name}: ${(await fs.stat(output)).size} bytes`);
}
