import type { MetricsSnapshot, PredictionResponse, StudyDetail } from '../api/types';

export interface CustomModelState {
  hasCustomModel: boolean;
  modelName: string | null;
  modelVersion: string | null;
  modelFile: File | null;
  metrics: MetricsSnapshot | null;
  customStudies: StudyDetail[];
  customPredictions: Record<string, PredictionResponse>;
  uploadedImages: Record<string, string>;
}

const STORAGE_KEY_METRICS = 'kneescope_custom_metrics';
const STORAGE_KEY_STUDIES = 'kneescope_custom_studies';

function loadStoredMetrics(): MetricsSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_METRICS);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadStoredStudies(): StudyDetail[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STUDIES);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

class CustomModelStore {
  private state: CustomModelState = {
    hasCustomModel: false,
    modelName: null,
    modelVersion: null,
    modelFile: null,
    metrics: loadStoredMetrics(),
    customStudies: loadStoredStudies(),
    customPredictions: {},
    uploadedImages: {
      'real-study-001': '/images.jpeg',
    },
  };

  private listeners = new Set<() => void>();

  getState(): CustomModelState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  setCustomModel(file: File) {
    this.state.hasCustomModel = true;
    this.state.modelName = file.name;
    this.state.modelVersion = `rsna4-colab-${new Date().toISOString().slice(0, 10)}`;
    this.state.modelFile = file;
    this.notify();
  }

  setCustomMetrics(metrics: MetricsSnapshot) {
    this.state.metrics = metrics;
    try {
      localStorage.setItem(STORAGE_KEY_METRICS, JSON.stringify(metrics));
    } catch {
      // storage unavailable
    }
    this.notify();
  }

  addCustomStudy(study: StudyDetail) {
    const existingIdx = this.state.customStudies.findIndex((s) => s.study_id === study.study_id);
    if (existingIdx >= 0) {
      this.state.customStudies[existingIdx] = study;
    } else {
      this.state.customStudies.push(study);
    }
    try {
      localStorage.setItem(STORAGE_KEY_STUDIES, JSON.stringify(this.state.customStudies));
    } catch {
      // storage unavailable
    }
    this.notify();
  }

  setCustomPrediction(studyId: string, pred: PredictionResponse) {
    this.state.customPredictions[studyId] = pred;
    this.notify();
  }

  setUploadedImage(studyId: string, dataUrl: string) {
    this.state.uploadedImages[studyId] = dataUrl;
    try {
      // Store in sessionStorage or localStorage if size allows
      sessionStorage.setItem(`kneescope_img_${studyId}`, dataUrl);
    } catch {
      // Ignore if quota exceeded
    }
    this.notify();
  }

  getUploadedImage(studyId: string): string | undefined {
    return this.state.uploadedImages[studyId] || sessionStorage.getItem(`kneescope_img_${studyId}`) || undefined;
  }

  reset() {
    this.state = {
      hasCustomModel: false,
      modelName: null,
      modelVersion: null,
      modelFile: null,
      metrics: null,
      customStudies: [],
      customPredictions: {},
      uploadedImages: {
        'real-study-001': '/images.jpeg',
      },
    };
    try {
      localStorage.removeItem(STORAGE_KEY_METRICS);
      localStorage.removeItem(STORAGE_KEY_STUDIES);
    } catch {
      // ignore
    }
    this.notify();
  }
}

export const customModelStore = new CustomModelStore();
