# Contributing to DeutschSphere

Thank you for your interest in contributing to DeutschSphere! We enforce a clean, zero-dependency, high-signal workspace.

## Core Rules

1. **Zero Runtime Dependencies**: No runtime framework, bundler, or npm package ships to the client — app code stays vanilla ES6 modules. The single build-time tool is the Tailwind CLI, run on demand to regenerate the committed `tailwind.css` (see [README → Styling](README.md)). Do not add a runtime build step or commit `node_modules`.
2. **The Zero-Inference Clause**: Never guess, generate, or infer linguistic details. If verb conjugations, plurals, or example sentences are not verified, leave their schema fields as `null`.
3. **No Gamification**: This is a study tool, not a game. Do not introduce XP, streaks, leaderboards, medals/badges, star ratings, letter grades, particle bursts, confetti, chimes, or screen shakes. Feedback stays calm and study-relevant (FSRS grade cues, accuracy %, plain correct/incorrect coloring).
4. **FSRS Scheduling**: Any updates to the scheduling logic must be unit-tested to match FSRS-5 specifications.

## Development

To run locally:
```bash
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

## Testing

Data integrity is enforced automatically in CI (`.github/workflows/validate-data.yml`). Before submitting a Pull Request, run it locally along with the in-browser suites:

```bash
# Data integrity — counts, image refs, doc consistency (no deps)
python scripts/validate_data.py

# In-browser unit tests — FSRS-5 math, Kölner Phonetik, lemmatization
python scripts/run_unit_tests.py

# End-to-end user-journey checks
python scripts/e2e_comprehensive_tests.py
```

The browser suites require a one-time `pip install playwright && playwright install chromium`.
