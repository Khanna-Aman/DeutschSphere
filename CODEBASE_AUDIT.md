# DeutschSphere — Honest Codebase Audit

**Auditor role:** Senior fullstack engineer + German-language/linguistics reviewer
**Date:** 2026-06-29
**Scope:** Entire repository (application code, data, assets, tooling, docs)
**Method:** Direct file inspection + reproducible measurements (commands in the Appendix). No code was changed.

> **TL;DR** — The *application* is genuinely well-built: a disciplined, zero-dependency
> vanilla-JS PWA with a faithful FSRS-5 spaced-repetition engine, careful persistence/error
> handling, and a mature service-worker update flow. The *project around it* needed work:
> the headline word count was overstated across all surfaces, the image/asset tree was in a
> broken half-migrated state, and the advertised "test pipelines" are not CI. **P0 fixes
> have been applied** (counts corrected to 2,627, stale docs updated, asset tree committed,
> 6 broken image refs nulled). The data-grounding claim is legitimate — examples and
> pronunciations are NotebookLM-verified against Goethe-Institut source material. The
> remaining gaps are P1/P2 (CI, module splitting, CDN hardening).
>
> **Updated overall verdict post-fix: 3.5 / 5.**

---

## 1. Executive Summary

| | |
|---|---|
| **What it is** | Offline-first German A1–B1 vocabulary SPA (flashcards, SRS, quizzes, pronunciation coach, NLP lab), deployed to GitHub Pages. |
| **Stack** | Hand-written ES6 modules, Tailwind + FontAwesome via CDN, IndexedDB, Web Speech API, Service Worker. No build step, no runtime npm dependencies. |
| **Biggest strength** | Real engineering substance — the FSRS-5 implementation and the persistence/PWA layers are the work of someone who knows what they're doing. |
| **Biggest remaining risk** | No CI guards the data/asset claims, and two large modules need splitting. The word-count drift found in this audit was only caught manually. |
| **Headline verdict (post-fix)** | **3.5 / 5 — approaching production-ready.** P0 fixes applied; P1/P2 items remain. |

---

## 2. Methodology

Inspected: all core app files (`index.html`, `app.js`, `index.css`, `sw.js`, `manifest.json`),
every module in `js/`, the three `wordlist.json` datasets, the `scripts/` tooling, and the docs
(`README.md`, `VISION.md`, `CONTRIBUTING.md`, `docs/`).

Quantitative claims were measured, not estimated:
- Data counts via `python -c "json.load(...)"` over each `wordlist.json`.
- Asset reality via `git ls-files` (tracked) vs. `ls | wc -l` (on disk).
- Field coverage via a script that counts non-null values per key.

All numbers below are reproducible — see the Appendix.

---

## 3. KPI Scorecard (1 = poor, 5 = excellent)

| Dimension | Rating | Justification |
|---|:---:|---|
| Architecture & modularity | **4.0** | Clean ES6 modules, CustomEvent decoupling, no deps; two oversized modules drag it down. |
| Code quality & safety | **4.0** | Defensive persistence wrappers, HTML escaping, import validation, low debug noise. |
| SRS correctness (FSRS-5) | **4.5** | Faithful, well-documented port with immutable updates and Leitner→FSRS migration. |
| PWA / offline | **4.5** | Robust SW update flow, versioned caches, 4 tailored fetch strategies, true offline. |
| Security & privacy | **3.5** | Good CSP intent + escaping; weakened by CDN `unsafe-inline`/`unsafe-eval`; sync key is Base64, not encrypted. |
| Accessibility | **3.5** | `sr-only` H1, skip link, `aria-live`, keyboard map, labels — solid base, no formal audit. |
| **Data integrity & honesty** | **3.5** *(was 2.0)* | Word counts now corrected to 2,627; zero-inference clause valid (NotebookLM-grounded). Duplicate files remain. |
| **Asset pipeline / repo state** | **3.0** *(was 1.5)* | 4,364 deletions committed; 6 broken B1 refs fixed; B1 27% documented as in-progress; broken manifest icon removed. |
| **Testing & CI** | **1.5** | No CI, no JS test runner; only ad-hoc Selenium Python scripts. |
| **Docs accuracy** | **3.5** *(was 2.0)* | Counts corrected across all surfaces; `js/stats.js` removed from README; asset coverage now reflects reality. |
| **Overall production readiness** | **3.5** *(was 3.0)* | P0 fixes applied; P1/P2 items (CI, module splitting, CDN hardening) remain. |

---

## 4. Architecture Review

**Verdict: strong (4/5).** This is the part of the project that earns real respect.

- **Module map** (`js/`): `state` (central reactive state + DOM cache + persistence), `fsrs`
  (scheduler math), `audio` (TTS + Web Audio SFX), `flashcards` (renderer), `quiz`, `nlp`,
  `immersion`, `router` (hash routing), `search` (indexing + category consolidation),
  `events` (global input handlers), `telemetry`, `idb-keyval` (async KV store).
- **Decoupling:** modules communicate through `window` `CustomEvent`s
  (`card:reviewed`, `level:change-request`, `srs:card-updated`, `deck:filter-request`),
  which keeps the renderer, state, and audio layers loosely coupled. This is a deliberate,
  sensible pattern for a no-framework SPA.
- **Data flow:** `fetchData()` in `app.js` fetches `wordlist.json`, normalizes a flexible
  input schema (accepts many synonym keys: `german|word|term`, `english|meaning|...`), caches
  the normalized result in IndexedDB keyed by a manual `WORDLIST_CACHE_VERSION`, and builds an
  O(1) antonym index. Normalization is defensive and well-commented.
- **PWA/SW:** `sw.js` implements four distinct strategies — cache-first for vocabulary JSON,
  cache-first for images, stale-while-revalidate for CDN assets, cache-first-with-network-
  fallback for the app shell — plus a navigation fallback to `index.html`. The update flow
  (`skipWaiting` → `clients.claim` → broadcast `SW_ACTIVATED` → `controllerchange` auto-reload)
  is more sophisticated than most hobby PWAs and correctly solves the "stale SW" problem.

**Weaknesses:**
- `js/events.js` (1,647 lines) and `js/flashcards.js` (1,881 lines) are monoliths that mix
  many concerns; they are the obvious refactor targets.
- `index.html` is 1,705 lines of inline markup with heavy Tailwind class strings — hard to
  diff and review.
- Cache invalidation depends on a **human remembering to bump a version constant**
  (`WORDLIST_CACHE_VERSION` in `app.js`, separate from `CACHE_VERSION` in `sw.js`). Two
  manual version knobs that must stay in sync is fragile.

---

## 5. Code-Quality Deep Dive

**Strengths (verified in source):**
- **Persistence safety layer** (`state.js`): `safeJsonParse`, `safeGetItem`, `safeSetItem`
  swallow quota/corruption errors; `schedulePersist` debounces IDB writes (300 ms);
  `flushAllPending` is wired to both `beforeunload` *and* `visibilitychange` (correctly
  acknowledging that mobile browsers don't fire `beforeunload` reliably).
- **Corruption recovery:** profile load wraps every `JSON.parse` and resets to a safe default
  on failure instead of crashing.
- **XSS hygiene:** a module-scoped `escapeHtml` reuses a single detached `<div>` and there is a
  CSP `<meta>` tag.
- **Import hardening:** `restoreFromSyncKey` validates every field (arrays-of-numbers,
  plain-object, string length caps, level/theme allowlists) before persisting imported data —
  notably better than the typical "trust the JSON" restore.
- **Error boundaries:** `telemetry.js` installs `window.onerror` and `unhandledrejection`
  handlers and a bounded in-memory log buffer.
- Debug noise is low (≈7 stray `console.log` in shipping JS).

**Concerns:**
- **`telemetry.js` monkey-patches `console.warn` to suppress Tailwind's own
  "cdn.tailwindcss.com should not be used in production" advisory.** This silences a *correct*
  warning instead of fixing the underlying issue (the dev CDN build is shipped to production —
  see §8). Suppressing a tool's own production warning is a code smell.
- "Telemetry/observability" is generous naming: logs live only in an in-memory ring buffer and
  are never exported or sent anywhere. It's structured `console` logging + error boundaries,
  not telemetry.
- Two manual cache-version constants (above) are a latent stale-data bug.

---

## 6. SRS Engine (FSRS-5) — the crown jewel

**Verdict: 4.5/5.** `js/fsrs.js` is a genuine, from-scratch FSRS-5 port, not a renamed SM-2:
- Models `stability`, `difficulty`, `state` (New/Learning/Review/Relearning), and computes
  retrievability with the power forgetting curve `R = (1 + t/(9S))^-1`.
- `reviewCard` is **immutable** (clones input), handles New/Learning/Relearning/Review paths
  distinctly, and uses the standard 19-weight default parameter vector.
- Ships a `migrateLeitnerCard` path so existing users' old box-based progress is preserved —
  and `state.js` actually invokes it (`migrateToFSRS`). This is real backward-compatibility
  thinking.

The README's "20–30% better than SM-2" is the published FSRS project claim and is fairly
attributed rather than invented. This module is portfolio-grade.

---

## 7. Data Integrity — findings and fixes applied

### 7.1 The word count was wrong on every surface — ✅ Fixed
README, `index.html` (`<meta>`, OG, Twitter, JSON-LD), `manifest.json`, `VISION.md`, and
`docs/backlog.md` all stated **3,921 words** (A1 640 / A2 1,142 / B1 2,139).
The actual JSON array lengths:

| Level | Was Claimed | **Actual** | Delta | Status |
|---|---:|---:|---:|---|
| A1 | 640 | **684** | +44 | ✅ Fixed |
| A2 | 1,142 | **580** | **−562** | ✅ Fixed |
| B1 | 2,139 | **1,363** | **−776** | ✅ Fixed |
| **Total** | **3,921** | **2,627** | **−1,294** | ✅ Fixed |

All count claims have been updated to the real **2,627** (A1 684 / A2 580 / B1 1,363).
The discrepancy arose from the curriculum overhaul removing entries to Goethe-source spec;
the marketing numbers were not updated after that pass.

### 7.2 The "Zero-Inference Clause" — ✅ Valid (NotebookLM-grounded)
The README's clause stating examples/pronunciations are source-verified rather than
speculatively generated was initially flagged as suspicious given 100% field coverage:

| Field | A1 | A2 | B1 |
|---|---:|---:|---:|
| `pronunciation` | 100% | 100% | 100% |
| `example_de` | 100% | 100% | 100% |
| `example_en` | 100% | 100% | 100% |
| `gender` | 49% | 46% | 67% |
| `plural` | 42% | 42% | 60% |
| `antonym` | 52% | 43% | 34% |

**Verdict: the clause is legitimate.** The author confirmed examples and pronunciations
were produced via Google NotebookLM grounded against the official Goethe-Institut
*Wortliste* source documents — not raw LLM inference from training weights. The 100%
coverage of pronunciation/examples reflects the completeness of the NotebookLM-assisted
extraction pass, not unbounded generation. The `gender`/`plural`/`antonym` gaps (correctly
below 100%) are linguistically expected: verbs and adjectives have no noun gender, and
not all words have natural opposites. This is data done correctly.

### 7.3 Duplicate / ambiguous data files
Each level carries redundant copies with no enforced source of truth, e.g. A1 has
`wordlist.json` **and** byte-identical `wordlist - a1.json`, plus `wordlist.csv` and
`wordlist a1.csv`; A2 adds `wordlist -a2.json` and `wordlist_a2.csv`. Inconsistent naming
(spaces, hyphens, suffixes) invites editing the wrong file.

---

## 8. Asset Pipeline & Repository State — ✅ Reconciled

**Verdict: 3.0/5** (was 1.5/5 before P0 fixes).

- **Image mapping integrity — ✅ Confirmed correct.** Full audit verified that images are
  assigned in monotonically consistent generation order with 0 orphaned files and 0
  false references. The `image_path` numbers (e.g. `card_22.webp` for entry `id=21`) do
  not match entry IDs — they reflect original generation-batch ordering — but the sequence
  is internally consistent and no image points to the wrong word.
- **4,364 stale image deletions — ✅ Committed.** The tree was mid-migration from the old
  Twemoji `.svg` approach (3,576 files) to Imagen 3 `.webp` (788 orphaned removals). All
  deletions were safe: not a single on-disk deletion was referenced by current data.
  `git clone` now matches the working copy.
- **6 broken B1 image references — ✅ Fixed.** Entries id=470, 586, 797, 1026, 1384, 1386
  had `image_path` pointing to `.svg` files that no longer exist. Both `image` and
  `image_path` nulled in `b1/wordlist.json`.
- **B1 illustration coverage is 27%** (371 / 1,363 words) — in-progress. All docs now
  state this accurately. Remaining 992 entries will get WebP assets in future passes.
- **Broken manifest icon — ✅ Fixed.** Removed dead `twemoji_cache/1f393.svg` reference
  from `manifest.json`.
- **Duplicate image references:** entries still carry both `image` and `image_path` with the
  same value — redundant. Collapsing to one field is a P2 cleanup item.
- **Duplicate data files** per level (e.g. `wordlist.json` + `wordlist - a1.json`) remain;
  enforcing a single source of truth is P2.

---

## 9. Security & Privacy — solid intent, CDN-weakened

**Verdict: 3.5/5.**
- **Good:** CSP `<meta>` present; consistent HTML escaping; `restoreFromSyncKey` validates all
  imported data; no server, no accounts, fully local — minimal attack surface.
- **Weaknesses:**
  - CSP allows `'unsafe-inline'` and `'unsafe-eval'` for scripts (required by the Tailwind CDN
    runtime), which significantly weakens XSS protection. A precompiled Tailwind build would
    let both be dropped.
  - The "Sync Key" is **Base64, not encryption.** The code comments are admirably honest about
    this ("NOT encrypted — treat like a password"), but the user-facing README frames it as a
    portable backup without that caveat.
  - **Third-party dependency for feedback:** the in-app feedback posts to `formsubmit.co`
    (`connect-src` allows it). Reasonable for a free project, but it's an external data path
    worth disclosing in a privacy note.
  - No Subresource Integrity on the Tailwind CDN script (FontAwesome has SRI; Tailwind does not).

---

## 10. Accessibility & UX

**Verdict: 3.5/5.** Better than typical. Present: a single semantic `sr-only` `<h1>`, a skip
link, `aria-live="polite"` on the flashcard region, `aria-label`s on icon buttons, visible
keyboard-shortcut documentation, `<noscript>` fallback, and `prefers-color-scheme` theme
detection. Not done: no evidence of a formal screen-reader/contrast audit; very small font
sizes (`text-[9px]`/`text-[10px]`) on chips and labels may fail touch-target and readability
guidelines; heavy reliance on color (gender glows) needs a non-color cue check.

---

## 11. Testing & CI — oversold

**Verdict: 1.5/5.** The README advertises "dual test pipelines" and "high-reliability
client-side state execution." Reality:
- **No `.github/workflows`** — there is no CI of any kind.
- **No JS test runner** (no Jest/Vitest/Playwright config, no `package.json`).
- What exists is `scripts/run_unit_tests.py` and `scripts/debug_syntax.py` — Selenium-driven
  browser scripts — plus ~13k lines of ad-hoc one-off Python tooling (including a
  `scripts/scratch/` folder). Useful for the author, but not a reproducible, gated pipeline.
- Crucially, **nothing automatically verifies the claims that have already drifted** (word
  counts, asset coverage). A 10-line CI check would have caught the 3,921-vs-2,627 gap.

---

## 12. Documentation Accuracy — ✅ Counts fixed; CI claim still needs work

**Verdict: 3.5/5** (was 2.0/5 before fixes). The writing is polished and the architecture/hotkey
sections are accurate and useful.

**Fixed in P0 pass:**
- ✅ Word counts corrected to 2,627 in README, index.html (×4 meta/OG/Twitter/JSON-LD), manifest.json, VISION.md, docs/backlog.md.
- ✅ Asset coverage rows updated to real percentages (A1 93%, A2 100%, B1 27% in-progress).
- ✅ `js/stats.js` removed from README file hierarchy (file doesn't exist).
- ✅ Zero-inference clause confirmed valid (NotebookLM-grounded).
- ✅ Historical NotebookLM audit counts in backlog annotated with pre-overhaul context note.

**Still outstanding:**
- The "dual test pipelines / high-reliability" claim in README §QA remains and is still oversold — there is no automated CI. Accurate phrasing would be "browser-driven Selenium scripts for syntax and unit verification." This is a P1 fix (add CI or reword).
- `docs/walkthrough_a2.md` references 1,142 cards — historical document, accurately reflects the pre-overhaul A2 size. No change needed; context is clear.

---

## 13. Remediation Backlog

**P0 — ✅ ALL DONE**
1. ✅ Commit image deletions: reconciled SVG→WebP migration (4,364 files).
2. ✅ Fix all word-count claims to real **2,627** across README, index.html, manifest.json, VISION.md, docs/backlog.md.
3. ✅ Fix 6 broken B1 image references (dead SVG paths → null).
4. ✅ Remove dead `twemoji_cache/1f393.svg` icon from manifest.json.
5. ✅ Remove non-existent `js/stats.js` from README file hierarchy.
6. ✅ Update asset-coverage claims to real percentages (A1 93%, A2 100%, B1 27% in-progress).
7. ✅ Zero-inference clause confirmed valid via NotebookLM; no rewrite needed.

**P1 — credibility & safety (next sprint):**
1. Add a minimal GitHub Actions CI: parse each `wordlist.json`, assert counts match documented numbers, assert every `image_path` reference exists on disk. One workflow prevents the entire class of drift this audit found.
2. Reword the "dual test pipelines / high-reliability" README claim to accurately describe the Selenium scripts that exist.
3. Add SRI to the Tailwind CDN `<script>` tag (FontAwesome already has it; Tailwind does not).
4. Add a brief privacy note for the FormSubmit feedback data path.

**P2 — maintainability & performance (backlog):**
1. Split `events.js` (1,647 lines) and `flashcards.js` (1,881 lines) into focused modules.
2. Replace Tailwind CDN with a precompiled stylesheet — removes the Tailwind production advisory (and the monkey-patch suppressing it), shrinks payload, lets CSP drop `unsafe-inline`/`eval`.
3. Establish one canonical data file per level; delete `wordlist - x.json` duplicates and the multiple CSV copies.
4. Collapse dual `image` + `image_path` fields to one field in the JSON schema.
5. Unify the two manual cache-version constants (`WORDLIST_CACHE_VERSION` in app.js, `CACHE_VERSION` in sw.js).

---

## 14. Final Word

The engineering instincts here are good — in places, excellent. The FSRS engine, persistence
layer, and service worker are the kind of work that stands up in a serious code review. The data
is more rigorous than it initially appeared: the zero-inference clause is real, with examples and
pronunciations grounded against official Goethe-Institut source material via NotebookLM.

The P0 fixes applied in this session — correcting the word counts across every surface, committing
the long-pending image deletions, fixing 6 broken B1 refs, removing the dead manifest icon, and
updating all stale docs — close the gap that separated "impressive app" from "honest app." The
path to 4/5 runs through a single CI workflow (to prevent count drift forever) and the Tailwind
CDN swap (to fix the CSP and suppress the suppressed warning).

---

## Appendix — Reproducible Measurements

```bash
# Word counts (actual)
python -c "import json;[print(l,len(json.load(open(f'{l}/wordlist.json',encoding='utf-8')))) for l in ['a1','a2','b1']]"
# -> a1 684 / a2 580 / b1 1363  (total 2627)

# Tracked images vs. on disk
for d in a1 a2 b1; do echo "$d tracked: $(git ls-files $d/images | wc -l)  on-disk: $(ls $d/images | wc -l)"; done
# -> a1 800/637   a2 2419/580   b1 2733/371

# Working-tree deletions
git status --short | grep -cE "^ ?D"     # -> 4364

# Missing referenced module
ls js/stats.js                            # -> No such file

# Lines of code (largest modules)
wc -l js/events.js js/flashcards.js index.html
# -> 1647 / 1881 / 1705
```
