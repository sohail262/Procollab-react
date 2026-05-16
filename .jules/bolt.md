# Bolt's Journal

## 2026-05-13 - Three.js in Landing page was the LCP killer
**Learning:** `HeroGlobe` imported `three` and `OrbitControls` at the top level, pulling ~600KB of 3D library into the Landing page's synchronous bundle. This blocked the main thread for ~6 seconds before any text rendered (LCP = 6070ms, 98% render delay). The page routes were already lazy-loaded but the component-level import was not.
**Action:** Always check component-level imports for heavy libraries (three.js, d3, chart libs, PDF renderers). Route-level lazy loading is not enough if a heavy library is imported statically inside a component. Use `lazy()` + `Suspense` at the component level too.

**Learning:** `checkConnectionStatuses` in `Discover.tsx` fires one `getDoc` per visible person to check outgoing connection requests (e.g. 10 people = 10 reads). This is called on every infinite-scroll page load. The `queryUtils.ts` already has `cachedGetDoc` and `batchGetDocs` helpers available but are not used here.
**Action:** Replace the per-person `getDoc` loop with `Promise.all` using `cachedGetDoc` from `queryUtils.ts` to deduplicate and cache repeated reads. The friends + incoming reads are already single collection reads — only the outgoing check is N+1.
