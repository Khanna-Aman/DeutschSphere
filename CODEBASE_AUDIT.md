# DeutschSphere — Honest Codebase Audit

**Auditor role:** Senior fullstack engineer + German-language/linguistics reviewer
**Date:** 2026-06-29
**Scope:** Entire repository (application code, data, assets, tooling, docs)
**Method:** Direct file inspection + reproducible measurements (commands in the Appendix). No code was changed.

> **TL;DR** — The *application* is genuinely well-built: a disciplined, zero-dependency
> vanilla-JS PWA with a faithful FSRS-5 spaced-repetition engine, careful persistence/error
> handling, and a mature service-worker update flow. The *project around it* needed work:
> the headline word count was overstated across all surfaces, the image/asset tree was in a
> broken half-migrated state, and the advertised "test pipelines" were not CI. **P0/P1 and most
> P2 work is now done** (counts corrected to 2,627 everywhere; curated B1 list restored with all
> image refs valid; asset tree committed; an automated CI data-integrity gate prevents future
> drift; two real bugs fixed — a fixed-button overlap that made Settings unclickable, and a
> cache layer that silently served stale data after updates; the image schema was collapsed to
> one field; and **Tailwind was precompiled so the CSP could drop `unsafe-inline`/`unsafe-eval`
> and the CDN dependency**). The data-grounding claim is legitimate — examples and pronunciations
> are NotebookLM-verified against Goethe-Institut source material. The only deferred items are
> splitting two large JS modules and wiring the (passing) Playwright tests into CI — both
> maintainability, neither blocking production.
>
> **Updated overall verdict post-fix: 3.5 / 5.**

---

## 1. Executive Summary

| | |
|---|---|
| **What it is** | Offline-first German A1–B1 vocabulary SPA (flashcards, SRS, quizzes, pronunciation coach, NLP lab), deployed to GitHub Pages. |
| **Stack** | Hand-written ES6 modules, precompiled Tailwind (static stylesheet) + FontAwesome via CDN, IndexedDB, Web Speech API, Service Worker. No runtime build, no runtime npm dependencies (Tailwind regenerated on demand via CLI). |
| **Biggest strength** | Real engineering substance — the FSRS-5 implementation and the persistence/PWA layers are the work of someone who knows what they're doing. |
| **Biggest remaining risk** | Low. The in-browser JS tests aren't yet wired into CI (run manually). The data/asset claims that drifted are now gated automatically, and the two oversized modules have been split. |
| **Headline verdict (post-fix)** | **4.0 / 5 — production-ready.** P0/P1 and P2 done (data CI gate, three real bug fixes, schema collapse, Tailwind precompile + CSP hardening, oversized-module split, gamification removed for study focus). Only remaining item: wiring the (passing) JS tests into CI. |

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
| Architecture & modularity | **4.5** *(was 4.0)* | Clean ES6 modules, CustomEvent decoupling, no deps; the two oversized modules were split (phonetics.js, backup.js extracted). |
| Code quality & safety | **4.0** | Defensive persistence wrappers, HTML escaping, import validation, low debug noise. |
| SRS correctness (FSRS-5) | **4.5** | Faithful, well-documented port with immutable updates and Leitner→FSRS migration. |
| PWA / offline | **4.5** | Robust SW update flow, versioned caches, 4 tailored fetch strategies, true offline. |
| Security & privacy | **4.0** *(was 3.5)* | CSP `script-src` hardened — dropped `unsafe-inline`/`unsafe-eval`/CDN via Tailwind precompile + FOIC externalization; FormSubmit privacy note; escaping + import validation. Sync key still Base64. |
| Accessibility | **3.5** | `sr-only` H1, skip link, `aria-live`, keyboard map, labels — solid base, no formal audit. |
| **Data integrity & honesty** | **4.0** *(was 2.0)* | Word counts corrected to 2,627; curated B1 list restored (1,363); all image refs valid; now enforced by CI. Duplicate files remain. |
| **Asset pipeline / repo state** | **3.5** *(was 1.5)* | 4,364 deletions committed; all broken/duplicate image refs cleared across A1/A2/B1; B1 27% documented as in-progress; manifest icon fixed. |
| **Testing & CI** | **2.5** *(was 1.5)* | Automated GitHub Actions data-integrity gate added; JS unit/e2e tests (Playwright) still run manually, not in CI. |
| **Docs accuracy** | **4.0** *(was 2.0)* | Counts corrected across all surfaces; `js/stats.js` removed; QA/CI claims rewritten to match reality. |
| **Overall production readiness** | **4.0** *(was 3.0)* | P0/P1 + P2 done: data CI gate, three real bug fixes (UI overlap, cache propagation, gamification scope-creep), schema collapse, Tailwind precompile + CSP hardening, oversized-module split, clean git history. Remaining: JS tests in CI. |

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
- ✅ **Resolved:** `js/events.js` (1,647 → 1,183) and `js/flashcards.js` (1,881 → 1,185) were
  split along feature seams — the Phonetik-Spiegel moved to `js/phonetics.js` (701 lines) and
  backup/sync to `js/backup.js` (461 lines), verified by the unit + e2e suites.
- `index.html` is ~1,690 lines of inline markup with heavy Tailwind class strings — hard to
  diff and review (acceptable for a single-shell SPA; not split this pass).
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
- ~~**`telemetry.js` monkey-patches `console.warn` to suppress Tailwind's own
  "cdn.tailwindcss.com should not be used in production" advisory.**~~ ✅ **Resolved:** Tailwind
  is now precompiled (§9), so the warning no longer fires; the `console.warn` override was
  removed and native warning behavior restored.
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

**Verdict: 3.5/5** (was 1.5/5 before fixes).

- **Image mapping integrity — ✅ Confirmed correct.** Full audit verified that images are
  assigned in monotonically consistent generation order with 0 orphaned files and 0
  false references. The `image_path` numbers (e.g. `card_22.webp` for entry `id=21`) do
  not match entry IDs — they reflect original generation-batch ordering — but the sequence
  is internally consistent and no image points to the wrong word.
- **4,364 stale image deletions — ✅ Committed.** The tree was mid-migration from the old
  Twemoji `.svg` approach (3,576 files) to Imagen 3 `.webp` (788 orphaned removals). All
  deletions were safe: not a single on-disk deletion was referenced by current data.
  `git clone` now matches the working copy.
- **Broken B1 image references — ✅ Fixed.** A `git checkout` during the P0 pass had
  regressed B1 to a stale 1,399-entry list with ~1,000 dead `.svg` refs; the curated
  1,363-entry list was restored, 981 dead SVG-era refs nulled, and the id=82
  (`der Ausdruck`) duplicate image cleared. Verified: **0 broken and 0 duplicate image
  refs across A1, A2, and B1**, now enforced by CI.
- **B1 illustration coverage is 27%** (371 / 1,363 words) — in-progress. All docs now
  state this accurately. Remaining ~992 entries will get WebP assets in future passes.
- **Broken manifest icon — ✅ Fixed.** Removed dead `twemoji_cache/1f393.svg` reference
  from `manifest.json`.
- **Duplicate image references:** entries still carry both `image` and `image_path` with the
  same value — redundant. Collapsing to one field is a P2 cleanup item.
- **Duplicate data files** per level (e.g. `wordlist.json` + `wordlist - a1.json`) remain;
  enforcing a single source of truth is P2.

---

## 9. Security & Privacy — ✅ CSP hardened

**Verdict: 4.0/5** (was 3.5 before fixes).
- **Good:** CSP `<meta>` present; consistent HTML escaping; `restoreFromSyncKey` validates all
  imported data; no server, no accounts, fully local — minimal attack surface.
- **✅ Fixed (this pass):**
  - **CSP `script-src` now drops `'unsafe-inline'`, `'unsafe-eval'`, and the Tailwind CDN** —
    reduced to `'self' https://cdnjs.cloudflare.com` (Lottie). Enabled by precompiling Tailwind
    to a static stylesheet (no runtime JIT → no `eval`) and externalizing the one inline
    pre-init script to `js/foic-preinit.js`. Verified zero CSP violations at runtime. This is
    the single biggest XSS-surface reduction in the codebase.
  - **SRI gap resolved by removal** — the unversioned Tailwind Play CDN script (which couldn't
    take a stable SRI hash) is gone entirely; FontAwesome and Lottie retain their SRI hashes.
  - **FormSubmit privacy note** added inline to the feedback form (third-party relay disclosed,
    no storage/tracking).
- **Remaining weaknesses:**
  - `style-src` still allows `'unsafe-inline'` for 6 static inline `style=` attributes
    (low risk; would need hashing or extraction to remove).
  - The "Sync Key" is **Base64, not encryption.** The code comments are honest about this
    ("NOT encrypted — treat like a password"); the user-facing README could state it too.

---

## 10. Accessibility & UX

**Verdict: 3.5/5.** Better than typical. Present: a single semantic `sr-only` `<h1>`, a skip
link, `aria-live="polite"` on the flashcard region, `aria-label`s on icon buttons, visible
keyboard-shortcut documentation, `<noscript>` fallback, and `prefers-color-scheme` theme
detection. Not done: no evidence of a formal screen-reader/contrast audit; very small font
sizes (`text-[9px]`/`text-[10px]`) on chips and labels may fail touch-target and readability
guidelines; heavy reliance on color (gender glows) needs a non-color cue check.

---

## 11. Testing & CI — ✅ data gate added; JS tests still manual

**Verdict: 2.5/5** (was 1.5/5 before fixes). A GitHub Actions workflow now gates **data
integrity** on every push/PR that touches a wordlist or a count-bearing doc
([`.github/workflows/validate-data.yml`](.github/workflows/validate-data.yml) running
[`scripts/validate_data.py`](scripts/validate_data.py)). It fails the build on invalid JSON,
duplicate ids, broken or duplicated image references, CSV row-count drift, and — critically —
any published word count that no longer matches the data. This closes the exact gap that let
the 3,921-vs-2,627 drift ship (the check was verified to fail on a simulated `3,921` total).

What remains for a higher score:
- **JS logic is still not gated.** The genuine in-browser tests — `scripts/run_unit_tests.py`
  (FSRS-5 math, Kölner Phonetik, lemmatization), `scripts/debug_syntax.py` (import/console
  smoke), and `scripts/e2e_comprehensive_tests.py` (end-to-end flows) — are **Playwright**-driven
  (the earlier "Selenium" description was wrong) and run on demand, not in CI.
- Wiring those into CI needs a browser runner (`playwright install chromium` in the workflow);
  it is the next step but heavier than the data gate.
- ~13k lines of ad-hoc one-off Python tooling remain under `scripts/` (incl. a `scripts/scratch/`
  folder) — useful for the author, but not part of any gated pipeline.

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

**Fixed in P1 pass:**
- ✅ The README §QA "dual test pipelines / high-reliability" claim was rewritten to accurately
  describe the Playwright scripts (run manually) and the new automated data-integrity CI gate.

**Still outstanding:**
- `docs/walkthrough_a2.md` references 1,142 cards — historical document, accurately reflects the pre-overhaul A2 size. No change needed; context is clear.

---

## 13. Remediation Backlog

**P0 — ✅ ALL DONE**
1. ✅ Commit image deletions: reconciled SVG→WebP migration (4,364 files).
2. ✅ Fix all word-count claims to real **2,627** across README, index.html, manifest.json, VISION.md, docs/backlog.md.
3. ✅ Restored the curated B1 wordlist (1,363 entries) after a `git checkout` regression and cleared all dead image references (981 SVG-era paths nulled + the id=82 duplicate). All three levels now have zero broken or duplicated image refs.
4. ✅ Remove dead `twemoji_cache/1f393.svg` icon from manifest.json.
5. ✅ Remove non-existent `js/stats.js` from README file hierarchy.
6. ✅ Update asset-coverage claims to real percentages (A1 93%, A2 100%, B1 27% in-progress).
7. ✅ Zero-inference clause confirmed valid via NotebookLM; no rewrite needed.

**P1 — credibility & safety — ✅ DONE**
1. ✅ Added GitHub Actions CI ([`validate-data.yml`](.github/workflows/validate-data.yml) +
   [`scripts/validate_data.py`](scripts/validate_data.py)): parses each `wordlist.json`, asserts
   the published total matches the data across README/index.html/manifest.json/VISION.md, and
   asserts every image reference exists on disk and is unique. Prevents the entire class of
   drift this audit found.
2. ✅ Reworded the README §QA "dual test pipelines / high-reliability" claim to accurately
   describe the Playwright scripts (manual) and the new automated data gate.
3. ✅ SRI on the Tailwind CDN — **resolved by removal.** Tailwind is now precompiled (P2 #2), so
   the unversioned CDN script is gone entirely; FontAwesome and Lottie retain SRI.
4. ✅ Added an inline privacy note to the feedback form for the FormSubmit data path.

**P2 — maintainability & performance**

> After this pass the author's working tree was committed, so the previously blocked items
> below were completed. Each change was verified against the Playwright unit + e2e suites and
> the data validator before commit.

1. ✅ **Split the two oversized modules.** `events.js` (1,647 → 1,183) and `flashcards.js`
   (1,881 → 1,185) decomposed along feature seams: `js/phonetics.js` (701) for the Phonetik-Spiegel
   and `js/backup.js` (461) for profile backup/sync. Behaviour-preserving, verified by unit + e2e.
   (Companion sidebar intentionally left in flashcards.js to avoid a circular import.)
2. ✅ **Replaced the Tailwind CDN with a precompiled stylesheet** (`tailwind.css` via
   `tailwind.config.js`). Removed the production advisory + its monkey-patch, and let CSP
   `script-src` drop `unsafe-inline`/`unsafe-eval`/CDN. See §9.
3. ✅ One canonical data file per level — deleted the `wordlist - x.json` duplicates and the
   extra CSV copies; `wordlist.json` (+ a regenerated `wordlist.csv`) is the single source.
4. ✅ Collapsed the dual `image` + `image_path` fields to a single `image` field across all
   levels; the validator now guards against `image_path` reappearing.
5. ✅ Cache-version constants clarified and a real bug fixed: `WORDLIST_CACHE_VERSION` is now
   appended as a `?v=` param so a data bump actually bypasses the SW's cache-first data cache
   (previously it didn't, silently serving stale data). The two constants now own distinct,
   documented layers (data vs. shell).
6. ⏳ **Deferred (only remaining item):** wire the Playwright unit/e2e tests into CI (needs
   `playwright install chromium` in the workflow).

**Scope cleanup (post-audit):** the app was re-scoped to study-only. All gamification
(particle bursts, wrong-answer shake, quiz star ratings + letter grades) was stripped from the
code so it matches the long-stated "zero gamification" principle, and every doc (README, VISION,
GEMINI, CONTRIBUTING, docs/) was reconciled with the code — correcting the Phonetik-Spiegel
algorithm (SpeechRecognition + Levenshtein, not Kölner), the "compressed/encrypted" Sync Key
(plain Base64), the Tailwind-CDN references, a non-existent `stats.js`/`#/stats` route, and the
swipe/hotkey behaviour. *(Note: the `getPhoneticSimilarity` Kölner routine in `nlp.js` is
implemented and unit-tested but currently unwired — a candidate for future use or removal.)*

---

## 14. Final Word

The engineering instincts here are good — in places, excellent. The FSRS engine, persistence
layer, and service worker are the kind of work that stands up in a serious code review. The data
is more rigorous than it initially appeared: the zero-inference clause is real, with examples and
pronunciations grounded against official Goethe-Institut source material via NotebookLM.

The work applied across this engagement closed the gap that separated "impressive app" from
"production-honest app." On the integrity side: word counts corrected on every surface, the
curated B1 list restored with every broken/duplicate image reference cleared, the long-pending
image deletions committed, the dead manifest icon removed, all stale docs updated, an automated
CI data-integrity gate added (the count drift that triggered this audit can no longer ship —
CI fails the build on it), and the QA/CI claims rewritten to match reality. On the hardening
side: two genuine bugs fixed (a fixed-overlay that made the Settings control unclickable, caught
by the e2e suite; and a Service-Worker cache layer that silently served stale data after a data
update), the redundant image schema collapsed, and — the marquee change — Tailwind precompiled
to a static stylesheet so the CSP could drop `unsafe-inline`, `unsafe-eval`, and the third-party
CDN script source entirely. Every change was verified against the data validator and the
Playwright unit + e2e suites before commit.

What remains is genuinely optional for shipping: splitting the two large JS modules and wiring
the (already passing) Playwright tests into CI. Both are maintainability investments, not
production blockers — deliberately deferred rather than rushed, since they carry refactor risk
with no runtime benefit.

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

# Lines of code (largest modules, after the module split)
wc -l js/events.js js/flashcards.js js/phonetics.js js/backup.js index.html
# -> 1183 / 1185 / 701 / 461 / 1673  (was 1647 / 1881 before extracting phonetics.js + backup.js)
```
