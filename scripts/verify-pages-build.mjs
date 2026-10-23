import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const indexPath = resolve(process.cwd(), 'dist/index.html');
if (!existsSync(indexPath)) {
  console.error('dist/index.html not found. Run the production build first.');
  process.exit(1);
}

const rawBase = process.env.VITE_BASE_PATH?.trim() || './';
const withLeadingSlash = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
const base =
  rawBase === './'
    ? './'
    : withLeadingSlash === '/'
      ? '/'
      : `${withLeadingSlash.replace(/\/+$/, '')}/`;

const html = readFileSync(indexPath, 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter(
    (url) =>
      url &&
      !url.startsWith('http://') &&
      !url.startsWith('https://') &&
      !url.startsWith('data:') &&
      !url.startsWith('mailto:') &&
      !url.startsWith('#'),
  );

if (references.length === 0) {
  console.error('No local asset references found in dist/index.html.');
  process.exit(1);
}

const invalid = references.filter((url) => !url.startsWith(base));
if (invalid.length > 0) {
  console.error(`Asset paths do not start with the expected base "${base}":`);
  for (const url of invalid) console.error(` - ${url}`);
  process.exit(1);
}

const assetsDirectory = resolve(process.cwd(), 'dist/assets');
if (!existsSync(assetsDirectory)) {
  console.error('dist/assets is missing.');
  process.exit(1);
}

const detailSample = resolve(
  process.cwd(),
  'dist/earth-detail/v1/5/0/0.webp',
);
if (!existsSync(detailSample)) {
  console.error('The bundled high-resolution Earth detail assets are missing from dist.');
  process.exit(1);
}

console.log(`Pages build verified: ${references.length} local references use "${base}".`);
console.log('Bundled Earth detail tiles are present.');
