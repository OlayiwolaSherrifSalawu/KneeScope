import { h } from '../utils/dom.js';

/**
 * skeleton — renders placeholder loading elements
 */
export function skeletonText(width = '100%') {
  const el = h('div', { class: 'skeleton skeleton-text' });
  el.style.width = width;
  return el;
}

export function skeletonBadge() {
  return h('div', { class: 'skeleton skeleton-badge' });
}

export function skeletonRow(cols = 5) {
  const tr = h('tr');
  for (let i = 0; i < cols; i++) {
    const td = h('td', { style: { padding: '14px 16px' } });
    td.appendChild(skeletonText(i === 0 ? '60%' : i === cols - 1 ? '50%' : '80%'));
    tr.appendChild(td);
  }
  return tr;
}

export function skeletonRows(count = 4, cols = 6) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    frag.appendChild(skeletonRow(cols));
  }
  return frag;
}

export function skeletonCard() {
  const card = h('div', { class: 'card', style: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' } });
  card.appendChild(skeletonText('40%'));
  card.appendChild(skeletonText('70%'));
  card.appendChild(skeletonText('55%'));
  return card;
}
