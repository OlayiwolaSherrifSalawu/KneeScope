import type { Analysis } from './useAnalysis';
import { useElapsedSeconds } from './useAnalysis';

/**
 * Primary button for the findings column header (DESIGN.md section 9.6): "Run analysis",
 * "Analysing…" while the request is in flight (disabled), "Run again" afterwards.
 */
export function RunAnalysisButton({
  analysis,
  onRun,
}: {
  analysis: Analysis;
  onRun: (options?: { forceSimulation?: boolean }) => void;
}) {
  const running = analysis.phase === 'running';
  const isError = analysis.phase === 'error';
  const label = running
    ? 'Analysing…'
    : isError
      ? 'Run with Simulated Fix'
      : analysis.phase === 'done'
        ? 'Run again'
        : 'Run analysis';
  return (
    <button
      type="button"
      className="btn primary text-xs"
      onClick={() => {
        if (isError) {
          onRun({ forceSimulation: true });
        } else {
          onRun();
        }
      }}
      disabled={running}
      title={running ? 'Analysis is running' : `${label} (r)`}
    >
      {label}
    </button>
  );
}

export function RunStatus({ analysis }: { analysis: Analysis }) {
  const seconds = useElapsedSeconds(analysis.phase === 'running' ? analysis.startedAt : null);
  if (analysis.phase !== 'running') return null;
  const progress = analysis.progress ?? 20;
  const stage = analysis.stage ?? 'Inferring in background…';
  const stageIndex = (analysis as any).stageIndex ?? 1;

  const steps = [
    { num: 1, label: 'DICOM' },
    { num: 2, label: 'Tensor' },
    { num: 3, label: 'ResNet' },
    { num: 4, label: 'Pooling' },
    { num: 5, label: 'Grad-CAM' },
  ];

  return (
    <div className="rounded border border-emerald-500/60 bg-[var(--ks-lb-panel-raised)] p-3 mb-3 text-xs shadow-md space-y-2.5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold text-white font-mono text-[11px] uppercase tracking-wide">
            Model Preloader & Live Inference
          </span>
        </div>
        <span className="mono text-[11px] text-emerald-400 font-bold bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-600/60">
          {progress}% • {seconds}s / ~3.2s
        </span>
      </div>

      {/* 5-step visual pipeline badges */}
      <div className="grid grid-cols-5 gap-1 pt-0.5">
        {steps.map((st) => {
          const isDone = stageIndex > st.num;
          const isCurrent = stageIndex === st.num;
          return (
            <div
              key={st.num}
              className={`flex items-center justify-center gap-1 py-1 px-1 rounded text-[9px] font-mono font-medium border text-center transition-all ${
                isDone
                  ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300'
                  : isCurrent
                    ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_8px_rgba(52,211,153,0.3)] animate-pulse'
                    : 'bg-black/40 border-[var(--ks-lb-line)] text-[var(--ks-lb-dim)]'
              }`}
            >
              <span>{isDone ? '✓' : st.num}.</span>
              <span className="truncate">{st.label}</span>
            </div>
          );
        })}
      </div>

      <div className="text-[11px] text-[var(--ks-lb-text)] leading-tight font-mono bg-black/40 p-2 rounded border border-[var(--ks-lb-line)]">
        <span className="text-emerald-400 mr-1.5">▶</span>
        {stage}
      </div>

      <div className="w-full h-2 rounded-full bg-black/60 border border-[var(--ks-lb-line)] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-[var(--ks-lb-dim)] font-mono pt-0.5">
        <span>Backbone: ResNet-18 (Multi-Plane ONNX)</span>
        <span>Resolution: 256×256 • 4.1 GFLOPs</span>
      </div>
    </div>
  );
}

