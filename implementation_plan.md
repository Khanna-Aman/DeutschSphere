# 🇩🇪 Handover & Resume Plan: High-Fidelity German Curriculum Verification (Levels A2 & B1)

This implementation plan acts as the definitive technical ledger and handover guide for resuming our high-fidelity, recursive auditing loops for **CEFR Level A2 and Level B1** vocabulary against the NotebookLM `a1a2b1` source. 

Execution is currently in a **24-hour mandatory cooling-off pause** after hitting account-level rate limits on the Google Labs backend (`RESOURCE_EXHAUSTED` error code 8). When the quota window resets, we will resume using the unbuffered, sequential, and highly concurrent execution framework detailed below.

---

## 🛑 Brutally Honest Status & The 24h Quota Bottleneck

Programmatic parallel batch querying of Google's NotebookLM via MCP is extremely powerful, but highly sensitive to rapid-fire queries.
* **The Glitch:** During parallel processing (using `--concurrency 4` with larger batch sizes), we hit the backend's programmatic API ceiling. Once triggered, Google returns a persistent `RESOURCE_EXHAUSTED` (error code 8) block on all subsequent queries (even single-word queries) for approximately 24 hours.
* **Our Hardened Safe-State:**
  1. All progress up to the block has been securely written. No partial or corrupted files exist.
  2. Background backups of the databases are preserved in `scripts/backups/`.
  3. We terminated the background audit loop and cleared out all unfinished log artifacts to keep the workspace 100% clean.
  4. The code is clean, compiled, and E2E-verified to run smoothly.

---

## 🛡️ Robust Defensive Guards & Validation

To ensure 100% curriculum accuracy so that learners and friends are never misled, our verification script (`scripts/verify_via_notebooklm.py`) enforces strict procedural and linguistic boundaries:

1. **Reflexive Pronoun Guard:**
   * **Problem:** Normal LLMs tend to strip reflexive pronouns (`sich`) from verbs, converting `sich beeilen` (to hurry) into simple `beeilen`.
   * **Guard:** A strict lookup filter rejects any proposed conjugation or lemma modification that strips `sich` from reflexive verbs.
2. **Präteritum-for-Perfekt Guard:**
   * **Problem:** LLMs frequently hallucinate simple past-tense Präteritum forms (e.g. `sollte`, `musste`) as the `perfekt` conjugation properties, omitting the required auxiliary verb (`hat`/`ist`).
   * **Guard:** A regex lookahead intercepts proposed verb conjugations, blocking single words ending in `-te`/`-ten` and enforcing proper auxiliary-verb prefix structures (e.g., `hat gemusst`).
3. **Theme Category Taxonomy Guard:**
   * **Problem:** NotebookLM often invents arbitrary, overly specific theme names (e.g., "Transportation in Berlin") instead of grouping them logically.
   * **Guard:** Limits suggestions to our canonical 19-category DeutschSphere taxonomy, automatically reverting any out-of-bounds themes.

---

## 🚀 Execution Strategy: How to Continue Tomorrow

As soon as the 24-hour rate limit window has expired (around `2026-06-24 00:30:00 +05:30`), resume the verification pipeline with separate commands to keep the executions completely distinct.

### Step 1: Precautionary Audit of Level A1 (0 corrections check)
To guarantee absolutely zero errors slipped through A1 in previous sessions:
```powershell
python -u scripts/iterative_audit.py --level a1 --batch-size 30 --concurrency 4
```
*Wait until this finishes and confirms `0 corrections`. It will automatically commit `a1/wordlist.json` if anything changed.*

### Step 2: "Concurrent Attack" on Level A2 (Multi-Iteration to Convergence)
Execute the multi-iteration loop for Level A2. Using `--concurrency 4` will run 4 parallel workers to execute rapidly:
```powershell
python -u scripts/iterative_audit.py --level a2 --batch-size 30 --concurrency 4
```
* **Unbuffered Execution (`-u` flag):** This forces Python to flush logging text instantly so you can monitor the live output minute-by-minute in the terminal or task log.
* **Continuous Loop:** The script will automatically clean out logs, audit, apply verified corrections, write them, and loop recursively until it hits exactly `0 corrections` (absolute convergence), at which point it will commit the changes to Git and exit cleanly.

### Step 3: "Concurrent Attack" on Level B1 (Multi-Iteration to Convergence)
Once A2 is fully converged and git-committed, run the same multi-iteration loop for Level B1:
```powershell
python -u scripts/iterative_audit.py --level b1 --batch-size 30 --concurrency 4
```
*Wait until B1 achieves exactly `0 corrections` and commits changes.*

---

## 🔍 Verification & Testing Checklist

Once both A2 and B1 have converged and committed:

### 1. Automated E2E Regression Suite
Run our comprehensive, Playwright-based testing across multiple viewports and all 5 premium themes to verify 100% clean test passes:
```powershell
python scripts/e2e_comprehensive_tests.py
```

### 2. Manual Visual Check
Launch `index.html` locally using any standard static server:
```powershell
python -m http.server 8080
```
Navigate to `http://localhost:8080` and click through hashes:
* `#/` (Ensure all cards render their respective deterministic blue/pink/green/violet glows perfectly with no clipping)
* `#/quiz` (Ensure multiple-choice and spelling test modes load words correctly)
* `#/weaver` and `#/adventure` (Verify fluid hotkey-driven selection transitions)
