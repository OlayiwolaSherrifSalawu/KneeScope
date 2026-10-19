import { ApiRequestError, AbortError } from './errors.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Core fetch wrapper. Maps errors to ApiRequestError.
 * Aborted requests throw AbortError (not surfaced as errors in UI).
 */
async function apiFetch(path, { signal, method = 'GET', body } = {}) {
  const url = `${BASE_URL}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err && (err.name === 'AbortError' || signal?.aborted)) {
      throw new AbortError();
    }
    throw new ApiRequestError({
      code: 'API_UNREACHABLE',
      message: `Unable to reach server at ${url}. Check network configuration or local proxy.`,
      retryable: true,
    });
  }

  if (response.ok) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return response.json();
    }
    return response;
  }

  // Error response - try to parse body
  const requestId = response.headers.get('X-Request-Id') || null;
  let errorBody = null;
  try {
    errorBody = await response.json();
  } catch {
    // unparseable
  }

  if (errorBody && errorBody.code) {
    throw new ApiRequestError({
      code: errorBody.code,
      message: errorBody.message || `Request failed with status ${response.status}`,
      requestId: errorBody.request_id || requestId,
      retryable: errorBody.retryable ?? false,
      detail: errorBody.detail ?? null,
      status: response.status,
    });
  }

  throw new ApiRequestError({
    code: 'UNEXPECTED_RESPONSE',
    message: `Unexpected response from server (HTTP ${response.status})`,
    requestId,
    retryable: response.status >= 500,
    status: response.status,
  });
}

// ─── Endpoint helpers ─────────────────────────────────────────────────────────

export async function getHealth(signal) {
  return apiFetch('/healthz', { signal });
}

export async function getFindings(signal) {
  return apiFetch('/findings', { signal });
}

export async function getStudies(signal) {
  return apiFetch('/studies', { signal });
}

export async function getStudy(studyId, signal) {
  return apiFetch(`/studies/${encodeURIComponent(studyId)}`, { signal });
}

/** Returns the raw fetch Response (PNG blob) */
export function getSliceUrl(studyId, seriesId, index) {
  return `${BASE_URL}/studies/${encodeURIComponent(studyId)}/series/${encodeURIComponent(seriesId)}/slices/${index}`;
}

/** Fetch slice and return as object URL for an <img>. Throws ApiRequestError on non-2xx. */
export async function fetchSlice(studyId, seriesId, index, signal) {
  const response = await apiFetch(
    `/studies/${encodeURIComponent(studyId)}/series/${encodeURIComponent(seriesId)}/slices/${index}`,
    { signal }
  );
  // apiFetch returns the raw Response for non-JSON content types
  if (response instanceof Response) {
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
  return response;
}

export async function postPredictions({ study_id, findings = null, allow_cached = true }, signal) {
  return apiFetch('/predictions', {
    signal,
    method: 'POST',
    body: { study_id, findings, allow_cached },
  });
}

export async function getExplanation(studyId, findingId, predictionId, signal) {
  return apiFetch(
    `/studies/${encodeURIComponent(studyId)}/explanations/${encodeURIComponent(findingId)}?prediction_id=${encodeURIComponent(predictionId)}`,
    { signal }
  );
}

export async function getLabels(studyId, signal) {
  return apiFetch(`/studies/${encodeURIComponent(studyId)}/labels`, { signal });
}

export async function getMetrics(signal) {
  return apiFetch('/metrics', { signal });
}

export async function getModelCard(signal) {
  return apiFetch('/model-card', { signal });
}

// Re-fetch a slice URL to read the API error body
export async function fetchSliceError(studyId, seriesId, index) {
  const url = `${BASE_URL}/studies/${encodeURIComponent(studyId)}/series/${encodeURIComponent(seriesId)}/slices/${index}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      if (body && body.code) {
        return new ApiRequestError({ code: body.code, message: body.message, requestId: body.request_id, retryable: body.retryable ?? false, detail: body.detail });
      }
      return new ApiRequestError({ code: 'UNEXPECTED_RESPONSE', message: `Slice load failed (HTTP ${resp.status})`, retryable: resp.status >= 500 });
    }
    return null;
  } catch {
    return new ApiRequestError({ code: 'API_UNREACHABLE', message: 'Unable to load slice image.', retryable: true });
  }
}
