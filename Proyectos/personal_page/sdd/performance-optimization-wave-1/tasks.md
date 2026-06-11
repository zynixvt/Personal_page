# Tasks: Performance Optimization Wave 1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~100-150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

## Phase 1: ParticleSystem Spatial Grid

- [x] 1.1 `comportamiento.js` — Build spatial hash grid `{cellKey: [indices]}` in `ParticleSystem._draw()` before connection loop (~line 1710), 100px cells
- [x] 1.2 Replace O(n²) all-pairs inner loop with 3×3 cell neighborhood check; remove redundant AABB early-out (lines 1717-1718)
- [x] 1.3 Test: 45 particles maintain steady 60fps; connection positions match pre-grid output

## Phase 2: Remove Duplicate render() Code

- [x] 2.1 `comportamiento.js` — Delete lines 944-948 (`containerRef`, `getAll()`, `innerHTML = ''`, `_updateCapacityWarning`) from `YouTubeManager.render()`
- [x] 2.2 Verify: `document.querySelectorAll('#video-list .video-card').length` equals `YouTubeManager.getAll().length` after render()

## Phase 3: Optimize IntersectionObserver Callback

- [x] 3.1 `comportamiento.js` ~line 1267 — Replace `querySelectorAll('#video-list .video-card')` + `indexOf` with `Array.from(card.parentNode.children).indexOf(card)`
- [x] 3.2 Verify: stagger delay `Math.min(idx, 10) * 0.08s` produces identical animation timing on panel open and scroll

## Phase 4: Optimize animateEntries

- [x] 4.1 `comportamiento.js` ~lines 1379-1386 — Remove per-card `getBoundingClientRect()` visibility check in `animateEntries()` (all cards visible on panel open)
- [x] 4.2 Verify: all cards animate on panel open regardless of scroll position; observer handles offscreen entries during scroll

## Phase 5: Comment System Incremental Merge

- [x] 5.1 `comportamiento.js` line 1885 — Add `data-id` attribute to `.comentario-item` div in `renderComentario()`
- [x] 5.2 Replace `innerHTML = ''; remoteComments.forEach(renderComentario)` (lines 1874-1875) with incremental diff: new IDs → prepend, missing → animate `.colapsando`/`.eliminando` + `removeChild`, match → no-op
- [x] 5.3 Wrap incremental merge in try/catch — fall back to full innerHTML rebuild on any error

## Phase 6: CSS will-change Audit

- [x] 6.1 `estilo.css` line 918 — Remove `will-change: transform` from `.slide-in-up`
- [x] 6.2 `estilo.css` line 1145 — Remove `will-change: transform` from `.panel`
- [x] 6.3 Verify: `prefers-reduced-motion: reduce` block (line 1232) still respected — no animation regression
