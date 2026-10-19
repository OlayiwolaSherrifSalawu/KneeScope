// API error types
export class ApiRequestError extends Error {
  /**
   * @param {object} params
   * @param {string} params.code
   * @param {string} params.message
   * @param {string|null} [params.requestId]
   * @param {boolean} [params.retryable]
   * @param {any} [params.detail]
   * @param {number} [params.status]
   */
  constructor({ code, message, requestId = null, retryable = false, detail = null, status = 0 }) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
    this.detail = detail;
    this.status = status;
    this.canRetry = retryable || code === 'API_UNREACHABLE';
  }
}

export class AbortError extends Error {
  constructor() {
    super('Request aborted');
    this.name = 'AbortError';
  }
}
