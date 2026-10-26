// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { AppStateProvider } from './AppStateProvider';

function renderApp() {
  return render(
    <AppStateProvider>
      <App />
    </AppStateProvider>,
  );
}

describe('application flows', () => {
  it('selects a body and displays its scientific information', async () => {
    const user = userEvent.setup();
    renderApp();

    expect(
      await screen.findByText(/نمایش صحنهٔ سه‌بعدی ممکن نشد/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ماه/ }));
    const panel = await screen.findByTestId('celestial-info-panel');
    expect(within(panel).getByRole('heading', { name: 'ماه' })).toBeInTheDocument();
    expect(within(panel).getByText(/مقیاس واقعی نجومی/)).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'بستن اطلاعات' }));
    expect(screen.queryByTestId('celestial-info-panel')).not.toBeInTheDocument();
  });

  it('switches to real sky, validates manual coordinates, and lists objects', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'آسمان واقعی' }));
    expect(
      await screen.findByRole('heading', { name: 'آسمان از کجا دیده می‌شود؟' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: /ورود مختصات به‌صورت دستی/ }),
    );
    await user.clear(screen.getByPlaceholderText('مثلاً 35.6892'));
    await user.type(screen.getByPlaceholderText('مثلاً 35.6892'), '200');
    await user.type(screen.getByPlaceholderText('مثلاً 51.3890'), '51.389');
    await user.click(screen.getByRole('button', { name: 'استفاده از این مکان' }));
    expect(screen.getByText(/عرض جغرافیایی باید/)).toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText('مثلاً 35.6892'));
    await user.type(screen.getByPlaceholderText('مثلاً 35.6892'), '35.6892');
    await user.click(screen.getByRole('button', { name: 'استفاده از این مکان' }));

    expect(
      await screen.findByText('نمای آسمان ساخته نشد'),
    ).toBeInTheDocument();
    expect(await screen.findByTestId('sky-hud')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'حسگر خاموش' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'اجرام' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('اجرام آسمان')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /مریخ/ }));

    const panel = await screen.findByTestId('celestial-info-panel');
    expect(within(panel).getByRole('heading', { name: 'مریخ' })).toBeInTheDocument();
    expect(within(panel).getByText(/موقعیت در آسمان ناظر/)).toBeInTheDocument();
  });

  it('keeps map attribution available when the manual location and map layer are configured', async () => {
    const user = userEvent.setup();
    renderApp();

    await screen.findByText(/نمایش صحنهٔ سه‌بعدی ممکن نشد/);
    await user.click(screen.getByRole('button', { name: 'موقعیت من روی زمین' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'ورود مختصات دستی' }));
    await user.type(within(dialog).getByPlaceholderText('مثلاً 35.6892'), '35.6892');
    await user.type(within(dialog).getByPlaceholderText('مثلاً 51.3890'), '51.389');
    await user.click(
      within(dialog).getByRole('button', { name: 'ثبت این مختصات روی زمین' }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /موقعیت شما/ }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText('© OpenStreetMap contributors')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /موقعیت شما/ }));
    const mapDialog = await screen.findByRole('dialog');
    expect(
      within(mapDialog).getByRole('link', { name: /OpenStreetMap contributors/ }),
    ).toBeInTheDocument();
    expect(
      within(mapDialog).getByRole('switch', { name: /نقشهٔ خیابانی/ }),
    ).toBeChecked();
  });

  it('shows explicit unsupported messages for sensors and camera without crashing', async () => {
    const originalSensorConstructor = Object.getOwnPropertyDescriptor(
      window,
      'DeviceOrientationEvent',
    );
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: undefined,
    });

    try {
      const user = userEvent.setup();
      renderApp();

      await user.click(screen.getByRole('button', { name: 'آسمان واقعی' }));
      await user.click(
        await screen.findByRole('button', { name: /ورود مختصات به‌صورت دستی/ }),
      );
      await user.type(screen.getByPlaceholderText('مثلاً 35.6892'), '35.6892');
      await user.type(screen.getByPlaceholderText('مثلاً 51.3890'), '51.389');
      await user.click(screen.getByRole('button', { name: 'استفاده از این مکان' }));

      await user.click(screen.getByRole('button', { name: 'حسگر خاموش' }));
      expect(
        await screen.findByText(/پشتیبانی نمی‌کند/),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'دوربین' }));
      await waitFor(() =>
        expect(screen.getByText(/صفحه در بستر امن/)).toBeInTheDocument(),
      );
      expect(screen.getByTestId('sky-hud')).toBeInTheDocument();
    } finally {
      if (originalSensorConstructor) {
        Object.defineProperty(
          window,
          'DeviceOrientationEvent',
          originalSensorConstructor,
        );
      } else {
        delete (window as unknown as Record<string, unknown>).DeviceOrientationEvent;
      }
    }
  });
});
