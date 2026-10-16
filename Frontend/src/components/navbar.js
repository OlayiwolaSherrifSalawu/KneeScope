import { h } from '../utils/dom.js';

/**
 * Navigation bar component
 * @param {string} activePath - current route path
 */
export function navbar(activePath = '/') {
  const nav = h('nav', { class: 'nav', role: 'navigation', 'aria-label': 'Main navigation' });
  const inner = h('div', { class: 'nav-inner' });

  // Logo
  const logo = h('a', { class: 'nav-logo', href: '/', style: { display: 'flex', alignItems: 'center' } });
  const logoImg = h('img', {
    src: '/logo.png',
    alt: 'KneeScope',
    style: { height: '35px', width: 'auto', display: 'block' },
  });
  logo.appendChild(logoImg);
  inner.appendChild(logo);

  // Links
  const links = h('div', { class: 'nav-links' });

  const studiesLink = h('a', {
    class: `nav-link${activePath === '/' || activePath.startsWith('/studies') ? ' active' : ''}`,
    href: '/',
    'aria-current': activePath === '/' || activePath.startsWith('/studies') ? 'page' : undefined,
  });
  studiesLink.textContent = 'Studies';
  links.appendChild(studiesLink);

  const evalLink = h('a', {
    class: `nav-link${activePath === '/evaluation' ? ' active' : ''}`,
    href: '/evaluation',
    'aria-current': activePath === '/evaluation' ? 'page' : undefined,
  });
  evalLink.textContent = 'Evaluation';
  links.appendChild(evalLink);

  inner.appendChild(links);

  // Avatar
  const avatar = h('div', { class: 'nav-avatar', 'aria-hidden': 'true' });
  const avatarSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  avatarSvg.setAttribute('viewBox', '0 0 24 24'); avatarSvg.setAttribute('width', '16'); avatarSvg.setAttribute('height', '16');
  avatarSvg.setAttribute('fill', 'none'); avatarSvg.setAttribute('stroke', 'white'); avatarSvg.setAttribute('stroke-width', '2');
  const userCircle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  userCircle.setAttribute('d', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z');
  avatarSvg.appendChild(userCircle);
  avatar.appendChild(avatarSvg);
  inner.appendChild(avatar);

  nav.appendChild(inner);
  return nav;
}
