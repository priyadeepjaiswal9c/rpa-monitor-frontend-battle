# SENTINEL — Enterprise RPA Telemetry Monitor

**Frontend Battle 2026 · Phase 2.** A high-density, real-time **Enterprise Control Terminal** that
ingests a 200 ms telemetry firehose over **50,000 RPA automation projects** and visualizes, sorts,
filters and searches it **without dropping frames or leaking memory** — built in **vanilla
JavaScript + ES modules** with **zero data-grid / virtualization libraries** (hand-rolled row
recycling), **100% client-side**.

- **Live demo:** https://priyadeepjaiswal9c.github.io/rpa-monitor-frontend-battle/
- **Stack:** HTML + CSS (custom properties) + vanilla ES modules. No frameworks, no build step, no
  dependencies (no `package.json`). The provided `dataStream.js` is committed **byte-for-byte
  unmodified** and consumed as-is.

---

## Engineering highlights (the 50-pt rendering/memory axis)

- **Two decoupled clocks.** Ingestion runs on the provided 200 ms `setInterval`; rendering runs on a
  **single, single-flight `requestAnimationFrame`** (the only place the DOM is ever written). Stream
  ticks and scroll events only mutate JS state + flag dirty → render frequency is bounded by rAF, not
  by the stream. N updates between two frames collapse into **one** paint.
- **Hand-rolled virtualization (F8).** A **fixed pool of ~40 row nodes** is recycled over a tall
  spacer; scrolling moves the whole pool with **one `transform: translateY()`** (compositor-only) and
  rebinds cells via **`nodeValue` writes only, dirty-checked** (identical cells are skipped). The DOM
  node count is **constant regardless of the 50,000 rows** → flat heap, no forced reflow, 60 fps.
  `overflow-anchor: none` + `contain: layout style paint` per row keep the browser from fighting us.
- **Memory discipline.** Store is a `Map<uid,row>` bounded by the fixed uid universe (≤ 50k), updated
  in place. The derived view is a single reused `Uint32Array` index. KPIs are scalar accumulators. One
  module-scope `Intl` formatter (reused, not re-created). **Event delegation** (one click listener on
  the grid). No append-only history anywhere.
- **Lossless, bounded Pause (F5).** While paused, the engine keeps capturing into a **coalesce-by-uid
  `Map`** — bounded by the dataset size **regardless of pause duration** (an append-only queue would
  bloat the heap). On resume it flushes in one pass with **no record dropped**; KPIs accrue for every
  captured event and the overlay shows the buffered/sequence counts.
- **Input-driven recompute.** Sort/filter/search recompute the index **only on user input** (the real
  columns don't drift), so the firehose costs ~zero pipeline work; a live value repaints a cell in
  place and the row never moves — "sorted order persists as the stream injects" for free.

A **live Performance HUD** (FPS · JS heap · DOM-nodes-rendered / total · rows/sec) surfaces the engine
working in real time.

---

## The 10 features → owning modules

| # | Feature | Module(s) |
|---|---|---|
| F1 | High-density live KPI strip (streamed rows · robots Σ · cumulative savings) | `core/streamAdapter`, `core/store`, `ui/kpiStrip` |
| F2 | Financial & numeric sanitation (currency commas, ROI 2 dp, no NaN leakage) | `core/format`, `ui/rowBinder` |
| F3 | Visual status alerts (Failed / negative-ROI → isolated, auto-expiring flash) | `ui/rowBinder`, `css/motion.css`, `ui/statusOverlay` |
| F4 | Single-column sort (click headers) | `ui/sortControls`, `lib/multiSort`, `core/pipeline` |
| F5 | Pause/Play buffer (freeze UI, keep capturing, lossless flush) | `core/pauseBuffer`, `ui/statusOverlay` |
| F6 | Workspace layout persistence (show/hide panels, localStorage) | `ui/layoutManager`, `lib/persist` |
| F7 | Categorical multi-select filters + infra toggles | `ui/filters`, `core/pipeline` |
| F8 | High-frequency virtualized DOM grid (row recycling) | `ui/virtualGrid`, `ui/rowBinder` |
| F9 | Multi-column compound sort (shift-click) | `ui/sortControls`, `lib/multiSort`, `core/pipeline` |
| F10 | Multi-field fuzzy search (out-of-order tokens) | `ui/searchBar`, `lib/fuzzy`, `core/pipeline` |
| Bounty 1 | Pause-gated row inspector (every attribute + insights + relational context) | `ui/inspector` |

**Extras:** live Perf HUD, honest flash-on-receive, density toggle, CSV export of the current view,
deep-linkable URL-hash state, ⌘K command palette, KPI sparklines.

---

## A note on the data (read before judging)

The provided `dataStream.js` is intentionally messy "legacy vendor" boilerplate. We consume it
unmodified and defend against its quirks in `core/streamAdapter.js`:
- It type-casts/mutates columns that **don't exist** in the real CSV (`annual_revenue_usd`,
  `customer_count`, `market_share_percent`, …) → it emits junk `NaN` fields (**stripped**) and leaves
  the **real numerics as strings** (**coerced** into a numeric shadow).
- The grid is seeded from our own parse of the **same** CSV (the brief's "complete static baseline"),
  so all 50k rows are present instantly; `dataStream.js` then drives the **live** layer (KPIs counted
  over received rows, flash-on-receive, updates). The browser HTTP-caches the file → one download.
- The real dataset contains **no `Failed` status and no negative ROI**, and the simulator never
  injects them — so F3's alert can't fire from live data. F3 implements the exact rule **and** ships a
  clearly-labeled **"Demo alert"** control that flags a row in the view copy only, so the
  auto-expiring flash is provably demonstrable.

## Run locally
Any static server (the CSV `fetch` needs http, not `file://`):
```bash
python3 -m http.server 8123       # then open http://localhost:8123
```

## Project structure
```
index.html · dataStream.js (provided) · automation_projects.csv (provided)
css/  base · app · grid · controls · chart · motion
js/   main.js
      core/  streamAdapter · store · pipeline · pauseBuffer · format · schema
      ui/    virtualGrid · rowBinder · kpiStrip · filters · sortControls · searchBar
             layoutManager · departmentChart · statusOverlay · inspector · perfHud · commandPalette
      lib/   fuzzy · multiSort · persist · urlState · exportCsv · sparkline · dom
```

Built by **Priyadeep Jaiswal** for Frontend Battle 2026.
