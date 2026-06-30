# Production-Readiness Audit — DeutschSphere (A1–B1 German)

**Date:** 2026-06-30
**Auditor:** Independent full-stack + linguistics review (Claude Opus 4.8)
**Scope:** Entire repository, prepared for public release
**Ground truth:** Official Goethe-Institut *Wortliste* PDFs (A1 *Start Deutsch 1*, A2, B1), cross-checked via NotebookLM notebook **`OpusAudit`** (`11fef2ec-4ada-414b-9648-e2fccd276d3f`) **and** by deterministic text extraction of the same PDFs (`.raw_resources/*.pdf`).
**Relationship to prior work:** This audit *independently re-verifies* (does not inherit) the claims in `CODEBASE_AUDIT.md` (2026-06-29), and adds linguistic ground-truth, legal/IP, and privacy dimensions that prior audit did not cover.

---

## 1. Executive summary & verdict

> ### ⛔ VERDICT: **NOT production-ready for public release** — blocked by one critical legal issue.
> The **engineering** is genuinely strong (a clean, zero-dependency, offline-first PWA with a real FSRS-5 SRS engine, sane security headers, and CI-gated data integrity). The **data is linguistically accurate** — 99.6% of all 2,627 entries trace directly to the official Goethe lists. **But that accuracy comes from verbatim copying**: ~90%+ of the example sentences are word-for-word reproductions of copyrighted Goethe-Institut / Hueber / telc / ÖSD publications, redistributed here under an MIT license that cannot grant those rights. That is the release blocker. Two further items (third-party data flows without a privacy policy; the "100% offline" claim being false on first load due to CDN fonts) should be fixed before launch, especially given the EU/German target audience.

**Overall weighted score: 63 / 100 (C)** — *gated*. Absent the content-licensing blocker, the engineering quality alone would land around **B+**. The score cannot rise to "ready" while a P0 legal item is open, regardless of average.

**Release-blocking conditions (all P0 must close):**
1. **Resolve example-sentence copyright** (≈2,400 verbatim Goethe/Hueber sentences) — relicense, replace with original sentences, or remove.
2. **Fix licensing scope** — MIT must not purport to license third-party copyrighted content; add a `NOTICE`/attribution and a non-affiliation disclaimer for the "Goethe" marks.
3. **Add a privacy policy** and disclose/repair third-party data flows (Google Fonts, Cloudflare CDN, `formsubmit.co` with a personal email).

---

## 2. KPI scorecard

| # | Dimension | Score | /5 | Severity of gaps | One-line rationale |
|---|---|---|---|---|---|
| 1 | Data accuracy & linguistic integrity | **92** | ★★★★½ | P2 | 99.6% of entries match official lists; no genuine gender/plural errors; perfect UTF-8; 1 dup headword. |
| 2 | Content coverage & completeness | **50** | ★★½ | P1 | Thematic groups (days/months/seasons/colours/numbers/countries) absent; B1 ≈57% of canon; B1 images 27%. |
| 3 | Architecture & code quality | **80** | ★★★★ | P2 | Clean modular vanilla ES6, zero runtime deps, defensive persistence; no JS lint/tests. |
| 4 | Security | **75** | ★★★½ | P1 | CSP + `escapeHtml` + SRI + no secrets/eval; `unsafe-inline` styles, external CDNs. |
| 5 | Privacy & data protection | **45** | ★★ | **P0** | Google Fonts + Cloudflare IP leakage; `formsubmit.co` + personal email; **no privacy policy**. |
| 6 | Legal / IP & licensing | **20** | ★ | **P0** | Verbatim copyrighted examples under MIT; "Goethe" marks w/o disclaimer; Imagen terms unaddressed. |
| 7 | Accessibility | **75** | ★★★½ | P2 | Skip link, `sr-only`, `lang="de"`, focus mgmt, ARIA; no formal axe pass. |
| 8 | Performance & offline | **72** | ★★★½ | P1 | Precompiled Tailwind, lazy/precached images; CDN deps break true offline first-load; 19.7 MB images. |
| 9 | PWA robustness | **82** | ★★★★ | P2 | Manifest + SW with dual cache-versioning + install prompt + offline fallback. |
| 10 | Testing & CI | **50** | ★★½ | P1 | `validate_data.py` gate is good; Playwright/JS tests not wired; CI ignores `js/` changes. |
| 11 | Documentation honesty | **62** | ★★★ | P1 | Counts corrected; but "zero-inference / NotebookLM-generated" and "100% offline" misrepresent reality. |
| 12 | UX & pedagogy (SRS) | **88** | ★★★★½ | P2 | FSRS-5, quizzes, pronunciation coaching, immersion, themes, no gamification (study focus). |
| | **Weighted overall** | **63** | | | Gated by P0 legal/privacy. |

*Weights: Legal 14, Data 12, Coverage 12, Security 9, Privacy 9, Architecture 8, A11y 7, Performance 7, PWA 6, Testing 6, Doc-honesty 5, UX 5.*

---

## 3. Methodology & provenance

- **Counts & integrity:** direct parse of `a1/a2/b1/wordlist.json`; ran the repo's own `scripts/validate_data.py`.
- **Linguistic ground truth (exhaustive):** extracted the three official PDFs with `pdftotext -enc UTF-8` (correct umlauts; `pypdf` mis-decoded them), built normalized headword/gender/plural sets, and **deterministically matched all 2,627 app entries** against them (strong = official headword match; weak = token attested anywhere in the official text; none = absent). Ambiguous/flagged items were **adjudicated against the PDFs via NotebookLM `OpusAudit`**.
- **Copyright test:** normalized every `example_de` and tested for verbatim substring / 6-gram presence in the official PDF text.
- **Code/security/PWA:** read of `index.html`, `js/*`, `sw.js`, `manifest.json`, `.github/workflows/`, `LICENSE`.
- Reproducible: official extraction + diff script archived under `scripts/` as part of remediation.

---

## 4. Findings by dimension

### 4.1 Data accuracy & linguistic integrity — 92/100 ✅
- **App→official fidelity: 99.6%** (2,616 / 2,627). Per level: A1 99.3% (5 unmatched), A2 99.1% (5), B1 99.9% (1). Every unmatched item is a **parser-normalization artifact**, not a scope error — e.g. stem entries `best-`, `jed-`, `unser-`, `welch-`, and alternations like `weglaufen / wegmachen`, `(an-)/(aus)ziehen`. NotebookLM confirmed the flagged B1 item `die Geschwindigkeitsbeschränkung` is legitimate.
- **Gender/plural: no genuine errors.** The 7 flagged "mismatches" are all linguistically valid: nominalized adjectives with both genders (`der/die Angehörige, Angestellte, Kranke, Studierende, Tote`), the homonym **`Leiter`** (der Leiter = manager / die Leiter = ladder — NLM-confirmed), and `das Lebensmittel` (correct singular; the official list only gives the plural `die Lebensmittel`).
- **Encoding:** perfect UTF-8 across ä/ö/ü/ß; no stray whitespace; all IDs unique per level.
- **No duplicate defects.** The two B1 `der Ausdruck` entries are **intentional polysemy** (id 81 "expression/phrase"; id 82 "printout"), not a duplicate — the second correctly carries no image to keep image refs unique. The only literal duplicates found were in the build-only artifact `scripts/words_a1.tsv` (`auf sein`, `aus`), which does not ship.
- **Field population:** `pronunciation`, `example_de`, `example_en` are 100% populated; `gender/plural/antonym` nulls are correct-by-design (verbs/adjectives/etc.). *Caveat:* the 100% example population is a consequence of copying (see §4.6), not generation.

### 4.2 Content coverage & completeness — 50/100 ⚠️ (P1)
- **Thematic word groups are missing.** Every Goethe list (NLM-confirmed) opens with a *Wortgruppenliste*: numbers, days, months, seasons, colours, countries, currencies, directions. The app ingested only the **alphabetical** section, so these are absent: **months 0/12, weekdays 0/7, seasons 0/4, country names 0/5**, and basic colours/cardinal-number words largely absent. For an A1 learner this is foundational vocabulary.
- **B1 wordlist is materially incomplete.** App B1 = 1,363 vs the official ~2,400 lexical units. A deterministic diff flags 500+ official B1 headwords absent; an **NLM-verified sample confirmed 8/8** real (`ablehnen, absagen, annehmen, abnehmen, anschließen, Abschied, absolut, abwesend`). B1 therefore covers roughly **55–60% of the official B1 canon**.
- **Image coverage:** A1 93% (637/684), A2 100% (580/580), **B1 27% (371/1,363)** — 992 B1 entries have no illustration. App degrades gracefully (null image), but the gap is large.
- **Counting model (clarified):** per-level counts only reconcile with official sizes because levels are **disjoint** (each word once, at introduction): A1+A2 = 1,264 ≈ official A2 ~1,300; total 2,627 ≈ official B1 ~2,400. "A2 100% complete" means *images for the 580 A2 entries*, not *the full official A2 list*.

### 4.3 Architecture & code quality — 80/100 ✅
- Vanilla ES6, 16 modules (~7.9k LOC), no bundler, **zero runtime dependencies**; Tailwind **precompiled** (not CDN runtime). Real **FSRS-5** scheduler (`js/fsrs.js`), zero-dependency German NLP (`js/nlp.js`), dual persistence (localStorage + IndexedDB via `js/idb-keyval.js`) with debounced/safe writes, decoupled module events, global error boundaries (`js/telemetry.js`).
- **Gaps:** no ESLint/Prettier, no TypeScript, no JS unit/e2e tests integrated (Playwright scripts exist but unrun in CI). Some large modules (`flashcards.js` 1,185 LOC, `events.js` 1,183 LOC) would benefit from decomposition.

### 4.4 Security — 75/100 ✅ (P1 hardening)
- **Good:** CSP present (`index.html:11`) with `script-src 'self' cdnjs` (**no** `unsafe-inline` scripts); FontAwesome loaded with **SRI**; all `innerHTML` sinks pass through `escapeHtml` (`state.js`); no `eval`/`Function`/`document.write`; `.env`/keys git-ignored, no secrets committed; HTTPS-gated speech APIs.
- **Hardening:** `style-src 'unsafe-inline'` (Tailwind) is hard to avoid but worth scoping; reliance on third-party CDNs widens the trust boundary (mitigated by self-hosting — see §4.5/§4.8).

### 4.5 Privacy & data protection — 45/100 ⛔ (P0)
- **Google Fonts** (`fonts.googleapis.com`/`fonts.gstatic.com`, `index.html:50`) and **Cloudflare cdnjs** (`:49`) are fetched at runtime → the user's **IP is disclosed to Google and Cloudflare** on every first load. For an EU/German audience this is a recognized GDPR exposure (cf. LG München I, 20.01.2022 — Google Fonts hotlinking).
- **Feedback** posts name/email/message to a third party `https://formsubmit.co/ajax/2002aman.khanna@gmail.com` (`events.js:1097`) — a **personal Gmail** is exposed in client source (scraping/spam) and user data leaves to an undisclosed processor.
- **No privacy policy / terms** are present in the repo. Good baseline: all learner progress is stored **locally only** (no accounts, no analytics, no trackers found).

### 4.6 Legal / IP & licensing — 20/100 ⛔ (P0, release blocker)
- **Verbatim copyrighted content.** Example sentences are copied word-for-word from the official publications: **A1 92.4%, A2 89.1%, B1 83.9% exact** (≈93–97% incl. near-matches) — ~2,400 sentences. The PDFs state they are *Auszüge* from Hueber Verlag / Goethe-Institut / telc / ÖSD works and are *urheberrechtlich geschützt* (NLM-confirmed). Example: `abbiegen → "An der nächsten Kreuzung müssen Sie links abbiegen."` is the Goethe sentence verbatim.
- **License mismatch.** `LICENSE` is plain MIT over "the Software and associated documentation files," purporting to grant rights to "copy, modify, … sell" — which the project **cannot grant** for third-party copyrighted sentences. The data is not the project's to MIT-license.
- **Trademark.** "Goethe-Zertifikat" / "Goethe-Institut" are used throughout (incl. marketing copy "verified against official Goethe-Institut curricula") **without a non-affiliation disclaimer**, risking an implication of endorsement.
- **Generated images.** README credits Google **Imagen 3**; redistribution/relicensing terms for the generated `.webp` assets are unaddressed.

### 4.7 Accessibility — 75/100 ✅
- `lang="de"`, skip link (`index.html:68`), single `sr-only` `h1`, ARIA roles, focus management on route changes (`router.js`), `noscript` fallback. **Not yet** validated with an automated axe pass or contrast audit on the `#020617` palette.

### 4.8 Performance & offline — 72/100 ✅ (P1)
- Precompiled Tailwind, `modulepreload` hints, lazy + on-demand-precached images, SW cache-first for data/images, stale-while-revalidate for CDNs. **But "100% offline" is false on first load**: FontAwesome + Google Fonts are network-required until the SW caches them. 19.7 MB of images are committed and ship with the site.

### 4.9 PWA robustness — 82/100 ✅
- `manifest.json` (standalone, maskable icons), `sw.js` v7.4.0 with **decoupled app-shell vs. wordlist cache versions**, 23-item app-shell precache, offline navigation fallback, install-prompt manager, multi-tab activation broadcast.

### 4.10 Testing & CI — 50/100 ⚠️ (P1)
- `.github/workflows/validate-data.yml` runs `validate_data.py` (JSON, unique IDs, image refs, CSV parity, doc/data count consistency) — a genuine, valuable gate. **But** it triggers only on data/doc paths, so **JS changes run no CI at all**; Playwright unit/e2e suites and any linting are not wired in.

### 4.11 Documentation honesty — 62/100 ⚠️ (P1)
- Word counts were corrected (3,921 → 2,627) and are CI-guarded — good. **But** two framings misrepresent reality: (a) "**zero-inference / examples produced via NotebookLM**" — the examples are *extracted verbatim* from Goethe, not generated; (b) "**100% offline PWA**" — untrue on first load (CDN fonts). README/VISION/CONTRIBUTING should be restated precisely.

### 4.12 UX & pedagogy — 88/100 ✅
- Strong study-focused feature set: FSRS-5 spaced repetition, MC + spelling quizzes, pronunciation coaching (waveform + Levenshtein scoring), immersion text analyzer, search/lemmatization, 5 themes, backup/sync, **no gamification** (consistent with the stated study focus).

---

## 5. Independent re-verification of `CODEBASE_AUDIT.md` (2026-06-29)

| Prior claim | Status this audit | Note |
|---|---|---|
| 2,627 entries (A1 684 / A2 580 / B1 1363) | ✅ Confirmed | Direct parse + `validate_data.py`. |
| 0 broken / 0 duplicate **image** refs | ✅ Confirmed | Validator passes. |
| Word counts corrected across docs | ✅ Confirmed | CI guards them. |
| Tailwind precompiled (no CDN runtime) | ✅ Confirmed | `index.html:47`. |
| "Examples/pronunciation NotebookLM-grounded, not LLM inference" | ⚠️ **Refuted/Reframed** | Examples are **verbatim copied** from copyrighted Goethe text — not "generated," and a copyright issue the prior audit treated as resolved. |
| Asset tree "clean" / production-ready | ⚠️ Partly | Image refs are clean, but 619 orphaned legacy SVGs remain; **content coverage** (thematic groups, B1) was not assessed. |
| Overall trajectory "ready pending assets" | ⚠️ Disagree | Legal/IP + privacy are unaddressed P0s; coverage gaps larger than stated. |

---

## 6. Prioritized remediation log

> Status legend: ✅ done this session · 🟡 in progress · ⏳ requires owner decision/credentials

### P0 — release blockers
- 🟡 **Example-sentence copyright** — owner chose **replace with original sentences**. Pipeline built and verified: `scripts/check_example_originality.py` (gate) + `scripts/apply_examples.py` (merge). **A1 complete: all 684 entries original, 0 verbatim copies (verified).** A2 (580) and B1 (1363) remain, same pipeline. *Blocker stays open until verbatim reaches 0 across all three levels.*
- ✅ **Licensing/attribution** — `NOTICE` separates code (MIT) from content; non-affiliation/trademark disclaimer added; `LICENSE` scoped to source code; Imagen 3 terms flagged.
- ✅ **Privacy** — `PRIVACY.md` added; fonts + FontAwesome **self-hosted** (no Google/Cloudflare calls), CSP tightened to self-only; `formsubmit.co` flow disclosed. *Remaining:* swap the personal feedback Gmail for a dedicated address / FormSubmit hashed token (owner action).

### P1
- ✅ **CI** — added `.github/workflows/js-checks.yml`: blocking `node --check` syntax gate on all `js/**` changes + advisory ESLint (`eslint.config.js`, dev-only).
- ✅ **Docs** — README now states offline accurately (true after self-hosting), reframes grounding honestly, and documents the disjoint-level counting model + real B1/thematic coverage.
- ✅ **Data integrity** — verified: no shipped duplicates (the `der Ausdruck` pair is intentional polysemy). Optionally regenerate the build-only `scripts/words_*.tsv` to drop its artifact duplicates.
- 🟡 **Coverage plan** — add the missing thematic groups (days/months/seasons/colours/numbers/countries) as A1 content; publish an honest B1 completeness roadmap.

### P2
- ⏳ **B1 imagery** (992 missing) — bulk Imagen 3 generation needs GCP/Vertex creds (git-ignored) + cost; **out of scope for automatic remediation** unless access is provided.
- Remove 619 orphaned legacy SVGs; add unit tests for `fsrs.js`/`nlp.js`; run an axe accessibility pass; add `CHANGELOG.md`; consider decomposing the two largest JS modules.

---

## 7. Bottom line

DeutschSphere is a **well-built, honest-in-engineering, study-focused PWA** whose **vocabulary is among the most accurate you will find** — because it is faithfully, and in the case of example sentences *literally*, the official Goethe material. That fidelity is simultaneously its biggest strength and its single release blocker: **you cannot ship ~2,400 verbatim copyrighted sentences under an MIT license to the public.** Resolve the content licensing, add the privacy basics, and tell the truth about offline/grounding in the docs, and this becomes a confidently shippable product. The coverage gaps (thematic groups, B1) are quality/roadmap items, not blockers.
