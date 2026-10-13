/** Slices to fetch ahead of and behind the displayed one (KS-WEB-02: prefetch ±2). */
export const PREFETCH_RADIUS = 2;

const MAX_ENTRIES = 24;

/**
 * Small in-memory cache of decoded slice images keyed by URL. Failed loads are evicted so a
 * retry requests the image again. Holding the elements also keeps prefetched slices alive.
 */
export class SliceImageCache {
  private readonly entries = new Map<string, Promise<HTMLImageElement>>();

  load(url: string): Promise<HTMLImageElement> {
    const hit = this.entries.get(url);
    if (hit) {
      // Refresh recency so the displayed slice is the last to be evicted.
      this.entries.delete(url);
      this.entries.set(url, hit);
      return hit;
    }
    const pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Slice image failed to load: ${url}`));
      img.src = url;
    });
    this.entries.set(url, pending);
    pending.catch(() => {
      if (this.entries.get(url) === pending) this.entries.delete(url);
    });
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
    return pending;
  }

  /** Warms the cache; failures are ignored here and surface when the slice is displayed. */
  prefetch(urls: readonly string[]): void {
    for (const url of urls) this.load(url).catch(() => {});
  }
}

/** Slice indices within `[0, count)` around `index`, nearest first, excluding `index`. */
export function neighbourIndices(index: number, count: number, radius = PREFETCH_RADIUS): number[] {
  const out: number[] = [];
  for (let d = 1; d <= radius; d += 1) {
    for (const i of [index + d, index - d]) if (i >= 0 && i < count) out.push(i);
  }
  return out;
}
