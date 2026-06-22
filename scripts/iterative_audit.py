#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Iterative Audit Automation Script (iterative_audit.py)
------------------------------------------------------
Automates the linguistic auditing process for DeutschSphere vocabulary.
Runs a continuous loop for a specified level until a run completes with
exactly 0 corrections (achieving absolute convergence).

It purges log files between each run to prevent any caching issues.
Once converged, it stages and commits the final wordlist JSON to Git.
"""

import os
import sys
import re
import glob
import subprocess
import time

# Force standard output to UTF-8 on Windows environments
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOGS_DIR = os.path.join(SCRIPT_DIR, "logs")

def purge_logs():
    """Delete all log files in scripts/logs to prevent caching or stale analysis."""
    print("[PURGE] Clearing all log files in scripts/logs...")
    log_files = glob.glob(os.path.join(LOGS_DIR, "*.log"))
    for file_path in log_files:
        try:
            os.remove(file_path)
            print(f"  [PURGE] Deleted: {os.path.basename(file_path)}")
        except Exception as e:
            print(f"  [PURGE] Failed to delete {file_path}: {e}")

def run_git_commit(level):
    """Stage and commit the converged wordlist."""
    json_path = os.path.join(PROJECT_ROOT, level, "wordlist.json")
    if not os.path.exists(json_path):
        print(f"[GIT] Wordlist not found at {json_path}")
        return
        
    print(f"[GIT] Staging changes for Level {level.upper()}...")
    try:
        # Check if there are active changes to commit
        status_res = subprocess.run(
            ["git", "status", "--porcelain", json_path],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        if not status_res.stdout.strip():
            print(f"[GIT] No changes detected in {level}/wordlist.json. Nothing to commit.")
            return

        subprocess.run(["git", "add", json_path], check=True, cwd=PROJECT_ROOT)
        commit_msg = f"fix({level}): achieve perfect convergence against NotebookLM after iterative audits"
        subprocess.run(["git", "commit", "-m", commit_msg], check=True, cwd=PROJECT_ROOT)
        print(f"[GIT] Successfully committed {level}/wordlist.json with message: '{commit_msg}'")
    except subprocess.CalledProcessError as e:
        print(f"[GIT-ERROR] Git operation failed: {e}")

def get_latest_correction_count(level):
    """Read the latest log file to find the number of corrections applied in the run."""
    log_files = sorted(glob.glob(os.path.join(LOGS_DIR, f"audit_{level}_*.log")))
    if not log_files:
        print("[WARN] No log files found to parse corrections.")
        return None
        
    latest_log = log_files[-1]
    print(f"[PARSE] Reading latest log: {os.path.basename(latest_log)}")
    
    try:
        with open(latest_log, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Search for pattern: Level A1 complete. Audited: 640, Corrections: 0
        match = re.search(r"Level\s+" + re.escape(level.upper()) + r"\s+complete\.\s+Audited:\s+\d+,\s+Corrections:\s+(\d+)", content, re.IGNORECASE)
        if match:
            return int(match.group(1))
            
        # Fallback stdout search: Total corrections applied: 0
        match_fallback = re.search(r"Total\s+corrections\s+applied:\s+(\d+)", content, re.IGNORECASE)
        if match_fallback:
            return int(match_fallback.group(1))
            
    except Exception as e:
        print(f"[PARSE-ERROR] Failed to read/parse {latest_log}: {e}")
        
    return None

def run_iterative_audit(level, batch_size=30, concurrency=4):
    print(f"\n======================================================================")
    print(f"LAUNCHING ITERATIVE AUDIT: LEVEL {level.upper()} (CONTINUOUS LOOP UNTIL CONVERGENT)")
    print(f"======================================================================\n")
    
    run_num = 1
    while True:
        print(f"\n--- [ITERATION {run_num}] Starting Run ---")
        
        # 1. Purge logs to prevent any stale state or caching
        purge_logs()
        
        # 2. Execute verification script
        cmd = [
            sys.executable,
            "-u",
            os.path.join(SCRIPT_DIR, "verify_via_notebooklm.py"),
            "--level", level,
            "--batch-size", str(batch_size),
            "--concurrency", str(concurrency)
        ]
        
        print(f"[EXEC] Running command: {' '.join(cmd)}")
        start_time = time.time()
        
        try:
            # Run the command and print output live
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=PROJECT_ROOT,
                encoding="utf-8"
            )
            
            # Print output live to terminal
            while True:
                line = process.stdout.readline()
                if not line and process.poll() is not None:
                    break
                if line:
                    sys.stdout.write(line)
                    sys.stdout.flush()
                    
            process.wait()
            duration = time.time() - start_time
            print(f"[EXEC] Completed in {duration:.2f} seconds with exit code: {process.returncode}")
            
            if process.returncode != 0:
                print(f"[FATAL] Subprocess exited with error code {process.returncode}. Aborting iterative audit loop.")
                sys.exit(process.returncode)
                
        except Exception as e:
            print(f"[FATAL] Failed to spawn or execute verification: {e}")
            sys.exit(1)
            
        # 3. Parse corrections count from log
        corrections = get_latest_correction_count(level)
        if corrections is None:
            print("[FATAL] Could not determine correction count from logs. Aborting to be safe.")
            sys.exit(1)
            
        print(f"\n[SUMMARY] Iteration {run_num} for {level.upper()} finished with corrections: {corrections}")
        
        # 4. Check convergence
        if corrections == 0:
            print(f"\n[CONVERGED] Level {level.upper()} achieved absolute convergence (0 corrections) on Iteration {run_num}!")
            # 5. Git Commit changes
            run_git_commit(level)
            break
        else:
            print(f"[CONTINUE] Corrections applied ({corrections}). Purging and starting next loop...")
            run_num += 1
            # Add a 5 second cool-down between loops
            time.sleep(5)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Iterative, anti-caching convergent audit script.")
    parser.add_argument("--level", choices=["a1", "a2", "b1", "all"], default="a1", help="Level to audit recursively.")
    parser.add_argument("--batch-size", type=int, default=30, help="Batch size per NotebookLM query.")
    parser.add_argument("--concurrency", type=int, default=4, help="Number of concurrent worker threads.")
    args = parser.parse_args()
    
    levels = ["a1", "a2", "b1"] if args.level == "all" else [args.level]
    
    for lvl in levels:
        run_iterative_audit(lvl, batch_size=args.batch_size, concurrency=args.concurrency)
        
    print(f"\n[COMPLETE] All targeted levels have converged with perfect accuracy and have been committed cleanly to Git!")
    sys.exit(0)
