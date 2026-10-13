import { vi } from 'vitest';
import type { FindingProfile, StudyDetail } from '../api/types';
import { example } from './examples';

export type Call = { method: string; path: string; body: unknown };
export type Handler = (call: Call) => Response | Promise<Response>;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const defaultStudy = example<StudyDetail>('study-detail').body;
const profile = example<FindingProfile>('findings').body;

/**
 * Stubs `fetch` for the review page. Routes are matched on the path after `/api`; extra or
 * replacement routes are passed as `routes` ("METHOD /path"). Every request is recorded in
 * `calls`, so tests can assert what was (and was not) requested.
 */
export function mockApi(
  routes: Record<string, Handler> = {},
  studies: Record<string, StudyDetail> = { [defaultStudy.study_id]: defaultStudy },
) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace(/^\/api/, '');
    const method = init?.method ?? 'GET';
    const call: Call = {
      method,
      path,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    };
    calls.push(call);
    const handler = routes[`${method} ${path}`];
    if (handler) return handler(call);
    if (method === 'GET' && path === '/findings') return json(profile);
    const study = method === 'GET' ? /^\/studies\/([^/]+)$/.exec(path)?.[1] : undefined;
    if (study && studies[study]) return json(studies[study]);
    return json(
      {
        error: {
          code: 'TEST_UNROUTED',
          message: `Unrouted ${method} ${path}`,
          request_id: 'req-test',
          retryable: false,
          detail: null,
        },
      },
      404,
    );
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** Test double for Image: slice loads settle immediately and are never real requests. */
export class FakeImage {
  static srcs: string[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  set src(url: string) {
    FakeImage.srcs.push(url);
    queueMicrotask(() => this.onload?.());
  }
}

/** jsdom has no canvas; a stub 2D context is enough for the viewer to draw. */
export function stubCanvas() {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: true,
  } as unknown as CanvasRenderingContext2D);
}
