/**
 * Small DOM helper — creates elements with attrs and children
 * e.g. h('div', {class:'foo'}, h('span', {}, 'text'))
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'class') {
      el.className = v;
    } else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (v !== undefined && v !== null && v !== false) {
      el.setAttribute(k, String(v));
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      el.appendChild(child);
    }
  }
  return el;
}

/** Set text content safely (avoids innerHTML injection) */
export function setText(el, text) {
  el.textContent = text;
  return el;
}

/** Empty a container */
export function empty(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** Mount component in container */
export function mount(container, el) {
  empty(container);
  container.appendChild(el);
  return el;
}

/** Simple SVG icon from path data */
export function icon(pathD, { size = 16, className = '', strokeWidth = 1.5 } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', strokeWidth);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (className) svg.setAttribute('class', className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

/** Format a number to fixed decimal places, trimming trailing zeros */
export function fmtScore(n, digits = 2) {
  return parseFloat(n.toFixed(digits)).toString();
}

/** Clamp a value */
export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
