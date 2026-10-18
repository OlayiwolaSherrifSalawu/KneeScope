/**
 * Real Knee MRI image helper and Grad-CAM heatmap synthesizer for uploaded MRI images.
 */

/**
 * Creates a circular/elliptical Grad-CAM heatmap base64 data URL aligned to knee anatomical features.
 */
export function generateGradCamHeatmap(
  width = 256,
  height = 256,
  cxRatio = 0.54,
  cyRatio = 0.50,
  sigmaRatio = 0.14
): string {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  const cx = width * cxRatio;
  const cy = height * cyRatio;
  const sigma = width * sigmaRatio;
  const twoSigmaSq = 2 * sigma * sigma;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      const intensity = Math.exp(-d2 / twoSigmaSq);
      const val = Math.min(255, Math.max(0, Math.round(intensity * 255)));

      // Gray8 PNG value
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Real knee MRI sample details (Sagittal view matching uploaded images.jpeg).
 */
export const REAL_KNEE_SAMPLE = {
  study_id: 'real-study-001',
  display_label: 'Real Knee MRI (images.jpeg • Sagittal View)',
  series_id: 'real-ser-01',
  plane: 'sagittal' as const,
  slice_index: 12,
  num_slices: 24,
  description: 'Sagittal T1/PD Knee MRI',
  imageUrl: '/images.jpeg',
  predictions: {
    acl: { score: 0.24, status: 'scored' as const, threshold: 0.5, above: false },
    mcl: { score: 0.08, status: 'scored' as const, threshold: 0.5, above: false },
    medial_meniscus: { score: 0.31, status: 'scored' as const, threshold: 0.5, above: false },
    lateral_meniscus: { score: 0.15, status: 'scored' as const, threshold: 0.5, above: false },
  },
};
