import type {
  ApiError,
  ApiErrorBody,
  Explanation,
  FindingProfile,
  Health,
  MetricsSnapshot,
  ModelCard,
  PredictionRequest,
  PredictionResponse,
  StudyDetail,
  StudyLabels,
  StudyList,
} from './types';

/** Code used when the request never reached the API (offline, refused, CORS, DNS). */
export const API_UNREACHABLE = 'API_UNREACHABLE';

export function apiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
  return base.replace(/\/+$/, '');
}

/** Typed error carrying the contract's ApiError body (contracts/README.md section 10). */
export class ApiRequestError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly detail: ApiErrorBody['detail'];

  constructor(init: {
    code: string;
    message: string;
    requestId?: string | null;
    retryable?: boolean;
    status?: number | null;
    detail?: ApiErrorBody['detail'];
  }) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.code = init.code;
    this.requestId = init.requestId ?? null;
    this.retryable = init.retryable ?? false;
    this.status = init.status ?? null;
    this.detail = init.detail ?? null;
  }

  /** Whether the UI should offer a retry action. */
  get canRetry(): boolean {
    return this.retryable || this.code === API_UNREACHABLE;
  }

  static fromBody(body: ApiError, status: number | null): ApiRequestError {
    const e = body.error;
    return new ApiRequestError({
      code: e.code,
      message: e.message,
      requestId: e.request_id,
      retryable: e.retryable,
      status,
      detail: e.detail,
    });
  }
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const e = (value as { error: unknown }).error;
  return (
    typeof e === 'object' &&
    e !== null &&
    typeof (e as ApiErrorBody).code === 'string' &&
    typeof (e as ApiErrorBody).message === 'string'
  );
}

/** Maps a non-2xx response body to an ApiRequestError. Unknown shapes get a generic code. */
export function toApiRequestError(status: number, body: unknown): ApiRequestError {
  if (isApiError(body)) return ApiRequestError.fromBody(body, status);
  return new ApiRequestError({
    code: 'UNEXPECTED_RESPONSE',
    message: `The API returned an unexpected response (HTTP ${status}).`,
    status,
    retryable: status >= 500,
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, init);
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiRequestError({
      code: API_UNREACHABLE,
      message: 'The KneeScope API could not be reached.',
      retryable: true,
    });
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw toApiRequestError(response.status, body);
  }
  return (await response.json()) as T;
}

const enc = encodeURIComponent;

type Opts = { signal?: AbortSignal };

export const api = {
  health: (o?: Opts) => request<Health>('/healthz', o),
  findings: (o?: Opts) => request<FindingProfile>('/findings', o),
  studies: (o?: Opts) => request<StudyList>('/studies', o),
  study: (studyId: string, o?: Opts) => request<StudyDetail>(`/studies/${enc(studyId)}`, o),
  /** The generated request type marks defaulted fields as required, so they are sent explicitly. */
  predict: (body: Pick<PredictionRequest, 'study_id' | 'findings'>, o?: Opts) =>
    request<PredictionResponse>('/predictions', {
      ...o,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_cached: true, ...body }),
    }),
  explanation: (studyId: string, findingId: string, predictionId: string, o?: Opts) =>
    request<Explanation>(
      `/studies/${enc(studyId)}/explanations/${enc(findingId)}?prediction_id=${enc(predictionId)}`,
      o,
    ),
  labels: (studyId: string, o?: Opts) => request<StudyLabels>(`/studies/${enc(studyId)}/labels`, o),
  metrics: (o?: Opts) => request<MetricsSnapshot>('/metrics', o),
  modelCard: (o?: Opts) => request<ModelCard>('/model-card', o),
};

/**
 * Asks the API why a slice image failed to load. An image element exposes no status, so the
 * same URL is fetched once on the error path to read the ApiError code. Never throws.
 */
export async function diagnoseSliceFailure(url: string): Promise<ApiRequestError> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return toApiRequestError(response.status, await response.json().catch(() => null));
    }
    return new ApiRequestError({
      code: 'IMAGE_DECODE_FAILED',
      message: 'The slice image could not be decoded.',
    });
  } catch {
    return new ApiRequestError({
      code: API_UNREACHABLE,
      message: 'The KneeScope API could not be reached.',
      retryable: true,
    });
  }
}

/** URL of the 8-bit PNG for a slice. `sliceIndex` is 0-based, as in the API. */
export function sliceUrl(studyId: string, seriesId: string, sliceIndex: number): string {
  return `${apiBaseUrl()}/studies/${enc(studyId)}/series/${enc(seriesId)}/slices/${sliceIndex}`;
}
