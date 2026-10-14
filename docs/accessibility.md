# Accessibility and responsive checklist (KS-WEB-07)

Standard: WCAG 2.2 AA (DESIGN.md section 16). Last run: 2026-10-14, fixture mode, branch
`anasabubakar/work`. Re-run the automated part with `pnpm --dir web test`.

## Automated

| Check | Result | Evidence |
|---|---|---|
| axe-core, serious/critical violations, every page state | **0** in all 9 states | `web/src/test/a11y.test.tsx` |
| States covered | Studies (populated, empty, error); Review (not evaluated; scored + failed + unsupported with FIXTURE provenance; unavailable / missing plane; study-level failure); Evaluation (metrics unavailable; metrics available incl. undefined AUC) | same file |
| Harness control | axe catches a seeded `button-name` violation, so a clean result is meaningful | "catches a seeded violation…" |
| Colour contrast | All token pairs pass (body ≥ 7:1, secondary ≥ 4.5:1, borders/focus ≥ 3:1); no blue/purple hues | `python3 scripts/check_design_tokens.py` (axe's contrast rule is disabled in jsdom, which cannot compute colours) |

## Manual (browser, fixture mode)

| Check | Result | How |
|---|---|---|
| No horizontal page scroll at 375 px | **Pass** on Studies, Review (before and after analysis), Review with a missing plane, Evaluation (`scrollWidth` = 375 on each) | Browser at 375×812 |
| Keyboard-only workflow | **Pass**: Tab order nav → filter → sort → study rows; Enter opens a study; `j` steps slices; `r` runs analysis; live region announces "Analysis complete. Fixture result, not a model output."; `[` / `]` move the selected finding; Enter on an influential-slice chip jumps to that slice (slice 13 of 30) | Desktop browser; key presses plus focus log |
| Reduced motion | **Pass (static)**: the only transitions are two 120 ms colour/background hovers, and `@media (prefers-reduced-motion: reduce)` sets every transition and animation to 0 ms. No motion between slices | `web/src/styles/index.css` |
| 200% browser zoom | Not yet checked | Needs a person with a desktop browser |
| Screen reader pass | **Not done** — no screen reader available in this environment | Needs a person with NVDA, VoiceOver or Orca: run the keyboard workflow above and confirm row names include status and provenance |

Note: the automated browser used for the keyboard check could not send `[`/`]` keystrokes;
those two shortcuts were confirmed by dispatching real `keydown` events in the page and by
the unit test "moves the selected finding with [ and ]".

## Outstanding

1. Screen reader pass (human).
2. 200% zoom check (human).
3. QA reviewer sign-off (issue definition of done).
