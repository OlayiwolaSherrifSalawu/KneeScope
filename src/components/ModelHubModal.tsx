import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import {
  X,
  Download,
  Upload,
  CheckCircle2,
  Cpu,
  FileText,
  Database,
  RotateCcw,
  Copy,
  ExternalLink,
  AlertTriangle,
  Code,
  Check,
} from 'lucide-react';
import { customModelStore, type CustomModelState } from '../store/customModelStore';
import type { MetricsSnapshot, StudyDetail } from '../api/types';

export function ModelHubModal({
  isOpen,
  onClose,
  initialTab = 'colab',
}: {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'colab' | 'code' | 'model' | 'studies';
}) {
  const [activeTab, setActiveTab] = useState<'colab' | 'code' | 'model' | 'studies'>(initialTab);
  const [storeState, setStoreState] = useState<CustomModelState>(customModelStore.getState());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [trainingScriptText, setTrainingScriptText] = useState<string>('');

  const modelInputRef = useRef<HTMLInputElement>(null);
  const metricsInputRef = useRef<HTMLInputElement>(null);
  const studyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const processModelFile = (file: File) => {
    customModelStore.setCustomModel(file);
    setStoreState(customModelStore.getState());
    const versionStr = `${file.name.replace(/\.[^/.]+$/, '')}-onnx`;
    void fetch('/api/model/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active: true,
        model_name: file.name,
        model_version: versionStr,
        file_size: file.size,
      }),
    }).catch(() => {});
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    setStatusMessage(`✓ Successfully fed model: ${file.name} (${sizeMb} MB) — Live ONNX inference activated!`);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleModelUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processModelFile(file);
    }
  };

  const handleMetricsUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const raw = event.target?.result as string;
          const parsed = JSON.parse(raw) as MetricsSnapshot;
          customModelStore.setCustomMetrics(parsed);
          setStoreState(customModelStore.getState());
          void fetch('/api/metrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: raw,
          }).catch(() => {});
          const count = parsed.per_finding?.length ?? 0;
          setStatusMessage(`Imported Colab validation metrics (${count} findings).`);
          setTimeout(() => setStatusMessage(null), 4000);
        } catch {
          setStatusMessage('Failed to parse metrics.json file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleStudyUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          const study: StudyDetail = {
            study_id: parsed.study_id || `custom-${Date.now().toString().slice(-4)}`,
            display_label: parsed.display_label || file.name.replace(/\.[^/.]+$/, ''),
            origin: 'dataset',
            dataset_id: 'custom_upload',
            planes_available: parsed.planes_available || ['sagittal', 'coronal', 'axial'],
            series_count: parsed.series?.length || 3,
            analysis_status: 'not_run',
            series: parsed.series || [
              {
                series_id: 'ser-custom-sag',
                plane: 'sagittal',
                description: 'Sag PD FS (Custom Cached)',
                num_slices: 32,
                slice_order: 'patient_position',
                rendered_width: 256,
                rendered_height: 256,
                fluid_sensitive: true,
                fat_suppressed: true,
              },
              {
                series_id: 'ser-custom-cor',
                plane: 'coronal',
                description: 'Cor PD FS (Custom Cached)',
                num_slices: 32,
                slice_order: 'patient_position',
                rendered_width: 256,
                rendered_height: 256,
                fluid_sensitive: true,
                fat_suppressed: true,
              },
            ],
            missing_planes: parsed.missing_planes || [],
            warnings: [],
          };
          customModelStore.addCustomStudy(study);
          setStoreState(customModelStore.getState());
          void fetch('/api/studies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(study),
          }).catch(() => {});
          setStatusMessage(`Imported study: ${study.display_label}`);
          setTimeout(() => setStatusMessage(null), 4000);
        } catch {
          setStatusMessage('Invalid study JSON format.');
        }
      };
      reader.readAsText(file);
    }
  };

  const addSampleCustomStudy = () => {
    const sample: StudyDetail = {
      study_id: `study-custom-${Date.now().toString().slice(-4)}`,
      display_label: 'Custom Patient Study (ACL Tear Candidate)',
      origin: 'dataset',
      dataset_id: 'rsna_cached_sample',
      planes_available: ['sagittal', 'coronal', 'axial'],
      series_count: 3,
      analysis_status: 'not_run',
      series: [
        {
          series_id: 'ser-sag-01',
          plane: 'sagittal',
          description: 'Sag PD FS (Cached 32 slices)',
          num_slices: 32,
          slice_order: 'patient_position',
          rendered_width: 256,
          rendered_height: 256,
          fluid_sensitive: true,
          fat_suppressed: true,
        },
        {
          series_id: 'ser-cor-01',
          plane: 'coronal',
          description: 'Cor PD FS (Cached 32 slices)',
          num_slices: 32,
          slice_order: 'patient_position',
          rendered_width: 256,
          rendered_height: 256,
          fluid_sensitive: true,
          fat_suppressed: true,
        },
        {
          series_id: 'ser-ax-01',
          plane: 'axial',
          description: 'Ax T2 FS (Cached 32 slices)',
          num_slices: 32,
          slice_order: 'patient_position',
          rendered_width: 256,
          rendered_height: 256,
          fluid_sensitive: true,
          fat_suppressed: true,
        },
      ],
      missing_planes: [],
      warnings: [],
    };
    customModelStore.addCustomStudy(sample);
    setStoreState(customModelStore.getState());
    void fetch('/api/studies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    }).catch(() => {});
    setStatusMessage('Added sample custom cached study to Studies browser.');
    setTimeout(() => setStatusMessage(null), 4000);
  };

  useEffect(() => {
    if (isOpen && !trainingScriptText) {
      fetch('/api/download/script')
        .then((r) => r.text())
        .then((txt) => setTrainingScriptText(txt))
        .catch(() => {});
    }
  }, [isOpen, trainingScriptText]);

  const handleDownloadNotebook = async () => {
    try {
      setStatusMessage('Preparing Colab notebook download...');
      const res = await fetch('/api/download/notebook');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      setStatusMessage('Downloaded "train_kneescope_colab.ipynb" (clean .ipynb file, no .html wrapper).');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch {
      window.location.href = '/api/download/notebook';
    }
  };

  const handleDownloadScript = async () => {
    try {
      setStatusMessage('Preparing Python script download...');
      const res = await fetch('/api/download/script');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'train_colab.py';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMessage('Downloaded "train_colab.py"!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      window.location.href = '/api/download/script';
    }
  };

  const handleCopyCode = async () => {
    try {
      let text = trainingScriptText;
      if (!text) {
        const res = await fetch('/api/download/script');
        text = await res.text();
        setTrainingScriptText(text);
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setStatusMessage('Copied Python training script! Go to colab.research.google.com, open a new notebook, paste into Cell 1, and run.');
      setTimeout(() => setCopied(false), 3000);
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: any) {
      setStatusMessage('Clipboard copy error: ' + err.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-panel)] text-[var(--ks-lb-text)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ks-lb-line)] px-6 py-4">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-[var(--ks-lb-accent)]" />
            <div>
              <h2 id="modal-title" className="text-base font-semibold tracking-tight text-white">
                Model & Training Hub
              </h2>
              <p className="text-xs text-[var(--ks-lb-text-muted)]">
                Train on Google Colab with GPU acceleration and deploy models to KneeScope
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--ks-lb-text-muted)] hover:bg-[var(--ks-lb-raised)] hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('colab')}
            className={`border-b-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'colab'
                ? 'border-[var(--ks-lb-accent)] text-white'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            1. Colab Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`border-b-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'code'
                ? 'border-[var(--ks-lb-accent)] text-white'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            2. View & Copy Python Code
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('model')}
            className={`border-b-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'model'
                ? 'border-[var(--ks-lb-accent)] text-white'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            3. Upload ONNX Model & Metrics
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('studies')}
            className={`border-b-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'studies'
                ? 'border-[var(--ks-lb-accent)] text-white'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            4. Ingest Cached Studies ({storeState.customStudies.length})
          </button>
        </div>

        {/* Notification banner */}
        {statusMessage ? (
          <div className="bg-emerald-950/70 border-b border-emerald-800/80 px-6 py-2 text-xs text-emerald-200">
            {statusMessage}
          </div>
        ) : null}

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto p-6 text-sm">
          {activeTab === 'colab' && (
            <div className="space-y-6">
              {/* Alert: Explaining the HTML download issue and how to resolve it */}
              <div className="rounded border border-amber-600/40 bg-amber-950/30 p-4 text-xs text-amber-200">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  Why did the file download as an .html file?
                </div>
                <p className="mt-1.5 leading-relaxed text-amber-200/90">
                  Web browsers in iframe previews sometimes automatically append <code className="rounded bg-black/40 px-1 py-0.5 text-amber-300">.html</code> to downloaded files (e.g. <code className="rounded bg-black/40 px-1 py-0.5 text-amber-300">train_kneescope_colab.ipynb.html</code>) or save an HTML wrapper. When you try to upload an HTML file to Colab, Colab rejects it because it only accepts real Jupyter Notebook (<code className="rounded bg-black/40 px-1 py-0.5 text-amber-300">.ipynb</code>) files.
                </p>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded border border-amber-700/50 bg-black/40 p-2.5">
                    <strong className="text-white block mb-1">Option 1 (Fastest — Zero downloads):</strong>
                    Click <strong className="text-amber-300">Copy Python Script</strong> below, open <a href="https://colab.research.google.com" target="_blank" rel="noreferrer" className="underline text-amber-300">Google Colab</a>, create a New Notebook, paste the code into Cell 1, and press Shift+Enter!
                  </div>
                  <div className="rounded border border-amber-700/50 bg-black/40 p-2.5">
                    <strong className="text-white block mb-1">Option 2 (Direct .ipynb Blob Download):</strong>
                    Click the updated <strong className="text-amber-300">Download Colab Notebook</strong> button below. It downloads the raw notebook bytes cleanly. If your browser still added <code className="text-amber-300">.html</code> at the end, simply rename the file on your computer to delete <code className="text-amber-300">.html</code>.
                  </div>
                </div>
              </div>

              <div className="border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                <span className="text-xs font-medium text-[var(--ks-lb-text-muted)]">
                  TRAINING PIPELINE SPECIFICATION (RSNA 4-CLASS RESNET-18)
                </span>
                <p className="mt-1 text-xs text-[var(--ks-lb-text-muted)]">
                  Self-contained Colab notebook for multi-plane (Sagittal, Coronal, Axial) ResNet-18 with
                  attention-gated slice pooling. Trained on cached tensors (`.pt` or `.npy`) with automatic
                  export of <code className="text-white">kneescope_rsna4.onnx</code> and <code className="text-white">metrics.json</code>.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadNotebook}
                    className="btn primary inline-flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download Colab Notebook (.ipynb)
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="btn inline-flex items-center gap-2 bg-emerald-900/40 border-emerald-700/70 text-emerald-300 hover:bg-emerald-800/50"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4 text-emerald-300" />}
                    {copied ? 'Copied to Clipboard!' : 'Copy Python Script for Colab'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadScript}
                    className="btn inline-flex items-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Download train_colab.py
                  </button>
                  <a
                    href="https://colab.research.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="btn inline-flex items-center gap-2 text-white/80 hover:text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Google Colab
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ks-lb-text-muted)]">
                  Quick Steps to Run in Google Colab:
                </h3>
                <ol className="mt-3 space-y-3 text-xs text-[var(--ks-lb-text)]">
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ks-lb-raised)] text-[10px] font-bold">
                      1
                    </span>
                    <span>
                      Open <strong className="text-white">Google Colab</strong> (colab.research.google.com). Either click <em>File &gt; Upload notebook</em> to upload <code className="text-[var(--ks-lb-accent)]">train_kneescope_colab.ipynb</code>, OR click <em>New Notebook</em> and paste the copied Python script into Cell 1.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ks-lb-raised)] text-[10px] font-bold">
                      2
                    </span>
                    <span>
                      Select a GPU runtime: <em>Runtime &gt; Change runtime type &gt; T4 GPU</em>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ks-lb-raised)] text-[10px] font-bold">
                      3
                    </span>
                    <span>
                      Mount Google Drive or set <code className="text-amber-300">DATA_DIR</code> to your cached tensors folder and <code className="text-amber-300">LABELS_CSV</code> to your labels file.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ks-lb-raised)] text-[10px] font-bold">
                      4
                    </span>
                    <span>
                      Run the cells. When training finishes, Colab automatically triggers the download of <strong className="text-white">kneescope_rsna4.onnx</strong> and <strong className="text-white">metrics.json</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ks-lb-raised)] text-[10px] font-bold">
                      5
                    </span>
                    <span>
                      Switch to the <em>Upload ONNX Model & Metrics</em> tab in this window and upload them to KneeScope!
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
                    Self-Contained Training Script (train_colab.py)
                  </h3>
                  <p className="text-xs text-[var(--ks-lb-text-muted)]">
                    You can copy this complete Python script and paste it directly into an empty Google Colab notebook cell.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="btn primary text-xs inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied!' : 'Copy Code'}
                </button>
              </div>

              <div className="relative max-h-[500px] overflow-auto rounded border border-[var(--ks-lb-line)] bg-black/90 p-4 font-mono text-xs text-emerald-300 leading-relaxed">
                <pre>{trainingScriptText || '# Loading Python training script...'}</pre>
              </div>
            </div>
          )}

          {activeTab === 'model' && (
            <div className="space-y-6">
              {/* Active Model Status */}
              <div className="border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ks-lb-text-faint)]">
                      CURRENT INFERENCE MODE
                    </span>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          storeState.hasCustomModel ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span className="font-semibold text-white">
                        {storeState.hasCustomModel ? 'Custom Colab Model Active' : 'Fixture Development Mode'}
                      </span>
                    </div>
                  </div>
                  {storeState.hasCustomModel ? (
                    <button
                      type="button"
                      onClick={() => {
                        customModelStore.reset();
                        setStoreState(customModelStore.getState());
                        setStatusMessage('Reset back to fixture development mode.');
                      }}
                      className="btn text-xs inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Revert to Fixture
                    </button>
                  ) : null}
                </div>

                {storeState.hasCustomModel ? (
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-[var(--ks-lb-text-muted)]">Model Name:</dt>
                      <dd className="font-mono text-white">{storeState.modelName}</dd>
                    </div>
                    <div>
                      <dt className="text-[var(--ks-lb-text-muted)]">Profile:</dt>
                      <dd className="font-mono text-white">rsna4 (ACL, MCL, Medial & Lateral Meniscus)</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-xs text-[var(--ks-lb-text-muted)]">
                    No custom ONNX weights loaded yet. Load your trained Colab weights below to activate live model inference.
                  </p>
                )}
              </div>

              {/* Upload Dropzones */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div
                  className="border-2 border-dashed border-emerald-500/60 bg-[var(--ks-lb-bg)] hover:bg-emerald-950/20 p-5 text-center rounded transition-colors cursor-pointer"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) processModelFile(file);
                  }}
                  onClick={() => modelInputRef.current?.click()}
                >
                  <Upload className="mx-auto h-8 w-8 text-emerald-400 animate-bounce" />
                  <h4 className="mt-2 text-xs font-semibold text-white">Feed Model Weights (.onx / .onnx)</h4>
                  <p className="mt-1 text-[11px] text-[var(--ks-lb-text-muted)]">
                    Drag & drop your <code className="text-emerald-300">.onx</code> or <code className="text-emerald-300">.onnx</code> model file here, or click to browse.
                  </p>
                  <input
                    ref={modelInputRef}
                    type="file"
                    accept=".onx,.onnx,.pt,.pth,.bin,.safetensors,*"
                    className="hidden"
                    onChange={handleModelUpload}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      modelInputRef.current?.click();
                    }}
                    className="btn primary mt-3 text-xs inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Select .onx / .onnx File
                  </button>
                  <p className="mt-2 text-[10px] text-[var(--ks-lb-dim)] font-mono">
                    Accepts: .onx, .onnx, .pt, .pth, .safetensors
                  </p>
                </div>

                <div className="border border-dashed border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-bg)] p-5 text-center rounded">
                  <FileText className="mx-auto h-8 w-8 text-[var(--ks-lb-text-muted)]" />
                  <h4 className="mt-2 text-xs font-semibold text-white">Upload Metrics Snapshot (.json)</h4>
                  <p className="mt-1 text-[11px] text-[var(--ks-lb-text-muted)]">
                    Select <code className="text-white">metrics.json</code> to update the Evaluation Ledger.
                  </p>
                  <input
                    ref={metricsInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleMetricsUpload}
                  />
                  <button
                    type="button"
                    onClick={() => metricsInputRef.current?.click()}
                    className="btn mt-3 text-xs"
                  >
                    Select Metrics JSON
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'studies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[var(--ks-lb-line)] pb-3">
                <div>
                  <h3 className="text-xs font-semibold text-white">Custom Uploaded Studies</h3>
                  <p className="text-xs text-[var(--ks-lb-text-muted)]">
                    Upload preprocessed study JSON metadata or load sample cached studies
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={studyInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleStudyUpload}
                  />
                  <button
                    type="button"
                    onClick={() => studyInputRef.current?.click()}
                    className="btn text-xs inline-flex items-center gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload Study JSON
                  </button>
                  <button
                    type="button"
                    onClick={addSampleCustomStudy}
                    className="btn primary text-xs inline-flex items-center gap-1.5"
                  >
                    <Database className="h-3.5 w-3.5" />
                    + Add Sample Study
                  </button>
                </div>
              </div>

              {storeState.customStudies.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--ks-lb-text-muted)]">
                  No custom studies imported yet. Click &ldquo;+ Add Sample Study&rdquo; to test a cached 32-slice study right away.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--ks-lb-line)]">
                  {storeState.customStudies.map((s) => (
                    <li key={s.study_id} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <span className="font-mono font-medium text-white">{s.study_id}</span>
                        <span className="ml-2 text-[var(--ks-lb-text-muted)]">{s.display_label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[var(--ks-lb-text-faint)]">
                          {s.series.length} series · {s.planes_available.join(', ')}
                        </span>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] px-6 py-3 text-xs">
          <span className="text-[var(--ks-lb-text-faint)]">
            KneeScope Research Review Prototype · RSNA 4-Class Architecture
          </span>
          <button type="button" onClick={onClose} className="btn primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
