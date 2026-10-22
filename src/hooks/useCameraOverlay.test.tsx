// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCameraOverlay } from './useCameraOverlay';

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalPlay = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  'play',
);
const originalPause = Object.getOwnPropertyDescriptor(
  HTMLMediaElement.prototype,
  'pause',
);

function installMediaDevices(getUserMedia: () => Promise<MediaStream>): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(getUserMedia) },
  });
}

function makeStream() {
  const stop = vi.fn();
  const track = {
    stop,
    addEventListener: vi.fn(),
    readyState: 'live' as MediaStreamTrackState,
  };
  const stream = {
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track, stop };
}

function Harness() {
  const {
    videoRef,
    status,
    messageFa,
    start,
    stop,
  } = useCameraOverlay();
  return (
    <div>
      <video ref={videoRef} data-testid="video" />
      <button type="button" onClick={() => void start()}>
        start
      </button>
      <button type="button" onClick={stop}>
        stop
      </button>
      <span data-testid="camera-status">{status}</span>
      {messageFa ? <p data-testid="camera-message">{messageFa}</p> : null}
    </div>
  );
}

beforeEach(() => {
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  if (originalMediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
  } else {
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  }
  if (originalPlay) {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', originalPlay);
  }
  if (originalPause) {
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', originalPause);
  }
});

describe('useCameraOverlay', () => {
  it('reports unsupported browsers without asking for permission', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() =>
      expect(screen.getByTestId('camera-status')).toHaveTextContent('unsupported'),
    );
    expect(screen.getByTestId('camera-message')).toHaveTextContent('پشتیبانی');
  });

  it('requests the rear camera and stops every track on exit', async () => {
    const { stream, track, stop } = makeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() =>
      expect(screen.getByTestId('camera-status')).toHaveTextContent('active'),
    );
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: { ideal: 'environment' },
        }),
      }),
    );
    expect(track.stop).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'stop' }));
    expect(stop).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId('camera-status')).toHaveTextContent('idle'),
    );
    expect(screen.getByTestId('video')).toHaveProperty('srcObject', null);
  });

  it('maps a permission rejection to a clear, recoverable error', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() =>
      expect(screen.getByTestId('camera-status')).toHaveTextContent('denied'),
    );
    expect(screen.getByTestId('camera-message')).toHaveTextContent('اجازهٔ دسترسی');
  });

  it('releases the camera when the component unmounts', async () => {
    const { stream, stop } = makeStream();
    installMediaDevices(() => Promise.resolve(stream));
    const user = userEvent.setup();
    const { unmount } = render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() =>
      expect(screen.getByTestId('camera-status')).toHaveTextContent('active'),
    );
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
