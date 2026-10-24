// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Sheet } from './Sheet';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        باز کردن
      </button>
      <button type="button">بیرون</button>
      <Sheet open={open} onClose={() => setOpen(false)} title="تنظیمات">
        <button type="button">داخل</button>
      </Sheet>
    </div>
  );
}

describe('Sheet accessibility', () => {
  it('focuses the close button, inerts the background and restores focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'باز کردن' });
    const outside = screen.getByRole('button', { name: 'بیرون' });

    opener.focus();
    await user.click(opener);
    await waitFor(() => expect(screen.getByRole('button', { name: 'بستن' })).toHaveFocus());
    expect(outside).toHaveAttribute('inert');
    expect(opener).toHaveAttribute('inert');

    await user.click(screen.getByRole('button', { name: 'بستن' }));
    await waitFor(() => expect(opener).toHaveFocus());
    expect(outside).not.toHaveAttribute('inert');
    expect(opener).not.toHaveAttribute('inert');
  });
});
