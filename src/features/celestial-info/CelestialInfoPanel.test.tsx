// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { getBodyById } from '../../catalog/bodies';
import type { SkyObjectPosition } from '../../astronomy/types';
import { CelestialInfoPanel } from './CelestialInfoPanel';

const moon = getBodyById('moon');
const sun = getBodyById('sun');
if (!moon || !sun) throw new Error('Catalog fixtures missing.');

const aboveHorizon: SkyObjectPosition = {
  bodyId: 'sun',
  equatorial: { raHours: 12, decDeg: 0 },
  horizontal: { altitudeDeg: 35.2, azimuthDeg: 185.4 },
  distanceKm: 1.47e8,
  isAboveHorizon: true,
  apparentMagnitude: -26.74,
  illuminationFraction: null,
};

const belowHorizon: SkyObjectPosition = {
  ...aboveHorizon,
  horizontal: { altitudeDeg: -18.5, azimuthDeg: 250 },
  isAboveHorizon: false,
};

describe('CelestialInfoPanel', () => {
  it('shows sourced facts and the display-scale warning in free mode', () => {
    render(
      <CelestialInfoPanel
        body={moon}
        mode="free"
        open
        onClose={() => {}}
      />,
    );
    const panel = screen.getByTestId('celestial-info-panel');
    expect(within(panel).getByRole('heading', { name: 'ماه' })).toBeInTheDocument();
    expect(within(panel).getByText(/مقیاس واقعی نجومی/)).toBeInTheDocument();
    expect(within(panel).getAllByText('میانگین').length).toBeGreaterThan(0);
    expect(within(panel).getAllByRole('link').length).toBeGreaterThan(0);
    expect(within(panel).getByTestId('fact-mean-radius')).toHaveTextContent('کیلومتر');
  });

  it('reports live altitude, visibility, and horizon warnings in sky mode', () => {
    const { rerender } = render(
      <CelestialInfoPanel
        body={sun}
        mode="sky"
        open
        onClose={() => {}}
        position={aboveHorizon}
        timestamp={new Date('2026-01-15T09:00:00Z')}
      />,
    );
    const panel = screen.getByTestId('celestial-info-panel');
    expect(within(panel).getByText(/بالای افق/)).toBeInTheDocument();
    expect(within(panel).getByText(/بدون شکست نور جو/)).toBeInTheDocument();

    rerender(
      <CelestialInfoPanel
        body={sun}
        mode="sky"
        open
        onClose={() => {}}
        position={belowHorizon}
        timestamp={new Date('2026-01-15T15:00:00Z')}
      />,
    );
    expect(within(panel).getByText(/زیر افق است/)).toBeInTheDocument();
  });

  it('closes through its labelled button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CelestialInfoPanel body={moon} mode="free" open onClose={onClose} />,
    );
    await user.click(screen.getByRole('button', { name: 'بستن اطلاعات' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', () => {
    render(
      <CelestialInfoPanel body={moon} mode="free" open={false} onClose={() => {}} />,
    );
    expect(screen.queryByTestId('celestial-info-panel')).not.toBeInTheDocument();
  });
});
