import { getStudy, getFindings, postPredictions, getExplanation, getLabels, getSliceUrl, fetchSliceError } from '../api/client.js';
import { AbortError } from '../api/errors.js';
import { createStore, asyncLoading, asyncDone, asyncError } from '../state/store.js';
import { h, empty } from '../utils/dom.js';
import { navbar } from '../components/navbar.js';
import { errorPanel } from '../components/errorPanel.js';
import { statusBadge } from '../components/statusBadge.js';
import { fixtureStripe } from '../components/fixtureStripe.js';
import { skeletonText } from '../components/skeleton.js';
import { announce, showToast } from '../components/toast.js';

export function reviewPage({ studyId }) {
  const ac = new AbortController();
  let analysisAc = null; // separate controller for analysis requests

  const store = createStore({
    study: { status: 'idle', data: null, error: null },
    findings: { status: 'idle', data: null, error: null },
    analysis: { status: 'idle', data: null, error: null },
    selectedFinding: null,
    explanation: { status: 'idle', data: null, error: null },
    labels: null,
    labelsRevealed: false,
    currentPlane: null,
    currentSeriesId: null,
    currentSliceIndex: 0,
    brightness: 1,
    predictionId: null,
    predictionModelVersion: null,
  });

  // ─── Root structure ──────────────────────────────────────────────────────────
  const root = document.createElement('div');
  root.id = 'review-page';

  const nav = navbar('/studies');
  root.appendChild(nav);

  const main = h('main', { class: 'page', id: 'main-content', style: { paddingTop: '20px' } });
  root.appendChild(main);

  // Breadcrumb
  const breadcrumb = h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' });
  const bcStudies = h('a', { href: '/' });
  bcStudies.textContent = 'Studies';
  const bcSep = document.createTextNode(' / ');
  const bcCurrent = h('span');
  bcCurrent.textContent = studyId;
  breadcrumb.append(bcStudies, bcSep, bcCurrent);
  main.appendChild(breadcrumb);

  // Study header
  const studyHeader = h('div', { class: 'study-header' });
  const studyHeaderLeft = h('div', { class: 'study-header-left' });
  const studyTitleEl = h('h1', { class: 'study-title' });
  studyTitleEl.textContent = '…';
  studyHeaderLeft.appendChild(studyTitleEl);

  const studyOriginEl = h('span');
  studyHeaderLeft.appendChild(studyOriginEl);

  const studyInfoEl = h('div', { class: 'study-info', style: { width: '100%' } });
  studyHeaderLeft.appendChild(studyInfoEl);

  studyHeader.appendChild(studyHeaderLeft);

  // Buttons
  const headerActions = h('div', { style: { display: 'flex', gap: '8px', flexShrink: '0', alignItems: 'center' } });
  const runBtn = h('button', {
    class: 'btn btn-primary btn-lg',
    id: 'run-analysis-btn',
    title: 'Run analysis (R)',
    'aria-label': 'Run analysis',
  });
  runBtn.innerHTML = '';
  const playIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  playIcon.setAttribute('viewBox', '0 0 24 24'); playIcon.setAttribute('width', '15'); playIcon.setAttribute('height', '15');
  playIcon.setAttribute('fill', 'currentColor');
  const playPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  playPath.setAttribute('points', '5 3 19 12 5 21 5 3');
  playIcon.appendChild(playPath);
  runBtn.appendChild(playIcon);
  runBtn.appendChild(document.createTextNode(' Run analysis'));
  headerActions.appendChild(runBtn);
  studyHeader.appendChild(headerActions);
  main.appendChild(studyHeader);

  // Study-level notices (missing planes, fixture)
  const noticesContainer = h('div', { style: { marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' } });
  main.appendChild(noticesContainer);

  // Analysis error container
  const analysisErrorContainer = h('div', { style: { marginBottom: '12px' } });
  main.appendChild(analysisErrorContainer);

  // Two-column layout
  const layout = h('div', { class: 'review-layout' });

  // ─── Left: Viewer ────────────────────────────────────────────────────────────
  const viewerCol = h('div');
  const viewerPanel = h('div', { class: 'viewer-panel', role: 'region', 'aria-label': 'MRI Slice Viewer' });

  // Viewer header (metadata)
  const viewerHeader = h('div', { class: 'viewer-header' });
  const viewerMetaLeft = h('div', { class: 'viewer-meta', id: 'viewer-meta-left' });
  viewerMetaLeft.textContent = '—';
  const viewerMetaRight = h('div', { class: 'viewer-meta', id: 'viewer-meta-right' });
  viewerMetaRight.textContent = '—';
  viewerHeader.append(viewerMetaLeft, viewerMetaRight);
  viewerPanel.appendChild(viewerHeader);

  // Plane tabs
  const planeTabs = h('div', { class: 'plane-tabs', role: 'tablist', 'aria-label': 'MRI planes' });
  viewerPanel.appendChild(planeTabs);

  // Series select row
  const seriesSelectRow = h('div', { class: 'series-select-row' });
  const seriesSelectLabel = h('label', { for: 'series-select', style: { flexShrink: '0' } });
  seriesSelectLabel.textContent = 'Series:';
  const seriesSelect = h('select', { class: 'series-select', id: 'series-select', 'aria-label': 'Select series' });
  seriesSelectRow.append(seriesSelectLabel, seriesSelect);
  viewerPanel.appendChild(seriesSelectRow);

  // Canvas/image area
  const canvasWrap = h('div', { class: 'viewer-canvas-wrap' });
  const sliceImg = h('img', {
    id: 'slice-img',
    alt: 'MRI slice',
    style: { display: 'none' },
  });
  const sliceCanvas = h('canvas', { id: 'slice-canvas', style: { display: 'none' } });
  const attentionCanvas = h('canvas', { class: 'attention-canvas', id: 'attention-canvas', style: { display: 'none' } });
  const viewerSpinner = h('div', { class: 'spinner spinner-dark', id: 'viewer-spinner', style: { display: 'none' } });
  const viewerError = h('div', { id: 'viewer-error', style: { display: 'none', padding: '20px', width: '100%' } });
  const overlayAnnotation = h('div', { class: 'viewer-overlay-annotation', id: 'viewer-overlay-annotation' });
  canvasWrap.append(sliceImg, sliceCanvas, attentionCanvas, viewerSpinner, viewerError, overlayAnnotation);
  viewerPanel.appendChild(canvasWrap);

  // Plane note
  const planeNote = h('div', { class: 'plane-note' });
  planeNote.textContent = 'Planes are separate acquisitions and are not spatially synchronised.';
  viewerPanel.appendChild(planeNote);

  // Display adjust (brightness)
  const displayAdjust = h('div', { class: 'display-adjust' });
  const adjustLabel = h('label', { for: 'adjust-slider' });
  adjustLabel.textContent = 'Display adjust:';
  const adjustSlider = h('input', {
    type: 'range',
    class: 'adjust-slider',
    id: 'adjust-slider',
    min: '0.2',
    max: '3',
    step: '0.05',
    value: '1',
    'aria-label': 'Brightness',
  });
  adjustSlider.addEventListener('input', () => {
    store.set({ brightness: parseFloat(adjustSlider.value) });
    applyBrightness();
  });
  displayAdjust.append(adjustLabel, adjustSlider);
  viewerPanel.appendChild(displayAdjust);

  // Slice controls
  const sliceControls = h('div', { class: 'slice-controls' });
  const sliceLabelRow = h('div', { class: 'slice-label' });
  const slicePositionLabel = h('span', { class: 'slice-label-text' });
  slicePositionLabel.textContent = 'Slice position';
  const slicePositionIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  slicePositionIcon.setAttribute('viewBox','0 0 24 24'); slicePositionIcon.setAttribute('width','12'); slicePositionIcon.setAttribute('height','12');
  slicePositionIcon.setAttribute('fill','none'); slicePositionIcon.setAttribute('stroke','currentColor'); slicePositionIcon.setAttribute('stroke-width','2');
  slicePositionIcon.style.color = 'var(--color-brand-light)';
  const spPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  spPath.setAttribute('d', 'M18 15l-6-6-6 6');
  slicePositionIcon.appendChild(spPath);
  const sliceCurrentLabel = h('span', { id: 'slice-current-label', style: { color: 'var(--color-brand-light)', fontWeight: '600' } });
  sliceCurrentLabel.textContent = 'Slice — / —';
  sliceLabelRow.append(slicePositionLabel, sliceCurrentLabel);
  sliceControls.appendChild(sliceLabelRow);

  const sliderRow = h('div', { class: 'slice-slider-row' });
  const prevBtn = h('button', { class: 'slice-arrow', id: 'slice-prev', 'aria-label': 'Previous slice' });
  prevBtn.textContent = '‹';
  const slider = h('input', {
    type: 'range',
    class: 'slice-slider',
    id: 'slice-slider',
    min: '0',
    max: '0',
    step: '1',
    value: '0',
    'aria-label': 'Slice position',
    'aria-valuemin': '0',
    'aria-valuemax': '0',
    'aria-valuenow': '0',
  });
  const nextBtn = h('button', { class: 'slice-arrow', id: 'slice-next', 'aria-label': 'Next slice' });
  nextBtn.textContent = '›';
  sliderRow.append(prevBtn, slider, nextBtn);
  sliceControls.appendChild(sliderRow);

  const sliceHint = h('div', { class: 'slice-hint' });
  const sliceHintLeft = h('span', { id: 'slice-hint-left' });
  const sliceHintRight = h('span', { id: 'slice-hint-right' });
  sliceHint.append(sliceHintLeft, sliceHintRight);
  sliceControls.appendChild(sliceHint);

  viewerPanel.appendChild(sliceControls);

  // Viewer footer (z position, etc.)
  const viewerFooter = h('div', { class: 'viewer-footer' });
  const footerLeft = h('div', { id: 'footer-left' });
  footerLeft.textContent = '';
  const footerRight = h('div', { id: 'footer-right' });
  footerRight.textContent = '';
  viewerFooter.append(footerLeft, footerRight);
  viewerPanel.appendChild(viewerFooter);

  // Study status bar
  const studyStatusBar = h('div', { class: 'study-status-bar', id: 'study-status-bar' });
  viewerPanel.appendChild(studyStatusBar);

  viewerCol.appendChild(viewerPanel);
  layout.appendChild(viewerCol);

  // ─── Right: Panels ───────────────────────────────────────────────────────────
  const rightCol = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } });

  // Findings panel
  const findingsPanel = h('div', { class: 'findings-panel', role: 'region', 'aria-label': 'Findings' });
  const findingsPanelHeader = h('div', { class: 'panel-header' });
  const findingsPanelTitle = h('div', { class: 'panel-title' });
  findingsPanelTitle.textContent = 'Findings';
  const findingsPanelCount = h('div', { class: 'panel-subtitle' });
  findingsPanelCount.textContent = '—';
  findingsPanelHeader.append(findingsPanelTitle, findingsPanelCount);
  findingsPanel.appendChild(findingsPanelHeader);
  const findingsList = h('div', { id: 'findings-list', role: 'list' });
  findingsPanel.appendChild(findingsList);

  // Analysis disclaimer
  const analysisDisclaimer = h('div', { class: 'analysis-disclaimer' });
  analysisDisclaimer.textContent = 'Model outputs are research scores only. Not for clinical use.';
  findingsPanel.appendChild(analysisDisclaimer);

  rightCol.appendChild(findingsPanel);

  // Explanation panel container
  const explanationContainer = h('div', { id: 'explanation-container' });
  rightCol.appendChild(explanationContainer);

  // Label reveal container
  const labelRevealContainer = h('div', { id: 'label-reveal-container' });
  rightCol.appendChild(labelRevealContainer);

  layout.appendChild(rightCol);
  main.appendChild(layout);

  // ─── State & refs ────────────────────────────────────────────────────────────
  let allSeries = [];
  let currentSeriesData = null;
  let prefetchCache = new Map(); // index -> objectURL
  let prefetchActive = new Set();
  let latestSliceLoad = 0; // for race condition prevention

  // ─── Viewer logic ────────────────────────────────────────────────────────────

  function applyBrightness() {
    const b = store.get('brightness');
    sliceImg.style.filter = `brightness(${b})`;
  }

  function updateSliceLabel(index, total) {
    sliceCurrentLabel.textContent = `Slice ${index + 1} / ${total}`;
    slider.setAttribute('aria-valuenow', index);
    slider.setAttribute('aria-valuetext', `Slice ${index + 1} of ${total}`);
  }

  async function loadSlice(studyId_, seriesId, index, animated = false) {
    const token = ++latestSliceLoad;

    viewerSpinner.style.display = 'block';
    empty(viewerError);
    viewerError.style.display = 'none';
    attentionCanvas.style.display = 'none';

    const url = getSliceUrl(studyId_, seriesId, index);
    const img = new Image();
    img.src = url;

    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = async () => {
        if (token !== latestSliceLoad) { resolve(); return; }
        // Re-fetch to read error body
        const apiErr = await fetchSliceError(studyId_, seriesId, index);
        if (token !== latestSliceLoad) { resolve(); return; }
        viewerSpinner.style.display = 'none';
        sliceImg.style.display = 'none';
        viewerError.style.display = 'block';
        if (apiErr) {
          viewerError.appendChild(errorPanel({ error: apiErr }));
        }
        resolve();
      };
    });

    if (token !== latestSliceLoad) return;
    viewerSpinner.style.display = 'none';
    sliceImg.src = url;
    sliceImg.style.display = 'block';
    applyBrightness();

    // Update overlay annotation
    overlayAnnotation.textContent = `${seriesId} • ${index}`;

    // Check if we should draw attention overlay
    const state = store.state;
    const expl = state.explanation.data;
    const predId = state.predictionId;
    const modelVer = state.predictionModelVersion;
    if (
      expl && expl.attention && Array.isArray(expl.attention) &&
      predId && modelVer &&
      state.currentSeriesId === seriesId
    ) {
      const attnEntry = expl.attention.find(a => a.slice_index === index && a.series_id === seriesId);
      if (attnEntry) {
        drawAttentionOverlay(attnEntry.data, img);
      }
    }

    // Prefetch neighbours
    prefetchNeighbours(studyId_, seriesId, index);
  }

  function drawAttentionOverlay(base64Data, srcImg) {
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      // Convert gray8 to RGBA
      const w = srcImg.naturalWidth || srcImg.width;
      const h_ = srcImg.naturalHeight || srcImg.height;
      if (!w || !h_) return;

      attentionCanvas.width = w;
      attentionCanvas.height = h_;
      attentionCanvas.style.width = sliceImg.offsetWidth + 'px';
      attentionCanvas.style.height = sliceImg.offsetHeight + 'px';
      attentionCanvas.style.display = 'block';

      const ctx = attentionCanvas.getContext('2d');
      const imgData = ctx.createImageData(w, h_);
      for (let i = 0; i < bytes.length; i++) {
        imgData.data[i * 4] = 255;     // R
        imgData.data[i * 4 + 1] = 0;   // G
        imgData.data[i * 4 + 2] = 0;   // B
        imgData.data[i * 4 + 3] = bytes[i]; // A
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('Failed to draw attention overlay:', e);
    }
  }

  function prefetchNeighbours(studyId_, seriesId, index) {
    if (!currentSeriesData) return;
    const total = currentSeriesData.num_slices;
    const neighbours = [index - 1, index + 1, index - 2, index + 2];
    for (const ni of neighbours) {
      if (ni < 0 || ni >= total) continue;
      if (prefetchCache.has(ni) || prefetchActive.has(ni)) continue;
      prefetchActive.add(ni);
      const img = new Image();
      img.src = getSliceUrl(studyId_, seriesId, ni);
      img.onload = () => {
        prefetchActive.delete(ni);
        prefetchCache.set(ni, true);
      };
      img.onerror = () => prefetchActive.delete(ni);
    }
  }

  function navigateSlice(delta) {
    if (!currentSeriesData) return;
    const total = currentSeriesData.num_slices;
    const cur = store.get('currentSliceIndex');
    const next = Math.max(0, Math.min(total - 1, cur + delta));
    if (next === cur) return;
    store.set({ currentSliceIndex: next });
    slider.value = next;
    updateSliceLabel(next, total);
    loadSlice(studyId, store.get('currentSeriesId'), next);
  }

  // Keyboard navigation
  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
      if (e.key !== 'r' && e.key !== 'R') return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateSlice(-1);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateSlice(1);
    } else if (e.key === 'r' || e.key === 'R') {
      if (e.target.tagName !== 'INPUT') {
        e.preventDefault();
        runAnalysis();
      }
    }
  }
  document.addEventListener('keydown', handleKeydown);

  // Scroll navigation on canvas
  canvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    navigateSlice(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // Slider
  slider.addEventListener('input', () => {
    const idx = parseInt(slider.value, 10);
    store.set({ currentSliceIndex: idx });
    if (currentSeriesData) {
      updateSliceLabel(idx, currentSeriesData.num_slices);
    }
    loadSlice(studyId, store.get('currentSeriesId'), idx);
  });

  prevBtn.addEventListener('click', () => navigateSlice(-1));
  nextBtn.addEventListener('click', () => navigateSlice(1));

  // Series select
  seriesSelect.addEventListener('change', () => {
    const seriesId = seriesSelect.value;
    store.set({ currentSeriesId: seriesId, currentSliceIndex: 0 });
    setupSeries(seriesId);
  });

  function setupSeries(seriesId) {
    const study = store.state.study.data;
    if (!study) return;
    const series = (study.series || []).find(s => s.series_id === seriesId);
    if (!series) return;
    currentSeriesData = series;
    prefetchCache.clear();
    prefetchActive.clear();

    // Set slider range
    const total = series.num_slices;
    slider.max = total - 1;
    slider.value = 0;
    slider.setAttribute('aria-valuemax', total - 1);

    // Slice hints
    const hintL = series.slice_labels?.first || '1';
    const hintR = series.slice_labels?.last || String(total);
    sliceHintLeft.textContent = `1 (${hintL})`;
    sliceHintRight.textContent = `${total} (${hintR})`;

    updateSliceLabel(0, total);
    store.set({ currentSliceIndex: 0 });

    // Update series select options display size using rendered_width/height
    if (series.rendered_width && series.rendered_height) {
      sliceImg.width = series.rendered_width;
      sliceImg.height = series.rendered_height;
    }

    // Update viewer header metadata
    viewerMetaLeft.textContent = [
      series.pulse_sequence,
      series.field_strength ? `${series.field_strength}T ${series.modality || ''}` : series.modality,
    ].filter(Boolean).join(' • ');

    const modelBadge = series.used_by_model ? 'INFERENCE READY' : 'NOT USED BY MODEL';
    viewerMetaRight.textContent = `${study.model_version || ''} • ${modelBadge}`;

    // Update footer
    footerLeft.textContent = series.fov ? `FOV ${series.fov}mm` : '';
    footerRight.textContent = series.slice_thickness ? `THK ${series.slice_thickness}mm` : '';

    // Load first slice
    loadSlice(studyId, seriesId, 0);
  }

  // ─── Plane tabs ──────────────────────────────────────────────────────────────
  function buildPlaneTabs(study) {
    empty(planeTabs);
    empty(seriesSelect);

    // Group series by plane
    const planeGroups = {};
    for (const s of (study.series || [])) {
      const plane = s.plane || 'null';
      if (!planeGroups[plane]) planeGroups[plane] = [];
      planeGroups[plane].push(s);
    }

    const planes = Object.keys(planeGroups).filter(p => p !== 'null');
    const usedByModel = planes.filter(p => planeGroups[p].some(s => s.used_by_model));
    const defaultPlane = usedByModel[0] || planes[0];

    for (const plane of planes) {
      const isUsedByModel = planeGroups[plane].some(s => s.used_by_model);
      const tab = h('button', {
        class: `plane-tab${plane === defaultPlane ? ' active' : ''}${!isUsedByModel ? ' no-model' : ''}`,
        role: 'tab',
        'aria-selected': plane === defaultPlane ? 'true' : 'false',
        title: !isUsedByModel ? 'Not used by model' : plane,
        id: `plane-tab-${plane}`,
      });
      tab.textContent = plane.charAt(0).toUpperCase() + plane.slice(1);
      if (!isUsedByModel) {
        const notUsedTag = h('span', { style: { fontSize: '9px', opacity: '0.7', marginLeft: '4px' } });
        notUsedTag.textContent = '*';
        tab.appendChild(notUsedTag);
      }
      tab.addEventListener('click', () => {
        store.set({ currentPlane: plane });
        // Update active state
        planeTabs.querySelectorAll('.plane-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        // Show series for this plane
        buildSeriesSelect(planeGroups[plane]);
      });
      planeTabs.appendChild(tab);
    }

    // Also add null-plane series to select
    if (defaultPlane) {
      store.set({ currentPlane: defaultPlane });
      buildSeriesSelect(planeGroups[defaultPlane]);
    }
  }

  function buildSeriesSelect(seriesList) {
    empty(seriesSelect);
    for (const s of seriesList) {
      const opt = document.createElement('option');
      opt.value = s.series_id;
      const label = [s.series_id, s.pulse_sequence, s.plane].filter(Boolean).join(' • ');
      opt.textContent = label;
      seriesSelect.appendChild(opt);
    }
    if (seriesList.length > 0) {
      const firstId = seriesList[0].series_id;
      store.set({ currentSeriesId: firstId });
      setupSeries(firstId);
    }
  }

  // ─── Findings panel ──────────────────────────────────────────────────────────
  function renderFindingsPanel(findings, analysisData) {
    empty(findingsList);
    const results = analysisData?.findings || {};

    findingsPanelCount.textContent = `${findings.length} structures`;

    for (const finding of findings) {
      const fid = finding.finding_id;
      const result = results[fid] || null;
      const isSelected = store.state.selectedFinding === fid;

      const row = h('div', {
        class: `finding-row${isSelected ? ' selected' : ''}`,
        role: 'listitem',
        tabindex: '0',
        id: `finding-row-${fid}`,
        'aria-selected': isSelected ? 'true' : 'false',
      });

      // Top row: name + badge + score
      const top = h('div', { class: 'finding-row-top' });

      const nameWrap = h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flex: '1' } });
      const nameEl = h('span', { class: 'finding-name' });
      nameEl.textContent = finding.display_name || finding.finding_id;
      nameWrap.appendChild(nameEl);

      if (!analysisData) {
        // Not run state
        const notRunBadge = h('span', { class: 'badge badge-not-run' });
        notRunBadge.textContent = 'Not run';
        nameWrap.appendChild(notRunBadge);
      } else if (result) {
        nameWrap.appendChild(renderStatusBadgeForResult(result));
      }
      top.appendChild(nameWrap);

      // Score display
      if (result && result.status === 'scored' && result.score !== undefined) {
        const scoreDisplay = h('div', { class: 'finding-score-display' });
        const scoreVal = h('span', { class: 'finding-score-value' });
        scoreVal.textContent = typeof result.score === 'number' ? result.score.toFixed(2) : '—';
        scoreDisplay.appendChild(scoreVal);
        top.appendChild(scoreDisplay);
      } else if (result && result.status !== 'scored') {
        const dashEl = h('span', { style: { color: 'var(--color-text-subtle)', fontSize: '13px' } });
        dashEl.textContent = '—';
        top.appendChild(dashEl);
      }

      row.appendChild(top);

      // Score bar
      if (result && result.status === 'scored' && result.score !== undefined) {
        const barWrap = h('div', { class: 'finding-score-bar-wrap', style: { marginBottom: '6px' } });
        const bar = h('div', { class: 'finding-score-bar' });
        bar.style.width = `${Math.max(2, Math.min(100, result.score * 100))}%`;
        barWrap.appendChild(bar);
        row.appendChild(barWrap);
      }

      // Score label / interpretation
      if (result && result.status === 'scored') {
        const scoreLabel = h('div', { class: 'finding-reason' });
        const scoreKind = result.score_kind;
        let prefix = 'Model score';
        if (scoreKind === 'calibrated_probability') prefix = 'Probability';
        const scoreText = result.score !== undefined ? `${prefix} ${result.score.toFixed(2)}` : prefix;
        scoreLabel.textContent = scoreText;

        if (result.label_display) {
          const labelSpan = h('span', { style: { color: 'var(--color-brand)', fontWeight: '600', marginLeft: '8px' } });
          labelSpan.textContent = result.label_display;
          scoreLabel.appendChild(labelSpan);
        }
        row.appendChild(scoreLabel);

        // Threshold
        if (result.threshold !== undefined && result.above_threshold !== undefined) {
          const threshEl = h('div', { class: 'finding-threshold' });
          threshEl.textContent = `Threshold: ${result.threshold} • ${result.above_threshold ? 'Above threshold' : 'Below threshold'}`;
          row.appendChild(threshEl);
        }
      }

      // Reason/message for non-scored
      if (result && result.reason?.message) {
        const reason = h('div', { class: 'finding-reason' });
        reason.textContent = result.reason.message;
        row.appendChild(reason);
      }

      // Provenance
      if (result && result.provenance) {
        const prov = result.provenance;
        const provRow = h('div', { class: 'finding-provenance' });

        if (prov.source) {
          const srcBadge = h('span', { class: `provenance-source provenance-${prov.source}` });
          srcBadge.textContent = prov.source;
          provRow.appendChild(srcBadge);
        }

        if (prov.model_version) {
          const mv = document.createElement('span');
          mv.textContent = prov.model_version;
          mv.style.cssText = 'font-size:11px;color:var(--color-text-subtle)';
          provRow.appendChild(mv);
        }

        row.appendChild(provRow);

        if (prov.notice) {
          const notice = h('div', { class: 'provenance-notice' });
          notice.textContent = prov.notice;
          row.appendChild(notice);
        }
      }

      // Warnings
      if (result && result.warnings && result.warnings.length > 0) {
        for (const w of result.warnings) {
          const warnEl = h('div', { class: 'warning-tag' });
          const warnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          warnIcon.setAttribute('viewBox','0 0 24 24'); warnIcon.setAttribute('width','11'); warnIcon.setAttribute('height','11');
          warnIcon.setAttribute('fill','none'); warnIcon.setAttribute('stroke','currentColor'); warnIcon.setAttribute('stroke-width','2');
          const wp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          wp.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
          warnIcon.appendChild(wp);
          warnEl.appendChild(warnIcon);
          const wText = document.createElement('span');
          wText.textContent = w.message || w;
          warnEl.appendChild(wText);
          row.appendChild(warnEl);
        }
      }

      // Click/keyboard to select
      const selectFinding = () => {
        store.set({ selectedFinding: fid });
        // Re-render findings (just update selected class)
        findingsList.querySelectorAll('.finding-row').forEach(r => {
          r.classList.remove('selected');
          r.setAttribute('aria-selected', 'false');
        });
        row.classList.add('selected');
        row.setAttribute('aria-selected', 'true');
        // Load explanation if applicable
        if (result && result.status === 'scored' && result.explanation_available && analysisData?.prediction_id) {
          loadExplanation(fid, analysisData.prediction_id);
        } else {
          empty(explanationContainer);
        }
      };

      row.addEventListener('click', selectFinding);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectFinding(); }
      });

      findingsList.appendChild(row);
    }

    // Calibration check row
    if (analysisData?.calibration_check) {
      const cc = analysisData.calibration_check;
      const calRow = h('div', { class: 'calibration-row' });
      const calIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      calIcon.setAttribute('viewBox','0 0 24 24'); calIcon.setAttribute('width','16'); calIcon.setAttribute('height','16');
      calIcon.setAttribute('fill','none'); calIcon.setAttribute('stroke','var(--color-brand)'); calIcon.setAttribute('stroke-width','2');
      const calP = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      calP.setAttribute('d', 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3');
      calIcon.appendChild(calP);
      const calText = h('div', { style: { flex: '1' } });
      const calTitle = document.createElement('div');
      calTitle.style.cssText = 'font-size:13px;font-weight:600';
      calTitle.textContent = 'Calibration Check';
      const calDesc = document.createElement('div');
      calDesc.style.cssText = 'font-size:12px;color:var(--color-text-muted)';
      calDesc.textContent = cc.message || '';
      calText.append(calTitle, calDesc);
      const calBadge = h('span', { class: `badge ${cc.passed ? 'badge-pass' : 'badge-fail'}` });
      calBadge.textContent = cc.passed ? 'PASS' : 'FAIL';
      calRow.append(calIcon, calText, calBadge);
      findingsList.appendChild(calRow);
    }
  }

  function renderStatusBadgeForResult(result) {
    const s = result.status;
    if (s === 'scored') return renderStatusBadge('scored', 'Scored');
    if (s === 'failed') return renderStatusBadge('failed', 'Failed');
    if (s === 'unavailable') return renderStatusBadge('unavailable', 'Unavailable');
    if (s === 'unsupported') return renderStatusBadge('unsupported', 'Not supported');
    if (s === 'not_evaluated') return renderStatusBadge('not_evaluated', 'Not evaluated');
    return renderStatusBadge('not_run', s || '—');
  }

  function renderStatusBadge(cls, text) {
    const badge = h('span', { class: `badge badge-${cls}` });
    badge.textContent = text;
    return badge;
  }

  // ─── Explanation panel ────────────────────────────────────────────────────────
  async function loadExplanation(findingId, predictionId) {
    empty(explanationContainer);
    const panel = buildExplanationPanel(null, 'loading');
    explanationContainer.appendChild(panel);

    try {
      const data = await getExplanation(studyId, findingId, predictionId, ac.signal);
      empty(explanationContainer);
      explanationContainer.appendChild(buildExplanationPanel(data, 'done'));
      store.set({ explanation: asyncDone(data) });
    } catch (err) {
      if (err.name === 'AbortError') return;
      empty(explanationContainer);
      if (err.code === 'EXPLANATION_UNAVAILABLE' || err.status === 404) {
        explanationContainer.appendChild(buildExplanationPanel(null, 'unavailable'));
      } else {
        explanationContainer.appendChild(buildExplanationPanel(null, 'error', err));
      }
    }
  }

  function buildExplanationPanel(data, phase, err) {
    const panel = h('div', { class: 'explanation-panel', role: 'region', 'aria-label': 'Influential slices' });
    const header = h('div', { class: 'panel-header' });
    const panelTitle = h('div', { class: 'panel-title' });
    panelTitle.textContent = 'Influential slices';
    const weightHint = h('div', { class: 'panel-subtitle' });
    weightHint.textContent = 'Weight [0–1.0]';
    header.append(panelTitle, weightHint);
    panel.appendChild(header);

    if (phase === 'loading') {
      const loadingEl = h('div', { style: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' } });
      for (let i = 0; i < 3; i++) loadingEl.appendChild(skeletonText(`${60 + i * 10}%`));
      panel.appendChild(loadingEl);
    } else if (phase === 'unavailable' || phase === 'error') {
      const msg = h('div', { style: { padding: '16px', fontSize: '13px', color: 'var(--color-text-muted)', fontStyle: 'italic' } });
      msg.textContent = 'Explanation unavailable.';
      panel.appendChild(msg);
    } else if (phase === 'done' && data) {
      // Influential slices
      if (data.slices && data.slices.length > 0) {
        for (const sl of data.slices) {
          const slRow = h('div', { class: 'influential-slice-row', tabindex: '0', 'aria-label': `Slice ${sl.slice_index + 1}` });
          const indicator = h('span', { style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-brand)', flexShrink: '0', display: 'inline-block' } });
          const labelEl = h('span', { class: 'influential-slice-label' });
          labelEl.textContent = `Slice ${sl.slice_index + 1}`;
          const tagEl = h('span', { class: 'influential-slice-tag' });
          tagEl.textContent = sl.label || '';
          const weightBarWrap = h('div', { class: 'weight-bar-wrap' });
          const weightBar = h('div', { class: 'weight-bar' });
          weightBar.style.width = `${Math.max(2, Math.min(100, (sl.weight || 0) * 100))}%`;
          weightBarWrap.appendChild(weightBar);
          const weightEl = h('span', { class: 'influential-slice-weight' });
          weightEl.textContent = typeof sl.weight === 'number' ? sl.weight.toFixed(2) : '—';
          slRow.append(indicator, labelEl, tagEl, weightBarWrap, weightEl);

          // Click to jump to slice
          slRow.addEventListener('click', () => {
            if (data.series_id) {
              // Find series
              const study = store.state.study.data;
              const targetSeries = (study?.series || []).find(s => s.series_id === data.series_id);
              if (targetSeries) {
                store.set({ currentSeriesId: data.series_id, currentSliceIndex: sl.slice_index });
                slider.value = sl.slice_index;
                if (currentSeriesData?.series_id !== data.series_id) {
                  setupSeries(data.series_id);
                } else {
                  updateSliceLabel(sl.slice_index, currentSeriesData.num_slices);
                  loadSlice(studyId, data.series_id, sl.slice_index);
                }
              }
            }
          });
          slRow.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slRow.click(); }
          });
          panel.appendChild(slRow);
        }
      }

      // Notice
      if (data.notice) {
        const notice = h('div', { class: 'explanation-notice' });
        notice.textContent = data.notice;
        panel.appendChild(notice);
      } else {
        const notice = h('div', { class: 'explanation-notice' });
        notice.textContent = "Shows what influenced the model score; it does not localise an injury.";
        panel.appendChild(notice);
      }
    }

    return panel;
  }

  // ─── Label reveal ─────────────────────────────────────────────────────────────
  function buildLabelRevealPanel() {
    empty(labelRevealContainer);
    const panel = h('div', { class: 'label-reveal-section', role: 'region', 'aria-label': 'Dataset label' });
    const header = h('div', { class: 'panel-header' });
    const titleEl = h('div', { class: 'panel-title' });
    titleEl.textContent = 'Dataset label (evaluation only)';
    const lockSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lockSvg.setAttribute('viewBox','0 0 24 24'); lockSvg.setAttribute('width','15'); lockSvg.setAttribute('height','15');
    lockSvg.setAttribute('fill','none'); lockSvg.setAttribute('stroke','currentColor'); lockSvg.setAttribute('stroke-width','2');
    lockSvg.style.color = 'var(--color-text-muted)';
    const lockR = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    lockR.setAttribute('x','3'); lockR.setAttribute('y','11'); lockR.setAttribute('width','18'); lockR.setAttribute('height','11'); lockR.setAttribute('rx','2'); lockR.setAttribute('ry','2');
    const lockArc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    lockArc.setAttribute('d', 'M7 11V7a5 5 0 0 1 10 0v4');
    lockSvg.append(lockR, lockArc);
    header.append(titleEl, lockSvg);
    panel.appendChild(header);

    const body = h('div', { style: { padding: '14px 16px' } });
    const labelsData = store.state.labels;
    const revealed = store.state.labelsRevealed;

    if (!revealed) {
      const revealBtn = h('button', {
        class: 'btn btn-secondary',
        id: 'reveal-label-btn',
        style: { gap: '6px' },
      });
      const eyeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      eyeSvg.setAttribute('viewBox','0 0 24 24'); eyeSvg.setAttribute('width','14'); eyeSvg.setAttribute('height','14');
      eyeSvg.setAttribute('fill','none'); eyeSvg.setAttribute('stroke','currentColor'); eyeSvg.setAttribute('stroke-width','2');
      const eyeP = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      eyeP.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
      const eyeC = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      eyeC.setAttribute('cx','12'); eyeC.setAttribute('cy','12'); eyeC.setAttribute('r','3');
      eyeSvg.append(eyeP, eyeC);
      revealBtn.append(eyeSvg, document.createTextNode('Reveal dataset label'));
      revealBtn.addEventListener('click', async () => {
        if (!labelsData) {
          try {
            const data = await getLabels(studyId, ac.signal);
            store.set({ labels: data, labelsRevealed: true });
          } catch (err) {
            if (err.name === 'AbortError') return;
            showToast('Failed to load labels: ' + err.message, 'error');
          }
        } else {
          store.set({ labelsRevealed: true });
        }
        buildLabelRevealPanel();
      });
      body.appendChild(revealBtn);
    } else if (labelsData) {
      // Show notice
      if (labelsData.notice) {
        const notice = h('div', { style: { fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '12px', padding: '8px 10px', background: 'var(--color-surface)', borderRadius: '4px', border: '1px solid var(--color-border)' } });
        notice.textContent = labelsData.notice;
        body.appendChild(notice);
      }
      // Show per-finding labels
      for (const [fid, label] of Object.entries(labelsData.findings || {})) {
        const row = h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-subtle)', fontSize: '13px' } });
        const fidName = document.createElement('span');
        fidName.style.color = 'var(--color-text)';
        fidName.textContent = fid;
        const labelState = h('span', { class: `label-state label-${label.state || 'not_labeled'}` });
        labelState.textContent = label.state === 'positive' ? 'Positive' :
                                  label.state === 'negative' ? 'Negative' :
                                  label.state === 'unknown' ? 'Unknown' : 'Not labeled';
        row.append(fidName, labelState);
        body.appendChild(row);
      }
    }

    panel.appendChild(body);
    labelRevealContainer.appendChild(panel);
  }

  // ─── Analysis ────────────────────────────────────────────────────────────────
  async function runAnalysis() {
    // Abort previous analysis
    if (analysisAc) {
      analysisAc.abort();
    }
    analysisAc = new AbortController();

    // Disable run button, show spinner
    runBtn.disabled = true;
    runBtn.textContent = '';
    const spin = h('div', { class: 'spinner' });
    runBtn.appendChild(spin);
    runBtn.appendChild(document.createTextNode(' Analysing…'));

    empty(analysisErrorContainer);
    store.set({ analysis: asyncLoading() });

    // Re-render findings in loading state
    const findings = store.state.findings.data;
    if (findings) renderFindingsPanel(findings, null);

    try {
      const result = await postPredictions({ study_id: studyId, findings: null, allow_cached: true }, analysisAc.signal);
      store.set({
        analysis: asyncDone(result),
        predictionId: result.prediction_id,
        predictionModelVersion: result.model_version,
      });
      announce('Analysis complete.');
      showToast('Analysis complete.', 'success');
      if (findings) renderFindingsPanel(findings, result);

      // Check fixture provenance
      if (result.provenance?.source === 'fixture') {
        empty(noticesContainer);
        noticesContainer.appendChild(fixtureStripe('Fixture result, not a model output.'));
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        store.set({ analysis: { status: 'idle', data: null, error: null } });
        return;
      }
      store.set({ analysis: asyncError(err) });
      // Study-level errors (422 etc.)
      empty(analysisErrorContainer);
      analysisErrorContainer.appendChild(errorPanel({ error: err, onRetry: runAnalysis }));
    } finally {
      runBtn.disabled = false;
      runBtn.innerHTML = '';
      runBtn.appendChild(playIcon.cloneNode(true));
      runBtn.appendChild(document.createTextNode(' Run analysis'));
    }
  }

  runBtn.addEventListener('click', runAnalysis);

  // ─── Load initial data ────────────────────────────────────────────────────────
  async function loadPage() {
    store.set({
      study: asyncLoading(),
      findings: asyncLoading(),
    });

    try {
      const [study, findingsData] = await Promise.all([
        getStudy(studyId, ac.signal),
        getFindings(ac.signal),
      ]);

      store.set({
        study: asyncDone(study),
        findings: asyncDone(findingsData.findings || findingsData),
      });

      // Update breadcrumb
      bcCurrent.textContent = study.label || studyId;

      // Update study header
      studyTitleEl.textContent = study.label || studyId;

      // Origin badge
      if (study.origin) {
        const ob = h('span', { class: `origin-badge${study.origin === 'clinical' ? ' origin-clinical' : ''}` });
        ob.textContent = study.origin.charAt(0).toUpperCase() + study.origin.slice(1);
        studyOriginEl.appendChild(ob);
      }

      // Study info line
      const infoParts = [
        study.modality,
        study.body_part,
        study.scanner && `${study.scanner}`,
        study.accession && `ACC: #${study.accession}`,
      ].filter(Boolean);
      studyInfoEl.textContent = infoParts.join(' • ');

      // Fixture notice
      if (study.origin === 'fixture') {
        noticesContainer.appendChild(fixtureStripe());
      }

      // Missing planes notice
      if (study.missing_planes && study.missing_planes.length > 0) {
        const mp = h('div', { class: 'missing-planes-notice' });
        const warnSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        warnSvg.setAttribute('viewBox','0 0 24 24'); warnSvg.setAttribute('width','15'); warnSvg.setAttribute('height','15');
        warnSvg.setAttribute('fill','none'); warnSvg.setAttribute('stroke','currentColor'); warnSvg.setAttribute('stroke-width','2');
        warnSvg.style.flexShrink = '0';
        const wp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        wp.setAttribute('d','M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
        warnSvg.appendChild(wp);
        const mpText = document.createElement('span');
        mpText.textContent = `Missing planes: ${study.missing_planes.join(', ')}`;
        mp.append(warnSvg, mpText);
        noticesContainer.appendChild(mp);
      }

      // Study-level warnings
      if (study.warnings && study.warnings.length > 0) {
        for (const w of study.warnings) {
          const warnDiv = h('div', { class: 'warning-tag', style: { fontSize: '12px' } });
          const wText = document.createElement('span');
          wText.textContent = w.message || w;
          warnDiv.appendChild(wText);
          noticesContainer.appendChild(warnDiv);
        }
      }

      // Study status bar
      const statusParts = [
        study.study_id && `STUDY-ID: ${study.study_id}`,
        study.series?.[0]?.series_id && `SERIES: ${study.series[0].series_id}`,
        study.checksum && `CHECKSUM: ${study.checksum}`,
      ].filter(Boolean);
      studyStatusBar.textContent = statusParts.join(' • ');

      // Build viewer
      const findings_ = findingsData.findings || findingsData;
      renderFindingsPanel(findings_, null);
      buildLabelRevealPanel();

      allSeries = study.series || [];
      buildPlaneTabs(study);

    } catch (err) {
      if (err.name === 'AbortError') return;
      // Show error in both columns
      studyTitleEl.textContent = studyId;
      main.appendChild(errorPanel({ error: err, onRetry: loadPage }));
    }
  }

  loadPage();

  return {
    element: root,
    cleanup() {
      ac.abort();
      if (analysisAc) analysisAc.abort();
      document.removeEventListener('keydown', handleKeydown);
    },
  };
}
