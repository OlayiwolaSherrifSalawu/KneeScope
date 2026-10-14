import type { components } from './schema';

type S = components['schemas'];

export type ApiError = S['ApiError'];
export type AttentionMap = S['AttentionMap'];
export type ApiErrorBody = S['ApiErrorBody'];
export type FindingProfile = S['FindingProfile'];
export type FindingDefinition = S['FindingDefinition'];
export type FindingResult = S['FindingResult'];
export type FindingMetrics = S['FindingMetrics'];
export type Health = S['Health'];
export type MetricValue = S['MetricValue'];
export type MetricsSnapshot = S['MetricsSnapshot'];
export type ModelCard = S['ModelCard'];
export type Explanation = S['Explanation'];
export type PredictionRequest = S['PredictionRequest'];
export type PredictionResponse = S['PredictionResponse'];
export type SeriesSummary = S['SeriesSummary'];
export type StudyDetail = S['StudyDetail'];
export type StudyLabels = S['StudyLabels'];
export type StudyList = S['StudyList'];
export type StudySummary = S['StudySummary'];
export type DatasetLabel = S['DatasetLabel'];

export type Plane = NonNullable<SeriesSummary['plane']>;
export type FindingStatus = FindingResult['status'];
export type ResultSource = PredictionResponse['provenance']['source'];

export const PLANES: readonly Plane[] = ['sagittal', 'coronal', 'axial'];
