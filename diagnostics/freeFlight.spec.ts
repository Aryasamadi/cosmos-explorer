import { expect, test, type Page } from '@playwright/test';
import {
  blockOsm,
  dismissHint,
  installFixedDate,
  openApp,
} from './helpers';

interface FlightSnapshot {
  position: number[];
  quaternion: number[];
  forward: number[];
  velocity: number[];
  viewTarget: number[];
  selectedBodyId: string | null;
  focusedBodyId: string | null;
  active: boolean;
}

const OVERVIEW = [0, 2.15, 7.4];

function distance(left: number[], right: number[]): number {
  return Math.hypot(
    left[0]! - right[0]!,
    left[1]! - right[1]!,
    left[2]! - right[2]!,
  );
}

function normalize(vector: number[]): number[] {
  const length = Math.hypot(vector[0]!, vector[1]!, vector[2]!);
  return [vector[0]! / length, vector[1]! / length, vector[2]! / length];
}

function dot(left: number[], right: number[]): number {
  return left[0]! * right[0]! + left[1]! * right[1]! + left[2]! * right[2]!;
}

function angleDeg(left: number[], right: number[]): number {
  return (
    (Math.acos(Math.min(1, Math.max(-1, dot(normalize(left), normalize(right))))) *
      180) /
    Math.PI
  );
}

function quaternionAngleDeg(left: number[], right: number[]): number {
  const cosine =
    left[0]! * right[0]! +
    left[1]! * right[1]! +
    left[2]! * right[2]! +
    left[3]! * right[3]!;
  return (2 * Math.acos(Math.min(1, Math.abs(cosine))) * 180) / Math.PI;
}

async function readFlight(page: Page): Promise<FlightSnapshot> {
  await page.waitForFunction(
    () =>
      typeof (window as Window & { __cosmosFlight?: unknown }).__cosmosFlight ===
      'function',
    undefined,
    { timeout: 30_000 },
  );
  return page.evaluate(() => {
    const probe = (
      window as Window & { __cosmosFlight?: () => FlightSnapshot }
    ).__cosmosFlight;
    if (!probe) throw new Error('Flight probe disappeared.');
    return probe();
  });
}

async function openFlightPage(page: Page): Promise<void> {
  await installFixedDate(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await blockOsm(page);
  await openApp(page);
  await dismissHint(page);
  await page.waitForTimeout(500);
}

async function resetToOverview(page: Page): Promise<FlightSnapshot> {
  await page.keyboard.press('Home');
  await page.waitForTimeout(700);
  return readFlight(page);
}

async function holdKey(page: Page, key: string, durationMs: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(durationMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(500);
}

async function waitForFlightIdle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const probe = (
        window as Window & { __cosmosFlight?: () => FlightSnapshot }
      ).__cosmosFlight;
      if (!probe) return false;
      const state = probe();
      return Math.hypot(state.velocity[0]!, state.velocity[1]!, state.velocity[2]!) <
        0.001;
    },
    undefined,
    { timeout: 5_000 },
  );
}

test.describe('6DOF free flight', () => {
  test('translates on all three axes and boosts with Shift', async ({ page }) => {
    test.setTimeout(240_000);
    await openFlightPage(page);

    const axes = [
      { key: 'w', sign: 1, vector: 'forward' },
      { key: 's', sign: -1, vector: 'forward' },
      { key: 'd', sign: 1, vector: 'right' },
      { key: 'a', sign: -1, vector: 'right' },
      { key: 'q', sign: 1, vector: 'y' },
      { key: 'e', sign: -1, vector: 'y' },
    ] as const;

    for (const axis of axes) {
      const before = await resetToOverview(page);
      await holdKey(page, axis.key, 360);
      const after = await readFlight(page);
      const displacement = normalize([
        after.position[0]! - before.position[0]!,
        after.position[1]! - before.position[1]!,
        after.position[2]! - before.position[2]!,
      ]);
      const reference =
        axis.vector === 'forward'
          ? before.forward
          : axis.vector === 'right'
            ? [
                before.quaternion[3]! ** 2 +
                  before.quaternion[0]! ** 2 -
                  before.quaternion[1]! ** 2 -
                  before.quaternion[2]! ** 2,
                2 *
                  (before.quaternion[0]! * before.quaternion[1]! +
                    before.quaternion[2]! * before.quaternion[3]!),
                2 *
                  (before.quaternion[0]! * before.quaternion[2]! -
                    before.quaternion[1]! * before.quaternion[3]!),
              ]
            : [0, 1, 0];
      expect(dot(displacement, reference) * axis.sign).toBeGreaterThan(0.8);
    }

    await resetToOverview(page);
    await holdKey(page, 'w', 420);
    const normal = await readFlight(page);
    const normalDistance = distance(normal.position, OVERVIEW);

    const boostedStart = await resetToOverview(page);
    await page.keyboard.down('Shift');
    await holdKey(page, 'w', 420);
    await page.keyboard.up('Shift');
    const boosted = await readFlight(page);
    expect(distance(boosted.position, boostedStart.position)).toBeGreaterThan(
      normalDistance * 1.2,
    );
  });

  test('look and roll never translate the camera', async ({ page }) => {
    test.setTimeout(180_000);
    await openFlightPage(page);
    const initial = await resetToOverview(page);

    await page.mouse.move(195, 420);
    await page.mouse.down();
    await page.mouse.move(280, 455, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const looked = await readFlight(page);
    expect(distance(initial.position, looked.position)).toBeLessThan(1e-9);
    expect(quaternionAngleDeg(initial.quaternion, looked.quaternion)).toBeGreaterThan(0.5);

    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(320);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(150);
    const arrowLooked = await readFlight(page);
    expect(distance(looked.position, arrowLooked.position)).toBeLessThan(1e-9);
    expect(
      quaternionAngleDeg(looked.quaternion, arrowLooked.quaternion),
    ).toBeGreaterThan(0.5);

    await page.keyboard.down('z');
    await page.waitForTimeout(350);
    await page.keyboard.up('z');
    await page.waitForTimeout(150);
    const rolled = await readFlight(page);
    expect(distance(arrowLooked.position, rolled.position)).toBeLessThan(1e-9);
    expect(quaternionAngleDeg(arrowLooked.quaternion, rolled.quaternion)).toBeGreaterThan(
      0.5,
    );
    expect(angleDeg(arrowLooked.forward, rolled.forward)).toBeLessThan(0.05);
  });

  test('wheel moves along the current view and Home restores the overview', async ({ page }) => {
    await openFlightPage(page);
    const initial = await resetToOverview(page);
    await page.mouse.wheel(0, -520);
    await page.waitForTimeout(700);
    const wheeled = await readFlight(page);
    const displacement = normalize([
      wheeled.position[0]! - initial.position[0]!,
      wheeled.position[1]! - initial.position[1]!,
      wheeled.position[2]! - initial.position[2]!,
    ]);
    expect(dot(displacement, initial.forward)).toBeGreaterThan(0.8);
    expect(distance(wheeled.position, initial.position)).toBeGreaterThan(0.1);

    const home = await resetToOverview(page);
    expect(distance(home.position, OVERVIEW)).toBeLessThan(0.0001);
    expect(quaternionAngleDeg(home.quaternion, initial.quaternion)).toBeLessThan(0.001);
  });

  test('selection is passive and focus remains optional and unlocked', async ({ page }) => {
    test.setTimeout(240_000);
    await openFlightPage(page);

    const initial = await readFlight(page);
    await page.locator('.body-pill', { hasText: 'ماه' }).click();
    await expect(page.getByTestId('celestial-info-panel')).toBeVisible();
    const selected = await readFlight(page);
    expect(distance(selected.position, initial.position)).toBeLessThan(1e-9);
    expect(selected.selectedBodyId).toBe('moon');
    expect(selected.focusedBodyId).not.toBe('moon');

    await page
      .getByTestId('celestial-info-panel')
      .getByRole('button', { name: 'فوکوس روی ماه' })
      .click();
    await page.waitForTimeout(700);
    const focusedMoon = await readFlight(page);
    expect(focusedMoon.focusedBodyId).toBe('moon');
    expect(distance(focusedMoon.position, selected.position)).toBeGreaterThan(0.5);

    await holdKey(page, 'w', 320);
    const movedAfterFocus = await readFlight(page);
    expect(distance(movedAfterFocus.position, focusedMoon.position)).toBeGreaterThan(0.01);

    await page
      .getByTestId('celestial-info-panel')
      .getByRole('button', { name: 'فوکوس روی ماه' })
      .click();
    await page.waitForTimeout(700);
    const refocusedMoon = await readFlight(page);
    expect(distance(refocusedMoon.position, focusedMoon.position)).toBeLessThan(
      0.05,
    );
    expect(
      quaternionAngleDeg(refocusedMoon.quaternion, focusedMoon.quaternion),
    ).toBeLessThan(0.1);

    for (const name of ['خورشید', 'مریخ'] as const) {
      await page.getByTestId('celestial-info-panel').getByRole('button', { name: 'بستن اطلاعات' }).click();
      await page.locator('.body-pill', { hasText: name }).click();
      await expect(page.getByTestId('celestial-info-panel')).toBeVisible();
      const bodyId = name === 'خورشید' ? 'sun' : 'mars';
      await page
        .getByTestId('celestial-info-panel')
        .getByRole('button', { name: `فوکوس روی ${name}` })
        .click();
      await page.waitForTimeout(700);
      const focus = await readFlight(page);
      expect(focus.focusedBodyId).toBe(bodyId);
    }

    await page.getByTestId('celestial-info-panel').getByRole('button', { name: 'بستن اطلاعات' }).click();
    await page.locator('.body-pill', { hasText: 'زمین' }).click();
    await page
      .getByTestId('celestial-info-panel')
      .getByRole('button', { name: 'فوکوس روی زمین' })
      .click();
    await page.waitForTimeout(700);
    const earthFocus = await readFlight(page);
    expect(earthFocus.focusedBodyId).toBe('earth');
  });

  test('flight pad moves the camera on small screens', async ({ page }) => {
    await openFlightPage(page);
    const before = await readFlight(page);
    await page.getByRole('button', { name: 'کنترل پرواز' }).click();
    const pad = page.getByRole('group', { name: 'کنترل پرواز شش‌درجه‌آزادی' });
    await expect(pad).toBeVisible();
    const padBox = await pad.boundingBox();
    const scaleBox = await page.locator('.scale-badge').boundingBox();
    expect(padBox).not.toBeNull();
    if (padBox) {
      expect(padBox.x).toBeGreaterThanOrEqual(0);
      expect(padBox.y).toBeGreaterThanOrEqual(0);
      expect(padBox.x + padBox.width).toBeLessThanOrEqual(390.5);
      expect(padBox.y + padBox.height).toBeLessThanOrEqual(844.5);
      if (scaleBox) {
        const overlaps =
          padBox.x < scaleBox.x + scaleBox.width &&
          padBox.x + padBox.width > scaleBox.x &&
          padBox.y < scaleBox.y + scaleBox.height &&
          padBox.y + padBox.height > scaleBox.y;
        expect(overlaps).toBe(false);
      }
    }
    const forward = page.locator('[data-flight="translation:forward"]');
    const box = await forward.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(450);
    await page.mouse.up();
    await page.waitForTimeout(500);
    const after = await readFlight(page);
    expect(distance(before.position, after.position)).toBeGreaterThan(0.01);
  });

  test('touch look and two-finger gestures control independent axes', async ({ page }) => {
    test.setTimeout(240_000);
    await openFlightPage(page);
    const client = await page.context().newCDPSession(page);
    const point = (x: number, y: number, id: number) => ({
      x,
      y,
      id,
      radiusX: 2,
      radiusY: 2,
      force: 1,
    });

    const initial = await resetToOverview(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(195, 430, 1)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(260, 470, 1)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(300);
    const looked = await readFlight(page);
    expect(distance(initial.position, looked.position)).toBeLessThan(1e-9);
    expect(quaternionAngleDeg(initial.quaternion, looked.quaternion)).toBeGreaterThan(0.2);

    const pinchStart = await resetToOverview(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(145, 420, 2), point(245, 420, 3)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(105, 420, 2), point(285, 420, 3)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(800);
    const pinched = await readFlight(page);
    const pinchedDisplacement = normalize([
      pinched.position[0]! - pinchStart.position[0]!,
      pinched.position[1]! - pinchStart.position[1]!,
      pinched.position[2]! - pinchStart.position[2]!,
    ]);
    expect(dot(pinchedDisplacement, pinchStart.forward)).toBeGreaterThan(0.7);

    const panStart = await resetToOverview(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(145, 420, 4), point(245, 420, 5)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [point(185, 450, 4), point(285, 450, 5)],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await page.waitForTimeout(800);
    const panned = await readFlight(page);
    const right = [
      panStart.quaternion[3]! ** 2 +
        panStart.quaternion[0]! ** 2 -
        panStart.quaternion[1]! ** 2 -
        panStart.quaternion[2]! ** 2,
      2 *
        (panStart.quaternion[0]! * panStart.quaternion[1]! +
          panStart.quaternion[2]! * panStart.quaternion[3]!),
      2 *
        (panStart.quaternion[0]! * panStart.quaternion[2]! -
          panStart.quaternion[1]! * panStart.quaternion[3]!),
    ];
    const pannedDisplacement = normalize([
      panned.position[0]! - panStart.position[0]!,
      panned.position[1]! - panStart.position[1]!,
      panned.position[2]! - panStart.position[2]!,
    ]);
    expect(dot(pannedDisplacement, right)).toBeGreaterThan(0.5);
    await client.detach();
  });

  test('Free -> Sky -> Free preserves the exact free-flight pose', async ({ page }) => {
    await openFlightPage(page);
    await page.mouse.move(195, 420);
    await page.mouse.down();
    await page.mouse.move(250, 380, { steps: 6 });
    await page.mouse.up();
    await holdKey(page, 'w', 300);
    await waitForFlightIdle(page);
    const before = await readFlight(page);

    await page.getByRole('button', { name: 'آسمان واقعی' }).click();
    await expect(
      page.getByRole('heading', { name: 'آسمان از کجا دیده می‌شود؟' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'کاوش آزاد' }).click();
    await page.waitForTimeout(900);
    const after = await readFlight(page);

    expect(after.position).toEqual(before.position);
    expect(after.quaternion).toEqual(before.quaternion);
    expect(after.active).toBe(true);
  });
});

test.describe('desktop free flight', () => {
  test.use({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

  test('desktop look, right-drag movement, wheel and keyboard stay free', async ({ page }) => {
    await openFlightPage(page);
    const initial = await resetToOverview(page);

    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(720, 440, { steps: 7 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    const looked = await readFlight(page);
    expect(distance(initial.position, looked.position)).toBeLessThan(1e-9);
    expect(quaternionAngleDeg(initial.quaternion, looked.quaternion)).toBeGreaterThan(0.2);

    await page.mouse.move(640, 420);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(730, 460, { steps: 7 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(600);
    const panned = await readFlight(page);
    expect(distance(looked.position, panned.position)).toBeGreaterThan(0.01);

    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(600);
    const wheeled = await readFlight(page);
    expect(distance(panned.position, wheeled.position)).toBeGreaterThan(0.05);

    await page.keyboard.down('d');
    await page.waitForTimeout(350);
    await page.keyboard.up('d');
    await page.waitForTimeout(400);
    const strafed = await readFlight(page);
    expect(distance(wheeled.position, strafed.position)).toBeGreaterThan(0.01);
  });
});
