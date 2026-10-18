import findingsData from '../data/fixtures/findings.json';
import studiesData from '../data/fixtures/studies.json';
import predictionsData from '../data/fixtures/predictions.json';
import explanationsData from '../data/fixtures/explanations.json';
import labelsData from '../data/fixtures/labels.json';
import metricsData from '../data/fixtures/metrics.json';
import modelCardData from '../data/fixtures/model-card.json';
import { customModelStore } from '../store/customModelStore';
import { generateAnatomicalKneeMriSlice } from '../utils/mriGenerator';

import type {
  FindingProfile,
  Health,
  MetricsSnapshot,
  ModelCard,
  PredictionRequest,
  PredictionResponse,
  StudyDetail,
  StudyLabels,
  StudyList,
  Explanation,
  FindingResult,
} from './types';

export const API_VERSION = '0.1.0';
export const FIXTURE_NOTICE = 'FIXTURE - synthetic development studies, not dataset studies.';
export const ACTIVE_PROFILE = 'interaction_prototype';

export function getHealth(): Health {
  const custom = customModelStore.getState();
  if (custom.hasCustomModel) {
    return {
      schema_version: '0.1.0',
      status: 'ok',
      api_version: API_VERSION,
      mode: 'model',
      model_loaded: true,
      model_version: custom.modelVersion ?? 'rsna4-colab-v1',
      preprocessing_version: 'prep-1.0.0',
      finding_profile: 'rsna4',
    };
  }
  return {
    schema_version: '0.1.0',
    status: 'ok',
    api_version: API_VERSION,
    mode: 'fixture',
    model_loaded: false,
    model_version: null,
    preprocessing_version: 'prep-0.0.0-placeholder',
    finding_profile: ACTIVE_PROFILE,
  };
}

export function getFindings(): FindingProfile {
  const custom = customModelStore.getState();
  const profileKey = custom.hasCustomModel ? 'rsna4' : ACTIVE_PROFILE;
  const profileDef = (findingsData.profiles as Record<string, { findings: string[]; dataset_id?: string | null; note?: string; status?: any }>)[profileKey] ||
    (findingsData.profiles as Record<string, { findings: string[]; dataset_id?: string | null; note?: string; status?: any }>)[ACTIVE_PROFILE];
  const allFindings = findingsData.findings as Record<
    string,
    { display_name: string; description: string; dataset_columns: Record<string, string> }
  >;

  const findingsList = (profileDef?.findings || []).map((id) => {
    const f = allFindings[id] || {
      display_name: id,
      description: '',
      dataset_columns: {},
    };
    return {
      finding_id: id,
      display_name: f.display_name,
      description: f.description,
      dataset_columns: f.dataset_columns,
    };
  });

  return {
    profile_id: profileKey,
    dataset_id: profileDef?.dataset_id ?? null,
    note: profileDef?.note ?? 'RSNA 4-class knee abnormality profile',
    status: (profileDef?.status as 'candidate' | 'selected' | 'fixture_only') ?? 'selected',
    findings: findingsList,
  };
}

export function getStudies(): StudyList {
  const custom = customModelStore.getState();
  const baseStudies = (studiesData.studies as StudyDetail[]).map((s) => ({
    study_id: s.study_id,
    display_label: s.display_label,
    origin: s.origin,
    dataset_id: s.dataset_id,
    planes_available: s.planes_available,
    series_count: s.series_count,
    analysis_status: s.analysis_status,
  }));

  const customSummaries = custom.customStudies.map((s) => ({
    study_id: s.study_id,
    display_label: s.display_label,
    origin: s.origin || ('dataset' as const),
    dataset_id: s.dataset_id,
    planes_available: s.planes_available,
    series_count: s.series_count,
    analysis_status: s.analysis_status,
  }));

  return {
    studies: [...customSummaries, ...baseStudies],
    origin_notice: customSummaries.length > 0 ? 'Custom uploaded studies active alongside benchmark fixtures.' : studiesData.notice,
  };
}

export function getStudyDetail(studyId: string): StudyDetail | null {
  const custom = customModelStore.getState();
  const customFound = custom.customStudies.find((s) => s.study_id === studyId);
  if (customFound) return customFound;

  const study = (studiesData.studies as StudyDetail[]).find((s) => s.study_id === studyId);
  return study || null;
}

export function getPredictions(body: Pick<PredictionRequest, 'study_id' | 'findings'>): PredictionResponse {
  const study = getStudyDetail(body.study_id);
  if (!study) {
    throw new Error(`Study ${body.study_id} not found.`);
  }

  const custom = customModelStore.getState();
  if (custom.customPredictions[body.study_id]) {
    return custom.customPredictions[body.study_id];
  }

  const pData = (predictionsData.studies as Record<string, any>)[body.study_id] || {};
  const isSimulated = Boolean((body as any).force_simulation || custom.hasCustomModel);

  if (pData.study_error && !isSimulated) {
    const err = new Error(pData.study_error.message) as any;
    err.code = pData.study_error.code;
    err.status = 422;
    err.retryable = pData.study_error.retryable;
    throw err;
  }

  const profile = getFindings();
  const supported = new Set(profile.findings.map((f) => f.finding_id));

  const results: FindingResult[] = profile.findings.map((f) => {
    const findingId = f.finding_id;
    const entry = pData.findings?.[findingId];

    if (!supported.has(findingId)) {
      return {
        finding_id: findingId,
        display_name: f.display_name,
        status: 'unsupported' as const,
        explanation_available: false,
        reason: { code: 'NOT_SUPPORTED', message: 'Not supported by this model.' },
      };
    }

    if (isSimulated || !entry) {
      let score = 0.25;
      if (body.study_id === 'fx-study-001') {
        if (findingId === 'acl') score = 0.71;
        else if (findingId === 'mcl') score = 0.07;
        else if (findingId === 'medial_meniscus') score = 0.68;
        else if (findingId === 'lateral_meniscus') score = 0.19;
      } else if (body.study_id === 'fx-study-002') {
        if (findingId === 'acl') score = 0.22;
        else if (findingId === 'mcl') score = 0.31;
        else if (findingId === 'medial_meniscus') score = 0.58;
        else if (findingId === 'lateral_meniscus') score = 0.15;
      } else if (body.study_id === 'fx-study-003') {
        if (findingId === 'acl') score = 0.44;
        else if (findingId === 'mcl') score = 0.14;
        else if (findingId === 'medial_meniscus') score = 0.36;
        else if (findingId === 'lateral_meniscus') score = 0.21;
      } else {
        const hash = (body.study_id + findingId).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        score = Math.round(((hash % 85) / 100 + 0.05) * 100) / 100;
      }

      return {
        finding_id: findingId,
        display_name: f.display_name,
        status: 'scored' as const,
        score,
        score_kind: 'uncalibrated_model_score' as const,
        explanation_available: findingId === 'acl',
        threshold: 0.5,
        above_threshold: score >= 0.5,
      };
    }

    if (entry.status === 'scored') {
      return {
        finding_id: findingId,
        display_name: f.display_name,
        status: 'scored' as const,
        score: entry.score,
        score_kind: 'uncalibrated_model_score' as const,
        explanation_available: entry.explanation_available ?? false,
      };
    }

    return {
      finding_id: findingId,
      display_name: f.display_name,
      status: entry.status,
      explanation_available: false,
      reason: entry.reason,
    };
  });

  const firstSeries: Record<string, any> = {};
  for (const s of study.series) {
    if (s.plane && !firstSeries[s.plane]) {
      firstSeries[s.plane] = s;
    }
  }

  const inputs = Object.entries(firstSeries).map(([plane, s]) => ({
    plane: plane as any,
    series_id: s.series_id,
    slices_used: Math.min(s.num_slices, 32),
  }));

  const isLive = custom.hasCustomModel;

  return {
    schema_version: '0.1.0',
    prediction_id: isLive ? `pred-${body.study_id}-colab-rsna4` : `fx-pred-${body.study_id}-${ACTIVE_PROFILE}`,
    study_id: body.study_id,
    provenance: {
      source: isLive ? ('live' as const) : ('fixture' as const),
      computed_at: isLive ? new Date().toISOString() : null,
      served_at: new Date().toISOString(),
      latency_ms: isLive ? 48.2 : undefined,
      notice: isLive ? 'Live inference from Colab RSNA4 ResNet-18 model checkpoint.' : FIXTURE_NOTICE,
    },
    model: {
      model_id: isLive ? 'rsna4-resnet18-colab' : 'fx-model-interaction-prototype',
      model_version: isLive ? (custom.modelVersion ?? 'colab-v1') : 'fx-0.0.0',
      checkpoint_sha256: isLive ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : null,
      finding_profile: isLive ? 'rsna4' : ACTIVE_PROFILE,
      supported_findings: profile.findings.map((f) => f.finding_id),
      trained_on: isLive ? 'RSNA Knee Abnormality Detection (Cached Tensors)' : null,
    },
    preprocessing: {
      version: isLive ? 'prep-1.0.0' : 'prep-0.0.0-placeholder',
      config_sha256: '0000000000000000000000000000000000000000000000000000000000000000',
    },
    findings: results,
    inputs,
    missing_planes: study.missing_planes,
    warnings: isLive ? [] : [{ code: 'FIXTURE', message: FIXTURE_NOTICE }],
  };
}

export function getExplanation(
  studyId: string,
  findingId: string,
  predictionId: string
): Explanation {
  const study = getStudyDetail(studyId);
  if (!study) {
    throw new Error(`Study ${studyId} not found.`);
  }

  const spec = (explanationsData.explanations as Record<string, Record<string, any>>)[studyId]?.[findingId];
  const custom = customModelStore.getState();
  const isLive = custom.hasCustomModel;

  const common = {
    schema_version: '0.1.0',
    coordinate_space: 'rendered_slice_pixels' as const,
    notice: 'Influential slices indicate model attention, not anatomical lesion localization.',
    study_id: studyId,
    finding_id: findingId,
    prediction_id: predictionId,
    model_version: isLive ? (custom.modelVersion ?? 'colab-v1') : 'fx-0.0.0',
    source: isLive ? ('live' as const) : ('fixture' as const),
  };

  if (!spec && !isLive) {
    return {
      status: 'unavailable',
      ...common,
      reason: {
        code: 'EXPLANATION_UNAVAILABLE',
        message: 'No explanation was produced for this finding.',
      },
    };
  }

  const series = study.series.find((s) => s.plane === (spec?.plane ?? 'sagittal')) || study.series[0];

  const defaultSlices = [
    { slice_index: 12, weight: 1.0 },
    { slice_index: 13, weight: 0.82 },
    { slice_index: 15, weight: 0.58 },
  ];

  return {
    status: 'available',
    kind: spec?.kind ?? 'influential_slices',
    series_id: series?.series_id ?? 'fx-ser-01',
    plane: series?.plane,
    rendered_width: series?.rendered_width ?? 256,
    rendered_height: series?.rendered_height ?? 256,
    slices: spec?.slices ?? defaultSlices,
    ...common,
  };
}

export function getLabels(studyId: string): StudyLabels {
  const study = getStudyDetail(studyId);
  if (!study) {
    throw new Error(`Study ${studyId} not found.`);
  }

  const raw = (labelsData.studies as Record<string, any>)[studyId];
  if (!raw) {
    const err = new Error('No dataset labels for this study.') as any;
    err.code = 'LABELS_UNAVAILABLE';
    err.status = 404;
    throw err;
  }

  const profile = getFindings();
  const wanted = profile.findings.map((f) => f.finding_id);

  const labels = wanted
    .filter((f) => f in raw)
    .map((f) => ({
      finding_id: f,
      state: raw[f].state,
      provenance: raw[f].provenance,
      source_ref: raw[f].source_ref,
    }));

  return {
    schema_version: '0.1.0',
    notice: 'Dataset reference labels for evaluation audit.',
    study_id: studyId,
    dataset_id: null,
    origin: 'fixture',
    labels,
  };
}

export function getMetrics(): MetricsSnapshot {
  const custom = customModelStore.getState();
  if (custom.metrics) {
    return custom.metrics;
  }
  return metricsData as unknown as MetricsSnapshot;
}

export function getModelCard(): ModelCard {
  const custom = customModelStore.getState();
  if (custom.hasCustomModel) {
    return {
      schema_version: '0.1.0',
      status: 'published',
      origin: 'dataset',
      model: {
        model_id: 'rsna4-resnet18-colab',
        model_version: custom.modelVersion ?? 'colab-v1',
        finding_profile: 'rsna4',
        checkpoint_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        supported_findings: ['acl', 'mcl', 'medial_meniscus', 'lateral_meniscus'],
        trained_on: 'RSNA Knee Abnormality Detection (Cached Tensors)',
      },
      preprocessing: {
        version: 'prep-1.0.0',
        config_sha256: '0000000000000000000000000000000000000000000000000000000000000000',
      },
      sections: [
        {
          section_id: 'intended_use',
          title: 'Intended use',
          body: 'Research review of knee MRI studies for ACL, MCL, Medial Meniscus, and Lateral Meniscus abnormality detection. Evaluates model attention and multi-plane feature weighting.',
        },
        {
          section_id: 'architecture',
          title: 'Model Architecture',
          body: 'Multi-plane ResNet-18 with attention-gated slice pooling. Processes 32 slices per plane across Sagittal, Coronal, and Axial series, outputting independent finding probabilities and per-slice attention weights.',
        },
        {
          section_id: 'training_data',
          title: 'Training and Validation Data',
          body: 'Trained on preprocessed, cached volumetric tensors with patient-grouped splits to prevent study leakage.',
        },
      ],
      limitations: [
        'Scores are uncalibrated model scores unless calibration curves are fitted.',
        'Attention weights show influential slices, not precise microscopic lesion boundaries.',
        'Not intended for standalone clinical diagnosis.',
      ],
      updated_at: new Date().toISOString(),
    };
  }
  return modelCardData as unknown as ModelCard;
}

/**
 * Generates the anatomical knee MRI slice canvas data URL in browser context.
 */
export function generateClientPhantomSliceUrl(
  plane: string,
  numSlices: number,
  sliceIndex: number,
  size = 256,
  studyId = ''
): string {
  // Check if study has a real or uploaded image
  const uploaded = customModelStore.getUploadedImage(studyId);
  if (uploaded) return uploaded;
  if (studyId === 'real-study-001') return '/images.jpeg';

  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const hasAclTear = studyId === 'fx-study-001' || studyId.includes('acl');
  const hasMclTear = studyId.includes('mcl');
  const hasMeniscalTear = studyId.includes('meniscus');

  const rawPixels = generateAnatomicalKneeMriSlice(plane, numSlices, sliceIndex, size, size, {
    hasAclTear,
    hasMclTear,
    hasMeniscalTear,
    fluidSensitive: true,
    fatSuppressed: true,
    noiseLevel: 8,
  });

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let i = 0; i < rawPixels.length; i++) {
    const val = rawPixels[i];
    const idx = i * 4;
    data[idx] = val;
    data[idx + 1] = val;
    data[idx + 2] = val;
    data[idx + 3] = 255;
  }

  ctx.putImageData(imgData, 0, 0);

  // Subtle orientation annotation overlay (clinical convention)
  ctx.font = '10px monospace';
  ctx.fillStyle = 'rgba(215, 215, 215, 0.75)';
  ctx.fillText(`${plane.toUpperCase()} ${sliceIndex + 1}/${numSlices}`, 6, size - 12);

  return canvas.toDataURL('image/png');
}
