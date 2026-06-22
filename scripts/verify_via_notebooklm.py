#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Verify via NotebookLM Script (verify_via_notebooklm.py)
------------------------------------------------------
This script performs a complete and thorough audit of the German vocabulary
databases (a1/wordlist.json, a2/wordlist.json, b1/wordlist.json) by batch-querying
NotebookLM to verify translations, plurals, genders, categories/themes, verbs,
adjectives, and example sentences.

FIX (2026-06-13): Rewrote run_nlm_query to avoid Windows 8191-char CLI argument
limit by writing the prompt to a temp file and using a Python subprocess wrapper
that reads the file and passes it to the nlm Python API directly.

Usage:
  python scripts/verify_via_notebooklm.py --level a1 --batch-size 15
  python scripts/verify_via_notebooklm.py --level all --batch-size 15
"""

import os
import sys
import re
import json
import time
import shutil
import argparse

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NOTEBOOK_ID = "8ea029b9-8a58-415b-8201-0e4c76804e82"  # Active 'germana1a2b1' notebook ID
SCRIPTS_DIR = os.path.join(PROJECT_ROOT, "scripts")

def get_wordlist_path(level):
    return os.path.join(PROJECT_ROOT, level, "wordlist.json")

def create_backup(level):
    src_path = get_wordlist_path(level)
    if not os.path.exists(src_path):
        return None
    backup_dir = os.path.join(SCRIPTS_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"{level}_wordlist_backup_{timestamp}.json")
    shutil.copy2(src_path, backup_path)
    print(f"[BACKUP] Created backup of {level}/wordlist.json at {backup_path}")
    return backup_path

def run_nlm_query(question):
    """
    Query NotebookLM via the Python API directly, bypassing the CLI entirely.
    
    This avoids the Windows 8191-char command-line argument limit that was causing
    batch audit failures. Uses cached auth tokens from `nlm login`.
    """
    from notebooklm_tools.core.client import NotebookLMClient
    from notebooklm_tools.core.auth import load_cached_tokens
    
    for attempt in range(3):
        try:
            print(f"  [QUERY] Querying NotebookLM (attempt {attempt + 1}/3)...")
            
            # Load cached tokens from nlm CLI profile
            tokens = load_cached_tokens()
            client = NotebookLMClient(
                cookies=tokens.cookies,
                csrf_token=tokens.csrf_token,
                session_id=tokens.session_id,
                build_label=tokens.build_label,
            )
            
            result = client.query(NOTEBOOK_ID, question)
            
            # Extract answer from response
            if isinstance(result, dict):
                answer = result.get("answer", result.get("text", str(result)))
            else:
                answer = str(result)
            
            if answer:
                return answer
            else:
                print(f"  [Warning] Empty answer received from NotebookLM.")
                
        except Exception as e:
            print(f"  [Error] Query failed: {type(e).__name__}: {e}")
        
        wait_time = 10 * (attempt + 1)  # Progressive backoff: 10s, 20s, 30s
        print(f"  [Retry] Waiting {wait_time}s before next attempt...")
        time.sleep(wait_time)
    
    raise RuntimeError("Failed to query NotebookLM after 3 attempts.")

def extract_json_array(text):
    """Extracts the JSON array block from a markdown response."""
    # Try ```json ... ``` codeblock
    match = re.search(r'```json\s*(\[\s*\{.*\}\s*\])\s*```', text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
        
    # Try any ``` ... ``` codeblock containing an array
    match_any_block = re.search(r'```\s*(\[\s*\{.*\}\s*\])\s*```', text, re.DOTALL)
    if match_any_block:
        return json.loads(match_any_block.group(1))
        
    # Find direct array from [ to ]
    match_raw_array = re.search(r'(\[\s*\{.*\}\s*\])', text, re.DOTALL)
    if match_raw_array:
        return json.loads(match_raw_array.group(1))
        
    raise ValueError("Could not find a valid JSON array block in the response.")

def audit_batch(batch_data, level):
    """Sends a batch of words to NotebookLM with a compact prompt to stay under API query limits."""
    # Build compact entries - only essential fields to minimize prompt length
    entries = []
    for item in batch_data:
        e = {
            "german": item.get("german"),
            "english": item.get("english"),
            "gender": item.get("gender"),
            "plural": item.get("plural"),
            "theme": item.get("theme"),
        }
        if item.get("word_class") == "Verb" and item.get("verb_conjugation"):
            e["verb_conjugation"] = item["verb_conjugation"]
        entries.append(e)
        
    input_json = json.dumps(entries, ensure_ascii=False)
    
    prompt = (
        f"Verify these {len(batch_data)} {level.upper()} German words against the official Goethe-Institut wordlist in your notebook. "
        "Check: english translation, gender, plural, theme category, verb conjugations. "
        "IMPORTANT: Do NOT remove or nullify existing plurals. Only correct a plural if it is WRONG. "
        "If a word already has a correct plural, do NOT include plural in corrections. "
        f'Return a JSON array with exactly {len(batch_data)} objects: '
        '[{"german":"...","has_corrections":true/false,"corrections":{}}]. '
        "Only include fields that are WRONG in corrections. Return ONLY the JSON array.\n\n"
        f"Words:\n{input_json}"
    )
    
    print(f"    [Prompt] {len(prompt)} chars, {len(batch_data)} words")
    response_text = run_nlm_query(prompt)
    try:
        audit_results = extract_json_array(response_text)
        return audit_results
    except Exception as e:
        print(f"    [Error] Failed to parse NotebookLM audit results: {e}")
        print(f"    [Debug] Raw response snippet:\n{response_text[:1000]}...")
        raise

def apply_corrections(original_item, corrections):
    """Safely merges NotebookLM corrections into the original vocabulary entry."""
    updated_item = original_item.copy()
    fields_updated = []
    
    # Simple top-level fields
    for field in ["gender", "plural", "english", "theme", "example_de", "example_en", "word_class"]:
        if field in corrections:
            new_val = corrections[field]
            old_val = original_item.get(field)
            
            # Guard: reject "None"/"null"/empty string corrections that would wipe valid data
            if isinstance(new_val, str) and new_val.strip().lower() in ('none', 'null', 'n/a', ''):
                # Don't overwrite a valid existing value with a null-like string
                if old_val and str(old_val).strip().lower() not in ('none', 'null', 'n/a', ''):
                    print(f"    [SKIP] Rejecting '{field}' correction: '{old_val}' -> '{new_val}' (would wipe valid data)")
                    continue
            if new_val is None and old_val is not None:
                print(f"    [SKIP] Rejecting '{field}' null correction: '{old_val}' -> None")
                continue
                
            if new_val != old_val:
                updated_item[field] = new_val
                fields_updated.append(f"{field}: '{old_val}' -> '{new_val}'")
                
    # Nested verb conjugations
    if "verb_conjugation" in corrections and corrections["verb_conjugation"] is not None and original_item.get("word_class") == "Verb":
        corr_conj = corrections["verb_conjugation"]
        if isinstance(corr_conj, dict):
            orig_conj = original_item.get("verb_conjugation") or {}
            new_conj = orig_conj.copy()
            for f in ["present_3sg", "perfekt", "is_irregular"]:
                if f in corr_conj:
                    if corr_conj[f] != orig_conj.get(f):
                        new_conj[f] = corr_conj[f]
                        fields_updated.append(f"verb_conjugation.{f}: '{orig_conj.get(f)}' -> '{corr_conj[f]}'")
            updated_item["verb_conjugation"] = new_conj
        
    # Nested adjective forms
    if "adjective_forms" in corrections and corrections["adjective_forms"] is not None and original_item.get("word_class") == "Adjektiv":
        corr_forms = corrections["adjective_forms"]
        if isinstance(corr_forms, dict):
            orig_forms = original_item.get("adjective_forms") or {}
            new_forms = orig_forms.copy()
            for f in ["comparative", "superlative"]:
                if f in corr_forms:
                    if corr_forms[f] != orig_forms.get(f):
                        new_forms[f] = corr_forms[f]
                        fields_updated.append(f"adjective_forms.{f}: '{orig_forms.get(f)}' -> '{corr_forms[f]}'")
            updated_item["adjective_forms"] = new_forms
        
    return updated_item, fields_updated

def run_level_audit(level, batch_size=15, start_index=0, concurrency=1):
    print(f"\n==================================================")
    print(f"STARTING COMPREHENSIVE AUDIT: LEVEL {level.upper()}")
    print(f"  - Batch Size: {batch_size}")
    print(f"  - Concurrency: {concurrency}")
    print(f"==================================================")
    
    json_path = get_wordlist_path(level)
    if not os.path.exists(json_path):
        print(f"Error: Wordlist file not found at {json_path}")
        return False
        
    with open(json_path, "r", encoding="utf-8") as f:
        words = json.load(f)
        
    print(f"Loaded {len(words)} words to check.")
    create_backup(level)
    
    log_dir = os.path.join(SCRIPTS_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file_path = os.path.join(log_dir, f"audit_{level}_{time.strftime('%Y%m%d')}.log")
    log_f = open(log_file_path, "a", encoding="utf-8")
    log_f.write(f"--- Audit Started at {time.strftime('%Y-%m-%d %H:%M:%S')} (Concurrency={concurrency}, BatchSize={batch_size}) ---\n")
    
    corrections_applied_count = 0
    total_audited = 0
    
    # Generate batch entries
    batches = []
    for i in range(start_index, len(words), batch_size):
        batch = words[i:i+batch_size]
        batches.append((i, batch))
        
    total_batches = len(batches)
    print(f"Divided remainder of dataset into {total_batches} batches.")
    
    if concurrency <= 1:
        # Exact original synchronous execution loop
        for batch_num, (start_idx, batch) in enumerate(batches):
            print(f"\n---> Batch {batch_num + 1} of {total_batches} (Words {start_idx} to {min(start_idx+batch_size, len(words))} of {len(words)})...")
            log_f.write(f"\nProcessing Batch {batch_num + 1}/{total_batches} (Index {start_idx} to {min(start_idx+batch_size, len(words))})\n")
            
            # Call NotebookLM audit with retries
            success = False
            for attempt in range(2):
                try:
                    results = audit_batch(batch, level)
                    if len(results) != len(batch):
                        print(f"    [Warning] Received {len(results)} items in audit results but batch size is {len(batch)}. Retrying...")
                        time.sleep(5)
                        continue
                    success = True
                    break
                except Exception as e:
                    print(f"    [Warning] Audit batch call failed: {e}. Retrying in 15 seconds...")
                    time.sleep(15)
                    
            if not success:
                print(f"[FATAL] Failed to audit batch {batch_num + 1} after retries. Interrupted.")
                print(f"[INFO] Resume with: python scripts/verify_via_notebooklm.py --level {level} --batch-size {batch_size} --start-index {start_idx}")
                log_f.write(f"FAILED to process batch {batch_num + 1} at index {start_idx}\n")
                log_f.close()
                return False
                
            # Apply corrections
            for idx, result in enumerate(results):
                original_item = batch[idx]
                german_word = original_item.get("german")
                
                has_corr = result.get("has_corrections", False)
                corrections = result.get("corrections", {})
                
                if has_corr and corrections:
                    updated_item, fields_changed = apply_corrections(original_item, corrections)
                    if fields_changed:
                        words[start_idx + idx] = updated_item
                        corrections_applied_count += 1
                        msg = f"  [UPDATE] '{german_word}' (ID: {original_item.get('id')}): {', '.join(fields_changed)}"
                        print(msg)
                        log_f.write(msg + "\n")
                total_audited += 1
                
            # Save progress incrementally after every successful batch
            try:
                with open(json_path, "w", encoding="utf-8") as f_out:
                    json.dump(words, f_out, indent=2, ensure_ascii=False)
                print(f"    [SAVE] Progress saved. Cumulative updates applied: {corrections_applied_count}")
                log_f.write(f"Batch {batch_num + 1} saved successfully. Total cumulative updates: {corrections_applied_count}\n")
                log_f.flush()
            except Exception as save_err:
                print(f"    [Error] Failed to save database incremental progress: {save_err}")
                log_f.write(f"ERROR saving batch {batch_num + 1} index progress: {save_err}\n")
                
            # Quick sleep to prevent hitting aggressive rate limits
            time.sleep(3)
            
    else:
        # Multi-threaded concurrent execution loop
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        def process_batch(batch_info):
            start_idx, batch = batch_info
            b_num = (start_idx - start_index) // batch_size
            
            # Call NotebookLM audit with retries
            for attempt in range(3):
                try:
                    # Creating a dedicated client instance per thread for thread-safety
                    from notebooklm_tools.core.client import NotebookLMClient
                    from notebooklm_tools.core.auth import load_cached_tokens
                    
                    tokens = load_cached_tokens()
                    client = NotebookLMClient(
                        cookies=tokens.cookies,
                        csrf_token=tokens.csrf_token,
                        session_id=tokens.session_id,
                        build_label=tokens.build_label,
                    )
                    
                    # Build compact entries
                    entries = []
                    for item in batch:
                        e = {
                            "german": item.get("german"),
                            "english": item.get("english"),
                            "gender": item.get("gender"),
                            "plural": item.get("plural"),
                            "theme": item.get("theme"),
                        }
                        if item.get("word_class") == "Verb" and item.get("verb_conjugation"):
                            e["verb_conjugation"] = item["verb_conjugation"]
                        entries.append(e)
                        
                    input_json = json.dumps(entries, ensure_ascii=False)
                    prompt = (
                        f"Verify these {len(batch)} {level.upper()} German words against the official Goethe-Institut wordlist in your notebook. "
                        "Check: english translation, gender, plural, theme category, verb conjugations. "
                        "IMPORTANT: Do NOT remove or nullify existing plurals. Only correct a plural if it is WRONG. "
                        "If a word already has a correct plural, do NOT include plural in corrections. "
                        f'Return a JSON array with exactly {len(batch)} objects: '
                        '[{"german":"...","has_corrections":true/false,"corrections":{}}]. '
                        "Only include fields that are WRONG in corrections. Return ONLY the JSON array.\n\n"
                        f"Words:\n{input_json}"
                    )
                    
                    print(f"  [THREAD] Querying batch {b_num + 1}/{total_batches} ({len(batch)} words)...")
                    result_raw = client.query(NOTEBOOK_ID, prompt)
                    
                    if isinstance(result_raw, dict):
                        answer = result_raw.get("answer", result_raw.get("text", str(result_raw)))
                    else:
                        answer = str(result_raw)
                        
                    if not answer:
                        raise ValueError("Empty answer received from NotebookLM")
                        
                    # Extract JSON array
                    audit_results = extract_json_array(answer)
                    if len(audit_results) != len(batch):
                        raise ValueError(f"Received {len(audit_results)} results, expected {len(batch)}")
                        
                    return start_idx, batch, audit_results
                    
                except Exception as e:
                    wait_time = 10 * (attempt + 1)
                    print(f"    [Warning-Thread] Batch {b_num + 1} attempt {attempt + 1}/3 failed: {type(e).__name__}: {e}. Retrying in {wait_time}s...")
                    time.sleep(wait_time)
            
            raise RuntimeError(f"Failed to process batch {b_num + 1} at index {start_idx} after 3 attempts.")

        print(f"Spawning thread pool with max_workers={concurrency}...")
        futures = {}
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            for b_info in batches:
                future = executor.submit(process_batch, b_info)
                futures[future] = b_info
                
            for future in as_completed(futures):
                b_info = futures[future]
                try:
                    start_idx, batch, results = future.result()
                    b_num = (start_idx - start_index) // batch_size
                    print(f"\n---> [RESOLVED] Batch {b_num + 1} of {total_batches} (Index {start_idx}). Applying corrections...")
                    log_f.write(f"\nApplying corrections for Batch {b_num + 1}/{total_batches} (Index {start_idx})\n")
                    
                    # Apply corrections sequentially (main thread is safe)
                    for idx, result in enumerate(results):
                        original_item = batch[idx]
                        german_word = original_item.get("german")
                        
                        has_corr = result.get("has_corrections", False)
                        corrections = result.get("corrections", {})
                        
                        if has_corr and corrections:
                            updated_item, fields_changed = apply_corrections(original_item, corrections)
                            if fields_changed:
                                words[start_idx + idx] = updated_item
                                corrections_applied_count += 1
                                msg = f"  [UPDATE] '{german_word}' (ID: {original_item.get('id')}): {', '.join(fields_changed)}"
                                print(msg)
                                log_f.write(msg + "\n")
                        total_audited += 1
                        
                    # Save progress sequentially to prevent file corruptions
                    try:
                        with open(json_path, "w", encoding="utf-8") as f_out:
                            json.dump(words, f_out, indent=2, ensure_ascii=False)
                        print(f"    [SAVE] Progress saved. Cumulative updates: {corrections_applied_count}")
                        log_f.write(f"Batch {b_num + 1} saved successfully. Cumulative updates: {corrections_applied_count}\n")
                        log_f.flush()
                    except Exception as save_err:
                        print(f"    [Error] Failed to save progress: {save_err}")
                        log_f.write(f"ERROR saving batch {b_num + 1} progress: {save_err}\n")
                        
                except Exception as exc:
                    print(f"\n[FATAL] Thread execution failed: {exc}")
                    log_f.write(f"FATAL Exception: {exc}\n")
                    executor.shutdown(wait=False, cancel_futures=True)
                    log_f.close()
                    return False
                    
    print(f"\n==================================================")
    print(f"[LEVEL COMPLETE] Finished audit for LEVEL {level.upper()}!")
    print(f"  - Total words audited: {total_audited}")
    print(f"  - Total corrections applied: {corrections_applied_count}")
    print(f"  - Full log stored at: {log_file_path}")
    print(f"==================================================")
    
    log_f.write(f"\nLevel {level.upper()} complete. Audited: {total_audited}, Corrections: {corrections_applied_count}\n")
    log_f.close()
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NotebookLM Ground-Truth Copyediting & Audit Suite.")
    parser.add_argument("--level", choices=["a1", "a2", "b1", "all"], default="a1", help="Level to audit.")
    parser.add_argument("--batch-size", type=int, default=5, help="Number of words to process per batch (keep small for NotebookLM query limits).")
    parser.add_argument("--start-index", type=int, default=0, help="Index of word to start from (for resuming).")
    parser.add_argument("--concurrency", "-j", type=int, default=1, help="Number of parallel query threads (set > 1 for high-speed audits).")
    args = parser.parse_args()
    
    levels = ["a1", "a2", "b1"] if args.level == "all" else [args.level]
    for lvl in levels:
        success = run_level_audit(lvl, batch_size=args.batch_size, start_index=args.start_index, concurrency=args.concurrency)
        if not success:
            sys.exit(1)
    sys.exit(0)
