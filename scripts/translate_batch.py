import os
import sys
import re
import json
import subprocess
import time
import argparse

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH_DIR = os.path.join(PROJECT_ROOT, "scripts", "scratch")
NOTEBOOK_ID = "e62cc31a-5209-4c8e-9aca-4a4702632123"  # _a1-b1_german notebook

def run_nlm_query(question):
    """
    Runs the nlm CLI query command to talk to the NotebookLM notebook.
    """
    cmd = [
        "nlm", "query", "notebook",
        NOTEBOOK_ID,
        question,
        "--json"
    ]
    
    # We will try up to 3 times in case of transient network errors or timeouts
    for attempt in range(3):
        try:
            print(f"  [CLI] Executing nlm query (attempt {attempt + 1}/3)...")
            result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', check=True, timeout=120)
            output_json = json.loads(result.stdout)
            if "answer" in output_json:
                return output_json["answer"]
            else:
                print(f"  [CLI Warning] Missing 'answer' key in CLI output: {result.stdout[:200]}")
        except subprocess.TimeoutExpired as e:
            print(f"  [CLI Error] Command timed out after 120 seconds: {e}")
        except subprocess.CalledProcessError as e:
            print(f"  [CLI Error] Command failed: {e}")
            print(f"  [CLI Error] Stderr: {e.stderr}")
        except json.JSONDecodeError as e:
            print(f"  [CLI Error] Failed to decode JSON from stdout: {e}")
            if 'result' in locals() and result.stdout:
                print(f"  [CLI Error] Raw stdout: {result.stdout[:500]}")
        
        time.sleep(5)
    
    raise RuntimeError("Failed to query NotebookLM via nlm CLI after 3 attempts.")

def extract_json_array(text):
    """
    Extracts the JSON array block from a markdown response.
    """
    # Look for ```json ... ``` block
    match = re.search(r'```json\s*(\[\s*\{.*\}\s*\])\s*```', text, re.DOTALL)
    if match:
        return json.loads(match.group(1))
        
    # Look for any ``` ... ``` block containing a JSON array
    match_any_block = re.search(r'```\s*(\[\s*\{.*\}\s*\])\s*```', text, re.DOTALL)
    if match_any_block:
        return json.loads(match_any_block.group(1))
        
    # Try finding the array directly from [ to ]
    match_raw_array = re.search(r'(\[\s*\{.*\}\s*\])', text, re.DOTALL)
    if match_raw_array:
        return json.loads(match_raw_array.group(1))
        
    raise ValueError("Could not find a valid JSON array block in the text response.")

def reconstruct_full_plural(german_word, plural_suffix):
    """
    Reconstructs the full absolute plural string including the article 'die'
    from a base German word and its plural suffix or raw plural representation.
    """
    if not plural_suffix or plural_suffix in ["-", "–", "—", "None", "null", "none"]:
        return None
    
    plural_suffix = plural_suffix.strip()
    
    # Already absolute
    if plural_suffix.lower().startswith("die "):
        return f"die {plural_suffix[4:].strip()}"
        
    # Get base word (remove der/die/das)
    base = german_word.strip()
    for art in ["der ", "die ", "das ", "der/das ", "die/das "]:
        if base.lower().startswith(art):
            base = base[len(art):]
            break
            
    # Remove any extra info like plural indicator or annotations
    base = base.split()[0].strip()
    base = base.replace(",", "").replace(".", "").replace("/", "").strip()
    
    # Special cases for irregular PDF suffixes
    if base.lower().endswith("mann") and "ä" in plural_suffix:
        # e.g., Ehemann -> Ehemänner
        plural_word = base[:-4] + "männer"
        return f"die {plural_word[0].upper()}{plural_word[1:]}"
    if base.lower() == "wort" and "ö" in plural_suffix:
        return "die Wörter"
            
    # If plural_suffix is a full word (doesn't start with hyphen and doesn't look like suffix)
    if not plural_suffix.startswith("-") and not plural_suffix.startswith("¨") and not any(x in plural_suffix for x in ["ä", "ö", "ü", "Ä", "Ö", "Ü"]) and len(plural_suffix) > 3:
        # It's a full word, make sure it's prefixed with "die" and capitalized
        clean_word = plural_suffix.replace(",", "").replace(".", "").replace("/", "").strip()
        if clean_word:
            return f"die {clean_word[0].upper()}{clean_word[1:]}"
            
    # Handle suffixes
    # Clean the suffix
    clean_suffix = plural_suffix.replace("-", "").replace("–", "").replace("—", "").strip()
    
    # Handle umlaut indicators
    has_umlaut = any(x in plural_suffix for x in ["¨", "ä", "ö", "ü", "Ä", "Ö", "Ü"])
    
    # Remove umlaut characters from clean_suffix to get the clean ending letters
    for char in ["¨", "ä", "ö", "ü", "Ä", "Ö", "Ü"]:
        clean_suffix = clean_suffix.replace(char, "")
    clean_suffix = clean_suffix.strip()
    
    # Clean suffix adjustments for German spelling rules
    if base.endswith("e") and clean_suffix == "en":
        clean_suffix = "n"
    elif base.endswith("e") and clean_suffix == "e":
        clean_suffix = ""
        
    plural_word = base
    if has_umlaut:
        # Scan from right to left to find the LAST umlautable vowel or vowel group
        vowels = {'a': 'ä', 'o': 'ö', 'u': 'ü', 'A': 'Ä', 'O': 'Ö', 'U': 'Ü'}
        chars = list(plural_word)
        umlauted = False
        # Look for 'au' or 'Au' first (as a pair)
        for i in range(len(chars) - 2, -1, -1):
            if chars[i].lower() == 'a' and chars[i+1] == 'u':
                chars[i] = 'ä' if chars[i] == 'a' else 'Ä'
                umlauted = True
                break
        if not umlauted:
            # Single vowel search from right to left
            for i in range(len(chars) - 1, -1, -1):
                if chars[i] in vowels:
                    chars[i] = vowels[chars[i]]
                    umlauted = True
                    break
        plural_word = "".join(chars)
        
    plural_word = plural_word + clean_suffix
    
    if plural_word:
        plural_word = plural_word[0].upper() + plural_word[1:]
        return f"die {plural_word}"
        
    return None

def validate_and_normalize_entry(item, original_word_data):
    """
    Validates and normalizes a single vocabulary entry to match the super-premium schema.
    """
    # Fallback default values
    german = item.get("german") or original_word_data.get("german")
    word_class = item.get("word_class") or original_word_data.get("word_class") or "Andere"
    gender = item.get("gender") or original_word_data.get("gender")
    
    # Clean gender if noun
    if word_class == "Nomen" and not gender:
        if german.startswith("der "): gender = "der"
        elif german.startswith("die "): gender = "die"
        elif german.startswith("das "): gender = "das"
        
    # Plural field validation
    plural = item.get("plural")
    if word_class == "Nomen":
        # Handle cases where the model returns plural as plural_raw or similar, or under item.get("plural_raw")
        if not plural:
            plural = item.get("plural_raw") or original_word_data.get("plural_raw")
        
        # Now normalize/reconstruct the plural to ensure it's absolute and prefixed with 'die '
        plural = reconstruct_full_plural(german, plural)
    else:
        plural = None
        
    # Verb conjugations
    verb_conjugation = item.get("verb_conjugation")
    if word_class == "Verb":
        if not isinstance(verb_conjugation, dict):
            # Try parsing if string or create default
            verb_conjugation = {
                "present_3sg": f"er/sie/es {german}",
                "perfekt": f"hat ge{german}",
                "is_irregular": False
            }
        else:
            # Ensure keys exist
            verb_conjugation = {
                "present_3sg": verb_conjugation.get("present_3sg") or "",
                "perfekt": verb_conjugation.get("perfekt") or "",
                "is_irregular": bool(verb_conjugation.get("is_irregular", False))
            }
    else:
        verb_conjugation = None
        
    # Adjective forms
    adjective_forms = item.get("adjective_forms")
    if word_class == "Adjektiv":
        if not isinstance(adjective_forms, dict):
            adjective_forms = {
                "comparative": "",
                "superlative": ""
            }
        else:
            adjective_forms = {
                "comparative": adjective_forms.get("comparative") or "",
                "superlative": adjective_forms.get("superlative") or ""
            }
    else:
        adjective_forms = None
        
    # Example sentences
    example_de = item.get("example_de") or (original_word_data.get("examples_de")[0] if original_word_data.get("examples_de") else "")
    example_en = item.get("example_en") or ""
    
    normalized = {
        "german": german,
        "word_class": word_class,
        "gender": gender,
        "plural": plural,
        "verb_conjugation": verb_conjugation,
        "adjective_forms": adjective_forms,
        "english": item.get("english") or "",
        "pronunciation": item.get("pronunciation") or "",
        "theme": item.get("theme") or "Allgemein",
        "antonym": item.get("antonym") or None,
        "example_de": example_de,
        "example_en": example_en,
        "image": None
    }
    return normalized

def translate_sub_batch(sub_batch_data, level):
    """
    Formulates a prompt and queries NotebookLM for a small sub-batch of words.
    """
    words_input = []
    for item in sub_batch_data:
        w_info = {
            "german": item["german"],
            "word_class": item["word_class"],
            "gender": item.get("gender"),
            "plural_raw": item.get("plural_raw"),
            "raw_examples": item.get("examples_de", [])
        }
        words_input.append(w_info)
        
    words_json_str = json.dumps(words_input, indent=2, ensure_ascii=False)
    
    prompt = f"""You are a premium German language pedagogy AI. Your task is to translate and expand the following {len(sub_batch_data)} German words for CEFR Level {level.upper()} using the official Goethe-Institut curriculum PDFs uploaded in your notebook.

Word list:
{words_json_str}

CRITICAL PEDAGOGY & EXTRACTION RULES:
1. "english": Precise English translation matching the standard Goethe curriculum.
2. "pronunciation": Standard English phonetic spelling to assist learners (e.g., "ah-bent" for "der Abend", "vo-nen" for "wohnen").
3. "theme": The semantic context or category of this word (e.g., "Alltag (Familie, Zahlen, Zeit)", "Beruf", "Reise", "Gesundheit").
4. "antonym": German antonym (including article if it is a noun), if there is a common one in the curriculum, otherwise null.
5. NOUN PLURALS (When word_class is "Nomen"):
   - The "plural" field must NEVER contain hyphen suffixes (e.g., NOT "-e" or "-en").
   - You must retrieve and write the full, absolute plural string including the plural article "die" (e.g., "die Abende", "die Kinder", "die Äpfel").
6. VERB EXTRACTION (When word_class is "Verb"):
   - Populate the "verb_conjugation" field as a JSON object:
     {{"present_3sg": "er/sie/es conjugation", "perfekt": "Perfekt past tense form with ist/hat", "is_irregular": true/false}}
     Example: {{"present_3sg": "er fährt ab", "perfekt": "ist abgefahren", "is_irregular": true}}
     Example: {{"present_3sg": "er lernt", "perfekt": "hat gelernt", "is_irregular": false}}
7. ADJECTIVE EXTRACTION (When word_class is "Adjektiv"):
   - Populate the "adjective_forms" field as a JSON object:
     {{"comparative": "comparative gradation", "superlative": "superlative gradation with am"}}
     Example: {{"comparative": "älter", "superlative": "am ältesten"}}
8. EXAMPLES:
   - "example_de": Choose one clean German example sentence. You can use the sentence provided in 'raw_examples' or refine it.
   - "example_en": Translate the chosen German example sentence into natural, grammatically correct English.

Return a JSON array of objects. Format your output inside a ```json ... ``` code block. Do not write any preambles, explanations, or conversational filler before or after the JSON block.
"""
    
    # Query NotebookLM via CLI
    answer_text = run_nlm_query(prompt)
    
    # Parse the answer text
    try:
        translated_items = extract_json_array(answer_text)
        print(f"    [Success] Parsed {len(translated_items)} entries from response.")
        
        # Normalize and validate against raw definitions
        normalized_items = []
        for idx, item in enumerate(translated_items):
            orig_data = sub_batch_data[idx] if idx < len(sub_batch_data) else {}
            norm_item = validate_and_normalize_entry(item, orig_data)
            normalized_items.append(norm_item)
            
        return normalized_items
    except Exception as e:
        print(f"    [Error] Failed to parse sub-batch response: {e}")
        # Print first few hundred characters of answer for debugging
        print(f"    [Debug] Answer text was:\n{answer_text[:1000]}...")
        raise

def translate_batch(level, batch_num):
    """
    Processes a single batch of 50 words by chunking it into sub-batches of 10 words.
    """
    batch_file = os.path.join(SCRATCH_DIR, f"{level}_batch_{batch_num}.json")
    completed_file = os.path.join(SCRATCH_DIR, f"{level}_completed_{batch_num}.json")
    
    if not os.path.exists(batch_file):
        print(f"Error: Batch file {batch_file} not found. Run rebuild_pipeline.py make_batches first.")
        return False
        
    with open(batch_file, "r", encoding="utf-8") as f:
        batch_entries = json.load(f)
        
    print(f"\n==================================================")
    print(f"STARTING TRANSLATION: {level.upper()} Batch {batch_num} ({len(batch_entries)} words)")
    print(f"==================================================")
    
    completed_entries = []
    sub_batch_size = 10
    
    for i in range(0, len(batch_entries), sub_batch_size):
        sub_batch = batch_entries[i:i+sub_batch_size]
        sub_num = i // sub_batch_size
        print(f"\n---> Sub-batch {sub_num + 1} of {((len(batch_entries)-1)//sub_batch_size)+1} ({len(sub_batch)} words)...")
        
        # Run translation with retries
        success = False
        for sub_attempt in range(2):
            try:
                translated_sub = translate_sub_batch(sub_batch, level)
                completed_entries.extend(translated_sub)
                success = True
                break
            except Exception as e:
                print(f"    [Warning] Sub-batch translation failed on attempt {sub_attempt + 1}: {e}")
                time.sleep(10)
                
        if not success:
            print(f"[FATAL] Failed to translate sub-batch {sub_num}. Progress saved up to last successful batch.")
            return False
            
    # Save completed entries
    with open(completed_file, "w", encoding="utf-8") as f:
        json.dump(completed_entries, f, indent=2, ensure_ascii=False)
        
    print(f"\n[SUCCESS] Successfully translated and saved {len(completed_entries)} items to {completed_file}")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NotebookLM Ground-Truth Translation CLI.")
    parser.add_argument("level", choices=["a1", "a2", "b1"], help="CEFR Level to target.")
    parser.add_argument("batch_num", type=int, help="Batch number to translate (0-indexed).")
    args = parser.parse_args()
    
    success = translate_batch(args.level, args.batch_num)
    sys.exit(0 if success else 1)
