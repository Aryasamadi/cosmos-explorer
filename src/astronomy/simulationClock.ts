import { assertValidDate } from './validation/input';

export interface SimulationClockOptions {
  /** Time source used while the clock is running. Defaults to the system UTC clock. */
  now?: () => Date;
  /** Optional initial fixed instant for deterministic tests. */
  fixedUtc?: Date | null;
}

/**
 * Shared UTC clock for Earth lighting and the sky view. A fixed instant can be
 * injected for tests; production always reads the system clock.
 */
export class SimulationClock {
  private readonly source: () => Date;
  private fixedMs: number | null;

  constructor(options: SimulationClockOptions = {}) {
    this.source = options.now ?? (() => new Date());
    this.fixedMs = options.fixedUtc ? assertValidDate(options.fixedUtc).getTime() : null;
  }

  nowUtc(): Date {
    if (this.fixedMs !== null) {
      return new Date(this.fixedMs);
    }
    const now = this.source();
    assertValidDate(now);
    return new Date(now.getTime());
  }

  setFixedUtc(date: Date | null): void {
    this.fixedMs = date === null ? null : assertValidDate(date).getTime();
  }
}

/** In-memory application clock; this is intentionally not persisted. */
export const appSimulationClock = new SimulationClock();
