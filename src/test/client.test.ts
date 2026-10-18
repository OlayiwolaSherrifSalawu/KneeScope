import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_UNREACHABLE, ApiRequestError, api, sliceUrl } from '../api/client';
import type { ApiError } from '../api/types';
import { example } from './examples';

afterEach(() => vi.unstubAllGlobals());

describe('api client', () => {
  it('maps an ApiError body to ApiRequestError', async () => {
    const { status, body } = example<ApiError>('error-preprocessing-failed');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
    );
    const err = await api.predict({ study_id: 'fx-study-003' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    const e = err as ApiRequestError;
    expect(e.code).toBe(body.error.code);
    expect(e.message).toBe(body.error.message);
    expect(e.requestId).toBe(body.error.request_id);
    expect(e.retryable).toBe(false);
    expect(e.status).toBe(422);
    expect(e.canRetry).toBe(false);
  });

  it('reports a network failure as API_UNREACHABLE and retryable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const e = (await api.studies().catch((x: unknown) => x)) as ApiRequestError;
    expect(e).toBeInstanceOf(ApiRequestError);
    expect(e.code).toBe(API_UNREACHABLE);
    expect(e.canRetry).toBe(true);
  });

  it('uses a generic code when a non-2xx body is not an ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 502 })));
    const e = (await api.health().catch((x: unknown) => x)) as ApiRequestError;
    expect(e.code).toBe('UNEXPECTED_RESPONSE');
    expect(e.status).toBe(502);
  });

  it('builds 0-based slice URLs under the base path', () => {
    expect(sliceUrl('fx-study-001', 'fx-ser-01', 0)).toBe(
      '/api/studies/fx-study-001/series/fx-ser-01/slices/0',
    );
  });
});
