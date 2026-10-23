import { describe, expect, it } from 'vitest';
import { SimulationClock } from './simulationClock';

describe('SimulationClock', () => {
  it('returns UTC from the injected source and defensive copies', () => {
    const sourceDate = new Date('2026-06-21T12:00:00.000Z');
    const clock = new SimulationClock({ now: () => sourceDate });
    const first = clock.nowUtc();
    expect(first.toISOString()).toBe('2026-06-21T12:00:00.000Z');
    expect(first).not.toBe(sourceDate);
    first.setUTCFullYear(2030);
    expect(clock.nowUtc().getUTCFullYear()).toBe(2026);
  });

  it('supports a deterministic fixed instant and resuming the source clock', () => {
    let nowMs = Date.parse('2026-01-15T00:00:00.000Z');
    const clock = new SimulationClock({ now: () => new Date(nowMs) });

    clock.setFixedUtc(new Date('2026-09-23T00:00:00.000Z'));
    nowMs = Date.parse('2026-12-21T12:00:00.000Z');
    expect(clock.nowUtc().toISOString()).toBe('2026-09-23T00:00:00.000Z');

    clock.setFixedUtc(null);
    expect(clock.nowUtc().toISOString()).toBe('2026-12-21T12:00:00.000Z');
  });

  it('accepts an initial fixed instant and rejects invalid values', () => {
    const clock = new SimulationClock({
      fixedUtc: new Date('2026-06-21T12:00:00.000Z'),
    });
    expect(clock.nowUtc().toISOString()).toBe('2026-06-21T12:00:00.000Z');
    expect(() => clock.setFixedUtc(new Date(Number.NaN))).toThrow(RangeError);
    expect(() => new SimulationClock({ now: () => new Date(Number.NaN) })).not.toThrow();
    expect(() => new SimulationClock({ now: () => new Date(Number.NaN) }).nowUtc()).toThrow(
      RangeError,
    );
  });
});
