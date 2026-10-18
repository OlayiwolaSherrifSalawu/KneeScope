import { useState } from 'react';
import { Layers, Cpu, Activity, Sparkles, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Analysis } from '../findings/useAnalysis';

export interface ModelPipelineStatusProps {
  studyId: string;
  analysis: Analysis;
  isSimulatedRecovery?: boolean;
}

/**
 * Visual status of the KneeScope ML Pipeline (matching user architecture diagram):
 * MRI study -> Shared preprocessing -> Slice encoder -> Pool slices -> Combine series -> Independent finding scores (+ Visual explanation)
 */
export function ModelPipelineStatus({
  studyId,
  analysis,
  isSimulatedRecovery = false,
}: ModelPipelineStatusProps) {
  const [collapsed, setCollapsed] = useState(false);

  const isRunning = analysis.phase === 'running';
  const isDone = analysis.phase === 'done';
  const isError = analysis.phase === 'error';
  const stageIdx = analysis.phase === 'running' ? (analysis.stageIndex ?? 1) : isDone ? 5 : 0;

  const isPrepError = isError && analysis.error.code === 'PREPROCESSING_FAILED';

  return (
    <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-panel)] mb-3 text-xs overflow-hidden transition-all shadow-sm">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-[var(--ks-lb-panel-raised)] hover:bg-[var(--ks-lb-raised)] transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Activity className={`w-3.5 h-3.5 ${isRunning ? 'text-[var(--ks-lb-accent)] animate-spin' : 'text-[var(--ks-lb-accent)]'}`} />
          <span className="font-mono text-[11px] font-semibold text-white tracking-wide uppercase">
            Inference Pipeline
          </span>
          <span className="text-[10px] text-[var(--ks-lb-text-muted)]">
            {isDone
              ? 'Complete'
              : isRunning
              ? `${analysis.stage ?? 'Running Inference…'}`
              : isError
              ? 'Stage Alert'
              : 'Ready'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--ks-lb-text-muted)] font-mono">
          <span>{collapsed ? 'Expand' : 'Collapse'}</span>
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
        </div>
      </button>

      {!collapsed && (
        <div className="p-2.5 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10px] font-mono">
            {/* Step 1: MRI Study */}
            <div className="p-1.5 rounded bg-[var(--ks-lb-bg)] border border-[var(--ks-lb-line)] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="min-w-0 truncate">
                <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Input</div>
                <div className="text-white truncate font-medium">MRI Study {studyId}</div>
              </div>
            </div>

            {/* Step 2: Shared Preprocessing */}
            <div
              className={`p-1.5 rounded border flex items-center gap-1.5 ${
                isPrepError
                  ? 'bg-amber-950/40 border-amber-600/70 text-amber-200'
                  : stageIdx === 2
                  ? 'border-[var(--ks-lb-accent)] bg-[var(--ks-lb-accent)]/15 text-white'
                  : stageIdx > 2 || isDone
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                  : 'bg-[var(--ks-lb-bg)] border-[var(--ks-lb-line)]'
              }`}
            >
              {isPrepError ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              ) : stageIdx >= 2 || isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-[var(--ks-lb-dim)] flex items-center justify-center text-[8px] text-[var(--ks-lb-dim)]">1</span>
              )}
              <div className="min-w-0 truncate">
                <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Stage 1</div>
                <div className="truncate font-medium">
                  {isPrepError ? 'Corrupted Input' : isSimulatedRecovery ? 'Simulated Recovery' : 'Preprocessing'}
                </div>
              </div>
            </div>

            {/* Step 3: Slice Encoder */}
            <div
              className={`p-1.5 rounded border flex items-center gap-1.5 ${
                stageIdx === 3
                  ? 'border-[var(--ks-lb-accent)] bg-[var(--ks-lb-accent)]/20 text-white animate-pulse'
                  : stageIdx > 3 || isDone
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                  : 'bg-[var(--ks-lb-bg)] border-[var(--ks-lb-line)]'
              }`}
            >
              <Cpu
                className={`w-3.5 h-3.5 shrink-0 ${
                  stageIdx === 3
                    ? 'text-[var(--ks-lb-accent)] animate-pulse'
                    : stageIdx > 3 || isDone
                    ? 'text-emerald-400'
                    : 'text-[var(--ks-lb-dim)]'
                }`}
              />
              <div className="min-w-0 truncate">
                <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Stage 2</div>
                <div className="truncate font-medium text-[var(--ks-lb-text)]">Slice Encoder (ResNet)</div>
              </div>
            </div>

            {/* Step 4: Pool Slices */}
            <div
              className={`p-1.5 rounded border flex items-center gap-1.5 ${
                stageIdx === 4
                  ? 'border-[var(--ks-lb-accent)] bg-[var(--ks-lb-accent)]/20 text-white animate-pulse'
                  : stageIdx > 4 || isDone
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                  : 'bg-[var(--ks-lb-bg)] border-[var(--ks-lb-line)]'
              }`}
            >
              <Layers
                className={`w-3.5 h-3.5 shrink-0 ${
                  stageIdx > 4 || isDone ? 'text-emerald-400' : 'text-[var(--ks-lb-dim)]'
                }`}
              />
              <div className="min-w-0 truncate">
                <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Stage 3</div>
                <div className="truncate font-medium text-[var(--ks-lb-text)]">Attention Pooling</div>
              </div>
            </div>

            {/* Step 5: Feature Combination */}
            <div
              className={`p-1.5 rounded border flex items-center gap-1.5 ${
                stageIdx === 5
                  ? 'border-[var(--ks-lb-accent)] bg-[var(--ks-lb-accent)]/20 text-white animate-pulse'
                  : isDone
                  ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-300'
                  : 'bg-[var(--ks-lb-bg)] border-[var(--ks-lb-line)]'
              }`}
            >
              <Activity
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDone ? 'text-emerald-400' : 'text-[var(--ks-lb-dim)]'
                }`}
              />
              <div className="min-w-0 truncate">
                <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Stage 4</div>
                <div className="truncate font-medium text-[var(--ks-lb-text)]">Combine Features</div>
              </div>
            </div>

            {/* Step 6: Finding Scores & Explanation */}
            <div
              className={`p-1.5 rounded border flex items-center gap-1.5 ${
                isDone
                  ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-200'
                  : 'bg-[var(--ks-lb-bg)] border-[var(--ks-lb-line)]'
              }`}
            >
              <Sparkles
                className={`w-3.5 h-3.5 shrink-0 ${
                  isDone ? 'text-emerald-400' : 'text-[var(--ks-lb-dim)]'
                }`}
              />
              <div className="min-w-0 truncate">
                <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Output</div>
                <div className="truncate font-medium">Finding Scores + Map</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
