/*
 * TEST DATA ONLY. The contract examples only cover fixture responses, so cached and live
 * responses are derived here from the fixture example, following the validators in
 * contracts/kneescope_contracts/models.py (live: computed_at + latency, no cache key;
 * cached: original computed_at + cache key, no latency; both: a checkpoint hash). These
 * objects are never shipped as fixtures and never produced by the app.
 */
import type { FindingResult, PredictionResponse } from '../api/types';
import { example } from './examples';

export const fixtureResponse = example<PredictionResponse>('prediction-fixture').body;

export const CHECKPOINT_SHA = 'ab12cd34ef56ab78cd90ef12ab34cd56ef78ab90cd12ef34ab56cd78ef90ab12';

const TEST_MODEL = {
  ...fixtureResponse.model,
  model_id: 'test-model',
  model_version: 'test-1.2.3',
  checkpoint_sha256: CHECKPOINT_SHA,
};

/** Fixture findings minus the one the "model" cannot score, so the response stays valid. */
const scoredFindings: FindingResult[] = fixtureResponse.findings
  .filter((f) => f.status === 'scored')
  .map((f) => ({ ...f }));

export function liveResponse(overrides: Partial<PredictionResponse> = {}): PredictionResponse {
  return {
    ...fixtureResponse,
    model: TEST_MODEL,
    findings: scoredFindings,
    provenance: {
      source: 'live',
      computed_at: '2026-03-04T10:11:12Z',
      latency_ms: 1234.4,
      cache_key: null,
      notice: null,
      served_at: '2026-03-04T10:11:12Z',
    },
    warnings: [],
    ...overrides,
  };
}

export function cachedResponse(overrides: Partial<PredictionResponse> = {}): PredictionResponse {
  return {
    ...fixtureResponse,
    model: TEST_MODEL,
    findings: scoredFindings,
    provenance: {
      source: 'cached',
      computed_at: '2026-02-01T08:30:00Z',
      latency_ms: null,
      cache_key: 'fx-study-001|test-1.2.3|ab12cd34|prep|interaction_prototype',
      notice: null,
      served_at: '2026-03-04T10:15:00Z',
    },
    warnings: [],
    ...overrides,
  };
}
