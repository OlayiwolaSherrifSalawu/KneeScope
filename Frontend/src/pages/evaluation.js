import { getMetrics, getModelCard } from '../api/client.js';
import { AbortError } from '../api/errors.js';
import { createStore, asyncLoading, asyncDone, asyncError } from '../state/store.js';
import { h, empty } from '../utils/dom.js';
import { navbar } from '../components/navbar.js';
import { errorPanel } from '../components/errorPanel.js';
import { skeletonText, skeletonCard } from '../components/skeleton.js';

export function evaluationPage() {
  const ac = new AbortController();
  const store = createStore({
    metrics: { status: 'idle', data: null, error: null },
    modelCard: { status: 'idle', data: null, error: null },
  });

  // ─── Root ────────────────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'evaluation-page';
  root.appendChild(navbar('/evaluation'));

  const main = h('main', { class: 'page', id: 'main-content' });
  root.appendChild(main);

  // Header row
  const headerRow = h('div', {
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  });

  const titleWrap = h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } });
  const h1 = h('h1', { style: { fontSize: '24px', fontWeight: '700', letterSpacing: '-0.02em', margin: '0' } });
  h1.textContent = 'Evaluation';
  titleWrap.appendChild(h1);

  const versionBadge = h('span', { id: 'eval-version-badge', class: 'badge badge-not-run', style: { fontSize: '11px', padding: '3px 8px' } });
  versionBadge.textContent = '—';
  titleWrap.appendChild(versionBadge);
  headerRow.appendChild(titleWrap);

  const workerModeBadge = h('div', {
    id: 'worker-mode-badge',
    style: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '5px 10px' },
  });
  workerModeBadge.textContent = '';
  headerRow.appendChild(workerModeBadge);
  main.appendChild(headerRow);

  // Error panel area (top-level)
  const topErrorContainer = h('div', { id: 'eval-top-error', style: { marginBottom: '16px' } });
  main.appendChild(topErrorContainer);

  // ─── Metrics section ──────────────────────────────────────────────────────────
  const metricsSection = h('section', { 'aria-label': 'Validation Benchmarks', style: { marginBottom: '28px' } });

  const metricsSectionHeader = h('div', {
    class: 'card',
    style: { display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', marginBottom: '12px' },
  });
  const metricsIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  metricsIcon.setAttribute('viewBox', '0 0 24 24'); metricsIcon.setAttribute('width', '22'); metricsIcon.setAttribute('height', '22');
  metricsIcon.setAttribute('fill', 'none'); metricsIcon.setAttribute('stroke', 'var(--color-brand)'); metricsIcon.setAttribute('stroke-width', '1.5');
  const mPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  mPath.setAttribute('d', 'M9 17H5a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2h-4M12 3v13M5 8l7-5 7 5');
  metricsIcon.appendChild(mPath);
  metricsSectionHeader.appendChild(metricsIcon);

  const metricsTitleWrap = h('div', { style: { flex: '1' } });
  const metricsTitle = h('div', { style: { fontSize: '15px', fontWeight: '600' } });
  metricsTitle.textContent = 'Validation Benchmarks';
  const metricsSubtitle = h('div', { id: 'metrics-subtitle', style: { fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' } });
  metricsSubtitle.textContent = '—';
  metricsTitleWrap.append(metricsTitle, metricsSubtitle);
  metricsSectionHeader.appendChild(metricsTitleWrap);

  const runIdEl = h('div', { style: { fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' } });
  const runIdLabel = document.createElement('span');
  runIdLabel.textContent = 'RUN-ID:';
  runIdLabel.style.fontWeight = '600';
  const runIdVal = h('span', { id: 'metrics-run-id', style: { fontFamily: 'ui-monospace, monospace' } });
  runIdVal.textContent = 'N/A';
  runIdEl.append(runIdLabel, runIdVal);
  metricsSectionHeader.appendChild(runIdEl);

  metricsSection.appendChild(metricsSectionHeader);

  const metricsTableContainer = h('div', { id: 'metrics-table-container' });
  metricsSection.appendChild(metricsTableContainer);
  main.appendChild(metricsSection);

  // ─── Model card section ───────────────────────────────────────────────────────
  const modelCardSection = h('section', { 'aria-label': 'Model card' });
  const modelCardHeader = h('div', {
    style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  });
  const modelCardTitle = h('h2', { style: { fontSize: '18px', fontWeight: '700', margin: '0', letterSpacing: '-0.01em' } });
  modelCardTitle.textContent = 'Model card';
  const modelCardStatusBadge = h('span', { id: 'model-card-status-badge', class: 'badge badge-not-run' });
  modelCardStatusBadge.textContent = '—';
  modelCardHeader.append(modelCardTitle, modelCardStatusBadge);
  modelCardSection.appendChild(modelCardHeader);

  const modelCardBody = h('div', { id: 'model-card-body', class: 'card' });
  modelCardSection.appendChild(modelCardBody);
  main.appendChild(modelCardSection);

  // ─── Render metrics ───────────────────────────────────────────────────────────
  function renderMetricsLoading() {
    empty(metricsTableContainer);
    const wrap = h('div', { class: 'card', style: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' } });
    wrap.appendChild(skeletonText('40%'));
    wrap.appendChild(skeletonText('80%'));
    wrap.appendChild(skeletonText('60%'));
    metricsTableContainer.appendChild(wrap);
  }

  function renderMetricsError(err) {
    empty(metricsTableContainer);
    metricsTableContainer.appendChild(errorPanel({ error: err, onRetry: load }));
  }

  function renderMetrics(data) {
    empty(topErrorContainer);
    empty(metricsTableContainer);

    // Update run ID and subtitle
    runIdVal.textContent = data.run_id || 'N/A';
    if (data.model_version) {
      const mv = h('span', { style: { marginRight: '8px' } });
      mv.textContent = `Model: ${data.model_version}`;
      metricsSubtitle.textContent = '';
      metricsSubtitle.appendChild(mv);
    }
    if (data.dataset) {
      const ds = document.createElement('span');
      ds.textContent = `Dataset: ${data.dataset}`;
      metricsSubtitle.appendChild(ds);
    }

    // Version badge
    if (data.model_version) {
      versionBadge.textContent = data.model_version;
    }

    // Worker mode
    if (data.worker_mode) {
      empty(workerModeBadge);
      const dot = h('span', { style: { width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-brand)', display: 'inline-block' } });
      const wText = document.createElement('span');
      wText.textContent = data.worker_mode;
      workerModeBadge.append(dot, wText);
    }

    if (data.status === 'unavailable') {
      const emptyState = h('div', { class: 'card', style: { padding: '32px 20px', textAlign: 'center' } });
      const emptyIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      emptyIcon.setAttribute('viewBox', '0 0 24 24'); emptyIcon.setAttribute('width', '32'); emptyIcon.setAttribute('height', '32');
      emptyIcon.setAttribute('fill', 'none'); emptyIcon.setAttribute('stroke', 'var(--color-text-subtle)'); emptyIcon.setAttribute('stroke-width', '1.5');
      emptyIcon.style.marginBottom = '10px';
      const ep = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ep.setAttribute('d', 'M9 17H5a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2h-4M12 3v13');
      emptyIcon.appendChild(ep);
      const emptyTitle = h('div', { style: { fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '6px' } });
      emptyTitle.textContent = 'Metrics unavailable';
      const emptyDesc = h('div', { style: { fontSize: '13px', color: 'var(--color-text-muted)' } });
      emptyDesc.textContent = data.reason || 'No checkpoint has been trained and evaluated.';
      emptyState.append(emptyIcon, emptyTitle, emptyDesc);
      metricsTableContainer.appendChild(emptyState);

      // Show top-level error panel if there's an API error in data
      if (data.api_error) {
        topErrorContainer.appendChild(errorPanel({ error: data.api_error, onRetry: load }));
      }
      return;
    }

    // Summary info row
    const summaryRow = h('div', {
      class: 'card',
      style: { display: 'flex', gap: '24px', padding: '14px 20px', marginBottom: '12px', flexWrap: 'wrap', fontSize: '13px' },
    });
    const infoFields = [
      ['Partition', data.partition],
      ['Split method', data.split_method],
      ['Studies (n)', data.n_studies],
      ['Dataset', data.dataset],
    ];
    for (const [label, value] of infoFields) {
      if (value == null) continue;
      const field = h('div');
      const fl = document.createElement('div');
      fl.style.cssText = 'font-size:11px;font-weight:600;color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px';
      fl.textContent = label;
      const fv = document.createElement('div');
      fv.style.cssText = 'font-weight:600;color:var(--color-text)';
      fv.textContent = String(value);
      field.append(fl, fv);
      summaryRow.appendChild(field);
    }
    metricsTableContainer.appendChild(summaryRow);

    // Findings table
    if (data.findings && Object.keys(data.findings).length > 0) {
      const tableCard = h('div', { class: 'card table-container' });
      const table = h('table', { class: 'metrics-table', role: 'grid', 'aria-label': 'Per-finding metrics' });

      // Header
      const thead = h('thead');
      thead.appendChild(h('tr', {},
        h('th', {}, 'Finding'),
        h('th', {}, 'ROC AUC'),
        h('th', {}, 'PR AUC'),
        h('th', {}, 'Sensitivity'),
        h('th', {}, 'Specificity'),
        h('th', {}, 'Brier'),
      ));
      table.appendChild(thead);

      const tbody = h('tbody');
      for (const [findingId, metrics] of Object.entries(data.findings)) {
        const tr = h('tr');

        const tdName = h('td', { style: { fontWeight: '500' } });
        tdName.textContent = findingId;
        tr.appendChild(tdName);

        const metricKeys = ['roc_auc', 'pr_auc', 'sensitivity', 'specificity', 'brier'];
        for (const key of metricKeys) {
          const td = h('td');
          const val = metrics[key];
          if (val === undefined || val === null) {
            const notComputed = h('span', { class: 'metric-undefined', title: 'Not computed' });
            notComputed.textContent = 'N/A';
            if (metrics[`${key}_reason`]) {
              notComputed.title = metrics[`${key}_reason`];
            }
            td.appendChild(notComputed);
          } else if (val === 'undefined_single_class') {
            const undef = h('span', { class: 'metric-undefined' });
            undef.textContent = 'undefined';
            td.appendChild(undef);
          } else if (typeof val === 'object' && val.not_computed) {
            const nc = h('span', { class: 'metric-undefined', title: val.reason || 'Not computed' });
            nc.textContent = 'N/A';
            td.appendChild(nc);
          } else if (typeof val === 'number') {
            td.textContent = val.toFixed(3);
          } else {
            td.textContent = String(val);
          }
          tr.appendChild(td);
        }

        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableCard.appendChild(table);
      metricsTableContainer.appendChild(tableCard);
    }
  }

  // ─── Render model card ────────────────────────────────────────────────────────
  function renderModelCardLoading() {
    empty(modelCardBody);
    modelCardBody.style.padding = '20px';
    const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } });
    for (let i = 0; i < 3; i++) wrap.appendChild(skeletonCard());
    modelCardBody.appendChild(wrap);
  }

  function renderModelCardError(err) {
    empty(modelCardBody);
    modelCardBody.style.padding = '20px';
    modelCardBody.appendChild(errorPanel({ error: err, onRetry: load }));
  }

  // Section icon map
  const sectionIcons = {
    'Intended Use':                  'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    'Architecture & Training Data':  'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    'Known Limitations':             'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
    'Performance':                   'M18 20V10M12 20V4M6 20v-6',
    'Ethical Considerations':        'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  };

  function renderModelCard(data) {
    empty(modelCardBody);

    // Status badge
    if (data.status) {
      const badgeCls = data.status === 'published' ? 'badge-published' : 'badge-draft';
      modelCardStatusBadge.className = `badge ${badgeCls}`;
      modelCardStatusBadge.textContent = data.status.charAt(0).toUpperCase() + data.status.slice(1);
    }

    if (data.status === 'unavailable') {
      modelCardBody.style.padding = '32px 20px';
      modelCardBody.style.textAlign = 'center';
      const msg = document.createElement('p');
      msg.style.cssText = 'color:var(--color-text-muted);font-size:14px;margin:0';
      msg.textContent = data.reason || 'Model card unavailable.';
      modelCardBody.appendChild(msg);
      return;
    }

    // Render sections in order
    const sections = data.sections || [];
    for (const section of sections) {
      const sec = h('div', { class: 'model-card-section' });

      const secTitle = h('div', { class: 'model-card-section-title' });

      // Icon
      const iconPath = Object.entries(sectionIcons).find(([k]) => section.title?.includes(k))?.[1]
        || 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z';
      const iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      iconSvg.setAttribute('viewBox','0 0 24 24'); iconSvg.setAttribute('width','17'); iconSvg.setAttribute('height','17');
      iconSvg.setAttribute('fill','none'); iconSvg.setAttribute('stroke','var(--color-brand)'); iconSvg.setAttribute('stroke-width','1.5');
      iconSvg.style.flexShrink = '0';
      const ip = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ip.setAttribute('d', iconPath);
      iconSvg.appendChild(ip);
      secTitle.appendChild(iconSvg);

      const titleText = document.createElement('span');
      titleText.textContent = section.title || '';
      secTitle.appendChild(titleText);
      sec.appendChild(secTitle);

      // Content
      if (section.kind === 'limitations' && Array.isArray(section.items)) {
        const ul = h('ul', { class: 'model-card-list' });
        for (const item of section.items) {
          const li = document.createElement('li');
          li.textContent = item;
          ul.appendChild(li);
        }
        sec.appendChild(ul);
      } else if (section.content) {
        const content = h('div', { class: 'model-card-text' });
        content.textContent = section.content;
        sec.appendChild(content);
      }

      modelCardBody.appendChild(sec);
    }

    // If no sections, show basic info
    if (!sections.length && data.description) {
      const desc = h('div', { class: 'model-card-section' });
      const descText = h('div', { class: 'model-card-text' });
      descText.textContent = data.description;
      desc.appendChild(descText);
      modelCardBody.appendChild(desc);
    }
  }

  // ─── Load data ────────────────────────────────────────────────────────────────
  async function load() {
    store.set({
      metrics: asyncLoading(),
      modelCard: asyncLoading(),
    });
    renderMetricsLoading();
    renderModelCardLoading();

    // Load both in parallel, handle independently
    const [metricsResult, modelCardResult] = await Promise.allSettled([
      getMetrics(ac.signal),
      getModelCard(ac.signal),
    ]);

    // Metrics
    if (metricsResult.status === 'fulfilled') {
      store.set({ metrics: asyncDone(metricsResult.value) });
      renderMetrics(metricsResult.value);
    } else {
      const err = metricsResult.reason;
      if (err?.name === 'AbortError') return;
      store.set({ metrics: asyncError(err) });

      // Show in top error panel + empty state in metrics
      topErrorContainer.appendChild(errorPanel({ error: err, onRetry: load }));
      const unavailableData = {
        status: 'unavailable',
        reason: err.message,
        run_id: null,
      };
      renderMetrics(unavailableData);
    }

    // Model card
    if (modelCardResult.status === 'fulfilled') {
      store.set({ modelCard: asyncDone(modelCardResult.value) });
      renderModelCard(modelCardResult.value);
    } else {
      const err = modelCardResult.reason;
      if (err?.name === 'AbortError') return;
      store.set({ modelCard: asyncError(err) });
      renderModelCardError(err);
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
