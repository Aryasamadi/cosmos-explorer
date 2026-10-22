export type FrameCallback = (elapsedSeconds: number, deltaSeconds: number) => void;

/**
 * A single requestAnimationFrame loop that pauses while the document is
 * hidden and can be stopped deterministically during cleanup.
 */
export class RenderLoop {
  private frameId: number | null = null;
  private lastTime = 0;
  private elapsed = 0;
  private paused = false;
  private readonly onVisibilityChange = (): void => {
    if (this.document.hidden) {
      this.pause();
    } else if (!this.paused) {
      this.resumeClock();
    }
  };

  constructor(
    private readonly callback: FrameCallback,
    private readonly document: Document = window.document,
    private readonly requestFrame: (callback: FrameRequestCallback) => number = (cb) =>
      window.requestAnimationFrame(cb),
    private readonly cancelFrame: (id: number) => void = (id) =>
      window.cancelAnimationFrame(id),
    private readonly now: () => number = () => performance.now(),
  ) {}

  start(): void {
    if (this.frameId !== null) return;
    this.document.addEventListener('visibilitychange', this.onVisibilityChange);
    this.resumeClock();
    this.schedule();
  }

  stop(): void {
    this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }
    this.paused = false;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      if (this.frameId !== null) {
        this.cancelFrame(this.frameId);
        this.frameId = null;
      }
    } else {
      this.resumeClock();
      this.schedule();
    }
  }

  private pause(): void {
    if (this.frameId !== null) {
      this.cancelFrame(this.frameId);
      this.frameId = null;
    }
  }

  private resumeClock(): void {
    this.lastTime = this.now();
  }

  private schedule(): void {
    if (this.frameId !== null || this.paused || this.document.hidden) return;
    this.frameId = this.requestFrame(this.tick);
  }

  private readonly tick = (time: number): void => {
    this.frameId = null;
    if (this.paused || this.document.hidden) return;
    const deltaSeconds = Math.min(Math.max((time - this.lastTime) / 1000, 0), 0.1);
    this.lastTime = time;
    this.elapsed += deltaSeconds;
    this.callback(this.elapsed, deltaSeconds);
    this.schedule();
  };
}
