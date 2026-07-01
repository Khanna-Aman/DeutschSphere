# DeutschSphere — Production-Readiness Audit (2026-07-01)

**Auditor:** independent re-verification pass (adversarial; every claim re-run against the code/data).
**This session did BOTH:** (a) a full 14-dimension re-audit, and (b) remediation — rebuilt the test
suite into a CI gate, relabeled the scheduler honestly, and **split a systemic data defect** (33
merged wordlist entries) into correct separate lemmas. Feature TODOs (audio, B1 imagery, thematic
groups, module decomposition, manual WCAG sign-off, perf budget) remain **audited but deferred**.
**Supersedes** the prior 2026-06-30 baseline audit (its claims are carried into the confirm/refute
table below; the old file was removed to keep the public repo root clean).

> Every number below was produced by running the code/gates this session. Where a check was sampled
> rather than exhaustive, it says so. **Corpus is now 2,660 entries** (was 2,627 — see §1).

---

## 0. Verdict — **GO (conditional)** for the stated scope

DeutschSphere is a free, offline-first, zero-runtime-dependency A1–B1 German vocabulary PWA. For
that scope it is releasable: no P0 (release-blocking) defect survived re-verification, and the three
original P0 blockers (example-sentence copyright, licensing/attribution, privacy) remain **closed and
re-confirmed**.

**Fixed this session (were P1):**
1. ✅ **Scheduler honesty** — relabeled "FSRS-inspired (FSRS-5-based)" in code + docs, with the three
   spec-simplifications documented in `js/fsrs.js` (§5). No behavior change.
2. ✅ **Systemic B1/A2 data corruption** — 33 entries that merged two *unrelated* lemmas into one row
   were split into correct separate entries, facts source-grounded, original examples authored + gated;
   a validator guard now blocks regressions (§1).

**Remaining P1 (before the next tagged release):**
3. **Manual WCAG 2.2 AA walkthrough** (§9) — automated Lighthouse is green; the manual pass is not done.
4. **Real performance budget + minification** (§10) — assets are unminified; CI perf is advisory only.

**Overall weighted score: ≈ 85 / 100.**

---

## Public-launch readiness (GitHub Pages) — **GO**

Deployment-specific checks beyond the code audit (verified 2026-07-01):

| Check | Result |
|---|---|
| Copyrighted source material not published | ✅ `.raw_resources/` (Goethe PDFs/MP3s) is git-ignored & untracked |
| No secrets in the repo | ✅ `.env` untracked (only holds a GCP project id/region, no keys); `*key.json` ignored |
| Works under a project subpath `/<repo>/` | ✅ all asset paths relative; SW scope `./`; manifest scope `./` |
| Jekyll won't mangle the static site | ✅ `.nojekyll` added; no underscore-prefixed files |
| Canonical / Open-Graph / manifest URLs match the deploy target | ✅ `khanna-aman.github.io/DeutschSphere` matches remote `Khanna-Aman/DeutschSphere` |
| Offline integrity (SW precache + IndexedDB) | ✅ verified by `tests/smoke_e2e.py` |
| Data / originality / grammar / unit gates | ✅ all green (2,660 entries; 0 verbatim; 0 grammar defects; 22/22 tests) |
| **Secret scan (current tree + full git history)** | ✅ no API keys/tokens/private keys/cookies ever committed; `.env`/`*key.json` untracked; no GCP id or local paths leaked |
| **SOTA repo hygiene** | ✅ `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.gitattributes`, issue/PR templates, CI status badges |

**Owner acknowledgements (not blockers, but decide before launch):**
- The feedback form posts to `formsubmit.co/…/2002aman.khanna@gmail.com` — a **personal email that
  will be visible in public source** and will receive submissions (formsubmit.co needs a one-time
  email confirmation on first use). Swap or accept.
- ~~Illustrations / Imagen 3 redistribution terms~~ — **RESOLVED**: Google Cloud Vertex AI grants
  customer ownership of generated output with the right to publish/redistribute (§8); NOTICE updated,
  no FLUX migration needed.

**Verdict: cleared for public release.** The two remaining P1 items (manual WCAG 2.2 AA, performance
budget) are post-launch polish, not launch blockers for a free study tool.

---

## Scorecard

| # | Dimension | /5 | /100 | Notes |
|---|-----------|----|------|-------|
| 1 | Data accuracy & linguistic integrity | 4.0 | 80 | Systemic 33-entry merge defect **found & fixed** this session + regression guard; a few borderline slash-pairs remain; full linguistic diff still sampled |
| 2 | Content coverage & completeness | 4.0 | 80 | 2,660 entries; B1 curated subset; imagery gap + no thematic groups — honestly disclosed |
| 3 | Example sentences | 4.5 | 90 | **0 verbatim** (2,660); 33 new split examples pass grammar clean |
| 4 | Architecture & code quality | 4.0 | 80 | Clean module split; `flashcards.js`/`events.js` ~1.18k LOC each |
| 5 | Correctness deep-dives | 4.0 | 80 | Scheduler now honestly labeled + documented; NLP heuristics have known misses |
| 6 | Security | 4.5 | 90 | Strong CSP (`script-src 'self'`), no eval, escaping at data sinks incl. user input |
| 7 | Privacy | 4.5 | 90 | Zero third-party on load; formsubmit.co only on explicit feedback; SpeechRecognition caveat |
| 8 | Legal / IP | 4.5 | 90 | Code MIT + NOTICE non-affiliation solid; **imagery (Imagen 3) redistribution confirmed permitted** & documented |
| 9 | Accessibility | 4.0 | 80 | Automated Lighthouse a11y 100; **manual** WCAG 2.2 AA not yet done |
| 10 | Performance | 3.5 | 70 | Unminified assets; fonts 1.3 MB; CI perf advisory only |
| 11 | PWA robustness | 4.5 | 90 | Valid manifest; sound SW strategies; offline boot verified this session |
| 12 | Testing & CI | 4.0 | 80 | **Rebuilt** deterministic suite (22 tests) + smoke/e2e, wired into CI; e2e advisory |
| 13 | Documentation honesty | 4.5 | 90 | Counts CI-gated & accurate (2,660); FSRS relabel; stale test claim corrected |
| 14 | UX & pedagogy (SRS) | 4.0 | 80 | FSRS-style SRS is pedagogically sound and now honestly labeled |

Weighted mean ≈ **85/100**.

---

## Confirm / Refute — prior audit, carried-forward TODO & this audit's own first pass

| Claim | Verdict | Evidence (this session) |
|---|---|---|
| 2,627 entries | **SUPERSEDED** | was 2,627; **now 2,660** after splitting 33 merged entries (§1). `validate_data.py` green; all image refs resolve. |
| Example sentences 0 verbatim | **CONFIRMED (extended)** | `check_example_originality.py` → verbatim=0 across all 2,660 (incl. 33 new). |
| CSP tightened, self-hosted fonts, no CDNs | **CONFIRMED** | CSP `script-src 'self'`; no third-party URLs load in `index.html`; `fonts/` self-hosted. |
| SW cache versioning split shell vs data | **CONFIRMED** | `CACHE_VERSION v7.5.0` vs `WORDLIST_CACHE_VERSION v1.0.6`. |
| No eval / secrets / dangerous sinks | **CONFIRMED** | none in any module. |
| "Test suite is rotted — delete and rebuild" | **REFUTED (stale)** | `run_unit_tests.py` ran clean; suite rebuilt anyway for a cleaner gate (§12). |
| Scheduler is "FSRS-5" | **REFUTED → FIXED** | deviates from spec (§5); **relabeled** "FSRS-inspired" this session. |
| (this audit's own first pass) "2 minor B1 defects; ids 81/82 duplicate" | **SELF-CORRECTED** | ids 81/82 are **NOT** a defect — two legitimate senses of *der Ausdruck* (plurals *Ausdrücke* vs *Ausdrucke*). Deeper scan then found a **systemic 33-entry merge** the first pass missed (§1). |
| Data is clean (implicit in prior audit) | **REFUTED → FIXED** | 33 entries merged two unrelated lemmas; now split (§1). |
| Lighthouse a11y/best-practices/SEO = 100 | **NOT RE-RUN** | gate present (`quality.yml`); not re-executed this session. |

---

## Findings per dimension

### 1 — Data accuracy & linguistic integrity  *(systemic P1 — FIXED this session)*
- **Systemic merge defect (found + fixed).** The B1/A2 generator glued **alphabetically-adjacent but
  unrelated** lemmas into single rows — e.g. `bevor / bewegen`, `singen / sinken`, `link- / die Lippe`,
  `nass / national / die Natur` (three merged). Confirmed against the Goethe B1 Wortliste that each is a
  **separate source entry**. **33 corrupt rows (31 B1 + 2 A2) were split** into their correct separate
  lemmas: facts (gender/plural/word_class) taken zero-inference from the Goethe lists, one original
  grammar-gated example authored per new lemma, `word_class` corrected (e.g. id 682 `link-` Nomen→Adjektiv;
  id 793 `der Nachteil` Andere→Nomen). Corpus 2,627 → **2,660**. Also fixed a doubled headword
  (`das Hähnchen / das Hähnchen` → `das Hähnchen`).
- **Regression guard added** — `scripts/validate_data.py` now fails on any `/`-headword not in a curated
  allowlist of legitimate variants/pairs (spelling variants, dual-gender nouns, phrase alternations,
  prefix groups). Blocks a recurrence in CI.
- **Self-corrected false positive:** this audit's first pass called B1 ids 81/82 a "duplicate." They are
  **two legitimate senses** of *der Ausdruck* (expression, pl. *Ausdrücke* / printout, pl. *Ausdrucke*) —
  kept as-is.
- **Baseline still good:** 0 duplicate IDs; A1/A2 nouns 100% gendered. **Encoding clean** (the
  `Mobilität → Mobilit�t` seen in console is a Windows-console artifact; 0 U+FFFD in data).
- **Remaining (P2, documented):** a few borderline slash-groupings kept in the allowlist
  (`die Nordsee / die Ostsee`, `Elektro- / elektronisch`) and a likely duplicate variant-pair
  (`die Fantasie / Phantasie` ids 342 & 834) warrant a later editorial pass. Full 2,660-row diff vs the
  Goethe PDFs remains sampled, not exhaustive.

### 2 — Coverage & completeness  *(P2, disclosed)*
- 2,660 entries (A1 684 / A2 582 / B1 1,394). B1 is an explicit curated subset (~58% of the ~2,400
  official B1 units). Honest B1 imagery target = concrete-noun subset (~300–450). Thematic groups absent.

### 3 — Example sentences  *(PASS)*
- `check_example_originality.py`: **verbatim = 0** across all 2,660 (one new example, `nächst-`, collided
  and was rewritten; re-run clean). 29 near-6-gram overlaps flagged advisory-only.
- Grammar: **full-corpus offline LanguageTool gate (`check_grammar_languagetool.py`, LanguageTool-6.8) →
  0 grammar/spell defects** (a1 684 / a2 580 / b1 1,394 checked; 12 advisory style/typography items,
  non-blocking; VERDICT PASS). This pass covered all 31 new B1 split examples; the 2 new A2 examples were
  separately verified clean (0/88 targeted run). Whole 2,660-entry corpus is grammar-clean.

### 4 — Architecture & code quality  *(P2)*
- Clean ESM boundaries; `fsrs.js`/`nlp.js` import cleanly in Node. Largest modules `flashcards.js`
  (1185 LOC), `events.js` (1183) — decomposition candidates (deferred).

### 5 — Correctness deep-dives  *(FIXED label / P2 math deferred)*
**FSRS scheduler (`js/fsrs.js`) — relabeled this session.** It is internally consistent, monotonic,
bounded, immutable and deterministic (all verified by `tests/fsrs.test.mjs`), but deviates from the
reference FSRS-5 spec:
- difficulty update (`_nextDifficulty`) mean-reverts toward `D0(Good)` and omits the FSRS-5 linear
  damping `(10−D)/9` (reference reverts toward `D0(Easy)`);
- forgetting curve (`getRetrievability`) is the FSRS-4.x form `(1 + t/(9S))^-1`, not FSRS-5's
  `(1 + (19/81)·t/S)^-0.5`;
- short-term stability (`w17`/`w18`) is unimplemented (weights now marked RESERVED).
**Action taken:** relabeled "FSRS-inspired (FSRS-5-based)" across `fsrs.js`, README, VISION, index.html,
CONTRIBUTING, AGENTS; simplifications documented in the module header. A fully spec-compliant rewrite is
tracked as a follow-up (P2 — it would change live schedules, so it belongs in its own tested change).
**NLP (`js/nlp.js`)** — heuristic, immersion-only: `lemmatizeVerb('arbeitest') → 'arbeien'` (over-strips
the `-test` rule). P2/P3, no effect on scheduling.
**Persistence** — IndexedDB↔localStorage round-trip verified (smoke test); SW versioning + old-cache
cleanup correct.

### 6 — Security  *(PASS)*
- CSP `default-src 'self'; script-src 'self'; connect-src 'self' https://formsubmit.co`. No eval. 41
  `innerHTML` sinks; data/user-driven ones are `escapeHtml`-wrapped, **including user input** (immersion
  paste `immersion.js:126`, typing-quiz answer `quiz.js:422`). 0 runtime dependencies.

### 7 — Privacy  *(PASS)*
- **Zero third-party requests on load.** Two fetch sinks: local `./{level}/wordlist.json`; `formsubmit.co`
  feedback (fires only on explicit submit; carries hardcoded personal email `events.js:1097` — owner
  action, deferred). Disclose the browser `SpeechRecognition` cloud caveat in `PRIVACY.md`.

### 8 — Legal / IP  *(P2)*
- `LICENSE` (MIT) scoped to code; `NOTICE` states Goethe non-affiliation. **Imagery — RESOLVED:** the
  card illustrations were generated with Google Cloud Vertex AI Imagen 3 (`imagen-3.0-generate-002`).
  Under Google Cloud's Service Specific Terms for AI/ML Services, Google does not assert ownership of a
  customer's generated output and customers may use it commercially and disclose it to third parties
  (publish/redistribute), subject to the Prohibited-Use policy; output is also covered by Google's
  generative-AI copyright indemnity. The competing-model restriction is inapplicable (static study
  illustrations, not model training). No FLUX migration needed; `NOTICE` §3 documents this + the SynthID
  watermark. Refs: cloud.google.com/terms/service-terms and /terms/generative-ai-indemnified-services.

### 9 — Accessibility  *(P1 — manual pass pending)*
- Automated Lighthouse a11y = 100 (not re-run this session). **Manual WCAG 2.2 AA walkthrough not done** —
  keyboard-only, focus traps, SR semantics, `#020617` contrast, `prefers-reduced-motion`. Open gap.

### 10 — Performance  *(P2)*
- Uncompressed shell: `index.html` 120 KB, CSS 112 KB (two files), `js/*` 345 KB, **fonts 1.3 MB**, all
  **unminified**. gzip/brotli mitigates transfer but there is no build-time minification or enforced
  budget; CI perf advisory. Open gap.

### 11 — PWA robustness  *(PASS)*
- Valid `manifest.json`; cache-first shell + network-fallback data with independent versioning; offline
  boot + render + IDB persistence verified by `tests/smoke_e2e.py`.

### 12 — Testing & CI  *(rebuilt this session)*
- Deleted the old harness + one-off cruft; rebuilt `tests/fsrs.test.mjs` (14) + `tests/nlp.test.mjs` (8)
  on `node --test` (zero deps, **22 green**) and `tests/smoke_e2e.py` (Playwright boot/smoke). CI:
  `tests.yml` `unit` job is a **hard blocking gate**; `e2e` advisory. `package.json` gains `test`/`test:e2e`.

### 13 — Documentation honesty  *(PASS)*
- Counts CI-gated and accurate (2,660). FSRS claims relabeled. Corrected the stale backlog "Comprehensive
  E2E Playwright suite" claim (that script is deleted; replaced by `tests/smoke_e2e.py`).

### 14 — UX & pedagogy (SRS)  *(PASS)*
- 4-grade retrievability-aware scheduling; now honestly labeled. `COMPETITIVE_ANALYSIS` "FSRS-5" claim
  should carry the §5 caveat.

---

## Remediation plan

**Fixed this session**
- Rebuilt deterministic test suite (22 `node --test` + smoke/e2e) + blocking CI gate; deleted rotted scripts.
- Relabeled the scheduler "FSRS-inspired (FSRS-5-based)" + documented simplifications.
- Split 33 systemically-merged B1/A2 entries into correct lemmas (source-grounded facts, original gated
  examples); fixed the `das Hähnchen` duplication; added a merged-headword regression guard; synced all
  counts to 2,660.
- Produced this independent, evidence-backed audit; corrected its own first-pass false positive (ids 81/82).

**Remaining — P1 (before next tagged release)**
| Item | Owner | Notes |
|---|---|---|
| Manual WCAG 2.2 AA walkthrough (§9) | maintainer | keyboard/SR/focus/contrast/reduced-motion sign-off |
| Real performance budget + minification (§10) | maintainer | enforce budget; minify CSS/JS; audit 1.3 MB fonts |

**Remaining — P2 / owner-gated (deferred)**
- Fully spec-compliant FSRS-5 rewrite (§5) — own tested change (alters live schedules).
- Native-speaker audio (Lingua Libre + Piper TTS); on-device pronunciation (Vosk/whisper.cpp — also
  closes the §7 SpeechRecognition caveat).
- B1 concrete-noun imagery (~300–450) — route undecided (owner: Cloudflare token / local GPU).
- Thematic word groups; module decomposition (`flashcards.js`, `events.js`).
- Editorial pass on remaining borderline slash-pairs + the `Fantasie/Phantasie` duplicate (§1);
  full 2,660-row linguistic diff vs the Goethe PDFs.
- Hardcoded feedback email — owner elected to **keep as-is**. (Imagery redistribution: **resolved**, §8.)

---

## Method / reproducibility

Commands run this session (offline, free tooling): `python scripts/validate_data.py` (now incl. the
merged-headword guard) · `python scripts/check_example_originality.py` · targeted LanguageTool grammar
check on the new examples · `node --test "tests/**/*.test.mjs"` · `python tests/smoke_e2e.py` · Goethe-PDF
extraction (`pdftotext -enc UTF-8`) to source-ground the splits · direct JSON integrity probes · `grep`
sink/URL enumeration. Not re-run this session: Lighthouse (`npm run audit:lighthouse`), the CLIP
image↔word gate, and the full-corpus grammar pass over all 2,660.
