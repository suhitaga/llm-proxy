import { PriorityHeap } from "./priority-heap.ts";

type QueueEntry = {
  priority: number;
  insertionOrder: number;
  resolve: () => void;
};

type QueueStatus = {
  active: number;
  queued: number;
  maxConcurrency: number;
  maxQueueDepth: number;
};

type EnqueueResult =
  | { queued: false }
  | { queued: true; position: number; waitMs: Promise<number> };

// higher priority first, then FIFO within the same priority
const compareEntries = (a: QueueEntry, b: QueueEntry): number => {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.insertionOrder - b.insertionOrder;
};

class RequestQueue {
  private active = 0;
  private counter = 0;
  private heap = new PriorityHeap<QueueEntry>(compareEntries);
  private maxConcurrency: number;
  private maxQueueDepth: number;

  constructor(maxConcurrency = 2, maxQueueDepth = 50) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueueDepth = maxQueueDepth;
  }

  // caller must call release() when done to free the slot
  async enqueue<T>(
    priority: number,
    fn: () => Promise<T>,
  ): Promise<{ result: T; release: () => void; meta: EnqueueResult }> {
    let meta: EnqueueResult;
    const enqueueTime = performance.now();

    if (this.active < this.maxConcurrency) {
      this.active++;
      meta = { queued: false };
    } else {
      if (this.heap.size >= this.maxQueueDepth) {
        throw new QueueFullError(this.heap.size);
      }

      const position = this.heap.size + 1;
      let waitMsResolve: (ms: number) => void;
      const waitMs = new Promise<number>((r) => { waitMsResolve = r; });

      await new Promise<void>((resolve) => {
        this.heap.push({
          priority,
          insertionOrder: this.counter++,
          resolve,
        });
      });

      this.active++;
      waitMsResolve!(performance.now() - enqueueTime);
      meta = { queued: true, position, waitMs };
    }

    const release = () => {
      this.active--;
      this.drain();
    };

    try {
      const result = await fn();
      return { result, release, meta };
    } catch (err) {
      release();
      throw err;
    }
  }

  private drain(): void {
    while (this.active < this.maxConcurrency && this.heap.size > 0) {
      const entry = this.heap.pop()!;
      entry.resolve();
    }
  }

  getStatus(): QueueStatus {
    return {
      active: this.active,
      queued: this.heap.size,
      maxConcurrency: this.maxConcurrency,
      maxQueueDepth: this.maxQueueDepth,
    };
  }
}

class QueueFullError extends Error {
  queueDepth: number;

  constructor(queueDepth: number) {
    super(`Queue is full (${queueDepth} pending requests)`);
    this.queueDepth = queueDepth;
  }
}

export { RequestQueue, QueueFullError };
export type { QueueStatus, EnqueueResult };
