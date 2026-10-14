# KneeScope design specification

This is the canonical design specification for KneeScope. There is no other design
spec; do not create a lowercase `design.md`. The direction was chosen in
[`docs/design/design-concept.md`](docs/design/design-concept.md) and is demonstrated in
[`docs/design/design-concept.html`](docs/design/design-concept.html).

Implementation tokens live in `web/src/styles/tokens.css`. `scripts/check_design_tokens.py`
fails CI if those tokens drift from §4 or if any pair in §4.4 loses its contrast ratio.

---

## 1. Product design principles

1. **The image comes first.** The viewer well is the largest, most neutral, least
   decorated region on screen. Nothing tinted, animated, or translucent overlaps it except
   explicitly requested overlays.
2. **Evidence, not verdicts.** Scores are shown as model scores with their provenance.
   There is no red/green severity encoding, no "positive/negative" verdict language, no
   diagnosis or treatment wording.
3. **Provenance is always visible.** Every score shows whether it is live, cached, or a
   fixture, plus model and preprocessing versions. Provenance is encoded by text, shape,
   and pattern, never by colour alone.
4. **States are honest and distinct.** Scored, unsupported, not evaluated, unavailable,
   and failed are five different visual states. A low score never looks like a failure.
5. **Labels are separate from inference.** Dataset labels are hidden by default in the
   review workspace and are revealed per finding by an explicit action. They are
   presented as dataset labels with provenance, not as "truth" about the patient.
6. **Calm, precise, quiet.** Fine borders, strict alignment, consistent spacing, one
   accent colour. No decoration that competes with the image.
7. **The dataset defines the findings.** The UI renders whatever finding list the active
   dataset profile supports (`contracts/findings.json`). It never hard-codes four cards.

## 2. Selected direction: Lightbox & Ledger

Two materials share one token system:

- **Lightbox** — the working surfaces (study browser, review workspace, app chrome).
  Warm charcoal panels around a strictly neutral, near-black viewer well. Bone text.
  Olive marks interaction. Ochre marks cached results. Clay/rust marks failure.
- **Ledger** — evidence documents (evaluation page, model card, data audit summaries).
  Bone-paper sheets set inside the lightbox, with a serif display face, ruled tables,
  sample counts beside every metric, and footnoted limitations.

Rationale: a dark neutral surround preserves perceived contrast in grayscale MRI; the
change of material tells the user whether they are looking at an image or at evidence
about the model. It is distinctive without imagery, gradients, or glow, and it is cheap
to implement because both materials use the same spacing, type, and component rules.

## 3. Brand and naming

- Product name: **KneeScope** (one word, capital K and S). Subtitle: "Knee MRI research
  review". The persistent notice reads **"Research prototype — not for diagnosis."**
- Never use: "AI-powered", "detects tears", "diagnosis", "accuracy" (unless an accuracy
  metric is actually computed and labelled), "confidence" (use "model score").
- Finding names come from `contracts/findings.json` display names.

## 4. Colour

### 4.1 Lightbox tokens (dark)

| Token | Hex | Role |
|---|---|---|
| `--ks-lb-bg` | `#191714` | App background, gutters |
| `--ks-lb-panel` | `#211F1B` | Panels, sidebars, findings column |
| `--ks-lb-raised` | `#2A2722` | Hover rows, selected row fill, menus |
| `--ks-lb-line` | `#3A362F` | Hairline dividers between regions |
| `--ks-lb-line-strong` | `#746C5E` | Borders of inputs, buttons, tabs (≥3:1) |
| `--ks-lb-text` | `#EDE7DA` | Primary text (bone) |
| `--ks-lb-text-muted` | `#B9B1A1` | Secondary text, labels |
| `--ks-lb-text-faint` | `#958C7C` | Tertiary text, units, timestamps |
| `--ks-lb-accent` | `#AEB27A` | Olive: interactive text, selected indicators, live provenance |
| `--ks-lb-accent-strong` | `#C3C690` | Olive hover/pressed |
| `--ks-lb-on-accent` | `#16150F` | Text on olive fills |
| `--ks-lb-cached` | `#D2AE5E` | Ochre: cached provenance |
| `--ks-lb-failed` | `#D9805B` | Clay: failed analysis, API errors |
| `--ks-lb-focus` | `#E6C98A` | Focus ring (2px) |
| `--ks-viewer-well` | `#0D0D0D` | Viewer background — neutral, no hue |
| `--ks-viewer-text` | `#D9D9D9` | Viewer corner annotations — neutral |

### 4.2 Ledger tokens (paper)

| Token | Hex | Role |
|---|---|---|
| `--ks-lg-paper` | `#EFE9DC` | Document sheet |
| `--ks-lg-paper-2` | `#E5DDCB` | Table stripe, inset blocks |
| `--ks-lg-line` | `#C9BEA6` | Rules and table lines |
| `--ks-lg-ink` | `#1E1B16` | Body text |
| `--ks-lg-ink-muted` | `#575043` | Captions, footnotes, counts |
| `--ks-lg-accent` | `#555A2A` | Olive ink: links, section numbers |
| `--ks-lg-failed` | `#93421F` | Rust ink: undefined/failed metric notes |
| `--ks-lg-cached` | `#7A5A12` | Ochre ink: cached snapshot notes |

### 4.3 Rules

- No blue, cyan, teal, purple, or violet anywhere, including focus rings, links, charts,
  and overlays. `check_design_tokens.py` rejects any saturated token with hue 170°–330°.
- No gradients (linear, radial, conic), no glow, no neon, no glassmorphism or backdrop
  blur.
- The viewer well and anything drawn inside it are neutral gray unless an overlay is
  explicitly enabled.
- Colour never carries meaning alone. Every state also has a text label and a shape or
  pattern (see §10, §11).
- Score bars are bone on charcoal regardless of value. There is no colour ramp from low
  to high.
- Attention overlays use a single-hue ochre→rust sequential ramp with opacity, or
  contour lines. The rainbow/"jet" colormap is prohibited.

### 4.4 Verified contrast

Checked by `scripts/check_design_tokens.py` (WCAG 2.2 relative luminance):
body text ≥ 7:1 on every lightbox and ledger surface; secondary and tertiary text ≥ 4.5:1;
accent, cached, and failed text ≥ 4.5:1 on panels; focus ring ≥ 3:1 on adjacent surfaces;
input and control borders ≥ 3:1. Any new token or pairing must be added to the script.

## 5. Typography

| Role | Family | Fallback stack | Notes |
|---|---|---|---|
| UI text | IBM Plex Sans | `"IBM Plex Sans", "Segoe UI", system-ui, sans-serif` | Weights 400, 500, 600 |
| Numbers, IDs, versions | IBM Plex Mono | `"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace` | Tabular figures |
| Ledger display | Source Serif 4 | `"Source Serif 4", "Iowan Old Style", Georgia, serif` | Ledger headings only |

Fonts are bundled through `@fontsource` packages in `web/` (OFL licensed); the app makes
no runtime CDN requests. The HTML concept loads them from Google Fonts when online and
falls back to the stacks above offline.

Scale (rem at 16px root): 0.75 (12px, minimum, only for mono metadata), 0.8125 (13px,
dense table cells), 0.875 (14px, default UI), 1 (16px, panel titles), 1.25 (20px, page
titles), 1.75 (28px, ledger title). Line height 1.45 for UI, 1.55 for ledger prose.
Letter-spacing 0.06em on uppercase micro-labels only. All numeric columns use
`font-variant-numeric: tabular-nums`. Scores always show two decimals (`0.43`), never
percentages.

## 6. Space, layout, dimensions

- Base unit 4px. Spacing tokens: `--ks-space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 24,
  `-6` 32, `-7` 48.
- App frame: top bar 48px; persistent footer notice 32px; content fills the rest.
- Review workspace (≥1200px): study rail 280px | viewer flexible (min 560px) |
  findings column 360px. Gutters are 1px `--ks-lb-line` rules, not gaps with shadows.
- Viewer: square-fit image, letterboxed in `--ks-viewer-well`. Slice controls sit in a
  40px strip directly beneath the image; a thumbnail strip is optional (P2).
- Ledger sheet: max width 920px, centred, 48px internal padding, 1px `--ks-lg-line`
  border.
- Tables: 36px rows in lightbox, 40px in ledger; right-align numbers; left-align text.

## 7. Borders, radii, elevation

- Borders: 1px. Strong borders only on interactive controls.
- Radii: 2px for controls and badges, 4px for panels and sheets, 0 for the viewer well.
  No pill shapes except the 2-character keyboard hint chips.
- Elevation: none by default. Menus and popovers use `--ks-lb-raised` plus a 1px
  `--ks-lb-line-strong` border and at most `0 1px 0 rgba(0,0,0,.4)`. No large blurred
  shadows. Hierarchy comes from material, border, and position.

## 8. Iconography

- Line icons, 1.5px stroke, 16px and 20px grids, square caps — Lucide (`lucide-react`)
  is the default set. Never the sparkle/twinkle "AI" icon.
- Icons always pair with a text label or an `aria-label`; icon-only buttons have a
  tooltip with the keyboard shortcut.
- No anatomical illustrations, body-part pictograms that look like imaging, or stock
  medical imagery. Findings are identified by text, not by drawings of ligaments.
- State glyphs (also used as the non-colour channel): filled square = scored,
  hollow circle = not evaluated, dashed circle = unavailable, slashed circle =
  unsupported, triangle with exclamation = failed.

## 9. Components

Each component lists anatomy, then states. All interactive components implement §12.

### 9.1 Top bar
Wordmark (Plex Sans 600, letter-spaced 0.01em), subtitle, primary nav (Studies, Review,
Evaluation), run-mode indicator (`Fixture mode` / `Model: <version>`), research notice
link. Selected nav item: bone text with 2px olive underline; others muted.

### 9.2 Research notice (persistent footer)
Single line, `--ks-lb-panel`, text "Research prototype — not for diagnosis. Scores are
uncalibrated model outputs unless stated." plus "About data use" link. Cannot be
dismissed.

### 9.3 Study table (study browser)
Columns: Study (mono ID + display label), Origin (Dataset / FIXTURE), Planes (three
fixed slots S·C·A, each present or an em dash with "missing" in the accessible name),
Series, Analysis (Not run / Cached / Live / Failed with glyph), Action ("Open"). Rows are
links. Sort by study ID. Filter field above the table. Show only metadata needed for the
task — no names, dates of birth, accession numbers.

### 9.4 Plane tabs
Segmented control of Sagittal / Coronal / Axial. A missing plane renders as a disabled
tab with a dashed bottom border, label "Axial — not available", and is skipped by arrow
keys. Tabs show series count when more than one series exists for the plane; a series
select appears beside the tabs.

### 9.5 Viewer
Viewer well with corner annotations in `--ks-viewer-text`, 12px mono: top-left study and
series; top-right "Rendered slice (PNG)"; bottom-left slice `i / n` and plane; bottom-right
zoom level. Orientation labels on edges only when derived from DICOM metadata; otherwise
omitted. Controls strip: first, previous, slider, next, last, `i / n`, zoom out, zoom in,
fit, and display-adjust (brightness/contrast) labelled "Display adjust (not window/level)".

### 9.6 Run analysis
Primary button (olive fill, `--ks-lb-on-accent` text) in the findings column header.
Label "Run analysis". While running: label "Analysing…", button disabled, a determinate
step list beneath ("Loading series → Preprocessing → Model → Done") when the API reports
steps, otherwise an indeterminate text status with elapsed seconds. Never a spinner over
the image.

### 9.7 Provenance strip
Directly under the findings header after a result exists. Shows: source badge, model
ID and version (mono), checkpoint short SHA (8 characters; "none" for fixtures),
preprocessing version (mono), computed time, served time, latency if live. Badges:

| Source | Shape and text | Colour |
|---|---|---|
| Live | Solid square glyph + "LIVE" + "computed now" | olive text, olive 1px border |
| Cached | Clock glyph + "CACHED" + "from <timestamp>, checkpoint <short sha>" | ochre text, ochre 1px dashed border |
| Fixture | Diagonal-hatched block + "FIXTURE — not a model output" | bone text on hatched `--ks-lb-raised` |

The fixture badge also adds a hatched 4px stripe to the left edge of every finding row
and of the viewer frame while fixture results are displayed.

### 9.8 Finding row
Anatomy: state glyph, finding display name, score (mono, two decimals) or state text,
score bar (120px, bone fill on `--ks-lb-raised`, threshold tick if a threshold is set),
"Above threshold"/"Below threshold" text when a validated threshold exists, overflow
for "Explanation" and "Reveal dataset label". Selected row: `--ks-lb-raised` fill and a
2px olive left border. Rows never change colour by score.

### 9.9 Explanation panel
Titled "Influential slices" or "Model attention" — never "lesion", "tear location", or
"detected here". Always carries the note "Shows what influenced the model score; it does
not localise an injury." Lists influential slices (click to jump) and, if an attention
map exists, a toggle "Show attention overlay" with opacity control. When absent:
"Explanation unavailable" with reason.

### 9.10 Dataset label reveal
Per finding, a secondary button "Reveal dataset label". On reveal it shows
"Dataset label: Positive / Negative / Unknown (not labelled)" and provenance (e.g.
"Expert annotation, RSNA train subset" or "Extracted from report — rule v0.2"). Hidden
again on study change. Labels are fetched from a separate endpoint and are never sent to
or returned by the prediction endpoint.

### 9.11 Ledger: metrics table
Columns: Finding, Positives, Negatives, Unknown (excluded), ROC AUC, PR AUC, Prevalence,
Sensitivity @ threshold, Specificity @ threshold. Header block states dataset, partition
("Validation" or "Held-out test"), split method, grouping unit, model and preprocessing
versions, snapshot time. Undefined AUC shows "Undefined — one class only (n+ = 0)" in
rust ink. Missing metrics show "Metrics unavailable" with a reason. Macro AUC states how
many findings it includes and which were excluded.

### 9.12 Ledger: model card
Sections: Intended use, Out-of-scope use, Data, Labels and provenance, Training,
Evaluation, Calibration status, Explanations, Limitations, Versions. Each limitation is a
numbered footnote.

### 9.13 Buttons
Primary (olive fill), secondary (transparent, `--ks-lb-line-strong` border, bone text),
quiet (text only, olive). Height 32px (dense) or 36px. Never more than one primary
button per region.

## 10. Interaction states

| State | Treatment |
|---|---|
| Focus | 2px `--ks-lb-focus` outline, 2px offset, on every focusable element; `:focus-visible` only; never removed |
| Hover | Rows/buttons move to `--ks-lb-raised`; text buttons underline. No scale or lift |
| Selected | 2px olive indicator (underline for tabs, left border for rows) plus `aria-selected`/`aria-current` |
| Disabled | 50% opacity text, `not-allowed` cursor, reason in tooltip and accessible description ("Axial series not available for this study") |
| Loading | Text status with step and elapsed time in the affected region only; existing content stays visible but is marked `aria-busy`. Skeleton rows allowed in tables (flat `--ks-lb-raised` blocks, no shimmer) |
| Empty | Region-level message: what is empty, why, what to do (e.g. "No permitted studies in the manifest. Add studies with `scripts/build_manifest.py`.") |
| Error | Clay triangle glyph, plain-language title, the API error `code` in mono, `request_id`, and a retry action when `retryable` is true. Never a stack trace |

## 11. Result and finding states

### 11.1 Result source

- **Live**: produced by the loaded checkpoint during this request. Shows latency.
- **Cached**: produced earlier by an identified checkpoint and preprocessing version and
  loaded from the cache. Shows original computation time and checkpoint hash. Cached
  results must never show "computed now" or a live latency.
- **Fixture**: hand-written development data from `contracts/fixtures/`. Hatched
  pattern, "FIXTURE — not a model output" on the strip and in each row's accessible name.
  Fixture mode is also shown in the top bar.

### 11.2 Finding status

| Status | Meaning | Visual |
|---|---|---|
| `scored` | Model produced a score | Filled square glyph, score `0.43`, bone bar; threshold text if validated threshold exists |
| `not_evaluated` | Analysis has not been run for this study | Hollow circle, "Not evaluated", no bar |
| `unavailable` | Required input missing (e.g. no sagittal series) | Dashed circle, "Unavailable — <reason>", no bar |
| `unsupported` | The active model does not predict this finding | Slashed circle, "Not supported by this model", row text muted; shown only when a finding is listed in the active profile but absent from the model |
| `failed` | Inference for this finding or study errored | Clay triangle, "Analysis failed — <code>", retry action |

A score of `0.02` is `scored`. It looks exactly like a score of `0.98` except for the
number and bar length.

## 12. Keyboard interaction

| Key | Action (review workspace, viewer focused or no input focused) |
|---|---|
| `↑`/`k`, `↓`/`j` | Previous / next slice |
| `PageUp` / `PageDown` | −10 / +10 slices |
| `Home` / `End` | First / last slice |
| `1` `2` `3` | Sagittal / coronal / axial (skips missing) |
| `+` / `-` / `0` | Zoom in / out / fit |
| `r` | Run analysis (when enabled) |
| `[` / `]` | Previous / next finding in findings column |
| `Esc` | Close overlay or popover |
| `?` | Open shortcut sheet |

Tab order: top bar → study rail → plane tabs → viewer → slice controls → findings →
footer. Plane tabs use roving tabindex with arrow keys. The slider is a native
`input[type=range]` with `aria-valuetext="Slice 14 of 30"`. Shortcuts never fire while
an input, select, or textarea has focus.

## 13. Motion

- Durations: 120ms for hover/focus colour changes, 160ms for panel open/close. Easing
  `cubic-bezier(.2,0,0,1)`.
- No motion on the image: no fades between slices, no zoom animation, no parallax.
- No decorative animation, shimmer, pulsing badges, or animated counters.
- `prefers-reduced-motion: reduce` sets all transitions to 0ms. Progress is
  communicated by text, so nothing is lost.

## 14. Image and overlay presentation

- Slices are rendered server-side to 8-bit PNG by the shared preprocessing/rendering
  module; the client draws them on a canvas with nearest-neighbour scaling above 200% and
  smoothing below.
- Brightness/contrast controls are labelled **"Display adjust"**. They modify the
  rendered PNG and are not MRI window/level. True window/level requires server-side
  rendering from intensity data and is a separate, explicitly labelled feature.
- Planes are independent acquisitions. The UI never shows crosshairs, reference lines,
  or "linked" scrolling between planes unless spatial registration from DICOM geometry is
  implemented and verified. Switching plane resets to that series' middle slice.
- Orientation markers (A/P, S/I, R/L) appear only when derived from DICOM orientation
  metadata. Never mirror an image for display convenience.
- Overlays are drawn in the same coordinate space as the rendered slice
  (`rendered_slice_pixels`, see `contracts/README.md`). If an overlay's `series_id`,
  `slice_index`, dimensions, `prediction_id`, or model version do not match the displayed
  slice, it is not drawn and the panel shows "Explanation unavailable — alignment check
  failed".
- Overlay legend always states "Model attention (relative, not lesion location)".
- No generated, illustrated, or stock anatomy anywhere. Where permitted imagery is not
  available, use the synthetic test pattern (`contracts/fixtures/` generator) labelled
  "Synthetic test pattern — not an MRI".

## 15. Responsive behaviour

| Width | Layout |
|---|---|
| ≥ 1200px | Three columns: study rail, viewer, findings |
| 900–1199px | Study rail collapses to a study switcher in the header; viewer + findings two columns (findings 320px) |
| 600–899px | Single column: viewer, then findings, then provenance. Slice controls stay attached under the image |
| < 600px | Review is supported read-only for demonstration: viewer full width, findings stacked, shortcut sheet hidden. Study table becomes a list of study cards with the same fields |

No horizontal page scroll at any width ≥ 320px. Tables that cannot fit scroll inside
their own container with a visible edge rule.

## 16. Accessibility requirements

- WCAG 2.2 AA minimum; text contrast verified per §4.4.
- Every state has a text equivalent; finding row accessible names include status and
  provenance, e.g. "ACL, model score 0.43, fixture, not a model output".
- Live region (`aria-live="polite"`) announces analysis start, completion, and failure.
- Viewer canvas has `role="img"` and an accessible name describing study, series, plane,
  and slice; the slider is the accessible control.
- Hit targets at least 24×24px (32px preferred).
- Respect `prefers-reduced-motion` and browser zoom to 200% without loss of function.
- Error messages are associated with their region (`aria-describedby`).
- Automated checks: axe in component tests for each page state; manual keyboard pass
  recorded in the accessibility issue.

## 17. Prohibited patterns (with examples)

- Gradient hero panels, glowing cards, neon accents, blurred glass panels.
- Blue/teal "medical tech" accents, purple "AI" accents, rainbow attention maps.
- Large rounded cards (radius > 4px), drop shadows used for hierarchy, stacks of pill
  badges.
- A marketing landing page in front of the app.
- Red/green score colouring, traffic-light severity, "Tear detected", "Normal knee",
  "Confidence 87%".
- Decorative MRI or anatomical imagery that could be read as clinical evidence; AI-
  generated knees.
- Fake numbers that look real: placeholder AUCs, "98.2% accuracy", sparkline decorations.
- Crosshairs or linked cursors between unregistered planes.
- Spinners over the image; animated transitions between slices.
- The sparkle/twinkle "AI" icon.

## 18. Changing this specification

- Any implementation change that alters a token, component anatomy, state, keyboard
  binding, or copy rule must update this file in the same pull request.
- New tokens must be added to `web/src/styles/tokens.css` **and** to
  `scripts/check_design_tokens.py`; CI runs the checker.
- Visual changes to the review workspace require before/after screenshots in the PR.
- If the HTML concept no longer matches this file, this file wins; update or annotate
  the concept.
- Record design decisions with lasting impact in `docs/decisions.md`.
