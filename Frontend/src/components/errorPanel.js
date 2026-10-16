import { h } from '../utils/dom.js';

/**
 * ErrorPanel component
 * Shows error code, message, requestId, and optional Retry button.
 */
export function errorPanel({ error, onRetry } = {}) {
  if (!error) return null;

  const wrap = h('div', { class: 'error-panel', role: 'alert' });

  // Icon
  const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  iconSvg.setAttribute('viewBox', '0 0 24 24');
  iconSvg.setAttribute('width', '18');
  iconSvg.setAttribute('height', '18');
  iconSvg.setAttribute('fill', 'none');
  iconSvg.setAttribute('stroke', 'currentColor');
  iconSvg.setAttribute('stroke-width', '2');
  iconSvg.setAttribute('class', 'error-panel-icon');
  const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circ.setAttribute('cx', '12'); circ.setAttribute('cy', '12'); circ.setAttribute('r', '10');
  const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line1.setAttribute('x1', '12'); line1.setAttribute('y1', '8'); line1.setAttribute('x2', '12'); line1.setAttribute('y2', '12');
  const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line2.setAttribute('x1', '12'); line2.setAttribute('y1', '16'); line2.setAttribute('x2', '12.01'); line2.setAttribute('y2', '16');
  iconSvg.append(circ, line1, line2);
  wrap.appendChild(iconSvg);

  const body = h('div', { class: 'error-panel-body' });

  const codeEl = h('div', { class: 'error-panel-code' });
  codeEl.textContent = error.code || 'ERROR';
  body.appendChild(codeEl);

  const msgEl = h('div', { class: 'error-panel-message' });
  msgEl.textContent = error.message || 'An unexpected error occurred.';
  body.appendChild(msgEl);

  if (error.requestId) {
    const rid = h('div', { class: 'error-panel-request-id' });
    rid.textContent = `Request ID: ${error.requestId}`;
    body.appendChild(rid);
  }

  if (error.detail && typeof error.detail === 'string') {
    const detail = h('div', { class: 'error-panel-request-id', style: { marginTop: '4px', color: '#7f1d1d' } });
    detail.textContent = error.detail;
    body.appendChild(detail);
  }

  wrap.appendChild(body);

  if (error.canRetry && typeof onRetry === 'function') {
    const btn = h('button', {
      class: 'btn btn-sm btn-secondary',
      style: { flexShrink: '0', alignSelf: 'flex-start' },
      onClick: onRetry,
    });
    // Retry icon
    const retrySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    retrySvg.setAttribute('viewBox', '0 0 24 24'); retrySvg.setAttribute('width', '12'); retrySvg.setAttribute('height', '12');
    retrySvg.setAttribute('fill', 'none'); retrySvg.setAttribute('stroke', 'currentColor'); retrySvg.setAttribute('stroke-width', '2');
    const rp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    rp.setAttribute('d', 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15');
    retrySvg.appendChild(rp);
    btn.appendChild(retrySvg);
    btn.appendChild(document.createTextNode(' Retry'));
    wrap.appendChild(btn);
  }

  return wrap;
}
