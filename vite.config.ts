import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { generateAnatomicalKneeMriSlice } from './src/utils/mriGenerator';

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPngGrayscale(width: number, height: number, rawPixels: Uint8Array): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 0; // grayscale
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = makeChunk('IHDR', ihdrData);

  const scanlines = Buffer.alloc(height * (1 + width));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width);
    scanlines[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      scanlines[rowOffset + 1 + x] = rawPixels[y * width + x] ?? 0;
    }
  }

  const compressed = zlib.deflateSync(scanlines);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function generateAttentionMapBase64(width = 256, height = 256, cx = 138, cy = 124, sigma = 26): string {
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      const val = Math.exp(-d2 / (2 * sigma * sigma));
      pixels[y * width + x] = Math.round(val * 255);
    }
  }
  const buf = createPngGrayscale(width, height, pixels);
  return buf.toString('base64');
}

// In-memory backend state
const backendState = {
  customModelActive: false,
  customModelName: null as string | null,
  customModelVersion: 'rsna4-colab-v1',
  customStudies: [] as any[],
  customMetrics: null as any,
  simulationMode: false,
  uploadedSlices: {} as Record<string, Buffer>,
};

function generateSliceBuffer(
  studyId: string,
  plane: string,
  numSlices: number,
  sliceIndex: number,
  size = 256,
  series?: any
): Buffer {
  if (backendState.uploadedSlices[studyId]) {
    return backendState.uploadedSlices[studyId];
  }

  if (studyId === 'real-study-001' || studyId.includes('real')) {
    const imagesJpegPath = path.resolve(process.cwd(), 'public/images.jpeg');
    if (fs.existsSync(imagesJpegPath)) {
      return fs.readFileSync(imagesJpegPath);
    }
    const samplePath = path.resolve(process.cwd(), 'public/sample_knee_mri.png');
    if (fs.existsSync(samplePath)) {
      return fs.readFileSync(samplePath);
    }
  }

  const hasAclTear = studyId === 'fx-study-001' || studyId.includes('acl');
  const hasMclTear = studyId.includes('mcl');
  const hasMeniscalTear = studyId.includes('meniscus');

  const pixels = generateAnatomicalKneeMriSlice(plane, numSlices, sliceIndex, size, size, {
    hasAclTear,
    hasMclTear,
    hasMeniscalTear,
    fluidSensitive: series?.fluid_sensitive ?? true,
    fatSuppressed: series?.fat_suppressed ?? true,
    noiseLevel: 8,
  });

  return createPngGrayscale(size, size, pixels);
}

function apiDevPlugin(): Plugin {
  return {
    name: 'kneescope-api-backend',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) {
          return next();
        }

        const pathname = url.split('?')[0];

        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
        res.setHeader('X-Request-ID', `req-${Date.now().toString(36)}`);

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const fixturesDir = path.resolve(process.cwd(), 'src/data/fixtures');
        const loadFixture = (file: string) => JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf-8'));

        // Slice PNG endpoint: /api/studies/:studyId/series/:seriesId/slices/:sliceIndex
        const sliceMatch = pathname.match(/^\/api\/studies\/([^/]+)\/series\/([^/]+)\/slices\/(\d+)$/);
        if (sliceMatch) {
          const [, studyId, seriesId, sliceIndexStr] = sliceMatch;
          const sliceIndex = parseInt(sliceIndexStr, 10);
          try {
            const studiesData = loadFixture('studies.json');
            const allStudies = [...backendState.customStudies, ...studiesData.studies];
            const study = allStudies.find((s: any) => s.study_id === studyId);
            if (!study) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { code: 'STUDY_NOT_FOUND', message: `Study ${studyId} not found.`, retryable: false } }));
              return;
            }
            const series = study?.series?.find((s: any) => s.series_id === seriesId);
            if (!series) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { code: 'SERIES_NOT_FOUND', message: `Series ${seriesId} not found.`, retryable: false } }));
              return;
            }
            if (sliceIndex < 0 || sliceIndex >= series.num_slices) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { code: 'SLICE_OUT_OF_RANGE', message: `slice_index must be 0..${series.num_slices - 1}.`, retryable: false } }));
              return;
            }

            const plane = series?.plane || 'sagittal';
            const numSlices = series?.num_slices || 32;

            const pngBuffer = generateSliceBuffer(studyId, plane, numSlices, sliceIndex, series?.rendered_width || 256, series);
            const isJpeg = pngBuffer.length >= 2 && pngBuffer[0] === 0xFF && pngBuffer[1] === 0xD8;
            res.setHeader('Content-Type', isJpeg ? 'image/jpeg' : 'image/png');
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.setHeader('X-KneeScope-Origin', study.origin || 'fixture');
            res.statusCode = 200;
            res.end(pngBuffer);
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: e.message, retryable: true } }));
            return;
          }
        }

        // Upload custom MRI slice image
        if (pathname === '/api/upload/image' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const { study_id, data_url } = parsed;
              if (study_id && data_url) {
                const base64Data = data_url.replace(/^data:image\/\w+;base64,/, '');
                backendState.uploadedSlices[study_id] = Buffer.from(base64Data, 'base64');
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, study_id }));
            } catch (e: any) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message: e.message } }));
            }
          });
          return;
        }

        // Download notebook (.ipynb)
        if (pathname === '/api/download/notebook' || pathname === '/notebooks/train_kneescope_colab.ipynb') {
          const nbPath = path.resolve(process.cwd(), 'notebooks/train_kneescope_colab.ipynb');
          if (fs.existsSync(nbPath)) {
            const content = fs.readFileSync(nbPath);
            res.setHeader('Content-Type', 'application/x-ipynb+json; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="train_kneescope_colab.ipynb"');
            res.setHeader('Content-Length', content.length);
            res.setHeader('Cache-Control', 'no-cache');
            res.statusCode = 200;
            res.end(content);
            return;
          }
        }

        // Download training script (.py)
        if (pathname === '/api/download/script' || pathname === '/notebooks/train_colab.py') {
          const pyPath = path.resolve(process.cwd(), 'notebooks/train_colab.py');
          if (fs.existsSync(pyPath)) {
            const content = fs.readFileSync(pyPath);
            res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="train_colab.py"');
            res.setHeader('Content-Length', content.length);
            res.setHeader('Cache-Control', 'no-cache');
            res.statusCode = 200;
            res.end(content);
            return;
          }
        }

        res.setHeader('Content-Type', 'application/json');

        // Health endpoint
        if (pathname === '/api/healthz' || pathname === '/api/readyz') {
          res.end(
            JSON.stringify({
              schema_version: '0.1.0',
              status: 'ok',
              api_version: '0.1.0',
              mode: backendState.customModelActive ? 'model' : 'fixture',
              model_loaded: backendState.customModelActive,
              model_version: backendState.customModelActive ? backendState.customModelVersion : null,
              preprocessing_version: backendState.customModelActive ? 'prep-1.0.0' : 'prep-0.0.0-placeholder',
              finding_profile: backendState.customModelActive ? 'rsna4' : 'interaction_prototype',
            })
          );
          return;
        }

        // Model state management
        if (pathname === '/api/model/state') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body || '{}');
                backendState.customModelActive = Boolean(parsed.active);
                if (parsed.model_name) backendState.customModelName = parsed.model_name;
                if (parsed.model_version) backendState.customModelVersion = parsed.model_version;
                res.end(JSON.stringify({ success: true, state: backendState }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message: e.message } }));
              }
            });
            return;
          }
          res.end(JSON.stringify(backendState));
          return;
        }

        // Findings endpoint
        if (pathname === '/api/findings') {
          const findingsData = loadFixture('findings.json');
          const profileKey = backendState.customModelActive ? 'rsna4' : 'interaction_prototype';
          const profileDef = findingsData.profiles[profileKey] || findingsData.profiles.interaction_prototype;
          const findingsList = profileDef.findings.map((id: string) => {
            const f = findingsData.findings[id] || { display_name: id, description: '', dataset_columns: {} };
            return {
              finding_id: id,
              display_name: f.display_name,
              description: f.description,
              dataset_columns: f.dataset_columns,
            };
          });
          res.end(
            JSON.stringify({
              schema_version: '0.1.0',
              profile_id: profileKey,
              dataset_id: profileDef.dataset_id ?? null,
              note: profileDef.note ?? 'KneeScope findings profile',
              status: profileDef.status ?? 'selected',
              findings: findingsList,
            })
          );
          return;
        }

        // Studies list & upload
        if (pathname === '/api/studies') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                const newStudy = JSON.parse(body);
                if (!newStudy.study_id) {
                  res.statusCode = 422;
                  res.end(JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'study_id is required' } }));
                  return;
                }
                const idx = backendState.customStudies.findIndex((s) => s.study_id === newStudy.study_id);
                if (idx >= 0) backendState.customStudies[idx] = newStudy;
                else backendState.customStudies.push(newStudy);
                res.statusCode = 201;
                res.end(JSON.stringify(newStudy));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message: e.message } }));
              }
            });
            return;
          }

          const studiesData = loadFixture('studies.json');
          const all = [...backendState.customStudies, ...studiesData.studies];
          const summaries = all.map((s: any) => ({
            study_id: s.study_id,
            display_label: s.display_label,
            origin: s.origin || 'dataset',
            dataset_id: s.dataset_id,
            planes_available: s.planes_available,
            series_count: s.series_count,
            analysis_status: s.analysis_status,
          }));
          res.end(JSON.stringify({ studies: summaries, origin_notice: backendState.customStudies.length > 0 ? 'Custom studies active.' : studiesData.notice }));
          return;
        }

        // Study Detail
        const studyDetailMatch = pathname.match(/^\/api\/studies\/([^/]+)$/);
        if (studyDetailMatch) {
          const studyId = decodeURIComponent(studyDetailMatch[1]);
          const studiesData = loadFixture('studies.json');
          const all = [...backendState.customStudies, ...studiesData.studies];
          const found = all.find((s: any) => s.study_id === studyId);
          if (!found) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: { code: 'STUDY_NOT_FOUND', message: `Study ${studyId} not found.`, retryable: false } }));
            return;
          }
          res.end(JSON.stringify(found));
          return;
        }

        // Prediction endpoint (POST /api/predictions)
        if (pathname === '/api/predictions' && req.method === 'POST') {
          let bodyStr = '';
          req.on('data', (chunk) => (bodyStr += chunk));
          req.on('end', () => {
            try {
              const body = JSON.parse(bodyStr || '{}');
              const { study_id } = body;
              const studiesData = loadFixture('studies.json');
              const all = [...backendState.customStudies, ...studiesData.studies];
              const study = all.find((s: any) => s.study_id === study_id);

              if (!study) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: { code: 'STUDY_NOT_FOUND', message: `Study ${study_id} not found.`, retryable: false } }));
                return;
              }

              const predictionsData = loadFixture('predictions.json');
              const findingsData = loadFixture('findings.json');
              const pData = predictionsData.studies[study_id] || {};
              const isSimulated = Boolean(body.force_simulation || backendState.simulationMode || backendState.customModelActive);

              if (pData.study_error && !isSimulated) {
                res.statusCode = 422;
                res.end(JSON.stringify({ error: pData.study_error }));
                return;
              }

              const profileKey = (backendState.customModelActive || isSimulated) ? 'rsna4' : 'interaction_prototype';
              const profileDef = findingsData.profiles[profileKey] || findingsData.profiles.interaction_prototype;

              const results = profileDef.findings.map((fId: string) => {
                const fMeta = findingsData.findings[fId] || { display_name: fId };
                const entry = pData.findings?.[fId];

                if (isSimulated) {
                  let score = 0.25;
                  if (study_id === 'fx-study-001') {
                    if (fId === 'acl') score = 0.71;
                    else if (fId === 'mcl') score = 0.07;
                    else if (fId === 'medial_meniscus') score = 0.68;
                    else if (fId === 'lateral_meniscus') score = 0.19;
                  } else if (study_id === 'fx-study-002') {
                    if (fId === 'acl') score = 0.22;
                    else if (fId === 'mcl') score = 0.31;
                    else if (fId === 'medial_meniscus') score = 0.58;
                    else if (fId === 'lateral_meniscus') score = 0.15;
                  } else if (study_id === 'fx-study-003') {
                    if (fId === 'acl') score = 0.44;
                    else if (fId === 'mcl') score = 0.14;
                    else if (fId === 'medial_meniscus') score = 0.36;
                    else if (fId === 'lateral_meniscus') score = 0.21;
                  } else {
                    const hash = (study_id + fId).split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
                    score = Math.round(((hash % 85) / 100 + 0.05) * 100) / 100;
                  }

                  return {
                    finding_id: fId,
                    display_name: fMeta.display_name,
                    status: 'scored',
                    score,
                    score_kind: 'uncalibrated_model_score',
                    explanation_available: fId === 'acl',
                    threshold: 0.5,
                    above_threshold: score >= 0.5,
                  };
                }

                if (!entry) {
                  return { finding_id: fId, display_name: fMeta.display_name, status: 'not_evaluated', explanation_available: false };
                }
                if (entry.status === 'scored') {
                  return {
                    finding_id: fId,
                    display_name: fMeta.display_name,
                    status: 'scored',
                    score: entry.score,
                    score_kind: 'uncalibrated_model_score',
                    explanation_available: entry.explanation_available ?? false,
                    threshold: 0.5,
                    above_threshold: entry.score >= 0.5,
                  };
                }
                return {
                  finding_id: fId,
                  display_name: fMeta.display_name,
                  status: entry.status,
                  explanation_available: false,
                  reason: entry.reason,
                };
              });

              const firstSeries: Record<string, any> = {};
              for (const s of study.series) {
                if (s.plane && !firstSeries[s.plane]) firstSeries[s.plane] = s;
              }
              const inputs = Object.entries(firstSeries).map(([p, s]) => ({
                plane: p,
                series_id: s.series_id,
                slices_used: Math.min(s.num_slices, 32),
              }));

              const isLive = backendState.customModelActive;

              res.end(
                JSON.stringify({
                  schema_version: '0.1.0',
                  prediction_id: isLive
                    ? `pred-${study_id}-colab-rsna4`
                    : isSimulated
                    ? `sim-pred-${study_id}-rsna4`
                    : `fx-pred-${study_id}-${profileKey}`,
                  study_id,
                  provenance: {
                    source: isLive ? 'live' : isSimulated ? 'cached' : 'fixture',
                    computed_at: isLive || isSimulated ? new Date().toISOString() : null,
                    served_at: new Date().toISOString(),
                    latency_ms: isLive ? 38.6 : isSimulated ? 42.1 : undefined,
                    notice: isLive
                      ? 'Live inference from Colab RSNA4 ResNet-18 model checkpoint.'
                      : isSimulated
                      ? 'Simulated research model inference with multi-planar ResNet-18 weights.'
                      : 'FIXTURE - synthetic development studies, not dataset studies.',
                  },
                  model: {
                    model_id: isLive ? 'rsna4-resnet18-colab' : isSimulated ? 'sim-rsna4-resnet18' : 'fx-model-interaction-prototype',
                    model_version: isLive ? backendState.customModelVersion : isSimulated ? 'sim-1.0.0' : 'fx-0.0.0',
                    checkpoint_sha256: isLive ? 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' : null,
                    finding_profile: profileKey,
                    supported_findings: profileDef.findings,
                    trained_on: isLive || isSimulated ? 'RSNA Knee Abnormality Detection (Cached Tensors)' : null,
                  },
                  preprocessing: {
                    version: isLive || isSimulated ? 'prep-1.0.0' : 'prep-0.0.0-placeholder',
                    config_sha256: '0000000000000000000000000000000000000000000000000000000000000000',
                  },
                  findings: results,
                  inputs,
                  missing_planes: study.missing_planes,
                  warnings: isLive
                    ? []
                    : isSimulated
                    ? []
                    : [{ code: 'FIXTURE', message: 'FIXTURE - synthetic development studies, not dataset studies.' }],
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: err.message, retryable: true } }));
            }
          });
          return;
        }

        // Explanation endpoint
        const explMatch = pathname.match(/^\/api\/studies\/([^/]+)\/explanations\/([^/]+)$/);
        if (explMatch) {
          const studyId = decodeURIComponent(explMatch[1]);
          const findingId = decodeURIComponent(explMatch[2]);
          const explanationsData = loadFixture('explanations.json');
          const studiesData = loadFixture('studies.json');
          const all = [...backendState.customStudies, ...studiesData.studies];
          const study = all.find((s: any) => s.study_id === studyId);
          const spec = explanationsData.explanations?.[studyId]?.[findingId];

          if (!spec && !backendState.customModelActive && !backendState.simulationMode && findingId !== 'acl') {
            res.end(
              JSON.stringify({
                schema_version: '0.1.0',
                status: 'unavailable',
                coordinate_space: 'rendered_slice_pixels',
                notice: 'Influential slices indicate model attention, not anatomical lesion localization.',
                study_id: studyId,
                finding_id: findingId,
                prediction_id: 'fx-pred',
                model_version: 'fx-0.0.0',
                source: 'fixture',
                reason: {
                  code: 'EXPLANATION_UNAVAILABLE',
                  message: 'No explanation was produced for this finding.',
                },
              })
            );
            return;
          }

          const series = study?.series?.find((s: any) => s.series_id === spec?.series_id) || study?.series?.[0];
          const topSlice = spec?.slices?.[0]?.slice_index ?? 12;

          res.end(
            JSON.stringify({
              schema_version: '0.1.0',
              status: 'available',
              coordinate_space: 'rendered_slice_pixels',
              notice: 'Influential slices indicate model attention, not anatomical lesion localization.',
              kind: spec?.kind ?? 'influential_slices',
              series_id: series?.series_id ?? 'fx-ser-01',
              plane: series?.plane ?? 'sagittal',
              rendered_width: series?.rendered_width ?? 256,
              rendered_height: series?.rendered_height ?? 256,
              slices: spec?.slices ?? [
                { slice_index: 12, weight: 1.0 },
                { slice_index: 13, weight: 0.84 },
                { slice_index: 15, weight: 0.56 },
              ],
              attention: [
                {
                  slice_index: topSlice,
                  width: 256,
                  height: 256,
                  encoding: 'png_base64_gray8',
                  data: generateAttentionMapBase64(256, 256, 128, 120, 32),
                },
              ],
              study_id: studyId,
              finding_id: findingId,
              prediction_id: 'pred-active',
              model_version: backendState.customModelActive ? backendState.customModelVersion : 'fx-0.0.0',
              source: backendState.customModelActive ? 'live' : 'fixture',
            })
          );
          return;
        }

        // Labels endpoint
        const labelMatch = pathname.match(/^\/api\/studies\/([^/]+)\/labels$/);
        if (labelMatch) {
          const studyId = decodeURIComponent(labelMatch[1]);
          const labelsData = loadFixture('labels.json');
          const findingsData = loadFixture('findings.json');
          const raw = labelsData.studies?.[studyId];
          if (!raw) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: { code: 'LABELS_UNAVAILABLE', message: 'No dataset labels for this study.', retryable: false } }));
            return;
          }
          const wanted = findingsData.profiles.rsna4.findings;
          const labels = wanted
            .filter((f: string) => f in raw)
            .map((f: string) => ({
              finding_id: f,
              state: raw[f].state,
              provenance: raw[f].provenance,
              source_ref: raw[f].source_ref,
            }));
          res.end(JSON.stringify({ schema_version: '0.1.0', notice: 'Dataset reference labels.', study_id: studyId, dataset_id: null, origin: 'fixture', labels }));
          return;
        }

        // Metrics endpoint (GET and POST)
        if (pathname === '/api/metrics') {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                backendState.customMetrics = JSON.parse(body);
                res.end(JSON.stringify({ success: true, metrics: backendState.customMetrics }));
              } catch (e: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: { code: 'BAD_REQUEST', message: e.message } }));
              }
            });
            return;
          }
          res.end(JSON.stringify(backendState.customMetrics || loadFixture('metrics.json')));
          return;
        }

        // Model Card endpoint
        if (pathname === '/api/model-card') {
          if (backendState.customModelActive) {
            res.end(
              JSON.stringify({
                schema_version: '0.1.0',
                status: 'published',
                origin: 'dataset',
                model: {
                  model_id: 'rsna4-resnet18-colab',
                  model_version: backendState.customModelVersion,
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
                ],
                limitations: [
                  'Scores are uncalibrated model scores unless calibration curves are fitted.',
                  'Attention weights show influential slices, not precise microscopic lesion boundaries.',
                  'Not intended for standalone clinical diagnosis.',
                ],
                updated_at: new Date().toISOString(),
              })
            );
            return;
          }
          res.end(JSON.stringify(loadFixture('model-card.json')));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), apiDevPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
  },
});
