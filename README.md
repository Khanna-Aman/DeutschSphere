# 🇩🇪 DeutschSphere

[![Live Web App](https://img.shields.io/badge/Launch%20App-DeutschSphere-FF007F?style=for-the-badge&logo=google-translate&logoColor=white&labelColor=020617)](https://khanna-aman.github.io/DeutschSphere/)
[![Deploy Status](https://img.shields.io/badge/Deploy-GitHub%20Pages-00F0FF?style=for-the-badge&logo=github&logoColor=white&labelColor=020617)](https://khanna-aman.github.io/DeutschSphere/)

**Learn German A1–B1 vocabulary with flashcards that actually remember what you
forget.** DeutschSphere is a free, offline-first study app built around proven
spaced repetition — 2,627 curated words with illustrations, audio, quizzes, and a
pronunciation coach. No ads, no account, no tracking. It runs entirely in your
browser and works without an internet connection once loaded.

### 👉 **[Launch the app →](https://khanna-aman.github.io/DeutschSphere/)**

---

## Why DeutschSphere

- **🎯 Remembers for you.** A modern spaced-repetition engine (FSRS-5) schedules
  each word for review right before you'd forget it — so you study less and retain
  more.
- **🆓 Free, forever.** No subscription, no ads, no paywalled features. It's a gift
  to learners.
- **🔒 Private by design.** Your progress never leaves your device. No account, no
  analytics, no trackers, no cookies.
- **📶 Works offline.** Install it to your home screen and study on the train, on a
  plane, anywhere — with zero network dependency.
- **🎓 Focused, not gamified.** No streaks to guilt you, no XP, no dark patterns —
  just the fastest path from *new word* to *long-term memory*.

---

## What's inside

**🧠 Spaced-repetition flashcards.** Every word is scheduled by the FSRS-5 algorithm,
which models how your memory of it decays over time. Grade a card with a swipe (or
`1`–`4` on desktop) and it reappears at the perfect moment. Cards glow by noun
gender — 🔵 *der*, 🩷 *die*, 🟢 *das* — to build gender intuition as you go.

**🗣️ Pronunciation coach (Phonetik-Spiegel).** Speak into your mic and get a live
match score against the target word, a waveform of your voice next to a reference,
and mouth-position guides for tricky sounds like *ä, ö, ü, ch, sch, r*.

**✍️ Quiz Arena.** Test active recall with multiple-choice (DE ↔ EN) and free-text
spelling challenges, complete with a one-tap umlaut tray (*ä ö ü ß*).

**🔊 Audio trainer.** A continuous, speed-adjustable voice (0.7×–1.5×) loops through
words, meanings, and example sentences to train your ear.

**🧪 Immersion lab.** Paste any German text and the app instantly identifies words,
verb lemmas, and noun genders — then lets you turn unfamiliar words into flashcards
in one tap.

**💾 Portable progress.** Back up or move your entire profile with a copy-paste Sync
Key or a JSON file. Your data, your control.

**📲 Installable app.** Add DeutschSphere to your home screen on Android, iOS, or
desktop and it behaves like a native app — fully offline.

---

## Vocabulary & coverage

DeutschSphere covers **2,627 words** across CEFR levels A1–B1, with scope grounded in
the official Goethe-Institut *Wortlisten*.

| Level | Words | Illustrations |
| :--- | :---: | :--- |
| **A1** — Beginner | 684 | 637 / 684 (93%) |
| **A2** — Elementary | 580 | 580 / 580 (100%) |
| **B1** — Intermediate | 1,363 | 371 / 1,363 (27%, in progress) |
| **Total** | **2,627** | 1,588 (60%) |

> [!NOTE]
> **An honest word on coverage.** Each entry's German headword, gender, and plural
> were cross-checked against the official Goethe lists (~99.6% fidelity). That is
> **not** the same as covering those lists in full: B1 is a **curated subset**
> (about 57% of the ~2,400 official B1 units), B1 illustrations are still rolling
> out, and some thematic groups (days, months, seasons, colours, numbers, countries)
> aren't in yet. We'd rather tell you exactly where we stand than round up.

**Where the content comes from.** Word *scope* references the publicly available
Goethe-Institut *Wortlisten* (A1/A2/B1). English translations and pronunciation hints
are original to this project. **Every example sentence is 100% original**, written
for DeutschSphere — an automated check confirms zero verbatim matches against the
source lists, and an offline grammar pass reviews them. Illustrations were generated
with Google Imagen 3 and compressed to under 10 KB each for instant offline loading.

---

## Keyboard shortcuts

| Key | Action | Key | Action |
| :---: | :--- | :---: | :--- |
| `Space` | Flip card / open details | `V` | Play word audio |
| `→` / `↓` | Next card | `A` | Toggle auto-play audio |
| `←` / `↑` | Previous card | `B` | Toggle illustrations |
| `1`–`4` | Grade recall (FSRS) | `E` | Toggle example sentences |
| `L` | Toggle learned | `F` | Fast-read mode |
| `S` | Shuffle deck | `H` | Hide learned cards |
| `Esc` | Close panels / exit quiz | `?` | Show all shortcuts |

---

## Your data & privacy

All of your learning data — progress, settings, review history — stays in your
browser (`localStorage` + IndexedDB). There are **no accounts, no analytics, no
trackers, and no cookies**, and fonts and icons are self-hosted, so the app makes no
third-party requests as you study. The only optional outbound request is the feedback
form, which is sent only when you choose to submit it. Full details in
[PRIVACY.md](PRIVACY.md).

---

## About

DeutschSphere is an independent, unofficial study tool. It is **not affiliated with,
endorsed by, or certified by the Goethe-Institut** or any examination body;
curriculum references are descriptive only. Source code is released under the
[MIT license](LICENSE); third-party content (vocabulary references, illustrations,
fonts) carries its own terms, documented in [NOTICE](NOTICE).

Curious how production-ready it is? We keep an honest, independent
[production-readiness audit](PRODUCTION_READINESS_AUDIT_2026-06-30.md) in the open.

---

## For developers

DeutschSphere is a zero-dependency vanilla-JS PWA — the source you see is what runs.
- **Build, run & architecture:** [DEVELOPMENT.md](DEVELOPMENT.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)
- **Project charter & scope:** [AGENTS.md](AGENTS.md)
