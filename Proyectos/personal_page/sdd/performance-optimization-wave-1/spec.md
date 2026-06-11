# Delta for personal-dashboard

## MODIFIED Requirements

### Particles Background

SHALL animate on home. MUST pause (`cancelAnimationFrame`) when any panel covers the canvas. SHALL use spatial hash grid (~100px cells, cell-aligned) for broad-phase connection culling to achieve ~O(n) per frame.
(Previously: spec required spatial grid but implementation used O(n²) all-pairs distance checks)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Pause on panel | Particles animating on home | Panel opens | RAF cancelled, canvas stops |
| Resume on close | Particles paused | Panel closes | RAF restarts, particles animate |
| Efficient at 45 particles | 45 particles active, home visible | 60fps frame renders | Connection checks complete within 16ms |
| Visual output identical | Home with particles | After grid activated | Line positions match pre-grid output |

### Videos — Rendering

Entries from `youtube-videos` render as iframes, newest-first. Blocked embeds show "Watch on YouTube" link. Render SHALL execute without duplicate draw calls. IntersectionObserver SHALL use `entry.target` to avoid forced layout re-queries. Entrance animations SHOULD use observer entry data instead of `getBoundingClientRect` loops.
(Previously: render() had duplicated code block; observer re-queried DOM via querySelectorAll; animateEntries called getBoundingClientRect per entry)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| Render no duplicate | YouTubeManager has multiple entries | render() called | Each card renders exactly once, no duplicate nodes |
| Observer no DOM re-query | Video cards in viewport | Observer callback fires | entry.target used, no querySelectorAll call |
| Animate without forced layout | Entry enters viewport | animateEntries runs | No getBoundingClientRect call on animated element |

### Avisos/Comentarios Panel

Notices + comments combined. Comments read/write `comentarios` in localStorage. Existing entries preserved. Comment list SHOULD merge incrementally (add/remove/update nodes) when Supabase data arrives, falling back to full innerHTML rebuild on failure.
(Previously: innerHTML = '' + full rebuild on every data arrival)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| New comment prepended | 3 comments rendered | Supabase returns 4 (1 new) | Only new node prepended, existing nodes untouched |
| Deleted comment removed | 3 comments rendered | Supabase returns 2 (1 removed) | Removed DOM node detached, order correct |
| Fallback on failure | List rendered, merge throws | Incremental merge errors | Full rebuild executed, list is correct newest-first |

### Visual Design

Black-dominant (`oklch(8% 0.01 270)`), red accent (`oklch(62% 0.22 25)`). Mobile-first responsive, dark default. SHALL NOT apply `will-change` to `.panel` or `.slide-in-up`. Reduced-motion preference MUST still be respected.
(Previously: unnecessary will-change on .panel and .slide-in-up causing GPU memory pressure)

| Scenario | GIVEN | WHEN | THEN |
|----------|-------|------|------|
| will-change absent | Dashboard loaded | Inspect .panel and .slide-in-up | will-change property not present on either |
| Reduced motion respected | prefers-reduced-motion: reduce | Panel opens | Animations respect reduced-motion, behavior unchanged |
