import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState } from './appState';

describe('application state', () => {
  it('starts with no forced body selection in either mode', () => {
    expect(initialAppState.freeSelectedBodyId).toBeNull();
    expect(initialAppState.skySelectedBodyId).toBeNull();
    expect(initialAppState.infoOpen).toBe(false);
  });

  it('selects a valid body in the active mode and opens its info panel', () => {
    const next = appReducer(initialAppState, { type: 'select-body', bodyId: 'moon' });
    expect(next.freeSelectedBodyId).toBe('moon');
    expect(next.skySelectedBodyId).toBeNull();
    expect(next.infoOpen).toBe(true);
  });

  it('ignores unknown body identifiers', () => {
    expect(
      appReducer(initialAppState, { type: 'select-body', bodyId: 'not-a-body' }),
    ).toBe(initialAppState);
  });

  it('keeps a separate selection per mode across round trips', () => {
    const freeMoon = appReducer(initialAppState, {
      type: 'select-body',
      bodyId: 'moon',
    });
    const sky = appReducer(freeMoon, { type: 'set-mode', mode: 'sky' });
    expect(sky.mode).toBe('sky');
    expect(sky.freeSelectedBodyId).toBe('moon');
    expect(sky.skySelectedBodyId).toBeNull();
    expect(sky.infoOpen).toBe(false);

    const skyMars = appReducer(sky, { type: 'select-body', bodyId: 'mars' });
    expect(skyMars.skySelectedBodyId).toBe('mars');
    expect(skyMars.freeSelectedBodyId).toBe('moon');

    const freeAgain = appReducer(skyMars, { type: 'set-mode', mode: 'free' });
    expect(freeAgain.mode).toBe('free');
    expect(freeAgain.freeSelectedBodyId).toBe('moon');
    expect(freeAgain.skySelectedBodyId).toBe('mars');
    expect(freeAgain.infoOpen).toBe(false);
  });

  it('does not invent a fallback body when a mode has no selection', () => {
    const sky = appReducer(initialAppState, { type: 'set-mode', mode: 'sky' });
    expect(sky.freeSelectedBodyId).toBeNull();
    expect(sky.skySelectedBodyId).toBeNull();
    expect(sky.infoOpen).toBe(false);
  });

  it('toggles and closes info indempotently', () => {
    const open = appReducer(initialAppState, { type: 'toggle-info' });
    expect(open.infoOpen).toBe(true);
    const closed = appReducer(open, { type: 'close-info' });
    expect(closed.infoOpen).toBe(false);
    expect(appReducer(closed, { type: 'close-info' })).toBe(closed);
  });

  it('stores the low-power preference', () => {
    const enabled = appReducer(initialAppState, {
      type: 'set-low-power',
      enabled: true,
    });
    expect(enabled.lowPower).toBe(true);
    expect(
      appReducer(enabled, { type: 'set-low-power', enabled: true }),
    ).toBe(enabled);
  });

  it('keeps a shared location across mode changes and clears it explicitly', () => {
    const location = {
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      accuracyM: 20,
      altitudeM: null,
      source: 'device' as const,
      timestampMs: 1_760_000_000_000,
    };
    const withLocation = appReducer(initialAppState, {
      type: 'set-location',
      location,
    });
    expect(withLocation.location).toEqual(location);
    const sky = appReducer(withLocation, { type: 'set-mode', mode: 'sky' });
    expect(sky.location).toEqual(location);
    const cleared = appReducer(sky, { type: 'clear-location' });
    expect(cleared.location).toBeNull();
    expect(appReducer(cleared, { type: 'clear-location' })).toBe(cleared);
  });
});
