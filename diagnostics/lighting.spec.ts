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
  cameraQuaternion: number[];
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

function quaternionAngleDeg(left: number[], right: number[]): number {
  const cosine =
    left[0]! * right[0]! +
    left[1]! * right[1]! +
    left[2]! * right[2]! +
    left[3]! * right[3]!;
  return (2 * Math.acos(Math.min(1, Math.abs(cosine))) * 180) / Math.PI;
}

async function waitForFlightIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const probe = (
        window as Window & {
          __cosmosFlight?: () => { velocity: number[] };
        }
      ).__cosmosFlight;
      if (!probe) return false;
      const { velocity } = probe();
      return Math.hypot(velocity[0]!, velocity[1]!, velocity[2]!) < 0.0005;
    },
    undefined,
    { timeout: 5_000 },
  );
}

test('free-flight look, translation and focus leave every Sun direction unchanged', async ({
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

  await page.mouse.move(195, 420);
  await page.mouse.down();
  await page.mouse.move(280, 455, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const afterLook = await readLighting(page);
  expect(
    quaternionAngleDeg(before.cameraQuaternion, afterLook.cameraQuaternion),
  ).toBeGreaterThan(0.2);
  expect(afterLook.cameraPosition).toEqual(before.cameraPosition);
  assertLightingUnchanged(afterLook);

  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  await page.waitForTimeout(500);
  const afterTranslate = await readLighting(page);
  expect(afterTranslate.cameraPosition).not.toEqual(afterLook.cameraPosition);
  assertLightingUnchanged(afterTranslate);

  await page.mouse.wheel(0, -420);
  await page.waitForTimeout(600);
  const afterWheel = await readLighting(page);
  expect(afterWheel.cameraPosition).not.toEqual(afterTranslate.cameraPosition);
  assertLightingUnchanged(afterWheel);

  await page.waitForTimeout(900);
  await waitForFlightIdle(page);
  const beforeSelection = await readLighting(page);
  await page.locator('.body-pill', { hasText: 'ماه' }).click();
  await page.waitForTimeout(300);
  const afterSelection = await readLighting(page);
  expect(afterSelection.cameraPosition).toEqual(beforeSelection.cameraPosition);
  assertLightingUnchanged(afterSelection);

  await page
    .getByTestId('celestial-info-panel')
    .getByRole('button', { name: 'فوکوس روی ماه' })
    .click();
  await page.waitForTimeout(700);
  const afterFocus = await readLighting(page);
  expect(afterFocus.cameraPosition).not.toEqual(afterSelection.cameraPosition);
  assertLightingUnchanged(afterFocus);
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
