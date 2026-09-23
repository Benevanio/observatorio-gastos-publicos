import { env } from '../../config/env';
export class CollectionQueue {
  private pending: string[] = [];
  private running = new Set<string>();
  private handlers: Array<(id: string) => Promise<void>> = [];

  constructor(private readonly concurrency: number = env.collection.concurrency) {}
  add(collectionId: string): void {
    if (this.running.has(collectionId) || this.pending.includes(collectionId)) return;
    this.pending.push(collectionId);
    this.drain();
  }

  onProcess(handler: (id: string) => Promise<void>): void {
    this.handlers.push(handler);
  }
  private drain(): void {
    while (this.running.size < this.concurrency && this.pending.length > 0) {
      const id = this.pending.shift();
      if (id === undefined) break;

      this.running.add(id);

      void this.runHandlers(id).finally(() => {
        this.running.delete(id);
        this.drain();
      });
    }
  }

  private async runHandlers(id: string): Promise<void> {
    for (const handler of this.handlers) {
      try {
        await handler(id);
      } catch (err) {
        console.error(`[COLLECTION_QUEUE_ERROR] collectionId=${id}`, err);
      }
    }
  }

  stats(): { pending: number; running: number; concurrency: number } {
    return { pending: this.pending.length, running: this.running.size, concurrency: this.concurrency };
  }

  isTracked(collectionId: string): boolean {
    return this.running.has(collectionId) || this.pending.includes(collectionId);
  }
}
export const collectionQueue = new CollectionQueue();
