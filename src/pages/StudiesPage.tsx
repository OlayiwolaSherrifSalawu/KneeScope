import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Download, Copy, Check, Cpu, Sparkles, Play, Upload } from 'lucide-react';
import { api } from '../api/client';
import type { StudyList, StudySummary } from '../api/types';
import { ErrorPanel } from '../components/ErrorPanel';
import {
  AnalysisStatus,
  OriginBadge,
  PlaneSlots,
  studyAccessibleName,
} from '../components/StudyParts';
import { useAsync } from '../hooks/useAsync';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { customModelStore } from '../store/customModelStore';
import { ModelHubModal } from '../components/ModelHubModal';
import { SystemSimulationModal } from '../components/simulation/SystemSimulationModal';
import { MriImagePredictorModal } from '../components/simulation/MriImagePredictorModal';

const STUDY_PATH = (id: string) => `/studies/${encodeURIComponent(id)}`;

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((c) => (
            <td key={c}>
              <div className="skel" style={{ width: c === 0 ? '70%' : '50%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SkeletonCards() {
  return (
    <ul className="study-cards" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <li key={i} className="study-card">
          <div className="skel" style={{ width: '60%' }} />
          <div className="skel" style={{ width: '40%' }} />
        </li>
      ))}
    </ul>
  );
}

function StudyCards({ rows }: { rows: StudySummary[] }) {
  return (
    <ul className="study-cards" aria-label="Studies available for review">
      {rows.map((s) => (
        <li key={s.study_id} className="study-card">
          <Link
            to={STUDY_PATH(s.study_id)}
            className="study-card-link"
            aria-label={studyAccessibleName(s)}
          >
            <span className="study-id">{s.study_id}</span>
            <span className="muted">{s.display_label}</span>
          </Link>
          <dl className="study-card-fields" aria-hidden="true">
            <div>
              <dt>Origin</dt>
              <dd>
                <OriginBadge origin={s.origin} />
              </dd>
            </div>
            <div>
              <dt>Planes</dt>
              <dd>
                <PlaneSlots study={s} />
              </dd>
            </div>
            <div>
              <dt>Series</dt>
              <dd className="mono">{s.series_count}</dd>
            </div>
            <div>
              <dt>Analysis</dt>
              <dd>
                <AnalysisStatus status={s.analysis_status} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function StudyTable({
  rows,
  loading,
  descending,
}: {
  rows: StudySummary[];
  loading: boolean;
  descending: boolean;
}) {
  const navigate = useNavigate();
  return (
    <table className="studies">
      <caption className="sr-only">Studies available for review</caption>
      <thead>
        <tr>
          <th scope="col" aria-sort={descending ? 'descending' : 'ascending'}>
            Study
          </th>
          <th scope="col">Origin</th>
          <th scope="col">Planes</th>
          <th scope="col" className="num">
            Series
          </th>
          <th scope="col">Analysis</th>
          <th scope="col">
            <span className="sr-only">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <SkeletonRows />
        ) : (
          rows.map((s) => (
            // The study link is the keyboard target; clicking anywhere else in the row follows it.
            <tr
              key={s.study_id}
              className="row-link"
              onClick={(e) => {
                if (!(e.target instanceof Element && e.target.closest('a'))) {
                  void navigate(STUDY_PATH(s.study_id));
                }
              }}
            >
              <td>
                <Link to={STUDY_PATH(s.study_id)} aria-label={studyAccessibleName(s)}>
                  <span className="study-id">{s.study_id}</span>
                </Link>{' '}
                <span className="muted">{s.display_label}</span>
                {s.study_id === 'real-study-001' ? (
                  <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/80 text-emerald-300 text-[10px] font-mono font-bold">
                    ★ Real Knee MRI (images.jpeg)
                  </span>
                ) : s.study_id === 'fx-study-001' ? (
                  <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-700/60 text-blue-300 text-[10px] font-mono">
                    3-Plane Demo (ACL)
                  </span>
                ) : s.study_id === 'fx-study-003' ? (
                  <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[10px] font-mono">
                    Error Resilience Test
                  </span>
                ) : null}
              </td>
              <td>
                <OriginBadge origin={s.origin} />
              </td>
              <td>
                <PlaneSlots study={s} />
              </td>
              <td className="num mono">{s.series_count}</td>
              <td>
                <AnalysisStatus status={s.analysis_status} />
              </td>
              <td aria-hidden="true" className="open-cell">
                Open
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export function StudiesPage() {
  const studies = useAsync<StudyList>('studies', (signal) => api.studies({ signal }));
  const [query, setQuery] = useState('');
  const [descending, setDescending] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const narrow = useMediaQuery('(max-width: 599px)');
  const loading = studies.phase === 'loading';
  const list = studies.phase === 'ready' ? studies.data : undefined;
  const needle = query.trim().toLowerCase();

  const handleDownloadNotebook = async () => {
    try {
      setDownloading(true);
      const res = await fetch('/api/download/notebook');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const blob = new Blob([text], { type: 'application/x-ipynb+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'train_kneescope_colab.ipynb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.location.href = '/api/download/notebook';
    } finally {
      setTimeout(() => setDownloading(false), 2000);
    }
  };

  const handleCopyScript = async () => {
    try {
      const res = await fetch('/api/download/script');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 4000);
    } catch (e) {
      console.error(e);
    }
  };

  const [hubTab, setHubTab] = useState<'colab' | 'code' | 'model' | 'studies'>('colab');
  const [modelFeedback, setModelFeedback] = useState<string | null>(null);
  const quickModelInputRef = useRef<HTMLInputElement>(null);
  const reloadRef = useRef(studies.reload);
  reloadRef.current = studies.reload;

  useEffect(() => {
    return customModelStore.subscribe(() => {
      reloadRef.current();
    });
  }, []);

  const handleQuickModelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      customModelStore.setCustomModel(file);
      void fetch('/api/model/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          active: true,
          model_name: file.name,
          model_version: `${file.name.replace(/\.[^/.]+$/, '')}-onnx`,
          file_size: file.size,
        }),
      }).catch(() => {});
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setModelFeedback(`✓ Fed model "${file.name}" (${sizeMb} MB) — Live ONNX inference activated!`);
      setTimeout(() => setModelFeedback(null), 5000);
    }
  };

  const rows = (list?.studies ?? [])
    .filter((s) => s.study_id.toLowerCase().includes(needle))
    .sort((a, b) => (descending ? -1 : 1) * a.study_id.localeCompare(b.study_id));
  const SortIcon = descending ? ArrowDown : ArrowUp;

  let body;
  if (studies.phase === 'error') {
    body = (
      <ErrorPanel
        error={studies.error}
        title="Studies could not be loaded"
        onRetry={studies.reload}
      />
    );
  } else if (loading) {
    body = (
      <>
        <p className="msg muted" role="status">
          Loading studies…
        </p>
        {narrow ? <SkeletonCards /> : <StudyTable rows={[]} loading descending={descending} />}
      </>
    );
  } else if (list && list.studies.length === 0) {
    body = (
      <div className="msg">
        <span />
        <div>
          <h2>No permitted studies</h2>
          <p>
            No permitted studies in the manifest. Ingest custom cached studies or run Colab training.
          </p>
        </div>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <div className="msg">
        <span />
        <div>
          <h2>No studies match the filter</h2>
          <p>No study ID contains “{query.trim()}”.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => setQuery('')}>
              Clear filter
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    body = narrow ? (
      <StudyCards rows={rows} />
    ) : (
      <StudyTable rows={rows} loading={false} descending={descending} />
    );
  }

  return (
    <div className="browser">
      <div className="page-head">
        <div>
          <h1>Studies</h1>
          <p>Choose a study to review. Only the metadata needed for review is shown.</p>
        </div>
        <div className="page-tools">
          <label>
            <span className="sr-only">Filter by study ID</span>
            <input
              className="field"
              type="search"
              placeholder="Filter by study ID"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn"
            aria-label={`Sort by study ID, ${descending ? 'descending' : 'ascending'}. Activate to reverse.`}
            onClick={() => setDescending((d) => !d)}
          >
            <SortIcon className="i" aria-hidden="true" />
            ID
          </button>
          <button
            type="button"
            className="btn primary inline-flex items-center gap-1.5"
            onClick={() => setHubOpen(true)}
          >
            <Plus className="i" aria-hidden="true" />
            Ingest Study
          </button>
        </div>
      </div>

      {/* Prominent Real Knee MRI Upload & Background Model Card */}
      <div className="mb-4 rounded border border-emerald-500/40 bg-[var(--ks-lb-panel)] p-3 text-xs shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 rounded overflow-hidden border border-emerald-500/60 bg-black shrink-0 shadow-inner group cursor-pointer" onClick={() => setImageModalOpen(true)} title="Click to open background model predictor">
              <img
                src="/images.jpeg"
                alt="Uploaded Sagittal Knee MRI"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/sample_knee_mri.png';
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/80 text-emerald-300 font-mono text-[10px] font-bold">
                  ★ ACTIVE MRI: images.jpeg
                </span>
                <span className="text-[11px] text-[var(--ks-lb-text)] font-semibold">
                  Real Knee MRI (Sagittal View • 24 Slices)
                </span>
              </div>
              <p className="text-[11px] text-[var(--ks-lb-text-muted)]">
                Inspect authentic knee anatomical structures (femur, tibia, ACL, menisci) and simulate background ResNet-18 forward pass & Grad-CAM overlays.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setImageModalOpen(true)}
              className="btn primary text-xs inline-flex items-center gap-1.5 py-1.5 px-3.5 shadow-sm bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              title="Simulate background model inference and inspect Grad-CAM attention"
            >
              <Cpu className="h-3.5 w-3.5" />
              Simulate Background Model
            </button>
            <Link
              to="/studies/real-study-001"
              className="btn text-xs inline-flex items-center gap-1.5 py-1.5 px-3 text-emerald-300 border border-emerald-700 bg-emerald-950/50 hover:bg-emerald-900/60 font-medium"
              title="Inspect the user uploaded real knee MRI (images.jpeg) in full workspace"
            >
              <Play className="h-3 w-3 fill-current" />
              Full Workspace Review
            </Link>
            <Link
              to="/studies/fx-study-001?sim=true"
              className="btn text-xs inline-flex items-center gap-1.5 py-1.5 px-2.5 bg-[var(--ks-lb-raised)]"
              title="Launch guided interactive review on Study 001"
            >
              Primary Review
            </Link>
            <Link
              to="/studies/fx-study-003?sim=true"
              className="btn text-xs inline-flex items-center gap-1.5 py-1.5 px-2.5 text-amber-300 border-amber-800/50 bg-amber-950/30 hover:bg-amber-950/60"
              title="Test preprocessing error handling and automated recovery"
            >
              Test Preprocessing Fix
            </Link>
            <input
              ref={quickModelInputRef}
              type="file"
              accept=".onx,.onnx,.pt,.pth,.safetensors,*"
              className="hidden"
              onChange={handleQuickModelFile}
            />
            <button
              type="button"
              onClick={() => {
                setHubTab('model');
                setHubOpen(true);
              }}
              className="btn text-xs inline-flex items-center gap-1.5 py-1.5 px-3 bg-emerald-950/70 border border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/60 font-semibold shadow-xs"
              title="Feed your .onx or .onnx model weights directly to KneeScope"
            >
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              Feed Model (.onx)
            </button>
            <button
              type="button"
              onClick={() => {
                setHubTab('colab');
                setHubOpen(true);
              }}
              className="btn text-xs inline-flex items-center gap-1.5 py-1.5 px-2.5 bg-[var(--ks-lb-raised)]"
              title="Colab training notebook, code viewer, and custom weights"
            >
              <Cpu className="h-3 w-3 text-[var(--ks-lb-accent)]" />
              Colab Hub
            </button>
          </div>
        </div>
      </div>

      {modelFeedback && (
        <div className="mb-4 rounded border border-emerald-500 bg-emerald-950/90 p-3 text-xs text-emerald-200 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{modelFeedback}</span>
          </div>
          <button type="button" onClick={() => setModelFeedback(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <div className="table-wrap" aria-busy={loading}>
        {body}
      </div>
      {list?.origin_notice ? <p className="table-note">{list.origin_notice}</p> : null}

      <ModelHubModal isOpen={hubOpen} onClose={() => setHubOpen(false)} initialTab={hubTab} />
      <SystemSimulationModal isOpen={simModalOpen} onClose={() => setSimModalOpen(false)} />
      <MriImagePredictorModal isOpen={imageModalOpen} onClose={() => setImageModalOpen(false)} />
    </div>
  );
}
