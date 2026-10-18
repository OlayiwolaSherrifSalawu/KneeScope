import { useState, useEffect } from 'react';
import { NavLink, Outlet, useMatch } from 'react-router-dom';
import { Cpu, Download, Sparkles, Upload } from 'lucide-react';
import { api } from '../api/client';
import type { Health } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { HatchBlock, StateGlyph } from './StateGlyph';
import { ModelHubModal } from './ModelHubModal';
import { customModelStore } from '../store/customModelStore';
import { SystemSimulationModal } from './simulation/SystemSimulationModal';
import { MriImagePredictorModal } from './simulation/MriImagePredictorModal';

function RunModeChip({ onOpenHub }: { onOpenHub: () => void }) {
  const health = useAsync<Health>('health', (signal) => api.health({ signal }));

  useEffect(() => {
    return customModelStore.subscribe(() => {
      health.reload();
    });
  }, [health]);

  if (health.phase === 'error') {
    return (
      <button
        type="button"
        onClick={onOpenHub}
        className="mode-chip failed cursor-pointer"
        title={`${health.error.code}: ${health.error.message} (Click to open Model Hub)`}
      >
        <StateGlyph status="failed" />
        API unreachable
      </button>
    );
  }
  if (health.phase !== 'ready') {
    return (
      <span className="mode-chip" aria-busy="true">
        Checking API…
      </span>
    );
  }
  const h = health.data;
  if (h.mode === 'fixture') {
    return (
      <button
        type="button"
        onClick={onOpenHub}
        className="mode-chip cursor-pointer hover:bg-[var(--ks-lb-raised)]"
        title="No model is loaded. Results come from development fixtures. Click to open Colab & Model Hub."
      >
        <HatchBlock />
        Fixture mode
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpenHub}
      className="mode-chip cursor-pointer bg-emerald-950/40 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50"
      title="A custom model checkpoint is active. Click to manage."
    >
      <Cpu className="h-3 w-3 text-emerald-400" />
      Model: <span className="mono">{h.model_version ?? 'active'}</span>
    </button>
  );
}

export function AppShell() {
  const onStudy = useMatch('/studies/:studyId');
  const [hubOpen, setHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState<'colab' | 'code' | 'model' | 'studies'>('colab');
  const [simOpen, setSimOpen] = useState(false);
  const [imageSimOpen, setImageSimOpen] = useState(false);
  const [globalDrag, setGlobalDrag] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleDropFile = (file: File) => {
    const name = file.name.toLowerCase();
    if (
      name.endsWith('.onx') ||
      name.endsWith('.onnx') ||
      name.endsWith('.pt') ||
      name.endsWith('.pth') ||
      name.endsWith('.safetensors') ||
      name.endsWith('.bin')
    ) {
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
      showToast(`✓ Fed model "${file.name}" (${sizeMb} MB) — Live ONNX inference activated!`);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        customModelStore.setUploadedImage('real-study-001', dataUrl);
        void fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ study_id: 'real-study-001', data_url: dataUrl }),
        }).catch(() => {});
        showToast(`✓ Loaded knee MRI image "${file.name}" into real-study-001!`);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDrag(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) {
        setGlobalDrag(false);
      }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setGlobalDrag(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) handleDropFile(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const openModelFeed = () => {
    setHubTab('model');
    setHubOpen(true);
  };

  return (
    <div className="app relative">
      {/* Global Drag & Drop Overlay */}
      {globalDrag && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center border-4 border-dashed border-emerald-400 p-6 pointer-events-none animate-fade-in">
          <div className="p-4 rounded-full bg-emerald-500/20 text-emerald-300 mb-4 animate-bounce">
            <Cpu className="w-12 h-12" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Drop your .onx model weights or knee MRI image</h2>
          <p className="text-sm text-emerald-300 font-mono">
            KneeScope will automatically activate live ONNX inference or update your active MRI scan
          </p>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-4 z-40 max-w-md bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded shadow-xl flex items-center justify-between gap-3 text-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button type="button" onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      <header className="topbar">
        <div className="wordmark">
          <b>KneeScope</b>
          <small>Knee MRI research review</small>
        </div>
        <nav className="nav" aria-label="Primary">
          <NavLink to="/" end>
            Studies
          </NavLink>
          {onStudy ? (
            <NavLink to={onStudy.pathname}>Review</NavLink>
          ) : (
            <span aria-disabled="true" title="Open a study from Studies to review it">
              Review
            </span>
          )}
          <NavLink to="/evaluation">Evaluation</NavLink>
        </nav>
        <span className="spacer" />
        <div className="flex items-center gap-2">
          {/* Prominent Feed Model (.onx) button */}
          <button
            type="button"
            onClick={openModelFeed}
            className="btn text-xs inline-flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500 text-emerald-300 hover:bg-emerald-900/60 font-semibold shadow-xs"
            title="Feed your .onx or .onnx trained weights directly into KneeScope"
          >
            <Cpu className="h-3.5 w-3.5 text-emerald-400" />
            Feed Model (.onx)
          </button>
          <button
            type="button"
            onClick={() => setImageSimOpen(true)}
            className="btn text-xs inline-flex items-center gap-1.5 bg-emerald-950/40 text-emerald-300 border border-emerald-800/60 hover:bg-emerald-900/50 shadow-sm"
            title="Upload or test a real knee MRI image with simulated background model inference and attention overlay"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload & Simulate MRI
          </button>
          <button
            type="button"
            onClick={() => setSimOpen(true)}
            className="btn text-xs inline-flex items-center gap-1.5 bg-[var(--ks-lb-raised)] text-[var(--ks-lb-accent)] hover:text-white"
            title="Explore interactive 7-step system simulation, test scenarios, and score simulator"
          >
            <Sparkles className="h-3.5 w-3.5" />
            System Simulation
          </button>
          <button
            type="button"
            onClick={() => {
              setHubTab('colab');
              setHubOpen(true);
            }}
            className="btn text-xs inline-flex items-center gap-1.5"
            title="Open Model & Colab Hub for training instructions, code viewer, and model uploader"
          >
            <Cpu className="h-3.5 w-3.5 text-[var(--ks-lb-accent)]" />
            Model & Colab Hub
          </button>
          <RunModeChip onOpenHub={openModelFeed} />
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="footer">
        <b>Research prototype — not for diagnosis.</b>
        <span>Scores are uncalibrated model outputs unless stated.</span>
      </footer>

      <ModelHubModal isOpen={hubOpen} onClose={() => setHubOpen(false)} initialTab={hubTab} />
      <SystemSimulationModal isOpen={simOpen} onClose={() => setSimOpen(false)} />
      <MriImagePredictorModal isOpen={imageSimOpen} onClose={() => setImageSimOpen(false)} />
    </div>
  );
}
