# DeutschSphere — Competitive Analysis & KPI Benchmark (2026-06-30)

**Status:** Strategic assessment — informational, not a release gate.
**Companion docs:** `PRODUCTION_READINESS_AUDIT_2026-07-01.md` (internal quality),
`AGENTS.md` (vision & scope), `VISION.md` (roadmap).

---

## 0. Honesty & methodology

This is an **honest, asymmetric** benchmark:

- **DeutschSphere's scores are grounded in verified repo facts** (entry counts,
  image coverage, modules, CSP, network sinks) measured on this branch on
  2026-06-30. The grounding data is in **Appendix A**, and every score traces to
  it.
- **Competitor scores are informed estimates** based on each product's
  publicly-known characteristics as of the author's knowledge (Jan 2026). They
  are **not** live, instrumented benchmarks, and product features change. Treat
  them as directional, not precise.

Ratings are **/10** (rubric in **Appendix B**). The "Winner" column names the
strongest product on that KPI. A high score is not automatically "good for our
user" — e.g. we score Gamification a deliberate **1**, because zero gamification
is a *design pledge* (`AGENTS.md` §2), not a missing feature.

**Scope of comparison.** We benchmark DeutschSphere *as it exists today* — a
free, offline-first, no-tracking German **A1–B1 vocabulary flashcard** tool — not
as a full language course. Competitors are scored on the same KPIs even where
their ambition is broader.

---

## 1. The competitor set

| Product | Why it's here | Model |
|---|---|---|
| **Anki** | The SRS gold standard; closest philosophical sibling (offline, local, free) | Free (US$25 one-time on iOS) |
| **Duolingo** | Market leader; the gamification benchmark | Free + ads / Super subscription |
| **Memrise** | Vocabulary-first; native-speaker video clips | Freemium (increasingly paywalled) |
| **Babbel** | The benchmark for a *professionally-curated* German course | Subscription only |
| **Seedlang** | The closest **German-specific SRS** rival (Easy German team) | Freemium / subscription |

Also-rans referenced in narrative but not tabled (to keep the matrix readable):
**Quizlet** (general flashcards, ad-driven), **Deutsche Welle / Nicos Weg** (free
official DW course — the strongest *free* alternative, but a course, not an SRS
flashcard tool), **Clozemaster**, **Drops**.

---

## 2. KPI scorecard

| KPI | **DS** | Anki | Duo | Mem | Bab | Seed | Winner |
|---|---|---|---|---|---|---|---|
| SRS / memory algorithm | **9** | 10 | 5 | 6 | 6 | 8 | Anki |
| Content quality (DE A1–B1) | **8** | 5¹ | 7 | 7 | 9 | 9 | Babbel / Seedlang |
| Coverage & breadth | **5** | 9 | 8 | 7 | 8 | 7 | Anki |
| Pedagogical depth | **6** | 6 | 6 | 7 | 9 | 8 | Babbel |
| Audio / pronunciation | **5** | 6 | 8 | 9 | 9 | 9 | Memrise / Babbel / Seedlang |
| Visual / dual-coding | **8** | 6 | 7 | 7 | 7 | 6 | **DeutschSphere** |
| Offline capability | **10** | 9 | 5 | 5 | 6 | 4 | **DeutschSphere** |
| Privacy / no-tracking | **10** | 8 | 3 | 4 | 5 | 5 | **DeutschSphere** |
| Cost / value | **10** | 9 | 6 | 5 | 3 | 4 | **DeutschSphere** |
| UX polish & design | **7**² | 4 | 9 | 8 | 9 | 8 | Duolingo / Babbel |
| Gamification / engagement | **1**³ | 2 | 10 | 8 | 5 | 6 | Duolingo |
| Platform reach | **7** | 9 | 9 | 8 | 8 | 7 | Anki / Duolingo |
| Accessibility (WCAG-intent) | **7**⁴ | 5 | 6 | 6 | 6 | 5 | **DeutschSphere** |
| Community / shared content | **2** | 10 | 7 | 6 | 4 | 6 | Anki |
| **Raw avg (unweighted)** | **6.8** | 7.0 | 6.9 | 6.6 | 6.7 | 6.6 | — |

**Footnotes**

1. Anki the *engine* is world-class. As a **turnkey, curated A1–B1 German
   product** it is deck-dependent and inconsistent (community decks vary in
   quality, rarely Goethe-aligned), so the *content* KPI scores 5.
2. DeutschSphere UX is **unproven at scale** (solo project, no battle-testing).
   The design intent is premium/SOTA; the 7 reflects intent minus validation.
3. **Intentional zero.** No streaks, leagues, XP, or lives — a permanent design
   pledge (`AGENTS.md` §2). For the "no dark patterns" audience this is a
   *feature*; the low score only reflects raw engagement mechanics.
4. Ships skip-links, `sr-only`, focus management, and a high-contrast theme, but
   **no formal WCAG 2.2 AA audit has been completed** — the 7 is provisional and
   is itself a backlog item.

> The **raw average is deliberately uninformative** — it weights Gamification
> equally with Privacy. The real signal is *per-KPI dominance* (§3) and a
> persona-weighted read (§5), not the mean.

---

## 3. Per-KPI read — who wins and why

**SRS / memory algorithm — Anki (10), DS (9).**
DeutschSphere ships **FSRS-5**, the same modern algorithm *family* Anki adopted
as its best-in-class scheduler. We trail Anki only on optimizer maturity
(per-user parameter training, decades of edge-case hardening). Everyone else uses
weaker or gamified review; Duolingo's "spaced practice" is not true SRS.

**Content quality (German A1–B1) — Babbel / Seedlang (9), DS (8).**
Our dataset is **Goethe-Wortliste-aligned, 0-verbatim, grammar-gated** (originality
+ offline LanguageTool gates, `scripts/`). That is unusually rigorous for a free
tool. We trail Babbel/Seedlang only because they add **human-linguist and
native-speaker review at scale**; ours is automated-verified and solo-authored.

**Coverage & breadth — Anki (9), DS (5).**
Our weakest *fundamentals* score. B1 is a **curated ~57% subset** of canon with
only **27% imagery**, the scope is A1–B1 only, and thematic groups
(days/months/colours/numbers/countries) aren't built yet. Anki's deck ecosystem
and Duolingo's full A1–B2 path dominate raw breadth.

**Audio / pronunciation — Memrise / Babbel / Seedlang (9), DS (5).**
**Our most defensible competitive gap.** We use browser `speechSynthesis` (TTS)
plus a `SpeechRecognition`-based pronunciation trainer — functional, but
**synthetic**, not native-speaker recordings. Memrise (native video clips),
Seedlang (native video), and Babbel (studio audio + speech scoring) are clearly
ahead. Closing this is the single highest-leverage product move (§5).

**Visual / dual-coding — DeutschSphere (8).**
Image-per-card is **baked into the data model** (A1 93%, A2 100% coverage), not
DIY (Anki) or shallow/early-only (Duolingo). We win this outright where imagery
exists; the B1 27% gap is the asterisk.

**Offline / Privacy / Cost — DeutschSphere (10 / 10 / 10).**
Our moat. **Zero third-party asset requests** after load, **self-hosted
everything**, strict CSP, **no account / ads / analytics / tracking**
(`telemetry.js` is an in-memory console buffer; only two network sinks exist —
local data + an opt-in feedback POST), and **forever-free** open source. No
competitor matches all three; Anki is the only one even close (it's local-first
and effectively free, but its sync server and iOS price cost it the perfect mark).

**UX polish — Duolingo / Babbel (9), DS (7).**
Funded teams with years of design iteration win here. Our intent is premium and
the shell is clean, but it is unvalidated. Anki, conversely, is powerful but
notoriously clunky (4).

**Gamification — Duolingo (10), DS (1, intentional).** See footnote 3.

**Platform reach — Anki / Duolingo (9), DS (7).**
We're an **installable PWA** (any modern browser, desktop or mobile, add-to-home)
— genuinely cross-platform, but with **no native app-store presence**, which
costs discoverability and some iOS/Android polish.

**Accessibility — DeutschSphere (7, provisional).**
We lead on *intent and primitives*, but the lead is unconfirmed until the formal
audit lands.

**Community / shared content — Anki (10), DS (2).**
Anki's shared-deck library + add-on ecosystem is an unbeatable network-effect
moat. We have none by design (single curated dataset, no social layer).

---

## 4. Where we stand — the three buckets

**We win decisively (best-in-class):**
- **Privacy (10)** — nobody is close; Duo/Memrise sit at the opposite pole.
- **Cost / value (10)** — forever-free, open, no paywall.
- **Offline (10)** — true offline-first PWA; only Anki rivals it.
- **Visual dual-coding (8)** — image-native flashcards.
- **Accessibility-intent (7)** — pending formal sign-off.

**We're genuinely competitive (within ~1 pt of the leader):**
- **SRS (9 vs 10)** — Anki-class scheduling without the Anki learning cliff.
- **Content quality (8 vs 9)** — rigor a free tool rarely has.

**We lose (real gaps to close):**
- **Coverage (5)** — B1 subset, 27% B1 imagery, no thematic sets, A1–B1 only.
- **Audio (5)** — synthetic TTS vs native-speaker audio/video.
- **Community (2)** — no shared decks / social; structurally hard to match.
- **Pedagogical depth (6)** — vocabulary-only *by design* (no grammar lessons,
  dialogue, or speaking drills).

---

## 5. Net verdict & rivals to watch

**Verdict.** In the specific niche we're building for —
**un-gamified · privacy-first · free · offline German A1–B1 flashcards** —
**DeutschSphere is already arguably best-in-class.** The flat raw average (6.8)
hides this because it weights gamification like privacy. On a **persona-weighted**
read for a privacy-conscious self-studier (heavy weight on SRS correctness,
content accuracy, privacy, offline, cost; near-zero on gamification/community),
**we lead the field.** On a "complete course for a casual beginner" read
(weight on gamification, audio, pedagogy, polish), **Duolingo/Babbel win** — but
that user was never our target.

**Two rivals to watch:**

- **Anki** — the benchmark for SRS rigor + ecosystem. We *match* its algorithm
  class and *beat* its onboarding/UX, but its shared-deck network effect is
  unbeatable head-on. Our wedge: **"Anki-quality SRS without the Anki learning
  cliff,"** curated specifically for Goethe A1–B1.
- **Seedlang** — the closest **German-specific SRS** rival (native-speaker
  video, Easy German brand). Their edge is **native audio/video + community**;
  ours is **free + private + offline**. Neutralizing their audio advantage is the
  game.

**The path forward** — closing every one of these gaps **without breaking a
single pledge** — is laid out in §6. The guardrails that keep us from "winning
the wrong way" are in §7, and the projected outcome is in §8. These are strategic
inputs for `backlog.md` / `VISION.md`, not release blockers.

## 6. The road to #1 — *within our limits*

We do **not** win by out-Duolingo-ing Duolingo. We win by **perfecting a narrow
thing** and turning our self-imposed constraints into moats. Every move below is
checked against the `AGENTS.md` pledges — **none of them add gamification, a
grammar engine, a chatbot, accounts, tracking, ads, paid tiers, or runtime AI.**
Each instead deepens what we already are: a free, private, offline, SRS-correct,
image-native A1–B1 vocabulary tool.

Ordered by leverage (impact × how directly it attacks a competitor's edge):

1. **Native-speaker audio (bundled, offline).**
   *Attacks:* Audio **5 → 8/9** — our single most defensible gap (vs.
   Seedlang/Memrise/Babbel).
   *Move:* Commission/record native A1+A2 headword + example audio, ship as
   compressed static assets precached by the service worker.
   *In-bounds because:* static media, no runtime AI, no cloud call — the offline
   and privacy pledges stay intact (audio plays from cache, not a CDN).
   *Horizon:* medium (recording/licensing effort, not engineering-hard).

2. **Fully on-device pronunciation feedback.**
   *Attacks:* Audio **+** Privacy — turns today's honest *caveat* (browser
   `SpeechRecognition` may hit a vendor cloud) into a **flex**.
   *Move:* Lean on the existing `phonetics.js` / `phoneme_guides.js` to score
   pronunciation locally; make any cloud STT strictly opt-in and clearly labelled.
   *In-bounds because:* removes a network dependency — strengthens the privacy
   moat rather than spending it. *Horizon:* medium.

3. **B1 to parity + imagery + thematic groups.**
   *Attacks:* Coverage **5 → 7/8** — our weakest *fundamentals* score.
   *Move:* Lift B1 from a ~57% curated subset toward canon, raise B1 imagery
   above 27%, and add the missing thematic sets (days/months/seasons/colours/
   numbers/countries).
   *In-bounds because:* more curated, zero-inference-gated data and
   original-authored examples — exactly the data policy we already enforce
   (`AGENTS.md` §6). *Horizon:* medium–large (content + B1 image generation needs
   owner-provided creds).

4. **Formal WCAG 2.2 AA audit + fixes.**
   *Attacks:* Accessibility **7 → 9** — converts a *provisional* lead into a
   **defensible, marketable** one (a real differentiator vs. all five rivals,
   none of whom lead here).
   *In-bounds because:* it's a pure SOTA quality bar (`AGENTS.md` §4), no scope
   creep. *Horizon:* small–medium.

5. **File-based deck import/export (no server, no account).**
   *Attacks:* Community **2 → 4/5** — our structurally hardest gap — **without**
   touching the no-account / no-tracking pledges.
   *Move:* Extend `backup.js` so learners can export and share curated decks as
   local files and import others' — a "bring-your-own-deck" ecosystem with **zero
   social backend**.
   *In-bounds because:* local files only; no sync server, no profiles, no
   telemetry. We get *some* of Anki's network-effect upside while keeping the
   privacy moat. *Horizon:* small–medium.

6. **Private, local progress insight (not gamification).**
   *Attacks:* the *engagement* axis where Duolingo wins — but **honestly**.
   *Move:* Surface what the SRS already knows — "due today," retention forecast,
   leeches needing attention, a calm heatmap — computed and stored **locally**.
   *In-bounds because:* this is **showing the SRS state**, not streaks, XP,
   leagues, lives, or loss-aversion pressure. No dark patterns (`AGENTS.md` §2,
   §4). The line we never cross: nothing that punishes a missed day. *Horizon:*
   small.

7. **Surface the content-trust signals we already earn.**
   *Attacks:* Content-quality **perception** (we score 8 but few users would know
   *why*).
   *Move:* Show the rigor — "0 verbatim vs. official lists · grammar-gated ·
   Goethe-Wortliste-aligned · original examples" — in-app and in the README.
   *In-bounds because:* it merely exposes verification that already runs in
   `scripts/`; no new claims. *Horizon:* trivial.

8. **Ship the UX proof.**
   *Attacks:* UX polish **7 → 8** — converts an *unproven* score into a
   *validated* one.
   *Move:* Adopt a performance budget, run a small usability pass, and publish the
   results. *In-bounds because:* quality-bar work only. *Horizon:* small.

> **Note on the two scores we will *not* chase:** Gamification (1) and
> Pedagogical depth (6) stay where they are **on purpose**. We will not add
> streaks/leagues to inflate the first, nor grammar lessons / dialogue / a tutor
> chatbot to inflate the second — both would violate the scope boundary. We beat
> the field *around* them, not by becoming them.

---

## 7. Guardrails — how we will **not** compete

The fastest way to climb a generic leaderboard is to adopt the very mechanics our
charter forbids. We refuse these on principle — they are how competitors win, and
declining them **is** our differentiation.

| Tempting play | Who leans on it | Why we refuse | Our in-bounds answer instead |
|---|---|---|---|
| Streaks / leagues / XP / lives | Duolingo, Memrise | Dark patterns; punish missed days (`AGENTS.md` §2, §4) | Calm, local progress insight (§6.6) |
| Ads / data monetisation | Duolingo (free tier), Quizlet | Breaks the privacy + free-forever pledge (§3) | Forever-free, zero ads, zero trackers |
| Accounts + cloud sync as default | Most rivals | "No account, ever" pledge; a tracking vector | Local IndexedDB + file backup/import (§6.5) |
| Grammar-correction engine / AI tutor chatbot | Babbel, AI apps | Out of scope — we are a **flashcard** tool, not a course (§2) | Stay narrow; nail vocabulary acquisition |
| Paid "premium" tier / upsell | Babbel, Seedlang, Memrise | Free-forever, non-negotiable (§3) | One free tier, fully featured |
| Runtime AI / paid API in the shipped app | AI-first apps | Breaks offline + cost + privacy invariants (§2, §5) | All AI is **dev-time only** (verification gates) |
| Engagement-maxxing push notifications | Duolingo | Manipulative pressure | At most a gentle, local, opt-in "due" nudge |

If a future feature can only be justified by "but the competitors do it," that is
the signal to **stop** and re-read §2.

---

## 8. Target scorecard — *after* the in-bounds roadmap

Projected DeutschSphere scores **if §6 lands** (and only §6 — no pledge broken).
This is a **target, not an achievement**; every uplift traces to a specific move.

| KPI | Today | Target | Driver (from §6) |
|---|---|---|---|
| SRS / memory algorithm | 9 | 9 | already category-class |
| Content quality (DE A1–B1) | 8 | 9 | trust signals + audio (§6.1, §6.7) |
| Coverage & breadth | 5 | 7 | B1 parity + thematic groups (§6.3) |
| Pedagogical depth | 6 | 6 | **held by design** (no grammar engine) |
| Audio / pronunciation | 5 | 8 | native audio + local scoring (§6.1–6.2) |
| Visual / dual-coding | 8 | 8 | B1 imagery reinforces (§6.3) |
| Offline capability | 10 | 10 | preserved (audio bundled, not CDN) |
| Privacy / no-tracking | 10 | 10 | reinforced (§6.2, §6.5) |
| Cost / value | 10 | 10 | unchanged pledge |
| UX polish & design | 7 | 8 | perf budget + usability proof (§6.8) |
| Gamification / engagement | 1 | 1 | **held by design** (intentional) |
| Platform reach | 7 | 7 | (native app store = future, optional) |
| Accessibility (WCAG) | 7 | 9 | formal AA audit (§6.4) |
| Community / shared content | 2 | 4 | file-based decks, no server (§6.5) |
| **Raw avg (unweighted)** | **6.8** | **~7.6** | — |

**What this means.** Even the *blunt, unweighted* average moves from 6.8 to ~7.6
— enough to **top the table outright** (today's leader, Anki, sits at 7.0) — and
it does so **without adding one point of gamification or one line of grammar
engine.** On the persona-weighted read that actually matters for our user
(privacy-first self-studier), the lead becomes decisive. The two scores we
deliberately leave low (Gamification 1, Pedagogy 6) are the *proof* we stayed in
our lane, not evidence of weakness.

---

## Appendix A — DeutschSphere grounding data (verified 2026-06-30)

Measured on branch `audit/production-readiness-2026-06-30`.

**Dataset (`*/wordlist.json`):**

| Level | Entries | With image | Image coverage | example_de | example_en | pronunciation |
|---|---|---|---|---|---|---|
| A1 | 684 | 637 | 93.1% | 684 (100%) | 684 (100%) | 684 (100%) |
| A2 | 580 | 580 | 100% | 580 (100%) | 580 (100%) | 580 (100%) |
| B1 | 1,363 | 371 | 27.2% | 1,363 (100%) | 1,363 (100%) | 1,363 (100%) |
| **Total** | **2,627** | **1,588** | **60.4%** | **100%** | **100%** | **100%** |

WebP assets on disk: **1,595** (1,588 card images + 7 collages).

**Engine & features (`js/`):** FSRS-5 scheduler (`fsrs.js`, `state.js`), TTS via
`speechSynthesis` (`audio.js`), pronunciation trainer via `SpeechRecognition`
(`phonetics.js`, `phoneme_guides.js`), quiz (`quiz.js`), immersion lab
(`immersion.js`), search (`search.js`), NLP helpers (`nlp.js`), backup/restore
for data durability (`backup.js`), IndexedDB persistence (`idb-keyval.js`),
local-only structured logging (`telemetry.js`).

**Privacy / offline posture:**
- CSP: `default-src 'self'`; no `script-src` CDN, no `unsafe-eval`; `font-src
  'self'` (self-hosted fonts under `fonts/`).
- Network sinks (entire app): **(1)** same-origin `./{level}/wordlist.json` load;
  **(2)** opt-in feedback `POST` to `formsubmit.co` (user-initiated).
- `telemetry.js`: 100-entry in-memory ring buffer → `console` only; **no network
  egress**.
- Known caveats (honest): feedback `POST` still targets a **hardcoded personal
  email** (P1 owner action, see audit §6); browser `SpeechRecognition` may route
  audio to the vendor's cloud when the pronunciation trainer is *actively used*
  in some browsers (opt-in, not background tracking).

**Verification gates (`scripts/`):** `check_example_originality.py` (0-verbatim
copyright gate), `check_grammar_languagetool.py` (offline LanguageTool),
`check_examples_llm_judge.py` (optional LLM second opinion),
`check_image_word_clip.py` (free local CLIP + perceptual-hash image↔word check).

---

## Appendix B — Rating rubric (/10)

| Band | Meaning |
|---|---|
| 9–10 | Best-in-class / category-defining |
| 7–8 | Strong; competitive with leaders |
| 5–6 | Adequate; clear gaps vs leaders |
| 3–4 | Weak; a meaningful disadvantage |
| 1–2 | Absent or near-absent (may be **by design** — see notes) |

Scores are comparative within this five-competitor set for the German-learning
use case, not absolute universal grades. A "by design" low score (e.g.
Gamification = 1) reflects a deliberate scope pledge, not a defect.

---

*Prepared 2026-06-30. DeutschSphere figures are verified against the repository;
competitor figures are informed estimates (knowledge cutoff Jan 2026) and should
be re-validated before any external/marketing use.*
