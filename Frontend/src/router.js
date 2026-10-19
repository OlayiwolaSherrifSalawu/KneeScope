/**
 * Minimal History API router with hash fallback.
 * Routes: '/' | '/studies/:studyId' | '/evaluation'
 */

const routes = [];
let currentCleanup = null;

export function addRoute(pattern, handler) {
  // Convert :param to named capture groups
  const regexStr = pattern
    .replace(/:[a-zA-Z]+/g, (m) => `(?<${m.slice(1)}>[^/]+)`)
    .replace(/\//g, '\\/');
  routes.push({ regex: new RegExp(`^${regexStr}$`), handler });
}

function resolve(path) {
  for (const { regex, handler } of routes) {
    const m = path.match(regex);
    if (m) {
      return { handler, params: m.groups || {} };
    }
  }
  return null;
}

export async function navigate(path, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  await dispatch(path);
}

async function dispatch(path) {
  // Abort previous page
  if (currentCleanup) {
    try { currentCleanup(); } catch {}
    currentCleanup = null;
  }

  const match = resolve(path);
  if (!match) {
    // Default to studies
    navigate('/', { replace: true });
    return;
  }

  const result = match.handler(match.params);
  if (result && typeof result.cleanup === 'function') {
    currentCleanup = result.cleanup;
  }
}

export function initRouter() {
  window.addEventListener('popstate', () => {
    dispatch(location.pathname + location.search);
  });

  // Intercept all internal <a> clicks
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) return;
    if (a.target === '_blank') return;
    e.preventDefault();
    navigate(href);
  });

  // Dispatch initial route
  dispatch(location.pathname + location.search);
}
