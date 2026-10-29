import { expect, test, type Page } from '@playwright/test';
import { Body, Illumination } from 'astronomy-engine';
import { computeReferenceFrame } from '../src/astronomy/referenceFrame';
import { localDirectionToScene } from '../src/engine/free/earthDisplayFrame';
import { blockOsm, dismissHint, installFixedDate, openApp } from './helpers';

const DATES = ['2026-06-21T12:00:00.000Z', '2026-10-25T14:26:00.000Z'] as const;

interface LightingSnapshot {
  earthLocalSunDirection: number[];
  osmLocalSunDirection: number[];
  moonSceneSunDirection: number[];
  marsSceneSunDirection: number[];
  moonPosition: number[];
  marsPosition: number[];
  cameraPosition: number[];
}

async function readLighting(page: Page): Promise<LightingSnapshot> {
  await page.waitForFunction(
    () =>
      typeof (window as Window & { __cosmosLighting?: unknown }).__cosmosLighting ===
      'function',
    undefined,
    { timeout: 30_000 },
  );
  return page.evaluate(() => {
    const probe = (
      window as Window & { __cosmosLighting?: () => LightingSnapshot }
    ).__cosmosLighting;
    if (!probe) throw new Error('Lighting probe disappeared.');
    return probe();
  });
}

function dot(left: number[], right: number[]): number {
  return left[0]! * right[0]! + left[1]! * right[1]! + left[2]! * right[2]!;
}

function normalize(vector: number[]): number[] {
  const length = Math.hypot(vector[0]!, vector[1]!, vector[2]!);
  return [vector[0]! / length, vector[1]! / length, vector[2]! / length];
}

function angleDeg(left: number[], right: number[]): number {
  const a = normalize(left);
  const b = normalize(right);
  return (
    (Math.acos(Math.min(1, Math.max(-1, dot(a, b)))) * 180) / Math.PI
  );
}

function phaseFromEarthObserver(
  bodyPosition: number[],
  sunDirection: number[],
): number {
  const towardEarth = normalize(bodyPosition.map((value) => -value));
  return (1 + dot(towardEarth, normalize(sunDirection))) / 2;
}

test('camera orbit, zoom, pan and selection leave every Sun direction unchanged', async ({
  page,
}) => {
  await installFixedDate(page, '2026-06-21T12:00:00.000Z');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await blockOsm(page);
  await openApp(page);
  await dismissHint(page);

  const before = await readLighting(page);
  const assertLightingUnchanged = (after: LightingSnapshot): void => {
    expect(after.earthLocalSunDirection).toEqual(before.earthLocalSunDirection);
    expect(after.osmLocalSunDirection).toEqual(before.osmLocalSunDirection);
    expect(after.osmLocalSunDirection).toEqual(after.earthLocalSunDirection);
    expect(after.moonSceneSunDirection).toEqual(before.moonSceneSunDirection);
    expect(after.marsSceneSunDirection).toEqual(before.marsSceneSunDirection);
    expect(after.moonPosition).toEqual(before.moonPosition);
    expect(after.marsPosition).toEqual(before.marsPosition);
  };

  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press('ArrowLeft');
  }
  await page.waitForTimeout(600);
  const afterOrbit = await readLighting(page);
  const orbitShift = Math.hypot(
    afterOrbit.cameraPosition[0]! - before.cameraPosition[0]!,
    afterOrbit.cameraPosition[1]! - before.cameraPosition[1]!,
    afterOrbit.cameraPosition[2]! - before.cameraPosition[2]!,
  );
  expect(orbitShift).toBeGreaterThan(1);
  assertLightingUnchanged(afterOrbit);

  await page.keyboard.press('Equal');
  await page.keyboard.press('Equal');
  await page.waitForTimeout(400);
  const afterZoom = await readLighting(page);
  expect(afterZoom.cameraPosition).not.toEqual(afterOrbit.cameraPosition);
  assertLightingUnchanged(afterZoom);

  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Shift+ArrowLeft');
  }
  await page.waitForTimeout(400);
  const afterPan = await readLighting(page);
  expect(afterPan.cameraPosition).not.toEqual(afterZoom.cameraPosition);
  assertLightingUnchanged(afterPan);

  await page.locator('.body-pill', { hasText: 'ماه' }).click();
  await page.waitForTimeout(1_800);
  const afterSelection = await readLighting(page);
  expect(afterSelection.cameraPosition).not.toEqual(afterPan.cameraPosition);
  assertLightingUnchanged(afterSelection);
});

for (const iso of DATES) {
  test(`scene lighting matches the astronomical frame at ${iso}`, async ({ page }) => {
    const date = new Date(iso);
    const frame = computeReferenceFrame(date);
    await installFixedDate(page, iso);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await blockOsm(page);
    await openApp(page);
    await dismissHint(page);

    const snapshot = await readLighting(page);
    expect(
      angleDeg(snapshot.earthLocalSunDirection, [
        frame.sun.directionFromEarth.x,
        frame.sun.directionFromEarth.y,
        frame.sun.directionFromEarth.z,
      ]),
    ).toBeLessThan(0.0001);
    expect(snapshot.osmLocalSunDirection).toEqual(
      snapshot.earthLocalSunDirection,
    );
    expect(
      angleDeg(
        snapshot.moonSceneSunDirection,
        localDirectionToScene(frame.moon.sunDirection).toArray(),
      ),
    ).toBeLessThan(0.0001);
    expect(
      angleDeg(
        snapshot.marsSceneSunDirection,
        localDirectionToScene(frame.mars.sunDirection).toArray(),
      ),
    ).toBeLessThan(0.0001);

    const moonPhase = phaseFromEarthObserver(
      snapshot.moonPosition,
      snapshot.moonSceneSunDirection,
    );
    const marsPhase = phaseFromEarthObserver(
      snapshot.marsPosition,
      snapshot.marsSceneSunDirection,
    );
    expect(
      Math.abs(moonPhase - Illumination(Body.Moon, date).phase_fraction),
    ).toBeLessThan(0.001);
    expect(
      Math.abs(marsPhase - Illumination(Body.Mars, date).phase_fraction),
    ).toBeLessThan(0.001);
  });
}
