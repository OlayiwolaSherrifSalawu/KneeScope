import { h } from '../utils/dom.js';

/**
 * fixtureStripe — amber diagonal-stripe bar for fixture data
 * Announces to aria-live.
 */
export function fixtureStripe(message = 'Fixture result, not a model output.') {
  // Announce to live region
  const liveRegion = document.getElementById('live-region');
  if (liveRegion) {
    liveRegion.textContent = '';
    requestAnimationFrame(() => {
      liveRegion.textContent = message;
    });
  }

  const bar = h('div', { class: 'fixture-stripe', role: 'status', 'aria-label': message });

  // Warning icon
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '16'); svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.style.flexShrink = '0';
  const tri = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  tri.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
  const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l1.setAttribute('x1','12'); l1.setAttribute('y1','9'); l1.setAttribute('x2','12'); l1.setAttribute('y2','13');
  const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l2.setAttribute('x1','12'); l2.setAttribute('y1','17'); l2.setAttribute('x2','12.01'); l2.setAttribute('y2','17');
  svg.append(tri, l1, l2);
  bar.appendChild(svg);

  const text = document.createElement('span');
  text.textContent = message;
  bar.appendChild(text);

  return bar;
}
