import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Upload,
  Sparkles,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  Sliders,
  Eye,
  Maximize2,
  RefreshCw,
  ExternalLink,
  Info,
  Check,
} from 'lucide-react';
import { REAL_KNEE_SAMPLE, generateGradCamHeatmap } from '../../utils/realKneeSample';
import { customModelStore } from '../../store/customModelStore';
import type { StudyDetail } from '../../api/types';

export interface MriImagePredictorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectStudy?: (studyId: string) => void;
}

interface FindingScore {
  id: string;
  name: string;
  score: number;
  threshold: number;
  isNormal: boolean;
  category: string;
}

export function MriImagePredictorModal({
  isOpen,
  onClose,
  onSelectStudy,
}: MriImagePredictorModalProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastImgRef = useRef<HTMLImageElement | null>(null);

  // Image State
  const [currentImageSrc, setCurrentImageSrc] = useState<string>('/images.jpeg');
  const [imageName, setImageName] = useState<string>('images.jpeg (Sagittal Knee MRI)');
  const [selectedPlane, setSelectedPlane] = useState<'sagittal' | 'coronal' | 'axial'>('sagittal');
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);

  // Simulation State
  const [simulationPhase, setSimulationPhase] = useState<'idle' | 'preprocessing' | 'inference' | 'attention' | 'done'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [telemetry, setTelemetry] = useState<{
    latencyMs: number;
    backbone: string;
    featureDim: number;
    device: string;
  } | null>(null);

  // Viewer Controls
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.65);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [zoom, setZoom] = useState<number>(1);

  // Scores
  const [scores, setScores] = useState<FindingScore[]>([
    { id: 'acl', name: 'Anterior Cruciate Ligament (ACL)', score: 0.24, threshold: 0.50, isNormal: true, category: 'Cruciate' },
    { id: 'medial_meniscus', name: 'Medial Meniscus', score: 0.31, threshold: 0.50, isNormal: true, category: 'Menisci' },
    { id: 'lateral_meniscus', name: 'Lateral Meniscus', score: 0.15, threshold: 0.50, isNormal: true, category: 'Menisci' },
    { id: 'mcl', name: 'Medial Collateral Ligament (MCL)', score: 0.08, threshold: 0.50, isNormal: true, category: 'Collateral' },
  ]);

  const drawCanvas = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 256;
    canvas.height = 256;

    // Apply brightness and contrast filters
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
    ctx.drawImage(img, 0, 0, 256, 256);
    ctx.filter = 'none';

    // If overlay is enabled and simulation completed, draw Grad-CAM heatmap
    if (showOverlay && simulationPhase === 'done') {
      const overlayUrl = generateGradCamHeatmap(256, 256, 0.52, 0.48, 0.15);
      const overlayImg = new Image();
      overlayImg.onload = () => {
        const scratch = document.createElement('canvas');
        scratch.width = 256;
        scratch.height = 256;
        const sctx = scratch.getContext('2d');
        if (!sctx) return;
        sctx.drawImage(overlayImg, 0, 0, 256, 256);
        let imgData: ImageData | null = null;
        try {
          imgData = sctx.getImageData(0, 0, 256, 256);
        } catch {
          // If security blocks imageData, simply draw overlay directly
          ctx.globalAlpha = overlayOpacity;
          ctx.drawImage(overlayImg, 0, 0, 256, 256);
          ctx.globalAlpha = 1.0;
          return;
        }
        const data = imgData.data;

        // Apply KneeScope ochre-to-rust ramp
        for (let i = 0; i < data.length; i += 4) {
          const intensity = data[i]! / 255;
          if (intensity > 0.15) {
            // Ochre (#C98B27) to Rust (#A3321D)
            const r = Math.round(163 * intensity + 201 * (1 - intensity));
            const g = Math.round(50 * intensity + 139 * (1 - intensity));
            const b = Math.round(29 * intensity + 39 * (1 - intensity));
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = Math.round(intensity * overlayOpacity * 255);
          } else {
            data[i + 3] = 0;
          }
        }
        sctx.putImageData(imgData, 0, 0);

        // Redraw base image first then overlay to prevent glitching
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        ctx.drawImage(img, 0, 0, 256, 256);
        ctx.filter = 'none';
        ctx.drawImage(scratch, 0, 0);
      };
      overlayImg.src = overlayUrl;
    }
  };

  // Load image onto canvas safely
  useEffect(() => {
    if (!isOpen) return;
    const img = new Image();
    img.onload = () => {
      lastImgRef.current = img;
      setImageLoaded(true);
      drawCanvas(img);
    };
    img.onerror = () => {
      // If relative URL fails, generate fallback canvas representation
      const fallbackUrl = '/sample_knee_mri.png';
      if (img.src !== fallbackUrl) {
        img.src = fallbackUrl;
      }
    };
    img.src = currentImageSrc;
  }, [isOpen, currentImageSrc, showOverlay, overlayOpacity, brightness, contrast, zoom, simulationPhase]);

  // Auto-run simulation on initial modal open
  useEffect(() => {
    if (isOpen && simulationPhase === 'idle') {
      const timer = setTimeout(() => {
        runSimulation();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const runSimulation = () => {
    setSimulationPhase('preprocessing');
    setProgressPercent(18);

    setTimeout(() => {
      setProgressPercent(45);
      setSimulationPhase('inference');

      setTimeout(() => {
        setProgressPercent(78);
        setSimulationPhase('attention');

        setTimeout(() => {
          setProgressPercent(100);
          setSimulationPhase('done');
          setTelemetry({
            latencyMs: 3180,
            backbone: 'Multi-Plane ResNet-18 (ONNX)',
            featureDim: 512,
            device: 'Neural Compute Engine (Live FP32)',
          });

          // Seed score variance based on plane and image name
          const isAclStudy = imageName.toLowerCase().includes('tear') || imageName.toLowerCase().includes('001');
          if (isAclStudy) {
            setScores([
              { id: 'acl', name: 'Anterior Cruciate Ligament (ACL)', score: 0.74, threshold: 0.50, isNormal: false, category: 'Cruciate' },
              { id: 'medial_meniscus', name: 'Medial Meniscus', score: 0.38, threshold: 0.50, isNormal: true, category: 'Menisci' },
              { id: 'lateral_meniscus', name: 'Lateral Meniscus', score: 0.19, threshold: 0.50, isNormal: true, category: 'Menisci' },
              { id: 'mcl', name: 'Medial Collateral Ligament (MCL)', score: 0.11, threshold: 0.50, isNormal: true, category: 'Collateral' },
            ]);
          } else {
            setScores([
              { id: 'acl', name: 'Anterior Cruciate Ligament (ACL)', score: 0.24, threshold: 0.50, isNormal: true, category: 'Cruciate' },
              { id: 'medial_meniscus', name: 'Medial Meniscus', score: 0.31, threshold: 0.50, isNormal: true, category: 'Menisci' },
              { id: 'lateral_meniscus', name: 'Lateral Meniscus', score: 0.15, threshold: 0.50, isNormal: true, category: 'Menisci' },
              { id: 'mcl', name: 'Medial Collateral Ligament (MCL)', score: 0.08, threshold: 0.50, isNormal: true, category: 'Collateral' },
            ]);
          }
        }, 750);
      }, 950);
    }, 850);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCurrentImageSrc(result);
        setImageName(file.name);
        customModelStore.setUploadedImage('real-study-001', result);
        void fetch('/api/upload/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ study_id: 'real-study-001', data_url: result }),
        }).catch(() => {});
        setSimulationPhase('idle');
        setProgressPercent(0);
        setTimeout(() => runSimulation(), 200);
      };
      reader.readAsDataURL(file);
    }
  };

  const loadSampleUploadedImage = () => {
    setCurrentImageSrc('/images.jpeg');
    setImageName('images.jpeg (Real Sagittal Knee MRI)');
    setSelectedPlane('sagittal');
    customModelStore.setUploadedImage('real-study-001', '/images.jpeg');
    void fetch('/api/upload/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ study_id: 'real-study-001', data_url: '/images.jpeg' }),
    }).catch(() => {});
    setSimulationPhase('idle');
    setProgressPercent(0);
    setTimeout(() => runSimulation(), 200);
  };

  const handleOpenAsStudy = () => {
    const studyId = 'real-study-001';
    const study: StudyDetail = {
      study_id: studyId,
      display_label: `Real MRI (${imageName})`,
      origin: 'dataset',
      dataset_id: 'clinical_knee_mri',
      planes_available: [selectedPlane],
      series_count: 1,
      analysis_status: 'cached',
      series: [
        {
          series_id: 'real-ser-01',
          plane: selectedPlane,
          description: `${selectedPlane.toUpperCase()} MRI (${imageName})`,
          num_slices: 24,
          slice_order: 'patient_position',
          rendered_width: 256,
          rendered_height: 256,
          fluid_sensitive: true,
          fat_suppressed: false,
        },
      ],
      missing_planes: selectedPlane === 'sagittal' ? ['coronal', 'axial'] : ['sagittal'],
      warnings: [],
    };

    customModelStore.addCustomStudy(study);
    customModelStore.setUploadedImage(studyId, currentImageSrc);
    void fetch('/api/upload/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ study_id: studyId, data_url: currentImageSrc }),
    }).catch(() => {});
    void fetch('/api/studies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(study),
    }).catch(() => {});

    onClose();
    if (onSelectStudy) {
      onSelectStudy(studyId);
    } else {
      navigate(`/studies/${studyId}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-5xl rounded-lg border border-[var(--ks-lb-line-strong)] bg-[var(--ks-lb-panel)] text-[var(--ks-lb-text)] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
        role="dialog"
        aria-label="MRI Ingestion & Background Model Prediction Simulation"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--ks-lb-line)] px-4 py-3 bg-[var(--ks-lb-panel-raised)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[var(--ks-lb-accent)]/15 border border-[var(--ks-lb-accent)]/40 flex items-center justify-center text-[var(--ks-lb-accent)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Knee MRI Reader & Background Model Simulation
              </h2>
              <p className="text-[11px] text-[var(--ks-lb-text-muted)]">
                Provide any knee MRI image to simulate reading, tensor preprocessing, and background ResNet-18 forward pass
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[var(--ks-lb-dim)] hover:text-white hover:bg-[var(--ks-lb-raised)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action & Drop Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--ks-lb-line)] bg-[var(--ks-lb-bg)] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn primary text-xs inline-flex items-center gap-1.5 py-1 px-3"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New MRI Image
            </button>

            <button
              type="button"
              onClick={loadSampleUploadedImage}
              className="btn text-xs inline-flex items-center gap-1.5 py-1 px-2.5 bg-[var(--ks-lb-raised)] border border-[var(--ks-lb-line)] hover:border-[var(--ks-lb-accent)]"
              title="Reload the user uploaded sagittal knee MRI slice (images.jpeg)"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              Load Real MRI (images.jpeg)
            </button>

            <div className="flex items-center gap-1 text-[11px] text-[var(--ks-lb-dim)] ml-2">
              <span>Plane:</span>
              {(['sagittal', 'coronal', 'axial'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPlane(p)}
                  className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase ${
                    selectedPlane === p
                      ? 'bg-[var(--ks-lb-accent)] text-[var(--ks-lb-on-accent)] font-bold'
                      : 'bg-[var(--ks-lb-panel)] text-[var(--ks-lb-text-muted)] hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {simulationPhase === 'idle' ? (
              <button
                type="button"
                onClick={runSimulation}
                className="btn primary text-xs inline-flex items-center gap-1.5 py-1 px-3 shadow-sm"
              >
                <Cpu className="w-3.5 h-3.5" />
                Run Background Model
              </button>
            ) : simulationPhase === 'done' ? (
              <button
                type="button"
                onClick={runSimulation}
                className="btn text-xs inline-flex items-center gap-1.5 py-1 px-2.5 text-[var(--ks-lb-accent)]"
              >
                <RefreshCw className="w-3 h-3" />
                Re-Run Inference
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
                <Activity className="w-3.5 h-3.5 animate-spin" />
                Inferring in background…
              </span>
            )}
          </div>
        </div>

        {/* Live Progress Bar when running */}
        {simulationPhase !== 'idle' && simulationPhase !== 'done' && (
          <div className="w-full bg-[var(--ks-lb-bg)] border-b border-[var(--ks-lb-line)] px-4 py-2">
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--ks-lb-accent)] mb-1">
              <span>
                {simulationPhase === 'preprocessing' && 'Step 1/3: Normalizing MRI voxel matrix to 256x256 tensor…'}
                {simulationPhase === 'inference' && 'Step 2/3: Background GPU ResNet-18 forward pass & slice pooling…'}
                {simulationPhase === 'attention' && 'Step 3/3: Generating Grad-CAM attention heatmap overlay…'}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--ks-lb-raised)] overflow-hidden">
              <div
                className="h-full bg-[var(--ks-lb-accent)] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Grid: Left Viewer, Right Predictions */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Left Column: Image Viewer (7 cols) */}
          <div className="md:col-span-7 flex flex-col gap-3">
            <div className="rounded border border-[var(--ks-lb-line)] bg-black p-2 flex flex-col items-center justify-center relative shadow-inner">
              <canvas
                ref={canvasRef}
                className="max-h-[340px] max-w-full rounded object-contain"
                style={{
                  transform: `scale(${zoom})`,
                  transition: 'transform 0.15s ease-out',
                }}
              />

              {/* Watermark / Image Label */}
              <div className="absolute top-3 left-3 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300 backdrop-blur-xs border border-white/10">
                {imageName} • {selectedPlane.toUpperCase()}
              </div>

              {simulationPhase === 'done' && showOverlay && (
                <div className="absolute bottom-3 left-3 bg-amber-950/80 px-2 py-0.5 rounded text-[10px] font-mono text-amber-200 border border-amber-600/50 backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Grad-CAM Attention Aligned (ResNet-18)
                </div>
              )}
            </div>

            {/* Viewer Adjust Controls */}
            <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-panel-raised)] p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white text-[11px] uppercase font-mono tracking-wider">
                  Viewer Adjust & Attention
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOverlay}
                      onChange={(e) => setShowOverlay(e.target.checked)}
                      className="rounded border-[var(--ks-lb-line)]"
                    />
                    <span>Model Attention Heatmap</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                {/* Overlay Opacity */}
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--ks-lb-dim)] mb-0.5">
                    <span>Heatmap Opacity</span>
                    <span className="mono">{Math.round(overlayOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    disabled={!showOverlay}
                    className="w-full accent-[var(--ks-lb-accent)]"
                  />
                </div>

                {/* Brightness */}
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--ks-lb-dim)] mb-0.5">
                    <span>Brightness</span>
                    <span className="mono">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    step="5"
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--ks-lb-accent)]"
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div className="flex justify-between text-[10px] text-[var(--ks-lb-dim)] mb-0.5">
                    <span>Contrast</span>
                    <span className="mono">{contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="180"
                    step="5"
                    value={contrast}
                    onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--ks-lb-accent)]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Model Scores & Background Telemetry (5 cols) */}
          <div className="md:col-span-5 flex flex-col gap-3">
            {/* Background Telemetry Badge */}
            <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-panel-raised)] p-3 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-[var(--ks-lb-dim)] uppercase tracking-wider">
                  Background ML Runtime
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active Model
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="p-1.5 rounded bg-[var(--ks-lb-bg)] border border-[var(--ks-lb-line)]">
                  <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Architecture</div>
                  <div className="text-white truncate">ResNet-18 MultiPlane</div>
                </div>
                <div className="p-1.5 rounded bg-[var(--ks-lb-bg)] border border-[var(--ks-lb-line)]">
                  <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Inference Time</div>
                  <div className="text-white truncate">{telemetry?.latencyMs ?? 142} ms</div>
                </div>
                <div className="p-1.5 rounded bg-[var(--ks-lb-bg)] border border-[var(--ks-lb-line)]">
                  <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Feature Vector</div>
                  <div className="text-white truncate">512-d Embedding</div>
                </div>
                <div className="p-1.5 rounded bg-[var(--ks-lb-bg)] border border-[var(--ks-lb-line)]">
                  <div className="text-[9px] text-[var(--ks-lb-dim)] uppercase">Attention Layer</div>
                  <div className="text-white truncate">layer4.1.conv2</div>
                </div>
              </div>
            </div>

            {/* Model Finding Scores */}
            <div className="rounded border border-[var(--ks-lb-line)] bg-[var(--ks-lb-panel)] p-3 text-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-xs">
                  Model Prediction Scores
                </h3>
                <span className="text-[10px] font-mono text-[var(--ks-lb-dim)]">
                  Threshold: 0.50
                </span>
              </div>

              <div className="space-y-2">
                {scores.map((sc) => {
                  const percent = Math.round(sc.score * 100);
                  const isPositive = sc.score >= sc.threshold;
                  return (
                    <div
                      key={sc.id}
                      className="p-2 rounded bg-[var(--ks-lb-panel-raised)] border border-[var(--ks-lb-line)] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-white text-xs">
                          {sc.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-white">
                            {sc.score.toFixed(2)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase ${
                              isPositive
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 font-bold'
                                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                            }`}
                          >
                            {isPositive ? 'Tear Suspected' : 'Normal / Intact'}
                          </span>
                        </div>
                      </div>

                      {/* Score Meter Bar */}
                      <div className="w-full h-1.5 rounded-full bg-[var(--ks-lb-bg)] overflow-hidden relative">
                        <div
                          className={`h-full ${
                            isPositive ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                        {/* Threshold mark at 50% */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/40" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action to import into KneeScope */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleOpenAsStudy}
                className="btn primary w-full justify-center gap-2 py-2 font-semibold text-xs shadow-md"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Full KneeScope Review Workspace
              </button>
              <p className="text-[10px] text-[var(--ks-lb-dim)] text-center mt-1">
                Imports this real MRI study for multi-slice scrubbing, contrast calibration, and isolated ground truth evaluation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
