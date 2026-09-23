import { AppError } from '../errors';
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** One in-flight request per upstream, across all comparisons in this process. */
export class RequestQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private nextAt = 0;
  private pending = 0;
  constructor(
    private delay: number,
    private maxPending = 40,
  ) {}
  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.pending >= this.maxPending) throw new AppError('busy');
    this.pending++;
    const task = this.tail.then(async () => {
      await sleep(Math.max(0, this.nextAt - Date.now()));
      try {
        return await operation();
      } finally {
        this.nextAt = Date.now() + this.delay;
      }
    });
    this.tail = task.catch(() => undefined);
    try {
      return await task;
    } finally {
      this.pending--;
    }
  }
}
