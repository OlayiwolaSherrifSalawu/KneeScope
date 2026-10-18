import type { ApiRequestError } from '../api/client';
import { StateGlyph } from './StateGlyph';

/** Error state per DESIGN.md section 10: title, API code, request id, retry when allowed. */
export function ErrorPanel({
  error,
  title,
  onRetry,
  id,
}: {
  error: ApiRequestError;
  title: string;
  onRetry?: () => void;
  id?: string;
}) {
  return (
    <div className="msg err" role="alert" id={id}>
      <StateGlyph status="failed" />
      <div>
        <h2>{title}</h2>
        <p>{error.message}</p>
        <p className="code-line">
          <span>{error.code}</span>
          {error.requestId ? <span> · request {error.requestId}</span> : null}
        </p>
        {error.canRetry && onRetry ? (
          <div className="actions">
            <button type="button" className="btn" onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
