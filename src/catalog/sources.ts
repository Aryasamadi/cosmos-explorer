import type { DataSource } from './types';

export const DATA_SOURCES = {
  'nasa-earth-fact': {
    id: 'nasa-earth-fact',
    titleFa: 'Earth Fact Sheet',
    publisherFa: 'NASA / NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
    accessedOn: '2026-10-22',
    licenseFa: 'داده‌های عمومی NASA با ذکر منبع',
  },
  'nasa-moon-fact': {
    id: 'nasa-moon-fact',
    titleFa: 'Moon Fact Sheet',
    publisherFa: 'NASA / NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    accessedOn: '2026-10-22',
    licenseFa: 'داده‌های عمومی NASA با ذکر منبع',
  },
  'nasa-sun-fact': {
    id: 'nasa-sun-fact',
    titleFa: 'Sun Fact Sheet',
    publisherFa: 'NASA / NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html',
    accessedOn: '2026-10-22',
    licenseFa: 'داده‌های عمومی NASA با ذکر منبع',
  },
  'nasa-mars-fact': {
    id: 'nasa-mars-fact',
    titleFa: 'Mars Fact Sheet',
    publisherFa: 'NASA / NSSDCA',
    url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html',
    accessedOn: '2026-10-22',
    licenseFa: 'داده‌های عمومی NASA با ذکر منبع',
  },
  'simbad-stars': {
    id: 'simbad-stars',
    titleFa: 'SIMBAD Astronomical Database',
    publisherFa: 'CDS, Université de Strasbourg',
    url: 'https://simbad.cds.unistra.fr/simbad/',
    accessedOn: '2026-10-22',
    licenseFa: 'استفادهٔ علمی با استناد',
  },
  'astronomy-engine': {
    id: 'astronomy-engine',
    titleFa: 'Astronomy Engine 2.1.19',
    publisherFa: 'Don Cross',
    url: 'https://github.com/cosinekitty/astronomy',
    accessedOn: '2026-10-22',
    licenseFa: 'MIT',
  },
} as const satisfies Record<string, DataSource>;

export type DataSourceId = keyof typeof DATA_SOURCES;

export function getDataSource(id: string): DataSource | undefined {
  return (DATA_SOURCES as Record<string, DataSource>)[id];
}

export function getSourceForFact(id: string): DataSource {
  const source = getDataSource(id);
  if (!source) {
    throw new Error(`Unknown data source: ${id}`);
  }
  return source;
}
