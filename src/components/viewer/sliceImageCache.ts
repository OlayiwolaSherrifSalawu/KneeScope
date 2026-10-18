import studiesData from '../../data/fixtures/studies.json';
import { generateClientPhantomSliceUrl } from '../../api/mockService';
import { customModelStore } from '../../store/customModelStore';

/** Slices to fetch ahead of and behind the displayed one (KS-WEB-02: prefetch ±2). */
export const PREFETCH_RADIUS = 2;

const MAX_ENTRIES = 24;

/**
 * Small in-memory cache of decoded slice images keyed by URL. Failed loads are evicted so a
 * retry requests the image again. Holding the elements also keeps prefetched slices alive.
 */
export class SliceImageCache {
  private readonly entries = new Map<string, Promise<HTMLImageElement>>();

  clear(): void {
    this.entries.clear();
  }

  load(url: string): Promise<HTMLImageElement> {
    const hit = this.entries.get(url);
    if (hit) {
      // Refresh recency so the displayed slice is the last to be evicted.
      this.entries.delete(url);
      this.entries.set(url, hit);
      return hit;
    }
    const pending = new Promise<HTMLImageElement>((resolve, reject) => {
      // Check if this study has a client-side uploaded image
      const match = url.match(/\/studies\/([^/]+)\/series\/([^/]+)\/slices\/(\d+)/);
      const studyId = match?.[1];
      const uploadedImg = studyId ? customModelStore.getUploadedImage(studyId) : undefined;
      const targetUrl = uploadedImg || (studyId === 'real-study-001' ? '/images.jpeg' : url);

      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Fallback: try sample_knee_mri.png or client-side generator
        if (targetUrl !== url) {
          const secondImg = new Image();
          secondImg.onload = () => resolve(secondImg);
          secondImg.onerror = () => this.fallbackToGenerator(url, match, resolve, reject);
          secondImg.src = url;
          return;
        }
        this.fallbackToGenerator(url, match, resolve, reject);
      };
      img.src = targetUrl;
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

  private fallbackToGenerator(
    url: string,
    match: RegExpMatchArray | null,
    resolve: (img: HTMLImageElement) => void,
    reject: (err: Error) => void
  ) {
    if (match) {
      const [, studyId, seriesId, sliceIdxStr] = match;
      const study = (studiesData.studies as any[]).find((s) => s.study_id === studyId);
      const series = study?.series?.find((s: any) => s.series_id === seriesId);
      if (series) {
        const fallbackUrl = generateClientPhantomSliceUrl(
          series.plane || 'sagittal',
          series.num_slices,
          parseInt(sliceIdxStr, 10),
          series.rendered_width || 256,
          studyId
        );
        if (fallbackUrl) {
          const fallbackImg = new Image();
          fallbackImg.onload = () => resolve(fallbackImg);
          fallbackImg.onerror = () => reject(new Error(`Slice image failed to load: ${url}`));
          fallbackImg.src = fallbackUrl;
          return;
        }
      }
    }
    reject(new Error(`Slice image failed to load: ${url}`));
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
