import { getStudies } from '../api/client.js';
import { AbortError } from '../api/errors.js';
import { createStore, asyncLoading, asyncDone, asyncError } from '../state/store.js';
import { h, empty } from '../utils/dom.js';
import { navbar } from '../components/navbar.js';
import { errorPanel } from '../components/errorPanel.js';
import { statusBadge, analysisStatusBadge } from '../components/statusBadge.js';
import { skeletonRows } from '../components/skeleton.js';

export function studiesPage() {
  const store = createStore({ studies: { status: 'idle', data: null, error: null }, filter: '' });
  const ac = new AbortController();

  // Build page structure
  const root = document.createElement('div');
  root.id = 'studies-page';

  const nav = navbar('/');
  root.appendChild(nav);

  const main = h('main', { class: 'page', id: 'main-content' });

  // Header row
  const headerRow = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' } });
  const titleBlock = h('div');
  const title = h('h1', { style: { fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--color-text)', margin: '0 0 4px' } });
  title.textContent = 'Studies';
  const subtitle = h('p', { style: { fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 } });
  subtitle.textContent = 'Diagnostic imaging series & synthetic evaluation fixtures';
  titleBlock.append(title, subtitle);
  headerRow.appendChild(titleBlock);

  // Fixture badge
  const fixturePill = h('div', { class: 'badge badge-fixture', style: { gap: '6px', padding: '5px 12px', fontSize: '12px' } });
  const listSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  listSvg.setAttribute('viewBox', '0 0 24 24'); listSvg.setAttribute('width', '13'); listSvg.setAttribute('height', '13');
  listSvg.setAttribute('fill', 'none'); listSvg.setAttribute('stroke', 'currentColor'); listSvg.setAttribute('stroke-width', '2');
  const lp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  lp.setAttribute('d', 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01');
  listSvg.appendChild(lp);
  fixturePill.appendChild(listSvg);
  fixturePill.appendChild(document.createTextNode('4 local test fixtures ready'));
  headerRow.appendChild(fixturePill);

  main.appendChild(headerRow);

  // Filter bar
  const filterBar = h('div', { class: 'filter-bar', style: { marginTop: '20px', marginBottom: '16px' } });
  const filterInput = h('input', {
    type: 'text',
    class: 'filter-input',
    placeholder: 'Filter studies…',
    'aria-label': 'Filter studies',
    id: 'study-filter',
  });
  filterInput.addEventListener('input', () => {
    store.set({ filter: filterInput.value.trim().toLowerCase() });
  });
  const clearBtn = h('button', { class: 'btn btn-ghost btn-sm', id: 'filter-clear', style: { display: 'none' } });
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', () => {
    filterInput.value = '';
    store.set({ filter: '' });
  });
  filterBar.append(filterInput, clearBtn);
  main.appendChild(filterBar);

  // Table card
  const card = h('div', { class: 'card table-container' });
  const table = h('table', { role: 'grid', 'aria-label': 'Studies list' });
  const thead = h('thead');
  thead.appendChild(h('tr', {},
    h('th', {}, 'Study'),
    h('th', {}, 'Origin'),
    h('th', {}, 'Planes'),
    h('th', {}, 'Series'),
    h('th', {}, 'Status'),
    h('th', {}, 'Action'),
  ));
  table.appendChild(thead);
  const tbody = h('tbody');
  table.appendChild(tbody);
  card.appendChild(table);
  main.appendChild(card);

  // Origin notice container
  const noticeContainer = h('div', { style: { marginTop: '10px', fontSize: '12px', color: 'var(--color-text-muted)' } });
  main.appendChild(noticeContainer);

  root.appendChild(main);

  // ─── Render functions ────────────────────────────────────────────────────────

  function renderSkeleton() {
    empty(tbody);
    tbody.appendChild(skeletonRows(4, 6));
  }

  function renderError(err) {
    empty(tbody);
    const tr = h('tr');
    const td = h('td', { colspan: '6', style: { padding: '20px' } });
    td.appendChild(errorPanel({ error: err, onRetry: load }));
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function renderStudies(data) {
    const { studies, origin_notice } = data;
    empty(noticeContainer);
    if (origin_notice) {
      const notice = document.createElement('p');
      notice.textContent = origin_notice;
      noticeContainer.appendChild(notice);
    }

    // Apply filter
    const filter = store.get('filter');
    const filtered = filter
      ? studies.filter(s =>
          (s.label || '').toLowerCase().includes(filter) ||
          (s.study_id || '').toLowerCase().includes(filter) ||
          (s.origin || '').toLowerCase().includes(filter)
        )
      : studies;

    // Show/hide clear button
    clearBtn.style.display = filter ? 'inline-flex' : 'none';

    empty(tbody);

    if (studies.length === 0) {
      const tr = h('tr');
      const td = h('td', { colspan: '6', style: { textAlign: 'center', padding: '60px 24px' } });
      const msg = document.createElement('p');
      msg.style.cssText = 'color:var(--color-text-muted);font-size:14px;margin:0';
      msg.textContent = 'No permitted studies found.';
      td.appendChild(msg);
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    if (filtered.length === 0 && filter) {
      const tr = h('tr');
      const td = h('td', { colspan: '6', style: { padding: '32px 16px' } });
      const wrap = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
      const msg = document.createElement('span');
      msg.style.cssText = 'color:var(--color-text-muted);font-size:14px';
      msg.textContent = `No studies match "${filterInput.value}".`;
      const clrBtn2 = h('button', { class: 'btn btn-secondary btn-sm', onClick: () => { filterInput.value = ''; store.set({ filter: '' }); } });
      clrBtn2.textContent = 'Clear filter';
      wrap.append(msg, clrBtn2);
      td.appendChild(wrap);
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    for (const study of filtered) {
      const tr = h('tr');

      // Study column
      const tdStudy = h('td');
      const studyWrap = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
      const docSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      docSvg.setAttribute('viewBox', '0 0 24 24'); docSvg.setAttribute('width', '15'); docSvg.setAttribute('height', '15');
      docSvg.setAttribute('fill', 'none'); docSvg.setAttribute('stroke', 'currentColor'); docSvg.setAttribute('stroke-width', '2');
      docSvg.style.color = 'var(--color-text-muted)';
      const dp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      dp.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6');
      docSvg.appendChild(dp);
      const labelEl = document.createElement('span');
      labelEl.style.cssText = 'font-weight:500;color:var(--color-text)';
      labelEl.textContent = study.label || study.study_id;
      studyWrap.append(docSvg, labelEl);
      tdStudy.appendChild(studyWrap);
      tr.appendChild(tdStudy);

      // Origin
      const tdOrigin = h('td');
      const originBadge = h('span', { class: `origin-badge${study.origin === 'clinical' ? ' origin-clinical' : ''}` });
      originBadge.textContent = study.origin ? (study.origin.charAt(0).toUpperCase() + study.origin.slice(1)) : '—';
      tdOrigin.appendChild(originBadge);
      tr.appendChild(tdOrigin);

      // Planes
      const tdPlanes = h('td');
      const planes = study.planes || [];
      if (planes.length > 0) {
        const planeWrap = h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } });
        for (const p of planes) {
          const chip = h('span', { class: 'plane-chip' });
          chip.textContent = p.charAt(0).toUpperCase() + p.slice(1);
          planeWrap.appendChild(chip);
        }
        tdPlanes.appendChild(planeWrap);
      } else {
        tdPlanes.textContent = '—';
        tdPlanes.style.color = 'var(--color-text-muted)';
      }
      tr.appendChild(tdPlanes);

      // Series count
      const tdSeries = h('td', { style: { color: 'var(--color-text-muted)', fontSize: '13px' } });
      const sc = Array.isArray(study.series) ? study.series.length : (study.series_count ?? '—');
      tdSeries.textContent = sc !== '—' ? `${sc} series` : '—';
      tr.appendChild(tdSeries);

      // Status
      const tdStatus = h('td');
      tdStatus.appendChild(analysisStatusBadge(study.analysis_status));
      tr.appendChild(tdStatus);

      // Action
      const tdAction = h('td');
      const openBtn = h('a', {
        href: `/studies/${encodeURIComponent(study.study_id)}`,
        class: 'btn btn-ghost',
        style: { color: 'var(--color-brand)', fontWeight: '600', fontSize: '13px', gap: '4px' },
        id: `open-study-${study.study_id}`,
      });
      openBtn.textContent = 'Open';
      const arrowSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      arrowSvg.setAttribute('viewBox', '0 0 24 24'); arrowSvg.setAttribute('width', '13'); arrowSvg.setAttribute('height', '13');
      arrowSvg.setAttribute('fill', 'none'); arrowSvg.setAttribute('stroke', 'currentColor'); arrowSvg.setAttribute('stroke-width', '2.5');
      const ap = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ap.setAttribute('d', 'M5 12h14M12 5l7 7-7 7');
      arrowSvg.appendChild(ap);
      openBtn.appendChild(arrowSvg);
      tdAction.appendChild(openBtn);
      tr.appendChild(tdAction);

      tbody.appendChild(tr);
    }
  }

  // ─── Store subscription ──────────────────────────────────────────────────────
  store.subscribe(({ state }) => {
    const { studies: asyncStudies, filter } = state;

    // Clear button visibility
    clearBtn.style.display = filter ? 'inline-flex' : 'none';

    if (asyncStudies.status === 'loading') {
      renderSkeleton();
    } else if (asyncStudies.status === 'error') {
      renderError(asyncStudies.error);
    } else if (asyncStudies.status === 'done') {
      renderStudies(asyncStudies.data);
    }
  });

  // ─── Load data ────────────────────────────────────────────────────────────────
  async function load() {
    store.set({ studies: asyncLoading() });
    try {
      const data = await getStudies(ac.signal);
      store.set({ studies: asyncDone(data) });
    } catch (err) {
      if (err.name === 'AbortError') return;
      store.set({ studies: asyncError(err) });
    }
  }

  load();

  return {
    element: root,
    cleanup() {
      ac.abort();
    },
  };
}
