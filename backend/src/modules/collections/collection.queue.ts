export class CollectionQueue {
  private queue: string[] = [];
  private processing = false;
  private handlers: ((id: string) => Promise<void>)[] = [];

  add(collectionId: string) {
    this.queue.push(collectionId);
    this.process();
  }

  onProcess(handler: (id: string) => Promise<void>) {
    this.handlers.push(handler);
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const id = this.queue.shift()!;
      for (const handler of this.handlers) {
        try {
          await handler(id);
        } catch (err) {
          console.error(`Queue handler error for ${id}:`, err);
        }
      }
    }

    this.processing = false;
  }
}
