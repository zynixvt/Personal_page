# Proposal: Performance Optimization Wave 1

## Intent

Reduce frame drops and layout thrash in `comportamiento.js` (~2275 lines). Particle connections run O(n²) per frame, render paths duplicate work, and animation callbacks force unnecessary layout reads. Six targeted fixes delivering measurable perf gains — zero behavior change.

## Scope

### In Scope
1. **ParticleSystem spatial grid** — hash-grid broad phase replacing O(n²) all-pairs distance checks in `_draw()`
2. **Remove duplicate render() code** — delete dead code block in `YouTubeManager.render()` (lines 944-948)
3. **Optimize IntersectionObserver callback** — use `entry.target` instead of `querySelectorAll('#video-list .video-card')` re-query
4. **Reduce getBoundingClientRect in animateEntries** — use intersection data from observer entries
5. **Comment system incremental merge** — patch DOM nodes instead of full `innerHTML = ''` + rebuild on Supabase data
6. **CSS will-change audit** — remove unnecessary `will-change` on `.panel` and `.slide-in-up` causing memory pressure

### Out of Scope
- Architectural rewrites or component extraction from IIFE
- Build tools, bundlers, or framework migration
- Video iframe lazy-loading or image optimization

## Capabilities

### New Capabilities
None — pure refactoring, zero behavior change.

### Modified Capabilities
- `personal-dashboard`: Particles SHALL use spatial grid ~100px cells for broad-phase culling (existing spec requirement; implementation doesn't deliver)

## Approach

Six independent commits, executed 1→6 (spatial grid first for highest gain, CSS audit last for lowest risk). Each change measured before/after using DevTools Performance panel.

## Affected Areas

| Area | Impact | Change |
|------|--------|--------|
| `comportamiento.js` | Modified | Spatial grid, dead code removal, IntersectionObserver, animateEntries, comment merge |
| `estilo.css` | Modified | Remove will-change from `.panel` and `.slide-in-up` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Particle grid bug causes visual glitch | Low | Single revertable commit |
| Comment incremental merge misses edge case | Low | Keep old code path as fallback first deploy |
| will-change removal affects animation perf | Low | Add back selectively if regression appears |

## Rollback Plan

Each optimization is an independent, revertable commit. `git revert <sha>` for the failing one — no cross-cutting changes.

## Dependencies

None. All changes self-contained in `comportamiento.js` + `estilo.css`.

## Success Criteria

- [ ] Particle system runs stable 60fps with 45 particles (vs current dropped frames)
- [ ] No visual regressions on dashboard home, videos, or comments panels
- [ ] All 6 optimizations pass visual smoke test
- [ ] Each commit touches only its target code (verified via `git diff --stat`)
