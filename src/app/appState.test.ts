import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState } from './appState';

describe('application state', () => {
  it('selects a valid body and opens its info panel', () => {
    const next = appReducer(initialAppState, { type: 'select-body', bodyId: 'moon' });
    expect(next.selectedBodyId).toBe('moon');
    expect(next.infoOpen).toBe(true);
  });

  it('ignores unknown body identifiers', () => {
    expect(
      appReducer(initialAppState, { type: 'select-body', bodyId: 'not-a-body' }),
    ).toBe(initialAppState);
  });

  it('closes the info panel when changing modes and keeps a valid selection', () => {
    const withMoon = appReducer(initialAppState, {
      type: 'select-body',
      bodyId: 'moon',
    });
    const sky = appReducer(withMoon, { type: 'set-mode', mode: 'sky' });
    expect(sky.mode).toBe('sky');
    expect(sky.selectedBodyId).toBe('moon');
    expect(sky.infoOpen).toBe(false);

    const sun = appReducer(initialAppState, { type: 'select-body', bodyId: 'sun' });
    const earthOnly = appReducer(sun, { type: 'set-mode', mode: 'free' });
    expect(earthOnly.selectedBodyId).toBe('sun');

    const sirius = appReducer(
      { ...initialAppState, mode: 'sky' },
      {
        type: 'select-body',
        bodyId: 'sirius',
      },
    );
    const free = appReducer(sirius, { type: 'set-mode', mode: 'free' });
    expect(free.selectedBodyId).toBe('earth');
  });

  it('replaces an invisible selection when entering sky mode', () => {
    const withEarth = appReducer(initialAppState, { type: 'toggle-info' });
    const sky = appReducer(withEarth, { type: 'set-mode', mode: 'sky' });
    expect(sky.selectedBodyId).toBe('sun');
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
});
