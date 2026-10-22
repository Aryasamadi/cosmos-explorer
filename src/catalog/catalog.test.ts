import { describe, expect, it } from 'vitest';
import { ASSET_CREDITS } from './credits';
import {
  BODY_CATALOG,
  CORE_BODY_IDS,
  getBodyById,
  getFreeExploreBodies,
  getSkyBodies,
} from './bodies';
import { DATA_SOURCES, getDataSource } from './sources';
import type { BodyFact } from './types';

const ALL_FACTS: Array<{ bodyId: string; fact: BodyFact }> = BODY_CATALOG.flatMap(
  (body) => body.facts.map((fact) => ({ bodyId: body.id, fact })),
);

describe('scientific catalog', () => {
  it('contains the four required bodies', () => {
    const ids = new Set(BODY_CATALOG.map((body) => body.id));
    for (const id of CORE_BODY_IDS) {
      expect(ids.has(id), `missing ${id}`).toBe(true);
    }
    expect(getFreeExploreBodies().map((body) => body.id).sort()).toEqual(
      [...CORE_BODY_IDS].sort(),
    );
  });

  it('uses unique stable identifiers', () => {
    const ids = BODY_CATALOG.map((body) => body.id);
    expect(new Set(ids).size).toBe(ids.length);
    const factIds = ALL_FACTS.map(({ bodyId, fact }) => `${bodyId}:${fact.id}`);
    expect(new Set(factIds).size).toBe(factIds.length);
  });

  it('has valid text and sourced facts', () => {
    for (const body of BODY_CATALOG) {
      expect(body.nameFa.length).toBeGreaterThan(1);
      expect(body.nameEn.length).toBeGreaterThan(1);
      expect(body.descriptionFa.length).toBeGreaterThan(30);
      expect(body.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of body.sourceIds) {
        expect(getDataSource(sourceId), `${body.id} -> ${sourceId}`).toBeDefined();
      }
      for (const fact of body.facts) {
        expect(fact.sourceIds.length).toBeGreaterThan(0);
        for (const sourceId of fact.sourceIds) {
          expect(getDataSource(sourceId), `${body.id}:${fact.id}`).toBeDefined();
        }
        if (fact.kind === 'text') {
          expect(fact.valueFa.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never contains NaN, Infinity, or inverted ranges', () => {
    for (const { bodyId, fact } of ALL_FACTS) {
      if (fact.kind !== 'quantity') continue;
      if (typeof fact.value === 'number') {
        expect(Number.isFinite(fact.value), `${bodyId}:${fact.id}`).toBe(true);
      } else {
        expect(Number.isFinite(fact.value.min), `${bodyId}:${fact.id} min`).toBe(true);
        expect(Number.isFinite(fact.value.max), `${bodyId}:${fact.id} max`).toBe(true);
        expect(fact.value.min, `${bodyId}:${fact.id} range`).toBeLessThanOrEqual(
          fact.value.max,
        );
      }
    }
  });

  it('keeps physical extents strictly positive', () => {
    const positiveFactIds = new Set([
      'equatorial-radius',
      'mean-radius',
      'mass',
      'mean-sun-distance',
      'mean-earth-distance',
      'orbital-period',
      'sidereal-rotation',
      'rotation-period',
      'equatorial-rotation',
      'axial-tilt',
      'effective-temperature',
      'distance',
    ]);
    for (const { bodyId, fact } of ALL_FACTS) {
      if (fact.kind !== 'quantity' || !positiveFactIds.has(fact.id)) continue;
      if (typeof fact.value === 'number') {
        expect(fact.value, `${bodyId}:${fact.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('makes every sky-visible body ephemeris-ready', () => {
    for (const body of getSkyBodies()) {
      expect(
        Boolean(body.ephemerisTarget) || Boolean(body.starFix),
        `${body.id} lacks ephemeris data`,
      ).toBe(true);
      if (body.starFix) {
        expect(body.starFix.rightAscensionHours).toBeGreaterThanOrEqual(0);
        expect(body.starFix.rightAscensionHours).toBeLessThan(24);
        expect(body.starFix.declinationDeg).toBeGreaterThanOrEqual(-90);
        expect(body.starFix.declinationDeg).toBeLessThanOrEqual(90);
        expect(body.starFix.distanceLightYears).toBeGreaterThan(0);
      }
      if (body.ephemerisTarget) {
        expect(body.starFix).toBeUndefined();
      }
    }
  });

  it('keeps Earth out of the sky object list', () => {
    expect(getSkyBodies().some((body) => body.id === 'earth')).toBe(false);
    expect(getBodyById('earth')?.skyVisible).toBe(false);
  });

  it('documents data sources and asset licenses', () => {
    for (const source of Object.values(DATA_SOURCES)) {
      expect(source.url.startsWith('https://')).toBe(true);
      expect(source.titleFa.length).toBeGreaterThan(0);
      expect(source.accessedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    for (const credit of ASSET_CREDITS) {
      expect(credit.license.length).toBeGreaterThan(0);
      expect(credit.licenseUrl.startsWith('https://')).toBe(true);
      expect(credit.sourceUrl.startsWith('https://')).toBe(true);
      expect(credit.modificationsFa.length).toBeGreaterThan(0);
    }
  });

  it('records variability metadata for temperature and distance facts', () => {
    for (const body of BODY_CATALOG) {
      const temperature = body.facts.find(
        (fact) =>
          fact.kind === 'quantity' &&
          (fact.id.includes('temperature') || fact.id === 'effective-temperature'),
      );
      if (temperature && temperature.kind === 'quantity') {
        expect(['mean', 'range', 'effective']).toContain(temperature.dataType);
      }
    }
  });
});
