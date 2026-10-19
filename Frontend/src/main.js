import './style.css';
import { addRoute, initRouter } from './router.js';
import { studiesPage } from './pages/studies.js';
import { reviewPage } from './pages/review.js';
import { evaluationPage } from './pages/evaluation.js';
import { empty } from './utils/dom.js';

const appEl = document.getElementById('app');

function mount(pageFactory) {
  const result = pageFactory();
  empty(appEl);
  appEl.appendChild(result.element);
  return result;
}

// Register routes
addRoute('/', () => mount(studiesPage));

addRoute('/studies/:studyId', ({ studyId }) => {
  return mount(() => reviewPage({ studyId: decodeURIComponent(studyId) }));
});

addRoute('/evaluation', () => mount(evaluationPage));

// Start router
initRouter();
