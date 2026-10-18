import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Play,
  Layers,
  Activity,
  Compass,
  FileCheck2,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Sparkles,
  HelpCircle,
  Eye,
} from 'lucide-react';

interface SystemSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SystemSimulationModal({ isOpen, onClose }: SystemSimulationModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'scenarios' | 'simulator' | 'architecture' | 'guardrails'>('scenarios');
  
  // Interactive Simulator State
  const [selectedFinding, setSelectedFinding] = useState<'acl' | 'mcl' | 'medial_meniscus'>('acl');
  const [featureIntensity, setFeatureIntensity] = useState<number>(75); // 0-100%

  if (!isOpen) return null;

  const simulatedScore = Math.min(0.98, Math.max(0.04, featureIntensity / 100));
  const isAboveThreshold = simulatedScore >= 0.5;

  const handleLaunchScenario = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-modal-title"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-panel)] text-[var(--ks-lb-text)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--ks-lb-line)] px-6 py-4 bg-[var(--ks-lb-bg)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-raised)] text-[var(--ks-lb-accent)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 id="sim-modal-title" className="text-base font-semibold text-white">
                KneeScope System Workflow Simulation
              </h2>
              <p className="text-xs text-[var(--ks-lb-text-muted)]">
                Experience the 7-step MRI research review workflow without requiring a trained model
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[var(--ks-lb-text-muted)] hover:bg-[var(--ks-lb-raised)] hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--ks-lb-line)] bg-[var(--ks-lb-raised)] px-6">
          <button
            type="button"
            onClick={() => setActiveTab('scenarios')}
            className={`border-b-2 py-3 px-4 text-xs font-medium transition-colors ${
              activeTab === 'scenarios'
                ? 'border-[var(--ks-lb-accent)] text-[var(--ks-lb-accent)]'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            Guided Test Scenarios
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`border-b-2 py-3 px-4 text-xs font-medium transition-colors ${
              activeTab === 'simulator'
                ? 'border-[var(--ks-lb-accent)] text-[var(--ks-lb-accent)]'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            Interactive Score & Attention Simulator
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('architecture')}
            className={`border-b-2 py-3 px-4 text-xs font-medium transition-colors ${
              activeTab === 'architecture'
                ? 'border-[var(--ks-lb-accent)] text-[var(--ks-lb-accent)]'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            7-Step System Workflow
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guardrails')}
            className={`border-b-2 py-3 px-4 text-xs font-medium transition-colors ${
              activeTab === 'guardrails'
                ? 'border-[var(--ks-lb-accent)] text-[var(--ks-lb-accent)]'
                : 'border-transparent text-[var(--ks-lb-text-muted)] hover:text-white'
            }`}
          >
            Scientific Guardrails
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SCENARIOS */}
          {activeTab === 'scenarios' && (
            <div className="space-y-4">
              <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                <p className="text-xs text-[var(--ks-lb-text-muted)] leading-relaxed">
                  Select any simulated clinical research scenario below. Each preset loads real multi-slice volumetric MRI data and demonstrates how KneeScope processes series, triggers model inference, presents uncalibrated finding scores, and isolates dataset ground truth.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Scenario 1 */}
                <div className="flex flex-col justify-between rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-bg)] p-4 hover:border-[var(--ks-lb-accent)] transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-emerald-950/60 border border-emerald-700/60 px-2 py-0.5 text-[11px] font-mono text-emerald-300">
                        Primary Simulation
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ks-lb-text-muted)]">fx-study-001</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      Full Tri-Planar Study (Positive ACL Tear)
                    </h3>
                    <p className="text-xs text-[var(--ks-lb-text-muted)] leading-relaxed">
                      Complete Sagittal, Coronal, and Axial series (4 series, 30+ slices each). Demonstrates elevated ACL Tear score (0.71), top influential slices (Sagittal slice 12), and Grad-CAM attention heatmap overlay.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchScenario('/studies/fx-study-001?sim=true')}
                    className="mt-4 btn primary text-xs w-full inline-flex items-center justify-center gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Launch Interactive Tour
                  </button>
                </div>

                {/* Scenario 2 */}
                <div className="flex flex-col justify-between rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-bg)] p-4 hover:border-[var(--ks-lb-accent)] transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-amber-950/60 border border-amber-700/60 px-2 py-0.5 text-[11px] font-mono text-amber-300">
                        Missing Plane Edge Case
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ks-lb-text-muted)]">fx-study-002</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      Missing Series Resilience (Axial Missing)
                    </h3>
                    <p className="text-xs text-[var(--ks-lb-text-muted)] leading-relaxed">
                      Demonstrates KneeScope's plane completeness check. The Axial series is omitted; the system displays a clear "Missing Plane: Axial" warning while continuing multi-finding evaluation on Sagittal & Coronal.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchScenario('/studies/fx-study-002?sim=true')}
                    className="mt-4 btn text-xs w-full inline-flex items-center justify-center gap-1.5 bg-[var(--ks-lb-raised)]"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Simulate Missing Plane Case
                  </button>
                </div>

                {/* Scenario 3 */}
                <div className="flex flex-col justify-between rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-bg)] p-4 hover:border-[var(--ks-lb-accent)] transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-rose-950/60 border border-rose-700/60 px-2 py-0.5 text-[11px] font-mono text-rose-300">
                        Error Boundary Test
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ks-lb-text-muted)]">fx-study-003</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      Preprocessing Failure Handling
                    </h3>
                    <p className="text-xs text-[var(--ks-lb-text-muted)] leading-relaxed">
                      Demonstrates robust error handling according to the shared contract. If a corrupt DICOM/series cannot be preprocessed, an explicit PREPROCESSING_FAILED error panel with request ID is presented without crashing.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchScenario('/studies/fx-study-003?sim=true')}
                    className="mt-4 btn text-xs w-full inline-flex items-center justify-center gap-1.5 bg-[var(--ks-lb-raised)]"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    Simulate Error Handling
                  </button>
                </div>

                {/* Scenario 4 */}
                <div className="flex flex-col justify-between rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-bg)] p-4 hover:border-[var(--ks-lb-accent)] transition-colors">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-sky-950/60 border border-sky-700/60 px-2 py-0.5 text-[11px] font-mono text-sky-300">
                        Performance & Card
                      </span>
                      <span className="text-[11px] font-mono text-[var(--ks-lb-text-muted)]">/evaluation</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white">
                      Evaluation Ledger & Model Card
                    </h3>
                    <p className="text-xs text-[var(--ks-lb-text-muted)] leading-relaxed">
                      Inspect the research evaluation ledger with AUROC, sensitivity, specificity, and slice weights. Review the Model Card documenting training dataset origin, intended research scope, and ethical disclaimers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLaunchScenario('/evaluation')}
                    className="mt-4 btn text-xs w-full inline-flex items-center justify-center gap-1.5 bg-[var(--ks-lb-raised)]"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View Evaluation Ledger
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-6">
              <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[var(--ks-lb-accent)]" />
                  Model Score & Attention Response Simulator
                </h3>
                <p className="mt-1 text-xs text-[var(--ks-lb-text-muted)]">
                  Adjust simulated MRI feature signals to observe how the multi-plane network computes uncalibrated model scores and positions attention weights across slices.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Controls */}
                <div className="space-y-4 rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                  <div>
                    <label className="text-xs font-semibold text-white block mb-2">
                      Target Finding
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['acl', 'mcl', 'medial_meniscus'] as const).map((fid) => (
                        <button
                          key={fid}
                          type="button"
                          onClick={() => setSelectedFinding(fid)}
                          className={`px-3 py-2 text-xs rounded border transition-colors ${
                            selectedFinding === fid
                              ? 'bg-[var(--ks-lb-accent)] text-[var(--ks-lb-on-accent)] font-semibold border-[var(--ks-lb-accent)]'
                              : 'bg-[var(--ks-lb-raised)] text-[var(--ks-lb-text-muted)] border-[var(--ks-lb-line)] hover:text-white'
                          }`}
                        >
                          {fid === 'acl' ? 'ACL Tear' : fid === 'mcl' ? 'MCL Tear' : 'Medial Meniscus'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-white">
                        Simulated Feature Intensity (Voxel Disruption)
                      </label>
                      <span className="font-mono text-xs text-[var(--ks-lb-accent)]">
                        {featureIntensity}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={featureIntensity}
                      onChange={(e) => setFeatureIntensity(Number(e.target.value))}
                      className="w-full accent-[var(--ks-lb-accent)] cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-[var(--ks-lb-text-faint)] mt-1 font-mono">
                      <span>Normal Anatomy (0%)</span>
                      <span>Mild Sprain (50%)</span>
                      <span>Complete Rupture (100%)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--ks-lb-line)] space-y-2 text-xs text-[var(--ks-lb-text-muted)]">
                    <div className="flex justify-between">
                      <span>Decision Threshold:</span>
                      <span className="font-mono text-white">0.50 (Standard)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Score Type:</span>
                      <span className="font-mono text-white">uncalibrated_model_score</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Spatial Activation Plane:</span>
                      <span className="font-mono text-white">
                        {selectedFinding === 'acl' ? 'Sagittal (Slice 12)' : selectedFinding === 'mcl' ? 'Coronal (Slice 14)' : 'Sagittal (Slice 18)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Output Simulation Card */}
                <div className="space-y-4 rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-[var(--ks-lb-line)] pb-3">
                      <div>
                        <div className="text-[11px] font-mono uppercase text-[var(--ks-lb-text-faint)]">
                          Output Model Score
                        </div>
                        <div className="text-3xl font-mono font-bold text-white mt-1">
                          {simulatedScore.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-mono font-bold rounded border ${
                            isAboveThreshold
                              ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                              : 'bg-emerald-950/70 border-emerald-600 text-emerald-300'
                          }`}
                        >
                          {isAboveThreshold ? 'ABOVE THRESHOLD (≥0.50)' : 'BELOW THRESHOLD (<0.50)'}
                        </span>
                        <div className="text-[11px] text-[var(--ks-lb-text-faint)] mt-1 font-mono">
                          {isAboveThreshold ? 'Suspected Finding Flagged' : 'No Tear Indicated'}
                        </div>
                      </div>
                    </div>

                    {/* Attention Heatmap Mockup */}
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Grad-CAM Spatial Attention Preview</span>
                        <span className="font-mono text-[11px] text-[var(--ks-lb-accent)]">
                          Weight: {(simulatedScore * 1.1).toFixed(2)}x
                        </span>
                      </div>
                      <div className="relative h-28 rounded border border-[var(--ks-lb-line-strong)] bg-black flex items-center justify-center overflow-hidden">
                        {/* Knee phantom graphic */}
                        <div className="w-20 h-20 rounded-full border border-neutral-700 bg-neutral-900 flex items-center justify-center">
                          <div className="w-10 h-10 rounded-full border border-neutral-800 bg-neutral-950" />
                        </div>
                        {/* Attention overlay blob */}
                        <div
                          className="absolute w-16 h-16 rounded-full pointer-events-none transition-all duration-300"
                          style={{
                            background: `radial-gradient(circle, rgba(217, 128, 91, ${Math.min(0.9, simulatedScore * 0.95)}) 0%, rgba(230, 201, 138, ${Math.min(0.6, simulatedScore * 0.6)}) 45%, transparent 75%)`,
                            transform: `scale(${0.7 + simulatedScore * 0.6})`,
                          }}
                        />
                        <div className="absolute bottom-1 right-2 text-[10px] font-mono text-[var(--ks-lb-text-faint)]">
                          Slice #{selectedFinding === 'acl' ? '12 (Sagittal)' : '14 (Coronal)'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLaunchScenario('/studies/fx-study-001?sim=true')}
                    className="btn primary text-xs w-full inline-flex items-center justify-center gap-1.5"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Open Live Study with These Parameters
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 7-STEP ARCHITECTURE */}
          {activeTab === 'architecture' && (
            <div className="space-y-4">
              <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                <h3 className="text-sm font-semibold text-white">
                  The KneeScope 7-Step Review Workflow
                </h3>
                <p className="mt-1 text-xs text-[var(--ks-lb-text-muted)]">
                  Engineered strictly according to the product specifications and canonical research review workflow.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    step: 1,
                    title: 'Select Permitted Study',
                    desc: 'Studies are filtered by dataset permissions. Patient metadata and multi-planar series availability (Sagittal, Coronal, Axial) are validated upfront.',
                    icon: Layers,
                  },
                  {
                    step: 2,
                    title: 'Inspect Multi-Slice Imaging Series',
                    desc: 'Review volumetric MRI acquisitions slice by slice. Display adjustments (brightness and contrast) enhance visualization without mutating raw pixel tensors.',
                    icon: Eye,
                  },
                  {
                    step: 3,
                    title: 'Run Multi-Plane Model Inference',
                    desc: 'The model extracts 32 slices per plane, processes features through ResNet-18, and aggregates spatial features via attention pooling to generate finding scores.',
                    icon: Activity,
                  },
                  {
                    step: 4,
                    title: 'Review Multi-Finding Scores',
                    desc: 'Inspect scores for active dataset findings (ACL Tear, MCL Tear, Medial Meniscus, Lateral Meniscus) against calibrated 0.50 decision thresholds.',
                    icon: Sparkles,
                  },
                  {
                    step: 5,
                    title: 'Inspect Influential Slices & Attention Maps',
                    desc: 'Model explainability flags top-weighted slices and projects Grad-CAM heatmap overlays onto the MRI viewer to identify spatial regions of attention.',
                    icon: Compass,
                  },
                  {
                    step: 6,
                    title: 'Reveal Dataset Reference Labels',
                    desc: 'Dataset labels are strictly isolated during inference. Once reviewed, researchers reveal ground truth labels to independently evaluate concordance.',
                    icon: FileCheck2,
                  },
                  {
                    step: 7,
                    title: 'Review Performance & Model Card',
                    desc: 'The Evaluation Ledger records test cohort AUROC, sensitivity, and specificity. The Model Card details training parameters, limitations, and ethical boundaries.',
                    icon: FileText,
                  },
                ].map((s) => {
                  const SIcon = s.icon;
                  return (
                    <div
                      key={s.step}
                      className="flex items-start gap-3 rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-raised)] text-xs font-mono font-bold text-[var(--ks-lb-accent)]">
                        {s.step}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white flex items-center gap-2">
                          <SIcon className="h-3.5 w-3.5 text-[var(--ks-lb-accent)]" />
                          {s.title}
                        </h4>
                        <p className="mt-0.5 text-xs text-[var(--ks-lb-text-muted)] leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SCIENTIFIC GUARDRAILS */}
          {activeTab === 'guardrails' && (
            <div className="space-y-4">
              <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-4">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--ks-lb-accent)]" />
                  Scientific & Ethical Guardrails (AGENTS.md Section 16)
                </h3>
                <p className="mt-1 text-xs text-[var(--ks-lb-text-muted)]">
                  KneeScope enforces strict data integrity rules. Implementation details never violate these boundaries:
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: 'Zero Slice-Level Leakage',
                    detail:
                      'Splitting is performed strictly at the patient/study level. Slices from the same knee never cross train and test partitions.',
                  },
                  {
                    title: 'Strict Label Isolation',
                    detail:
                      'Dataset ground truth labels NEVER feed into model inference. Predictions take only MRI image series IDs.',
                  },
                  {
                    title: 'Uncalibrated Scores vs Probabilities',
                    detail:
                      'Scores are always clearly labeled as "uncalibrated model score" unless Platt scaling or isotonic regression is formally proven.',
                  },
                  {
                    title: 'Attention Is Not Lesion Localization',
                    detail:
                      'Grad-CAM heatmaps highlight model feature attention, never anatomical lesion boundaries or surgical margins.',
                  },
                  {
                    title: 'No Masquerading Fixtures',
                    detail:
                      'Fixture and synthetic test studies are permanently branded with hatched provenance badges and explicit notices so researchers never mistake synthetic data for live models.',
                  },
                ].map((g, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] p-3 space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--ks-lb-accent)] shrink-0" />
                      <h4 className="text-xs font-semibold text-white">{g.title}</h4>
                    </div>
                    <p className="text-xs text-[var(--ks-lb-text-muted)] pl-6 leading-relaxed">
                      {g.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] px-6 py-3">
          <div className="text-[11px] text-[var(--ks-lb-text-muted)] font-mono">
            Research prototype mode • Fixture & live model compatible
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn text-xs"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleLaunchScenario('/studies/fx-study-001?sim=true')}
              className="btn primary text-xs inline-flex items-center gap-1.5"
            >
              <Play className="h-3.5 w-3.5" />
              Launch Interactive Simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
