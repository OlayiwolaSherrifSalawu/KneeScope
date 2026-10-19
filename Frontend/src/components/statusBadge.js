import { h } from '../utils/dom.js';

/**
 * statusBadge — renders a status badge for analysis_status or finding status
 * @param {string} status - 'scored'|'failed'|'unavailable'|'unsupported'|'not_evaluated'|'not_run'|'analyzed'|'fixture'|...
 * @param {string} [label] - optional override label
 */
export function statusBadge(status, label) {
  const map = {
    scored:        { cls: 'badge-scored',        text: 'Scored' },
    failed:        { cls: 'badge-failed',         text: 'Failed' },
    unavailable:   { cls: 'badge-unavailable',    text: 'Unavailable' },
    unsupported:   { cls: 'badge-unsupported',    text: 'Not supported' },
    not_evaluated: { cls: 'badge-not-evaluated',  text: 'Not evaluated' },
    not_run:       { cls: 'badge-not-run',        text: 'Not run' },
    analyzed:      { cls: 'badge-analyzed',       text: 'Analyzed' },
    fixture:       { cls: 'badge-fixture',        text: 'Fixture' },
    draft:         { cls: 'badge-draft',          text: 'Draft' },
    published:     { cls: 'badge-published',      text: 'Published' },
    pass:          { cls: 'badge-pass',           text: 'PASS' },
    fail:          { cls: 'badge-fail',           text: 'FAIL' },
  };
  const info = map[status] || { cls: 'badge-not-evaluated', text: status || '—' };
  const badge = h('span', { class: `badge ${info.cls}` });
  badge.textContent = label || info.text;
  return badge;
}

/**
 * analysisStatusBadge — handles the study-level analysis_status field
 */
export function analysisStatusBadge(status) {
  if (!status || status === 'not_run') return statusBadge('not_run', 'Not run');
  if (status === 'analyzed') return statusBadge('analyzed', 'Analyzed');
  if (status === 'failed') return statusBadge('failed', 'Failed');
  return statusBadge('not_run', status);
}
