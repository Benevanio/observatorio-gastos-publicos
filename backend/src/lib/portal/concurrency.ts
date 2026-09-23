export class HostLimiter {
  private active = new Map<string, number>();
  private lastStart = new Map<string, number>();
  private waiting = new Map<string, Array<() => void>>();

  constructor(
    private readonly maxConcurrent: number,
    private readonly minIntervalMs: number
  ) {}

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    await this.acquire(key);
    try {
      return await fn();
    } finally {
      this.release(key);
    }
  }

  private async acquire(key: string): Promise<void> {
    while ((this.active.get(key) ?? 0) >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        const queue = this.waiting.get(key) ?? [];
        queue.push(resolve);
        this.waiting.set(key, queue);
      });
    }

    this.active.set(key, (this.active.get(key) ?? 0) + 1);

    const last = this.lastStart.get(key);
    if (last !== undefined) {
      const wait = this.minIntervalMs - (Date.now() - last);
      if (wait > 0) await sleep(wait);
    }
    this.lastStart.set(key, Date.now());
  }

  private release(key: string): void {
    const current = this.active.get(key) ?? 1;
    this.active.set(key, Math.max(0, current - 1));

    const queue = this.waiting.get(key);
    const next = queue?.shift();
    if (next) next();
  }

  stats(): Record<string, { active: number; waiting: number }> {
    const out: Record<string, { active: number; waiting: number }> = {};
    for (const [key, active] of this.active) {
      out[key] = { active, waiting: this.waiting.get(key)?.length ?? 0 };
    }
    return out;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
