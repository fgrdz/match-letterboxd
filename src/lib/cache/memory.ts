export interface Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttlSeconds: number): void;
}
export class MemoryCache<T> implements Cache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(private capacity = 200) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key: string, value: T, ttlSeconds: number): void {
    this.entries.delete(key);
    if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  }
}
