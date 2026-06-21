import os
import sys
import glob
import subprocess
import argparse

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH_DIR = os.path.join(PROJECT_ROOT, "scripts", "scratch")

def translate_all(level):
    print(f"\n==================================================")
    print(f"LAUNCHING LEVEL {level.upper()} MASTER TRANSLATION PIPELINE")
    print(f"==================================================")
    
    # Find all batch files for the level
    batch_pattern = os.path.join(SCRATCH_DIR, f"{level}_batch_*.json")
    batch_files = glob.glob(batch_pattern)
    
    if not batch_files:
        print(f"Error: No batch files found for level {level} in {SCRATCH_DIR}.")
        print("Please run: python scripts/rebuild_pipeline.py make_batches [level] first.")
        return False
        
    # Determine the number of batches by parsing filenames
    batch_nums = []
    for f in batch_files:
        basename = os.path.basename(f)
        # Extract number from filename (e.g., a1_batch_12.json -> 12)
        try:
            num = int(basename.split("_")[-1].split(".")[0])
            batch_nums.append(num)
        except ValueError:
            pass
            
    if not batch_nums:
        print(f"Error: Could not parse batch numbers from filenames.")
        return False
        
    total_batches = max(batch_nums) + 1
    print(f"Found {total_batches} batches to process for Level {level.upper()}.")
    
    for b_idx in range(total_batches):
        comp_file = os.path.join(SCRATCH_DIR, f"{level}_completed_{b_idx}.json")
        if os.path.exists(comp_file):
            print(f"\n[SKIP] Batch {b_idx} already translated and completed: {comp_file}")
            continue
            
        print(f"\n[RUN] Translating Batch {b_idx} of {total_batches}...")
        
        # We invoke the translate_batch script as a subprocess to keep memory and scope fully isolated
        cmd = [
            "python", "-u",
            os.path.join(PROJECT_ROOT, "scripts", "translate_batch.py"),
            level,
            str(b_idx)
        ]
        
        try:
            subprocess.run(cmd, check=True)
            print(f"[PROGRESS] Completed Batch {b_idx} of {total_batches} successfully.")
        except subprocess.CalledProcessError as e:
            print(f"\n[FATAL ERROR] Translation failed at Batch {b_idx} of {total_batches}!")
            print(f"Subprocess exit code: {e.returncode}")
            return False
            
    print(f"\n==================================================")
    print(f"[SUCCESS] All {total_batches} batches for {level.upper()} have been translated!")
    print(f"==================================================")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Master Translation orchestrator for a full level.")
    parser.add_argument("level", choices=["a1", "a2", "b1"], help="CEFR Level to translate.")
    args = parser.parse_args()
    
    success = translate_all(args.level)
    sys.exit(0 if success else 1)
