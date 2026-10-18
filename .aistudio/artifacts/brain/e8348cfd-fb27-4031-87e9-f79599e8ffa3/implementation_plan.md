# KneeScope: Optimal Model Architecture & Pipeline for Cached Tensors

The recommended model architecture, training configuration, loss function, and export format designed to perform best with your preprocessed/cached knee MRI tensors.

### User Review & Critical Decisions

> [!IMPORTANT]
> **What Works Best With Cached Knee MRI Tensors**:
> 1. **Model Backbone — Multi-Plane ResNet-18 with 2.5D Slice Extraction**:
>    - Pretrained ResNet-18 weights extract deep 512-dimensional feature vectors from each slice.
>    - Fast, memory-efficient, and trains on Google Colab in under 20 minutes without out-of-memory errors.
> 2. **Slice Aggregator — Attention-Gated Pooling (Key for Explainability)**:
>    - Pathology like an ACL or meniscal tear typically only appears on 2 to 4 slices out of 32.
>    - Attention-gated pooling learns a normalized weight per slice $\alpha_i \in [0, 1]$.
>    - **Direct Win**: These attention weights feed directly into KneeScope's **"Influential Slices"** panel and heatmaps!
> 3. **Loss Function — Class-Weighted BCE with Logits**:
>    - Compensates for class imbalance (MCL and lateral meniscus tears are less frequent in knee datasets).
> 4. **Export Specs — Dual-Output ONNX (`kneescope_rsna4.onnx`)**:
>    - Outputs both **pathology probabilities** `[ACL, MCL, Medial Meniscus, Lateral Meniscus]` and **per-slice attention weights** `[3, 32]`.
>    - Enables real-time, browser-native inference with WebAssembly/WebGPU.

---

### 1. Detailed Architecture for Cached Tensors

```
 Input Cached Tensors:
 Sagittal (32, 256, 256) ──► [2D ResNet-18 Backbone] ──► Slice Features (32 × 512) ──► [Attention Gate] ──┐
 Coronal  (32, 256, 256) ──► [2D ResNet-18 Backbone] ──► Slice Features (32 × 512) ──► [Attention Gate] ──┼─► [Multimodal Dense] ──► RSNA 4 Scores
 Axial    (32, 256, 256) ──► [2D ResNet-18 Backbone] ──► Slice Features (32 × 512) ──► [Attention Gate] ──┘                                 │
                                                                       │                                                                     │
                                                                       └─────────────────────────► Slice Attention Weights [3, 32] ──────────┘
                                                                                                    (Feeds Influential Slices HUD)
```

- **Input Dimension Handling**:
  - The model expects tensor inputs shaped `(batch, slices, height, width)`: e.g. `(1, 32, 256, 256)`.
  - Slices are passed through the 2D feature extractor in parallel.
  - If a study is missing a plane (e.g. axial is absent), that branch is masked with zeros and ignored by the multimodal aggregator.
- **Attention-Gated Formula**:
  $$\mathbf{a}_i = \frac{\exp(\mathbf{w}^T \tanh(\mathbf{V} \mathbf{h}_i))}{\sum_j \exp(\mathbf{w}^T \tanh(\mathbf{V} \mathbf{h}_j))}, \quad \mathbf{h}_{\text{pooled}} = \sum_i \mathbf{a}_i \mathbf{h}_i$$
  where $\mathbf{a}_i$ represents how much slice $i$ contributed to the abnormality prediction.

---

### 2. What the Colab Training Script Delivers

The script (`train_kneescope_colab.ipynb` / `train_colab.py`) includes:

1. **Auto-Detecting Tensor Loader**:
   - Detects whether your cached tensors are stored as `.pt` (PyTorch) or `.npy` (NumPy).
   - Pairs them with your labels table (`study_id, acl, mcl, medial_meniscus, lateral_meniscus`).
2. **Patient-Grouped Train / Validation Split**:
   - Prevents slice/study leakage between training and validation sets.
3. **Training Loop & Metrics Tracker**:
   - Evaluates ROC AUC after every epoch using `sklearn.metrics.roc_auc_score`.
   - Saves the best checkpoint based on validation Macro ROC AUC.
4. **ONNX Export Function**:
   - Converts the trained PyTorch network to `kneescope_rsna4.onnx` with verified output parity.
   - Saves `metrics.json` containing the real validation ROC AUC curves and thresholds.

---

### 3. KneeScope In-App Integration (Here)

1. **In-App Model & Dataset Hub**:
   - A drawer to download the Colab notebook and upload `kneescope_rsna4.onnx` + `metrics.json`.
2. **Display Conversion for Cached Slices**:
   - In KneeScope, cached float32 arrays `(32, 256, 256)` are converted to 8-bit display PNGs in real-time, allowing instant scrolling across slices with window/level contrast adjustments.
3. **Real Model Execution & Attention Visualization**:
   - Clicking "Run Analysis" executes your trained ONNX model.
   - The top 3 highest-weight slices identified by the attention layer are highlighted in the viewer with ochre-rust overlays.
4. **Evaluation Ledger**:
   - Displays your actual Colab run metrics: Macro AUC, sensitivity, specificity, and model card documentation.
