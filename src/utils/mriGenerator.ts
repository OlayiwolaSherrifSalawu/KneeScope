/**
 * High-fidelity anatomical knee MRI slice synthesizer.
 * Generates realistic clinical knee MRI slices for Sagittal, Coronal, and Axial planes
 * with genuine musculoskeletal anatomy (femur, tibia, patella, ACL/PCL, menisci, cartilage,
 * joint fluid, soft tissues, and authentic MRI tissue signal intensities & Rician noise).
 */

export interface MriSliceOptions {
  hasAclTear?: boolean;
  hasMclTear?: boolean;
  hasMeniscalTear?: boolean;
  fluidSensitive?: boolean;
  fatSuppressed?: boolean;
  noiseLevel?: number;
}

// Pseudo-random noise generator with reproducible seed
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates a grayscale pixel buffer (width * height, Uint8Array) representing an anatomical knee MRI slice.
 */
export function generateAnatomicalKneeMriSlice(
  plane: 'sagittal' | 'coronal' | 'axial' | string,
  numSlices: number,
  sliceIndex: number,
  width = 256,
  height = 256,
  options: MriSliceOptions = {}
): Uint8Array {
  const pixels = new Uint8Array(width * height);
  const rand = seededRandom((sliceIndex + 1) * 9973 + (plane === 'sagittal' ? 101 : plane === 'coronal' ? 202 : 303));

  // Normalized slice coordinate: z in [-1, 1]
  const z = numSlices > 1 ? ((sliceIndex + 0.5) / numSlices) * 2 - 1 : 0;
  const zAbs = Math.abs(z);

  const {
    hasAclTear = false,
    hasMclTear = false,
    hasMeniscalTear = false,
    fluidSensitive = true,
    fatSuppressed = true,
  } = options;

  // Signal intensities for PD FS / T2 FS vs non-FS
  const SIG_BG = 8;
  const SIG_FAT = fatSuppressed ? 38 : 190;
  const SIG_MUSCLE = 65;
  const SIG_CORTEX = 12; // Bone cortex is signal void
  const SIG_MARROW = fatSuppressed ? 55 : 180;
  const SIG_CARTILAGE = 135; // Articular cartilage has intermediate-high signal
  const SIG_FLUID = fluidSensitive ? 230 : 60; // Synovial fluid is bright on PD FS / T2
  const SIG_LIGAMENT = 25; // Dense fibrous collagen has very short T2
  const SIG_EDEMA = 195; // Bright marrow edema / tear fluid

  // Helper distance functions
  const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x1 - x2, y1 - y2);

  // Capsule contour bounding function
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };

  const smoothstep = (min: number, max: number, value: number) => {
    const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
    return x * x * (3 - 2 * x);
  };

  if (plane === 'sagittal') {
    // -------------------------------------------------------------
    // SAGITTAL PLANE:
    // Left = Anterior (Patella, Patellar tendon, Hoffa's pad)
    // Right = Posterior (Popliteal fossa, PCL attachment)
    // Top = Superior (Femur shaft)
    // Bottom = Inferior (Tibia shaft, Tuberosity)
    // z: -1 (Lateral condyle) -> 0 (Intercondylar notch) -> +1 (Medial condyle)
    // -------------------------------------------------------------
    const isIntercondylar = zAbs < 0.32;
    const isLateral = z < -0.28;
    const isMedial = z > 0.28;

    // Limb outline: large rounded contour
    const limbCx = width * 0.52;
    const limbCy = height * 0.50;
    const limbRx = width * 0.38 + (1 - zAbs * 0.4) * 8;
    const limbRy = height * 0.46;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = SIG_BG;

        // Subcutaneous envelope
        const inLimb = inEllipse(x, y, limbCx, limbCy, limbRx, limbRy);
        if (inLimb) {
          val = SIG_FAT + (rand() - 0.5) * 8;

          // Posterior calf / hamstring muscle bellies
          if (x > width * 0.62 && y > height * 0.58) {
            val = SIG_MUSCLE + (rand() - 0.5) * 6;
          }
          // Anterior quadriceps muscle superiorly
          if (x < width * 0.52 && y < height * 0.28) {
            val = SIG_MUSCLE + (rand() - 0.5) * 6;
          }

          // Hoffa's infrapatellar fat pad (triangular area behind patellar tendon)
          if (x >= width * 0.30 && x <= width * 0.48 && y >= height * 0.44 && y <= height * 0.62) {
            val = fatSuppressed ? 45 : 175;
          }

          // Joint fluid effusion in suprapatellar pouch & recesses
          if (fluidSensitive && x >= width * 0.32 && x <= width * 0.44 && y >= height * 0.28 && y <= height * 0.40) {
            val = SIG_FLUID - 20;
          }
        }

        // --- FEMUR (Distal) ---
        // Shaft descending from top: x ~ 125..155, y ~ 20..95
        const femurShaftX = width * 0.52;
        const femurShaftW = width * 0.14;
        const inFemurShaft = y >= height * 0.08 && y <= height * 0.42 && Math.abs(x - femurShaftX) <= femurShaftW;

        // Femoral Condyle: rounded bulbous posterior expansion
        const condyleCx = width * (isIntercondylar ? 0.54 : 0.56);
        const condyleCy = height * 0.42;
        const condyleRx = width * (isIntercondylar ? 0.16 : 0.21);
        const condyleRy = height * 0.15;
        const inFemurCondyle = inEllipse(x, y, condyleCx, condyleCy, condyleRx, condyleRy);

        if (inFemurShaft || inFemurCondyle) {
          // Inside femur
          const boneDist = inFemurCondyle
            ? 1 - Math.hypot((x - condyleCx) / condyleRx, (y - condyleCy) / condyleRy)
            : (femurShaftW - Math.abs(x - femurShaftX)) / femurShaftW;

          if (boneDist < 0.12) {
            val = SIG_CORTEX; // Dense black cortical bone rim
          } else {
            val = SIG_MARROW + (rand() - 0.5) * 12; // Trabecular marrow texture
            // Pivot-shift bone contusion (edema) in lateral femoral condyle if ACL tear
            if (hasAclTear && isLateral && dist(x, y, width * 0.58, height * 0.44) < width * 0.09) {
              val = SIG_EDEMA + (rand() - 0.5) * 14; // High signal marrow bruise
            }
          }
        }

        // Articular Cartilage layer lining femoral condyle (smooth intermediate bright band)
        if (inFemurCondyle && y >= height * 0.48 && y <= height * 0.56) {
          const edgeD = Math.abs(Math.hypot((x - condyleCx) / condyleRx, (y - condyleCy) / condyleRy) - 1.0);
          if (edgeD < 0.08) {
            val = SIG_CARTILAGE;
          }
        }

        // --- TIBIA (Proximal) ---
        // Tibial plateau: horizontal flat surface at y ~ 0.56..0.59
        const tibiaCx = width * 0.52;
        const tibiaCy = height * 0.72;
        const tibiaRx = width * (isIntercondylar ? 0.18 : 0.22);
        const tibiaRy = height * 0.20;
        const inTibia = inEllipse(x, y, tibiaCx, tibiaCy, tibiaRx, tibiaRy) && y >= height * 0.56;

        if (inTibia) {
          const tDist = 1 - Math.hypot((x - tibiaCx) / tibiaRx, (y - tibiaCy) / tibiaRy);
          if (tDist < 0.10 || y <= height * 0.575) {
            val = SIG_CORTEX; // Subchondral cortical bone plate
          } else {
            val = SIG_MARROW + (rand() - 0.5) * 12;
            // Lateral tibial plateau pivot-shift bone bruise in ACL tear
            if (hasAclTear && isLateral && dist(x, y, width * 0.58, height * 0.62) < width * 0.08) {
              val = SIG_EDEMA + (rand() - 0.5) * 14;
            }
          }
        }

        // Tibial articular cartilage
        if (y >= height * 0.545 && y <= height * 0.565 && x >= width * 0.36 && x <= width * 0.68) {
          val = SIG_CARTILAGE;
        }

        // --- PATELLA & EXTENSOR MECHANISM ---
        // Patella bone (anterior teardrop/shield, visible in central slices)
        if (zAbs < 0.45) {
          const patellaCx = width * 0.28;
          const patellaCy = height * 0.36;
          const patellaRx = width * 0.07;
          const patellaRy = height * 0.10;
          if (inEllipse(x, y, patellaCx, patellaCy, patellaRx, patellaRy)) {
            const pDist = 1 - Math.hypot((x - patellaCx) / patellaRx, (y - patellaCy) / patellaRy);
            val = pDist < 0.14 ? SIG_CORTEX : SIG_MARROW + (rand() - 0.5) * 10;
          }
          // Patellar cartilage (posterior facet)
          if (x >= width * 0.32 && x <= width * 0.36 && y >= height * 0.30 && y <= height * 0.42) {
            val = SIG_CARTILAGE;
          }

          // Patellar Tendon (dark fibrous cord from inferior patella to tibia)
          if (x >= width * 0.26 && x <= width * 0.31 && y >= height * 0.45 && y <= height * 0.70) {
            val = SIG_LIGAMENT;
          }
          // Quadriceps Tendon (superior patella insertion)
          if (x >= width * 0.27 && x <= width * 0.33 && y >= height * 0.16 && y <= height * 0.28) {
            val = SIG_LIGAMENT;
          }
        }

        // --- CRUCIATE LIGAMENTS (Intercondylar Notch slices) ---
        if (isIntercondylar) {
          // ACL: Oblique taut dark band from postero-lateral femoral notch to anterior tibial spine
          // Line from (x=152, y=108) to (x=114, y=145)
          const aclX1 = width * 0.60;
          const aclY1 = height * 0.44;
          const aclX2 = width * 0.46;
          const aclY2 = height * 0.56;

          // Distance to ACL segment
          const l2 = (aclX2 - aclX1) ** 2 + (aclY2 - aclY1) ** 2;
          const t = Math.max(0, Math.min(1, ((x - aclX1) * (aclX2 - aclX1) + (y - aclY1) * (aclY2 - aclY1)) / l2));
          const projX = aclX1 + t * (aclX2 - aclX1);
          const projY = aclY1 + t * (aclY2 - aclY1);
          const dToAcl = dist(x, y, projX, projY);

          if (dToAcl <= width * 0.024) {
            if (hasAclTear && t >= 0.35 && t <= 0.70) {
              // Torn ACL: ruptured fiber gap, wavy discontinuity & high fluid/edema signal
              val = SIG_EDEMA + (rand() - 0.5) * 16;
            } else {
              val = SIG_LIGAMENT + (rand() - 0.5) * 4;
            }
          }

          // PCL: Curved dark arc from anteromedial femur to posterior tibial plateau
          const pclX = width * 0.58;
          const pclY = height * 0.54;
          const dPcl = Math.abs(Math.hypot(x - pclX, y - pclY) - width * 0.10);
          if (dPcl < width * 0.022 && x >= width * 0.50 && y >= height * 0.46 && y <= height * 0.60) {
            val = SIG_LIGAMENT;
          }
        }

        // --- MENISCI (Lateral & Medial Compartments) ---
        if (!isIntercondylar) {
          // Anterior Horn (sharp triangle pointing central)
          const antX = width * 0.39;
          const antY = height * 0.55;
          if (dist(x, y, antX, antY) < width * 0.042 && x <= antX + 4 && y >= antY - 5 && y <= antY + 5) {
            val = SIG_LIGAMENT;
          }
          // Posterior Horn (larger triangle wedge)
          const postX = width * 0.65;
          const postY = height * 0.55;
          if (dist(x, y, postX, postY) < width * 0.052 && x >= postX - 4 && y >= postY - 6 && y <= postY + 6) {
            if (hasMeniscalTear && isMedial && Math.abs(y - postY) < 1.5) {
              val = SIG_FLUID; // Linear hyperintensity reaching articular surface (grade 3 tear)
            } else {
              val = SIG_LIGAMENT;
            }
          }
        }

        // Rician thermal MRI noise texture
        const noise = (rand() - 0.5) * (options.noiseLevel ?? 9);
        pixels[y * width + x] = Math.max(0, Math.min(255, Math.round(val + noise)));
      }
    }
  } else if (plane === 'coronal') {
    // -------------------------------------------------------------
    // CORONAL PLANE:
    // Left = Medial (MCL, Medial Femoral Condyle, Medial Tibial Plateau)
    // Right = Lateral (LCL, Lateral Condyle, Fibular head)
    // Top = Superior (Femur)
    // Bottom = Inferior (Tibia, Fibula)
    // z: -1 (Anterior/Patella) -> 0 (Mid-joint/Spines) -> +1 (Posterior condyles)
    // -------------------------------------------------------------
    const limbCx = width * 0.50;
    const limbCy = height * 0.50;
    const limbRx = width * 0.42;
    const limbRy = height * 0.46;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = SIG_BG;

        if (inEllipse(x, y, limbCx, limbCy, limbRx, limbRy)) {
          val = SIG_FAT + (rand() - 0.5) * 8;

          // Muscular flanking soft tissues (Vastus medialis & lateralis)
          if ((x < width * 0.22 || x > width * 0.78) && y < height * 0.45) {
            val = SIG_MUSCLE + (rand() - 0.5) * 6;
          }

          // Joint fluid effusion in gutters
          if (fluidSensitive && (x < width * 0.28 || x > width * 0.72) && Math.abs(y - height * 0.52) < height * 0.04) {
            val = SIG_FLUID - 15;
          }
        }

        // --- FEMUR (Distal) ---
        // Femoral shaft descending center
        const femurShaft = Math.abs(x - width * 0.50) < width * 0.16 && y < height * 0.38;

        // Medial Femoral Condyle (Left)
        const medCondyle = inEllipse(x, y, width * 0.36, height * 0.44, width * 0.16, height * 0.14);
        // Lateral Femoral Condyle (Right)
        const latCondyle = inEllipse(x, y, width * 0.64, height * 0.44, width * 0.16, height * 0.14);
        // Intercondylar notch (central indentation between condyles)
        const inNotch = Math.abs(x - width * 0.50) < width * 0.09 && y >= height * 0.42 && y <= height * 0.52;

        if ((femurShaft || medCondyle || latCondyle) && !inNotch) {
          const dBorder = Math.min(
            femurShaft ? (width * 0.16 - Math.abs(x - width * 0.50)) / width : 1,
            medCondyle ? 1 - Math.hypot((x - width * 0.36) / (width * 0.16), (y - height * 0.44) / (height * 0.14)) : 1,
            latCondyle ? 1 - Math.hypot((x - width * 0.64) / (width * 0.16), (y - height * 0.44) / (height * 0.14)) : 1
          );

          if (dBorder < 0.10) {
            val = SIG_CORTEX;
          } else {
            val = SIG_MARROW + (rand() - 0.5) * 12;
          }
        }

        // Femoral Articular Cartilage (lining condyle curves at joint line)
        if (y >= height * 0.49 && y <= height * 0.53 && !inNotch) {
          if (dist(x, y, width * 0.36, height * 0.50) < width * 0.15 || dist(x, y, width * 0.64, height * 0.50) < width * 0.15) {
            val = SIG_CARTILAGE;
          }
        }

        // --- TIBIA (Proximal) ---
        // Medial and Lateral Tibial Plateaus
        const medPlateau = inEllipse(x, y, width * 0.36, height * 0.68, width * 0.17, height * 0.18) && y >= height * 0.54;
        const latPlateau = inEllipse(x, y, width * 0.64, height * 0.68, width * 0.17, height * 0.18) && y >= height * 0.54;
        const tibiaShaft = Math.abs(x - width * 0.50) < width * 0.18 && y >= height * 0.60;

        // Intercondylar Eminence (Tibial Spines peaking in center)
        const spineCenter = width * 0.50;
        const inSpines = Math.abs(x - spineCenter) < width * 0.07 && y >= height * 0.48 && y <= height * 0.55;

        if (medPlateau || latPlateau || tibiaShaft || inSpines) {
          val = SIG_MARROW + (rand() - 0.5) * 12;
          if (y <= height * 0.555 || inSpines) {
            val = SIG_CORTEX;
          }
        }

        // Tibial Articular Cartilage
        if (y >= height * 0.535 && y <= height * 0.555 && !inSpines) {
          if ((x >= width * 0.22 && x <= width * 0.44) || (x >= width * 0.56 && x <= width * 0.78)) {
            val = SIG_CARTILAGE;
          }
        }

        // --- FIBULAR HEAD (Lateral aspect, inferior-lateral) ---
        if (x >= width * 0.78 && x <= width * 0.88 && y >= height * 0.64 && y <= height * 0.85) {
          const dFib = Math.hypot(x - width * 0.83, y - height * 0.74);
          if (dFib < width * 0.055) {
            val = dFib > width * 0.042 ? SIG_CORTEX : SIG_MARROW + (rand() - 0.5) * 8;
          }
        }

        // --- MENISCI (Sharp triangular wedges between condyle and plateau) ---
        // Medial Meniscus Body (Left joint margin: x ~ 0.22..0.32, y ~ 0.51..0.55)
        if (x >= width * 0.22 && x <= width * 0.32 && Math.abs(y - height * 0.53) <= (width * 0.32 - x) * 0.35) {
          if (hasMeniscalTear && Math.abs(y - height * 0.53) < 1.2) {
            val = SIG_FLUID; // Meniscal tear hyperintensity
          } else {
            val = SIG_LIGAMENT;
          }
        }
        // Lateral Meniscus Body (Right joint margin: x ~ 0.68..0.78, y ~ 0.51..0.55)
        if (x >= width * 0.68 && x <= width * 0.78 && Math.abs(y - height * 0.53) <= (x - width * 0.68) * 0.35) {
          val = SIG_LIGAMENT;
        }

        // --- MEDIAL COLLATERAL LIGAMENT (MCL) ---
        // Long dark taut fibrous band running along medial epicondyle to proximal tibia (Left edge)
        if (x >= width * 0.17 && x <= width * 0.20 && y >= height * 0.38 && y <= height * 0.75) {
          if (hasMclTear && Math.abs(y - height * 0.52) < height * 0.04) {
            val = SIG_EDEMA; // High signal fluid edema surrounding disrupted MCL fibers
          } else {
            val = SIG_LIGAMENT;
          }
        }

        // --- LATERAL COLLATERAL LIGAMENT (LCL) ---
        if (x >= width * 0.80 && x <= width * 0.83 && y >= height * 0.42 && y <= height * 0.70) {
          val = SIG_LIGAMENT;
        }

        const noise = (rand() - 0.5) * (options.noiseLevel ?? 9);
        pixels[y * width + x] = Math.max(0, Math.min(255, Math.round(val + noise)));
      }
    }
  } else {
    // -------------------------------------------------------------
    // AXIAL (TRANSVERSE) PLANE:
    // Top = Anterior (Patella, Trochlear groove, Retinaculum)
    // Bottom = Posterior (Popliteal fossa, Posterior condyles)
    // Left = Medial Condyle
    // Right = Lateral Condyle
    // z: -1 (Suprapatellar) -> 0 (Patellofemoral joint) -> +1 (Tibial plateau)
    // -------------------------------------------------------------
    const limbCx = width * 0.50;
    const limbCy = height * 0.50;
    const limbRx = width * 0.44;
    const limbRy = height * 0.42;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = SIG_BG;

        if (inEllipse(x, y, limbCx, limbCy, limbRx, limbRy)) {
          val = SIG_FAT + (rand() - 0.5) * 8;

          // Posterior popliteal neurovascular bundle (dark round flow voids)
          if (Math.abs(x - width * 0.50) < width * 0.05 && y >= height * 0.78 && y <= height * 0.88) {
            val = SIG_CORTEX; // Flow void
          }

          // Gastrocnemius muscle bellies posterolaterally and posteromedially
          if ((x < width * 0.30 || x > width * 0.70) && y > height * 0.65) {
            val = SIG_MUSCLE + (rand() - 0.5) * 6;
          }
        }

        if (z < 0.25) {
          // --- PATELLOFEMORAL SECTION ---
          // Anterior Femur with Trochlear Sulcus (V-shaped notch)
          const femurCx = width * 0.50;
          const femurCy = height * 0.58;
          const femurRx = width * 0.32;
          const femurRy = height * 0.24;

          const inFemurBody = inEllipse(x, y, femurCx, femurCy, femurRx, femurRy) && y >= height * 0.42;
          // Trochlear notch indentation: x ~ 0.46..0.54, y ~ 0.42..0.48
          const inTrochlearGroove = Math.abs(x - femurCx) < width * 0.08 && y >= height * 0.40 && y <= height * 0.50;

          if (inFemurBody && !inTrochlearGroove) {
            const dF = 1 - Math.hypot((x - femurCx) / femurRx, (y - femurCy) / femurRy);
            val = dF < 0.12 ? SIG_CORTEX : SIG_MARROW + (rand() - 0.5) * 12;
          }

          // Trochlear cartilage lining
          if (inFemurBody && Math.abs(y - height * 0.48) < height * 0.025 && Math.abs(x - femurCx) < width * 0.22) {
            val = SIG_CARTILAGE;
          }

          // PATELLA (Anterior sesamoid wedge articulating in trochlea)
          const patellaCx = width * 0.50;
          const patellaCy = height * 0.28;
          const patellaRx = width * 0.16;
          const patellaRy = height * 0.09;

          if (inEllipse(x, y, patellaCx, patellaCy, patellaRx, patellaRy)) {
            const dP = 1 - Math.hypot((x - patellaCx) / patellaRx, (y - patellaCy) / patellaRy);
            val = dP < 0.14 ? SIG_CORTEX : SIG_MARROW + (rand() - 0.5) * 10;
          }
          // Patellar cartilage (posterior surface facing trochlea)
          if (inEllipse(x, y, patellaCx, patellaCy + height * 0.04, patellaRx * 0.85, patellaRy * 0.5)) {
            val = SIG_CARTILAGE;
          }

          // Medial & Lateral Retinaculum (thin dark bands holding patella)
          if (y >= height * 0.28 && y <= height * 0.34) {
            if ((x >= width * 0.24 && x <= width * 0.35) || (x >= width * 0.65 && x <= width * 0.76)) {
              val = SIG_LIGAMENT;
            }
          }
        } else {
          // --- PROXIMAL TIBIA / JOINT LINE SECTION ---
          const tibiaCx = width * 0.50;
          const tibiaCy = height * 0.54;
          const tibiaRx = width * 0.34;
          const tibiaRy = height * 0.26;

          if (inEllipse(x, y, tibiaCx, tibiaCy, tibiaRx, tibiaRy)) {
            const dT = 1 - Math.hypot((x - tibiaCx) / tibiaRx, (y - tibiaCy) / tibiaRy);
            val = dT < 0.12 ? SIG_CORTEX : SIG_MARROW + (rand() - 0.5) * 12;
          }
          // Tibial tuberosity anterior prominence
          if (Math.abs(x - width * 0.50) < width * 0.08 && y >= height * 0.28 && y <= height * 0.36) {
            val = SIG_LIGAMENT; // Patellar tendon insertion
          }
        }

        const noise = (rand() - 0.5) * (options.noiseLevel ?? 9);
        pixels[y * width + x] = Math.max(0, Math.min(255, Math.round(val + noise)));
      }
    }
  }

  return pixels;
}
