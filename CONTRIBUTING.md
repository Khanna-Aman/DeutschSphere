# Contributing to DeutschSphere

Thank you for your interest in contributing to DeutschSphere! We enforce a clean, zero-dependency, high-signal workspace.

## Core Rules

1. **Zero Dependencies**: Do not introduce any npm, node, or build tools. All scripts must remain vanilla client-side ES6 modules.
2. **The Zero-Inference Clause**: Never guess, generate, or infer linguistic details. If verb conjugations, plurals, or example sentences are not verified, leave their schema fields as `null`.
3. **No Gamification**: Do not introduce XP counters, medals, chimes, or screen shakes. 
4. **FSRS Scheduling**: Any updates to the scheduling logic must be unit-tested to match FSRS-5 specifications.

## Development

To run locally:
```bash
python -m http.server 8080
```
Then navigate to `http://localhost:8080`.

## Testing

Run unit tests before submitting a Pull Request:
```bash
python scripts/run_unit_tests.py
```
