import { describe, expect, it } from 'vitest';
import { resolveBase } from './basePath';

describe('site base path', () => {
  it('uses a relative base by default so static hosts work anywhere', () => {
    expect(resolveBase({})).toBe('./');
    expect(resolveBase({ VITE_BASE_PATH: '' })).toBe('./');
    expect(resolveBase({ VITE_BASE_PATH: '   ' })).toBe('./');
  });

  it('normalizes GitHub Pages repository paths', () => {
    expect(resolveBase({ VITE_BASE_PATH: '/cosmos-explorer/' })).toBe('/cosmos-explorer/');
    expect(resolveBase({ VITE_BASE_PATH: '/cosmos-explorer' })).toBe('/cosmos-explorer/');
    expect(resolveBase({ VITE_BASE_PATH: 'cosmos-explorer' })).toBe('/cosmos-explorer/');
    expect(resolveBase({ VITE_BASE_PATH: '/cosmos-explorer//' })).toBe('/cosmos-explorer/');
    expect(resolveBase({ VITE_BASE_PATH: '/' })).toBe('/');
  });

  it('rejects full URLs because Vite expects a path prefix', () => {
    expect(() =>
      resolveBase({ VITE_BASE_PATH: 'https://example.com/cosmos/' }),
    ).toThrow();
  });
});
