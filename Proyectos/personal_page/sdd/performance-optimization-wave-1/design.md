# Design: Performance Optimization Wave 1

## Technical Approach

Six independent, revertable optimizations in `comportamiento.js` and `estilo.css`. No behavior changes. Each targets a specific known performance bottleneck: O(n²) particle connections, duplicate render path, layout thrash in IO callbacks, redundant getBoundingClientRect, full comment DOM rebuild, and unnecessary GPU memory from will-change.

## Architecture Decisions

### 1. ParticleSystem Spatial Grid

| Option | Tradeoff | Decision |
|--------|----------|----------|
| All-pairs (current) | O(n²) per frame, drops frames at 45 particles | ❌ |
| Spatial hash grid | O(n) average, ~100px cells, preserves exact visual output | ✅ |
| Quadtree | Overkill for 45 particles, higher setup cost per frame | ❌ |

**Implementation**: Build a `{cellKey: [indices]}` object each frame before the connection loop. Cell key = `${Math.floor(x/100)},${Math.floor(y/100)}`. For each particle i, check its cell + 8 adjacent cells (3×3 neighborhood). The existing AABB early-out (lines 1717-1718) becomes redundant — remove it. Exact alpha (`0.15 * (1 - sqrt(d2)/CONNECT_DIST)`) and lineWidth (0.5) are preserved since the distance calculation is unchanged.

**File**: `comportamiento.js` lines 1710-1731 in `ParticleSystem._draw()`

### 2. Remove Duplicate render() Code

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Keep both (current) | Dead code wastes CPU on redundant `getAll()` + `innerHTML = ''` | ❌ |
| Remove lines 944-948 | Eliminates duplicate + orphaned `_updateCapacityWarning` that gets destroyed by second `innerHTML=''` | ✅ |

**Rationale**: Lines 944-946 (`containerRef`, `getAll()`, `innerHTML = ''`) are a complete duplicate of 949-951. Line 948's `_updateCapacityWarning(container)` creates a warning element that is immediately destroyed by the second `innerHTML = ''` at line 951. The `isNearCapacity()` block at lines 953-958 correctly creates the warning after the final clear.

**File**: `comportamiento.js` lines 944-948

### 3. IntersectionObserver callback — DOM Re-query Elimination

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `querySelectorAll` (current) | Forces style recalc + layout per observer entry | ❌ |
| `entry.target` + `parentNode.children.indexOf` | Zero DOM queries, exact same stagger logic | ✅ |

**Rationale**: The observer already receives `entry.target` as the card element. Replace `document.querySelectorAll('#video-list .video-card')` + `Array.prototype.indexOf.call(allCards, card)` with `Array.from(card.parentNode.children).indexOf(card)`. Stagger formula (`Math.min(idx, 10) * 0.08s`) stays identical.

**File**: `comportamiento.js` lines 1267-1268

### 4. animateEntries — getBoundingClientRect Reduction

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Per-card gBCR loop (current) | Forces layout per card (N calls) | ❌ |
| Remove visibility check | Observer handles offscreen cards; panel open means all visible | ✅ |

**Rationale**: `animateEntries` fires once on panel open. All cards are in the viewport — the <50% visibility guard is defensive but unnecessary here. Cards that genuinely aren't visible get animated when the IntersectionObserver fires during scroll. `containerRect` is already cached once outside the loop (line 1375).

**File**: `comportamiento.js` lines 1379-1386 in `animateEntries()`

### 5. Comment Incremental Merge

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Full innerHTML rebuild (current) | Destroys all DOM, loses animation state | ❌ |
| Incremental diff by id | Add new (prepend), remove deleted (animate), match existing (no-op) | ✅ |

**Implementation**: In `cargarComentarios()` lines 1871-1879, diff incoming remote comments against DOM `[data-id]` attributes. New IDs → `renderComentario()` + prepend. Removed IDs → animate `.colapsando` + `.eliminando` then remove. Existing → no-op. Wrap in try/catch — on any error, fall back to full rebuild.

**File**: `comportamiento.js` lines 1871-1879 in `cargarComentarios()`

### 6. CSS will-change Audit

| Selector | Line | Action | Rationale |
|----------|------|--------|-----------|
| `.panel` | 1145 | Remove | Transitioning, not animating; `contain: layout style paint` already creates a layer |
| `.slide-in-up` | 918 | Remove | Brief 0.4s animation; GPU memory cost outweighs benefit |

Reduced motion: the existing `@media (prefers-reduced-motion: reduce)` block at line 1232 nullifies all animation durations — removing will-change has no effect on it.

**File**: `estilo.css` lines 1145, 918

## Data Flow

```
ParticleSystem._draw() per frame:
  Update particles → Build spatial grid (cellKey→indices) → For each particle:
    Check 3×3 neighborhood → Distance check (preserved) → Draw connection

cargarComentarios() on Supabase data arrival:
  remoteComments → diff by [data-id] against DOM →
    ├─ New id   → renderComentario() + prepend
    ├─ Missing  → animar salida + removeChild
    └─ Match    → no-op
  Error? → full innerHTML rebuild (fallback)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `comportamiento.js` | Modify | O1: spatial grid in _draw(); O2: remove lines 944-948; O3: entry.target + parentNode.children; O4: remove per-card gBCR; O5: incremental comment merge |
| `estilo.css` | Modify | O6: remove will-change from .panel and .slide-in-up |

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Visual | Particle connections render identically | Side-by-side canvas capture, compare pixel output |
| Visual | Video cards render without duplication | Inspect DOM after render() call |
| Visual | Comments animate in/out | Validate prepend + remove animation sequence |
| Functional | Reduced motion still respected | Verify `prefers-reduced-motion: reduce` behavior unchanged |
| Perf | Particle frame time <16ms at 45 particles | `performance.now()` before/after connection block |

## Migration / Rollout

No migration required. Each optimization is an independent revertable commit.

## Open Questions

None.
