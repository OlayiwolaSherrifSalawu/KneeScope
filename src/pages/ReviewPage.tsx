import { useCallback, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { FindingDefinition, Plane, StudyDetail, StudyList } from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import { checkOverlay, type ViewerPosition } from '../components/explanations/alignment';
import { ExplanationPanel } from '../components/explanations/ExplanationPanel';
import { useExplanation } from '../components/explanations/useExplanation';
import { FindingsPanel } from '../components/findings/FindingsPanel';
import { useAnalysis } from '../components/findings/useAnalysis';
import { useLabelReveal } from '../components/findings/useLabelReveal';
import { ViewerPanel, type JumpRequest } from '../components/viewer/ViewerPanel';
import { useAsync } from '../hooks/useAsync';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { SimulationController } from '../components/simulation/SimulationController';
import { MriImagePredictorModal } from '../components/simulation/MriImagePredictorModal';
import { ModelHubModal } from '../components/ModelHubModal';
import { customModelStore } from '../store/customModelStore';
import { Sparkles, Upload, Cpu } from 'lucide-react';

export function ReviewPage() {
  const { studyId = '' } = useParams();
  const study = useAsync<StudyDetail>(`study:${studyId}`, (signal) =>
    api.study(studyId, { signal }),
  );
  const profile = useAsync('findings', (signal) => api.findings({ signal }));
  const studiesList = useAsync<StudyList>('studies_all', (signal) => api.studies({ signal }));

  return (
    <>
      {study.phase === 'ready' && profile.phase === 'ready' ? (
        // Keyed by study: selection, analysis and revealed labels reset on study change.
        <Workspace
          key={study.data.study_id}
          study={study.data}
          definitions={profile.data.findings}
          studies={studiesList.data?.studies ?? []}
        />
      ) : (
        <div
          className="browser"
          aria-busy={study.phase === 'loading' || profile.phase === 'loading'}
        >
          {study.phase === 'error' ? (
            <ErrorPanel
              error={study.error}
              title="Study could not be loaded"
              onRetry={study.reload}
            />
          ) : profile.phase === 'error' ? (
            <ErrorPanel
              error={profile.error}
              title="Findings list could not be loaded"
              onRetry={profile.reload}
            />
          ) : (
            <p className="muted">Loading study…</p>
          )}
        </div>
      )}
    </>
  );
}

function Workspace({
  study,
  definitions,
  studies = [],
}: {
  study: StudyDetail;
  definitions: FindingDefinition[];
  studies?: any[];
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const [guideOpen, setGuideOpen] = useState(
    searchParams.get('sim') === 'true'
  );
  const [imageSimOpen, setImageSimOpen] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<'colab' | 'code' | 'model' | 'studies'>('colab');
  const { analysis, announcement, run } = useAnalysis(study.study_id);
  const labels = useLabelReveal(study.study_id);
  const result = analysis.phase === 'done' ? analysis.result : null;
  const findingIds = result
    ? result.findings.map((f) => f.finding_id)
    : definitions.map((d) => d.finding_id);
  const [selectedId, setSelectedId] = useState<string | null>(findingIds[0] ?? null);
  const selected = findingIds.includes(selectedId ?? '') ? selectedId : (findingIds[0] ?? null);
  const finding = result?.findings.find((f) => f.finding_id === selected) ?? null;
  const explanation = useExplanation(study.study_id, result?.prediction_id ?? null, finding);

  const [position, setPosition] = useState<ViewerPosition | null>(null);
  const onPosition = useCallback((p: ViewerPosition | null) => setPosition(p), []);
  const [jump, setJump] = useState<JumpRequest | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [opacity, setOpacity] = useState(0.6);

  const moveSelection = (delta: number) => {
    const i = findingIds.indexOf(selected ?? '');
    const next = findingIds[Math.min(Math.max(i + delta, 0), findingIds.length - 1)];
    if (next) setSelectedId(next);
  };
  useKeyboardShortcuts({
    r: () => {
      if (analysis.phase !== 'running') run();
    },
    '[': () => moveSelection(-1),
    ']': () => moveSelection(1),
  });

  const shownExplanation = explanation.phase === 'ready' ? explanation.explanation : null;
  const overlayCheck =
    result && shownExplanation && (shownExplanation.attention?.length ?? 0) > 0
      ? checkOverlay(shownExplanation, position, {
          predictionId: result.prediction_id,
          modelVersion: result.model.model_version,
        })
      : null;
  const overlay = overlayOn && overlayCheck?.ok ? { map: overlayCheck.map, opacity } : null;
  const onJump = (seriesId: string, plane: Plane, sliceIndex: number) =>
    setJump((j) => ({ seriesId, plane, sliceIndex, nonce: (j?.nonce ?? 0) + 1 }));

  const source = result ? result.provenance.source : null;
  const selectedName =
    result?.findings.find((f) => f.finding_id === selected)?.display_name ??
    definitions.find((d) => d.finding_id === selected)?.display_name ??
    null;

  // Study switcher options
  const defaultStudyOptions = [
    { id: 'real-study-001', label: 'real-study-001 • Real Knee MRI (images.jpeg)' },
    { id: 'fx-study-001', label: 'fx-study-001 • Primary Demo (ACL Tear + 3 Planes)' },
    { id: 'fx-study-002', label: 'fx-study-002 • Axial Plane Missing Case' },
    { id: 'fx-study-003', label: 'fx-study-003 • Preprocessing Error Resilience Test' },
    { id: 'fx-study-004', label: 'fx-study-004 • Sagittal Plane Missing Case' },
  ];
  const activeOptions =
    studies.length > 0
      ? studies.map((s) => ({
          id: s.study_id,
          label: `${s.study_id} • ${s.display_label}`,
        }))
      : defaultStudyOptions;

  const handleQuickImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        customModelStore.setUploadedImage('real-study-001', dataUrl);
        void fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ study_id: 'real-study-001', data_url: dataUrl }),
        }).catch(() => {});
        navigate('/studies/real-study-001');
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top Study & Mode Bar - ALWAYS visible */}
      <div className="flex flex-wrap items-center justify-between border-b border-[var(--ks-lb-line)] bg-[var(--ks-lb-panel)] px-3 py-1.5 text-xs text-[var(--ks-lb-text-muted)] gap-2 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <label htmlFor="study-switcher-select" className="text-[11px] font-mono text-[var(--ks-lb-dim)] uppercase tracking-wider">
              Study:
            </label>
            <select
              id="study-switcher-select"
              value={study.study_id}
              onChange={(e) => navigate(`/studies/${e.target.value}`)}
              className="field text-xs py-1 px-2 rounded bg-[var(--ks-lb-raised)] border border-[var(--ks-lb-line)] font-mono text-[var(--ks-lb-text)] cursor-pointer hover:border-[var(--ks-lb-accent)] transition-colors"
              title="Switch active study"
            >
              {activeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {study.study_id === 'real-study-001' ? (
            <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-500/80 font-mono text-[10px] font-bold">
              ★ Real Knee MRI (images.jpeg)
            </span>
          ) : study.study_id === 'fx-study-003' ? (
            <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-700/60 font-mono text-[10px]">
              Preprocessing Test Case
            </span>
          ) : null}

          <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-300 font-mono bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Background Model Ready
          </span>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={quickFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleQuickImageUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => setImageSimOpen(true)}
            className="btn text-xs inline-flex items-center gap-1.5 py-1 px-2.5 h-7 bg-emerald-950/60 text-emerald-300 border border-emerald-700 hover:bg-emerald-900/60 font-medium shadow-xs"
            title="Upload any knee MRI image to simulate reading and background model prediction"
          >
            <Upload className="h-3 w-3" />
            Upload & Simulate MRI
          </button>
          <button
            type="button"
            onClick={() => {
              setHubTab('model');
              setHubOpen(true);
            }}
            className="btn text-xs inline-flex items-center gap-1.5 py-1 px-2.5 h-7 bg-emerald-950/70 border border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/60 font-semibold shadow-xs"
            title="Feed your .onx or .onnx model weights directly into KneeScope"
          >
            <Cpu className="h-3 w-3 text-emerald-400" />
            Feed Model (.onx)
          </button>
          <button
            type="button"
            onClick={() => quickFileInputRef.current?.click()}
            className="btn text-xs inline-flex items-center gap-1.5 py-1 px-2.5 h-7 bg-[var(--ks-lb-raised)] border border-[var(--ks-lb-line)] hover:border-[var(--ks-lb-accent)]"
            title="Upload/replace active MRI image with a local file"
          >
            <Upload className="h-3 w-3" />
            Upload MRI File
          </button>
          {analysis.phase === 'error' ? (
            <button
              type="button"
              onClick={() => run({ forceSimulation: true })}
              className="btn primary text-xs inline-flex items-center gap-1.5 py-1 px-2.5 h-7 shadow-sm"
              title="Bypass error and run simulated ResNet-18 model inference"
            >
              <Sparkles className="h-3 w-3" />
              Simulated Fix & Run
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setGuideOpen((g) => !g)}
            className={`btn text-xs inline-flex items-center gap-1.5 py-1 px-2.5 h-7 ${
              guideOpen ? 'bg-[var(--ks-lb-accent)] text-[var(--ks-lb-on-accent)] font-bold' : 'text-[var(--ks-lb-accent)]'
            }`}
            title="Toggle 7-step interactive review workflow stepper"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {guideOpen ? 'Hide Guide' : '7-Step Guide'}
          </button>
        </div>
      </div>

      {/* Optional Collapsible Simulation Guide */}
      {guideOpen && (
        <div className="shrink-0 max-h-[38vh] overflow-y-auto border-b border-[var(--ks-lb-accent)]/40 bg-[var(--ks-lb-panel-raised)]">
          <SimulationController
            study={study}
            definitions={definitions}
            analysis={analysis}
            onRun={run}
            onJump={onJump}
            overlayOn={overlayOn}
            onToggleOverlay={setOverlayOn}
            onToggleLabel={labels.toggle}
            selectedFindingId={selected}
            onSelectFinding={setSelectedId}
            onClose={() => {
              setGuideOpen(false);
              if (searchParams.get('sim')) {
                searchParams.delete('sim');
                setSearchParams(searchParams);
              }
            }}
          />
        </div>
      )}

      <div className="workspace flex-1 min-h-0">
        <ViewerPanel
          study={study}
          fixtureStripe={study.origin === 'fixture' || source === 'fixture'}
          jump={jump}
          overlay={overlay}
          isAnalyzing={analysis.phase === 'running'}
          analysisStage={analysis.phase === 'running' ? analysis.stage : undefined}
          analysisProgress={analysis.phase === 'running' ? analysis.progress : undefined}
          onPosition={onPosition}
        />

        <FindingsPanel
          definitions={definitions}
          analysis={analysis}
          announcement={announcement}
          onRun={run}
          revealFor={labels.revealFor}
          onToggleLabel={labels.toggle}
          onRetryLabel={labels.retry}
          labelNotice={labels.notice}
          selectedId={selected}
          onSelect={setSelectedId}
          onSwitchCleanStudy={() => navigate('/studies/fx-study-001')}
          studyId={study.study_id}
        >
          <ExplanationPanel
            findingName={selectedName}
            state={explanation}
            overlay={overlayCheck}
            overlayOn={overlayOn}
            opacity={opacity}
            onToggleOverlay={setOverlayOn}
            onOpacity={setOpacity}
            onJump={onJump}
          />
        </FindingsPanel>
      </div>

      <ModelHubModal
        isOpen={hubOpen}
        onClose={() => setHubOpen(false)}
        initialTab={hubTab}
      />

      <MriImagePredictorModal
        isOpen={imageSimOpen}
        onClose={() => setImageSimOpen(false)}
        onSelectStudy={(id) => navigate(`/studies/${id}`)}
      />
    </div>
  );
}
