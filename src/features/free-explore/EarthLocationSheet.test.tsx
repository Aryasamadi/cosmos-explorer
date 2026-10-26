// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeoLocation } from '../../geo/types';
import { EarthLocationSheet } from './EarthLocationSheet';

const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');

function makePosition(accuracy = 25): GeolocationPosition {
  return {
    coords: {
      latitude: 35.6892,
      longitude: 51.389,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 1_760_000_000_000,
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function installGeolocation(
  getCurrentPosition: Geolocation['getCurrentPosition'],
  watchPosition: Geolocation['watchPosition'] = vi.fn(),
): void {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition,
      watchPosition,
      clearWatch: vi.fn(),
    },
  });
}

function baseProps() {
  return {
    open: true,
    onClose: vi.fn(),
    location: null as GeoLocation | null,
    onUseLocation: vi.fn(),
    onUpdateLocation: vi.fn(),
    onFocus: vi.fn(),
    onClear: vi.fn(),
    mapOverlayEnabled: true,
    onMapOverlayChange: vi.fn(),
  };
}

function renderSheet(props = baseProps()) {
  render(<EarthLocationSheet {...props} />);
  return props;
}

afterEach(() => {
  if (originalGeolocation) {
    Object.defineProperty(navigator, 'geolocation', originalGeolocation);
  } else {
    delete (navigator as unknown as Record<string, unknown>).geolocation;
  }
});

describe('EarthLocationSheet', () => {
  it('accepts manual coordinates and closes after use', async () => {
    const user = userEvent.setup();
    const props = renderSheet();

    await user.click(screen.getByRole('button', { name: 'ورود مختصات دستی' }));
    await user.type(screen.getByPlaceholderText('مثلاً 35.6892'), '35.6892');
    await user.type(screen.getByPlaceholderText('مثلاً 51.3890'), '51.389');
    await user.click(screen.getByRole('button', { name: 'ثبت این مختصات روی زمین' }));

    expect(props.onUseLocation).toHaveBeenCalledTimes(1);
    const location = props.onUseLocation.mock.calls[0]?.[0] as GeoLocation;
    expect(location.latitudeDeg).toBeCloseTo(35.6892, 6);
    expect(location.longitudeDeg).toBeCloseTo(51.389, 6);
    expect(location.source).toBe('manual');
    expect(location.accuracyM).toBeNull();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('uses the device location and reports its accuracy without claiming exactness', async () => {
    installGeolocation((success) => success(makePosition(25)));
    const user = userEvent.setup();
    const props = renderSheet();

    await user.click(screen.getByRole('button', { name: 'دریافت موقعیت دستگاه' }));

    await waitFor(() => expect(props.onUseLocation).toHaveBeenCalledTimes(1));
    const location = props.onUseLocation.mock.calls[0]?.[0] as GeoLocation;
    expect(location).toMatchObject({
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      accuracyM: 25,
      source: 'device',
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it('keeps a coarse fix open and requires an explicit focus action', async () => {
    installGeolocation((success) => success(makePosition(900)));
    const user = userEvent.setup();
    const props = renderSheet();

    await user.click(screen.getByRole('button', { name: 'دریافت موقعیت دستگاه' }));

    await waitFor(() => expect(props.onUseLocation).toHaveBeenCalledTimes(1));
    const location = props.onUseLocation.mock.calls[0]?.[0] as GeoLocation;
    expect(location.accuracyM).toBe(900);
    expect(props.onClose).not.toHaveBeenCalled();
    expect(await screen.findByText(/زوم روی محدودهٔ نامطمئن/)).toBeInTheDocument();
  });

  it('shows a clear error when location permission is denied', async () => {
    installGeolocation((_success, error) => {
      error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
    });
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: 'دریافت موقعیت دستگاه' }));
    expect(
      await screen.findByText(/اجازهٔ موقعیت داده نشد/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ورود مختصات دستی' })).toBeInTheDocument();
  });

  it('offers refinement and updates only when accuracy improves', async () => {
    installGeolocation(
      vi.fn(),
      ((success: PositionCallback) => {
        success(makePosition(12));
        return 7;
      }) as Geolocation['watchPosition'],
    );
    const user = userEvent.setup();
    const props = baseProps();
    props.location = {
      latitudeDeg: 35.6892,
      longitudeDeg: 51.389,
      accuracyM: 250,
      altitudeM: null,
      source: 'device',
      timestampMs: 1_760_000_000_000,
    };
    render(<EarthLocationSheet {...props} />);
    expect(screen.getByText(/پایین است/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'بهبود دقت' }));

    await waitFor(() => expect(props.onUpdateLocation).toHaveBeenCalledTimes(1));
    const improved = props.onUpdateLocation.mock.calls[0]?.[0] as GeoLocation;
    expect(improved.accuracyM).toBe(12);
    expect(await screen.findByText('دقت بهبود یافت.')).toBeInTheDocument();
    expect(props.onUseLocation).not.toHaveBeenCalled();
  });

  it('lets the user disable the OSM overlay independently of the location', async () => {
    const user = userEvent.setup();
    const props = renderSheet();
    const toggle = screen.getByRole('switch', { name: /نقشهٔ خیابانی/ });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(props.onMapOverlayChange).toHaveBeenCalledWith(false);
  });

  it('shows a compact sheet with the required OpenStreetMap attribution', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'موقعیت من' })).toBeInTheDocument();
    expect(screen.queryByText('جزئیات نقشه')).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /OpenStreetMap contributors/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /شرایط سرویس نقشه/ })).toHaveAttribute(
      'href',
      expect.stringContaining('operations.osmfoundation.org'),
    );
    expect(screen.getByRole('link', { name: /گزارش مشکل نقشه/ })).toHaveAttribute(
      'href',
      expect.stringContaining('fixthemap'),
    );
  });
});
