# Contributing to DeutschSphere

Thank you for your interest in contributing to DeutschSphere! We enforce a clean, zero-dependency, high-signal workspace.

## Core Rules

1. **Zero Runtime Dependencies**: No runtime framework, bundler, or npm package ships to the client — app code stays vanilla ES6 modules. The single build-time tool is the Tailwind CLI, run on demand to regenerate the committed `tailwind.css` (see [README → Styling](README.md)). Do not add a runtime build step or commit `node_modules`.
2. **The Zero-Inference Clause** (factual fields only): Never guess, generate, or infer **factual linguistic data** — verb conjugations, plurals, genders. If they are not attested in the official Goethe wordlists, leave the schema field `null`. **Example sentences are different**: they are deliberately **original content** authored to replace the copyrighted source examples. New/edited example sentences must (a) use the entry's headword, (b) be original — run [`scripts/check_example_originality.py`](scripts/check_example_originality.py) and keep verbatim at **0** — and (c) pass the grammar gate [`scripts/check_grammar_languagetool.py`](scripts/check_grammar_languagetool.py).
3. **No Gamification**: This is a study tool, not a game. Do not introduce XP, streaks, leaderboards, medals/badges, star ratings, letter grades, particle bursts, confetti, chimes, or screen shakes. Feedback stays calm and study-relevant (FSRS grade cues, accuracy %, plain correct/incorrect coloring).
4. **FSRS Scheduling**: Any updates to the scheduling logic must be unit-tested to match FSRS-5 specifications.

## Development

To run locally:
```bash
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

## Testing

Data integrity, JS syntax/lint, and accessibility are all enforced automatically in CI (`validate-data.yml`, `js-checks.yml`, `quality.yml`). Before submitting a Pull Request, run them locally:

```bash
# Data integrity — counts, image refs, doc consistency (no deps)
python scripts/validate_data.py

# JS syntax check + lint
npm run check && npm run lint

# Accessibility / best-practices / SEO (Lighthouse, axe-core) — must stay 100 / 95 / 100
npm run audit:lighthouse
```

The Playwright browser scripts (`scripts/run_unit_tests.py`, `scripts/e2e_comprehensive_tests.py`) are **legacy and slated for a from-scratch rebuild**; they require a one-time `pip install playwright && playwright install chromium` and are run on demand only.
