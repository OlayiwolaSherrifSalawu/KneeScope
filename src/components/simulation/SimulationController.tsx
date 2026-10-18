import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Eye,
  Activity,
  Layers,
  FileCheck2,
  FileText,
  X,
  Compass,
} from 'lucide-react';
import type { FindingDefinition, FindingResult, Plane, StudyDetail } from '../../api/types';
import type { Analysis } from '../findings/useAnalysis';
import type { JumpRequest } from '../viewer/ViewerPanel';

export interface SimulationControllerProps {
  study: StudyDetail;
  definitions: FindingDefinition[];
  analysis: Analysis;
  onRun: (options?: { forceSimulation?: boolean }) => void;
  onJump: (seriesId: string, plane: Plane, sliceIndex: number) => void;
  overlayOn: boolean;
  onToggleOverlay: (on: boolean) => void;
  onToggleLabel: (findingId: string) => void;
  selectedFindingId: string | null;
  onSelectFinding: (findingId: string) => void;
  onClose?: () => void;
}

interface StepInfo {
  step: number;
  title: string;
  tag: string;
  icon: typeof Activity;
  summary: string;
  detail: string;
  actionText?: string;
  isActionDone?: boolean;
}

export function SimulationController({
  study,
  analysis,
  onRun,
  onJump,
  overlayOn,
  onToggleOverlay,
  onToggleLabel,
  onSelectFinding,
  onClose,
}: SimulationControllerProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const autoPlayTimerRef = useRef<NodeJS.Timeout | null>(null);

  const result = analysis.phase === 'done' ? analysis.result : null;
  const aclResult: FindingResult | undefined = result?.findings.find((f) => f.finding_id === 'acl');
  const isAclScored = aclResult?.status === 'scored';

  // Steps matching AGENTS.md 7-step review workflow
  const steps: StepInfo[] = [
    {
      step: 1,
      title: 'Study & Multi-Plane Overview',
      tag: 'Step 1 of 7',
      icon: Layers,
      summary: `Inspecting permitted study ${study.study_id} with ${study.series.length} series.`,
      detail:
        'KneeScope requires review across Sagittal, Coronal, and Axial planes when available. Notice the plane indicators and slice counts in the viewer. Missing planes are flagged immediately as warnings.',
      actionText: 'Explore Planes in Viewer',
    },
    {
      step: 2,
      title: 'Scrub MRI Slices & Adjust Contrast',
      tag: 'Step 2 of 7',
      icon: Eye,
      summary: 'Volumetric cross-sectional MRI navigation with keyboard & display adjustment.',
      detail:
        'Researchers scrub through slices using the slider or keys (j / k or arrow keys). Display Adjust controls brightness/contrast without altering raw MRI voxel values.',
      actionText: 'Jump to Slice 12 (Mid-Joint)',
    },
    {
      step: 3,
      title: 'Trigger Model Inference',
      tag: 'Step 3 of 7',
      icon: Activity,
      summary:
        analysis.phase === 'done'
          ? 'Inference complete! Multi-plane feature extraction finished.'
          : analysis.phase === 'running'
          ? 'Running forward pass through ResNet-18...'
          : 'Ready to evaluate MRI volume through the multi-plane network.',
      detail:
        'Clicking "Run model" extracts 32 slices per plane, computes features via ResNet-18, aggregates representations with attention pooling, and outputs scores for active findings.',
      actionText: analysis.phase === 'done' ? 'Re-run Inference' : 'Run Model Inference',
      isActionDone: analysis.phase === 'done',
    },
    {
      step: 4,
      title: 'Review Multi-Finding Scores',
      tag: 'Step 4 of 7',
      icon: Sparkles,
      summary: isAclScored
        ? `ACL Tear score is ${aclResult?.score?.toFixed(2)} (Threshold: 0.50).`
        : 'Model scores quantify tear likelihood between 0.00 and 1.00.',
      detail:
        'KneeScope displays uncalibrated model scores (unless calibration is verified). Scores equal or above 0.50 indicate suspected findings (e.g., ACL Tear 0.71). Each finding is independently evaluated.',
      actionText: 'Select ACL Finding',
      isActionDone: isAclScored,
    },
    {
      step: 5,
      title: 'Inspect Attention & Grad-CAM Heatmap',
      tag: 'Step 5 of 7',
      icon: Compass,
      summary: overlayOn
        ? 'Attention overlay is active on Slice 12!'
        : 'Influential slices identify which MRI slices drove the model score.',
      detail:
        'The model flags influential slices (e.g. Sagittal slice 12 with weight 1.0). Grad-CAM heatmaps highlight where spatial attention focused. Note: attention indicates model focus, not anatomical lesion localization.',
      actionText: overlayOn ? 'Hide Attention Overlay' : 'Jump & Overlay Heatmap (Slice 12)',
      isActionDone: overlayOn,
    },
    {
      step: 6,
      title: 'Dataset Label Isolation & Reveal',
      tag: 'Step 6 of 7',
      icon: FileCheck2,
      summary: 'Labels are strictly isolated from model inference to prevent data contamination.',
      detail:
        'Ground truth reference labels from radiologists are NEVER sent to or read by inference. Researchers click "Reveal" separately to compare model predictions with reference standards.',
      actionText: 'Reveal ACL Reference Label',
    },
    {
      step: 7,
      title: 'Review Model Evaluation & Limitations',
      tag: 'Step 7 of 7',
      icon: FileText,
      summary: 'Inspect test cohort AUROC, sensitivity, specificity, and documented limitations.',
      detail:
        'The Evaluation Ledger tracks performance across dataset splits and subgroup audits. The Model Card documents training data, intended research use, and clinical disclaimers.',
      actionText: 'Open Evaluation Ledger',
    },
  ];

  const current = steps[currentStep - 1]!;

  // Handle step action
  const handleStepAction = () => {
    switch (currentStep) {
      case 1:
        // Jump to first sagittal series
        onJump(study.series[0]?.series_id ?? '', (study.series[0]?.plane ?? 'sagittal') as Plane, 10);
        break;
      case 2: {
        const sagittal = study.series.find((s) => s.plane === 'sagittal') ?? study.series[0];
        if (sagittal) {
          onJump(sagittal.series_id, (sagittal.plane ?? 'sagittal') as Plane, 12);
        }
        break;
      }
      case 3:
        onRun({ forceSimulation: true });
        break;
      case 4:
        onSelectFinding('acl');
        break;
      case 5: {
        const sag = study.series.find((s) => s.plane === 'sagittal') ?? study.series[0];
        if (sag) {
          onJump(sagagSeriesId(study), 'sagittal', 12);
        }
        onToggleOverlay(!overlayOn);
        break;
      }
      case 6:
        onToggleLabel('acl');
        break;
      case 7:
        navigate('/evaluation');
        break;
      default:
        break;
    }
  };

  function sagagSeriesId(st: StudyDetail) {
    const s = st.series.find((x) => x.plane === 'sagittal');
    return s?.series_id ?? st.series[0]?.series_id ?? '';
  }

  // Auto-play effect
  useEffect(() => {
    if (!isAutoPlaying) {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
      return;
    }

    autoPlayTimerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev === 2 && analysis.phase !== 'done') {
          onRun({ forceSimulation: true });
        } else if (prev === 4) {
          onSelectFinding('acl');
          const sag = study.series.find((s) => s.plane === 'sagittal') ?? study.series[0];
          if (sag) onJump(sag.series_id, (sag.plane ?? 'sagittal') as Plane, 12);
          onToggleOverlay(true);
        } else if (prev === 5) {
          onToggleLabel('acl');
        }

        if (prev >= 7) {
          setIsAutoPlaying(false);
          return 7;
        }
        return prev + 1;
      });
    }, 4500);

    return () => {
      if (autoPlayTimerRef.current) clearInterval(autoPlayTimerRef.current);
    };
  }, [isAutoPlaying, analysis.phase, onRun, onSelectFinding, onJump, onToggleOverlay, onToggleLabel, study.series]);

  const goToNext = () => setCurrentStep((s) => Math.min(s + 1, 7));
  const goToPrev = () => setCurrentStep((s) => Math.max(s - 1, 1));
  const restart = () => {
    setCurrentStep(1);
    setIsAutoPlaying(false);
  };

  const Icon = current.icon;

  if (isMinimized) {
    return (
      <div className="fixed bottom-10 right-6 z-50 flex items-center gap-2 border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-panel)] p-2 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ks-lb-accent)] animate-pulse" />
          <span className="text-xs font-mono text-[var(--ks-lb-text)]">
            Simulation Step {currentStep}/7
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="btn primary text-xs"
        >
          Expand Guide
        </button>
      </div>
    );
  }

  return (
    <div
      className="simulation-guide-bar border-b border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-panel)] px-3 py-2 text-[var(--ks-lb-text)] shrink-0"
      role="region"
      aria-label="Simulation Workflow Stepper"
    >
      <div className="mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-2 max-w-7xl">
        {/* Step navigation & info */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          <div className="flex items-center gap-1 shrink-0">
            {steps.map((st) => {
              const isCurrent = st.step === currentStep;
              const isCompleted = st.step < currentStep;
              return (
                <button
                  key={st.step}
                  type="button"
                  onClick={() => {
                    setCurrentStep(st.step);
                    setIsAutoPlaying(false);
                  }}
                  className={`h-6 px-2 text-[11px] rounded font-mono font-medium transition-colors ${
                    isCurrent
                      ? 'bg-[var(--ks-lb-accent)] text-[var(--ks-lb-on-accent)] font-bold'
                      : isCompleted
                      ? 'bg-[var(--ks-lb-raised)] text-[var(--ks-lb-text)] hover:text-white'
                      : 'text-[var(--ks-lb-text-faint)] hover:text-[var(--ks-lb-text)]'
                  }`}
                  title={`${st.tag}: ${st.title}`}
                >
                  {st.step}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 min-w-0 truncate">
            <span className="text-[11px] font-mono text-[var(--ks-lb-accent)] font-semibold shrink-0">
              {current.tag}:
            </span>
            <span className="text-xs font-semibold text-white truncate shrink-0">
              {current.title}
            </span>
            <span className="text-xs text-[var(--ks-lb-text-muted)] truncate hidden lg:inline">
              — {current.summary}
            </span>
          </div>
        </div>

        {/* Step Actions & Navigation */}
        <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
          {current.actionText && (
            <button
              type="button"
              onClick={handleStepAction}
              className="btn primary text-xs inline-flex items-center gap-1.5 py-1 h-7"
            >
              <Sparkles className="h-3 w-3" />
              {current.actionText}
            </button>
          )}

          <button
            type="button"
            onClick={goToPrev}
            disabled={currentStep === 1}
            className="btn text-xs inline-flex items-center px-2 py-1 h-7"
            title="Previous step"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={goToNext}
            disabled={currentStep === 7}
            className="btn text-xs inline-flex items-center px-2 py-1 h-7"
            title="Next step"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`btn text-xs inline-flex items-center gap-1 py-1 px-2 h-7 ${
              isAutoPlaying ? 'bg-amber-900/60 border-amber-600 text-amber-200' : ''
            }`}
            title={isAutoPlaying ? 'Pause automatic walkthrough' : 'Auto-play walkthrough'}
          >
            {isAutoPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 fill-current" />}
            <span className="hidden sm:inline">{isAutoPlaying ? 'Pause' : 'Auto'}</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="btn text-xs py-1 px-2 h-7"
              title="Close stepper"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
