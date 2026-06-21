import os
import sys
import re
import json
import pypdf
import argparse

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH_DIR = os.path.join(PROJECT_ROOT, "scripts", "scratch")
os.makedirs(SCRATCH_DIR, exist_ok=True)

# Path configurations
PDF_PATHS = {
    "a1": os.path.join(PROJECT_ROOT, "a1", "A1_SD1_Wortliste_02.pdf"),
    "a2": os.path.join(PROJECT_ROOT, "a2", "Goethe-Zertifikat_A2_Wortliste.pdf"),
    "b1": os.path.join(PROJECT_ROOT, "b1", "Goethe-Zertifikat_B1_Wortliste.pdf")
}

# Helper functions
def clean_base_word(word):
    if not word: return ""
    w = word.strip().lower()
    for art in ["der ", "die ", "das ", "der/das ", "die/das "]:
        if w.startswith(art):
            w = w[len(art):]
            break
    w = re.sub(r'\(.*?\)', '', w)
    w = w.replace(",", "").replace(".", "").replace("/", "").replace("-", "").strip()
    return w.lower()

# --- PDF PARSERS ---

def parse_a1():
    pdf_path = PDF_PATHS["a1"]
    print(f"Parsing A1 PDF: {pdf_path}")
    if not os.path.exists(pdf_path):
        print("Error: A1 PDF not found.")
        return []
        
    reader = pypdf.PdfReader(pdf_path)
    lines = []
    # Pages 10 to 27 in the PDF are vocab list
    for idx in range(9, 27):
        text = reader.pages[idx].extract_text()
        if text:
            lines.extend(text.split("\n"))
            
    parsed_words = []
    current_word = None
    
    for line in lines:
        line_str = line.strip()
        if not line_str or line_str.startswith("VS_") or "Seite" in line_str or line_str.startswith("INVeNTAre"):
            continue
        if len(line_str) == 1 and line_str.isupper():
            continue
            
        # Match noun
        match_noun = re.match(r'^(der|die|das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜß]+)(?:,\s*([\-a-zA-ZäöüßÄÖÜß¨,\s\ufffd]+))?\s{2,}(.*)$', line_str)
        if not match_noun:
            match_noun = re.match(r'^(der|die|das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜß]+)(?:,\s*([\-a-zA-ZäöüßÄÖÜß¨\ufffd]+))?\s+(.*)$', line_str)
        if match_noun:
            gender = match_noun.group(1).lower()
            noun = match_noun.group(2)
            plural = match_noun.group(3) or "-"
            example = match_noun.group(4).strip()
            
            # Clean up the plural if it contains the raw replacement character
            if plural != "-":
                plural = plural.replace("\ufffd", "").strip()
            
            if plural != "-" and plural and plural[0].isupper() and len(plural) > 2:
                example = plural + " " + example
                plural = "-"
                
            current_word = {
                "german": f"{gender} {noun}",
                "word_class": "Nomen",
                "gender": gender,
                "plural_raw": plural if plural != "-" else None,
                "examples_de": [example] if example else []
            }
            parsed_words.append(current_word)
            continue
            
        # Match other classes
        match_other = re.match(r'^([a-zäöüß\-]+(?:\s+\(sich\))?)\s+(.*)$', line_str)
        if match_other:
            word = match_other.group(1).strip()
            example = match_other.group(2).strip()
            
            word_class = "Verb" if word.endswith("en") else "Andere"
            if word in ["groß", "klein", "hell", "dunkel", "schön", "hässlich", "alt", "neu", "gut", "schlecht"]:
                word_class = "Adjektiv"
                
            current_word = {
                "german": word,
                "word_class": word_class,
                "gender": None,
                "plural_raw": None,
                "examples_de": [example] if example else []
            }
            parsed_words.append(current_word)
            continue
            
        if current_word and len(line_str.split()) >= 2:
            current_word["examples_de"][0] += " " + line_str
            
    print(f"Extracted {len(parsed_words)} raw entries for A1.")
    return parsed_words

def parse_a2():
    pdf_path = PDF_PATHS["a2"]
    print(f"Parsing A2 PDF: {pdf_path}")
    if not os.path.exists(pdf_path):
        print("Error: A2 PDF not found.")
        return []
        
    reader = pypdf.PdfReader(pdf_path)
    extracted = []
    current_word = None
    
    # Alphabetical list starts on page 8 (index 7) to 31 (index 30)
    for page_idx in range(7, 31):
        page = reader.pages[page_idx]
        text = page.extract_text()
        if not text: continue
        
        lines = text.split("\n")
        for line in lines:
            line_str = line.strip()
            if not line_str or "WORTLISTE" in line_str or "GOETHE-ZERTIFIKAT" in line_str or "A2_Wortliste" in line_str:
                continue
            if len(line_str) == 1 and line_str.isupper():
                continue
            if line_str.startswith("Seite") or line_str.startswith("Felix Brandl"):
                continue
                
            parts = re.split(r'\s{3,}', line)
            
            left = parts[0].strip() if len(parts) > 0 else ""
            right = parts[1].strip() if len(parts) > 1 else ""
            
            if len(parts) == 1:
                # Use validated single-line heuristic
                if re.search(r'[.!?]["”»]?$', line_str):
                    left = ""
                    right = line_str
                elif len(line_str) < 35 and (line_str[0].islower() or line_str.startswith("ist ") or line_str.startswith("hat ") or line_str.startswith("wird ") or line_str.endswith(",") or "-" in line_str):
                    left = line_str
                    right = ""
                else:
                    left = ""
                    right = line_str
            
            if not left:
                if current_word and right:
                    current_word["examples_de"].append(right)
                continue
                
            is_continuation = False
            if current_word:
                prev_left = current_word["raw_left"][-1]
                starts_with_article = re.match(r'^(der|die|das|der/das|die/das|die\s*\(Pl\.\))\s+', left, re.IGNORECASE)
                if (prev_left.endswith(",") or left.startswith("ist ") or left.startswith("hat ") or left.startswith("wird ")) and not starts_with_article:
                    is_continuation = True
                    
            if is_continuation:
                current_word["raw_left"].append(left)
                if right:
                    current_word["examples_de"].append(right)
            else:
                if current_word:
                    extracted.append(current_word)
                current_word = {
                    "raw_left": [left],
                    "examples_de": [right] if right else []
                }
                
    if current_word:
        extracted.append(current_word)
        
    # Standardize extracted entries
    standardized = []
    for item in extracted:
        raw_left_str = " ".join(item["raw_left"])
        
        # Nouns with articles
        match_noun = re.match(r'^(der|die|das|der/das|die/das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_]+)(?:,\s*([^ ]+))?', raw_left_str)
        if match_noun:
            gender_raw = match_noun.group(1).lower()
            gender = "der" if "der" in gender_raw else ("die" if "die" in gender_raw else "das")
            noun = match_noun.group(2)
            plural = match_noun.group(3) or None
            if plural:
                plural = plural.replace(",", "").strip()
            
            standardized.append({
                "german": f"{gender_raw} {noun}",
                "word_class": "Nomen",
                "gender": gender,
                "plural_raw": plural,
                "examples_de": item["examples_de"]
            })
            continue
            
        # Match plural-only noun
        match_pl = re.match(r'^([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_/]+)\s+\(Pl\.\)', raw_left_str)
        if match_pl:
            noun = match_pl.group(1)
            standardized.append({
                "german": noun,
                "word_class": "Nomen",
                "gender": "die",
                "plural_raw": "(Pl.)",
                "examples_de": item["examples_de"]
            })
            continue
            
        # Prepositions, Adverbs, Verbs, etc.
        clean_w = raw_left_str.split(",")[0].strip()
        word_class = "Verb" if clean_w.endswith("en") else "Andere"
        if clean_w in ["groß", "klein", "hell", "dunkel", "schön", "hässlich", "alt", "neu", "gut", "schlecht"]:
            word_class = "Adjektiv"
            
        standardized.append({
            "german": clean_w,
            "word_class": word_class,
            "gender": None,
            "plural_raw": None,
            "examples_de": item["examples_de"]
        })
        
    print(f"Extracted {len(standardized)} raw entries for A2.")
    return standardized

def parse_b1():
    pdf_path = PDF_PATHS["b1"]
    print(f"Parsing B1 PDF: {pdf_path}")
    if not os.path.exists(pdf_path):
        print("Error: B1 PDF not found.")
        return []
        
    reader = pypdf.PdfReader(pdf_path)
    all_pairs = []
    
    # Vocabulary alphabetical lists on pages 16 to 103 (0-indexed: 15 to 102)
    for page_idx in range(15, 103):
        text = reader.pages[page_idx].extract_text()
        if not text: continue
        
        lines = text.split("\n")
        filtered_lines = []
        for line in lines:
            l = line.strip()
            if not l: continue
            if "WORTLISTE" in l or "ZERTIFIKAT B1" in l or "VS_03" in l: continue
            if l.startswith("Seite") or "Felix Brandl" in l: continue
            if l == "2 Alphabetischer Wortschatz": continue
            filtered_lines.append(l)
            
        # Detect where example sentences begin on the page
        sentence_start_idx = -1
        for idx, line in enumerate(filtered_lines):
            # Check for is_headword_line indicator
            words = line.split()
            is_headword = False
            if words and len(words) <= 6:
                if re.match(r'^(der|die|das|der/das|die/das)\s+', line, re.IGNORECASE):
                    is_headword = True
                elif "," in line and any(x in line for x in ["te, hat", "t, hat", "en, ", "t, ist", "e, ist"]):
                    is_headword = True
                elif line.strip().startswith("hat ") or line.strip().startswith("ist "):
                    is_headword = True
                elif len(words) == 1 and words[0][0].islower() and re.match(r'^[a-zäöüß\-]+$', words[0]):
                    is_headword = True
                elif "→" in line or "/" in line:
                    if len(words) <= 4:
                        is_headword = True
                elif len(words) <= 2 and words[0][0].isupper() and not words[0].endswith(".") and not words[0].isdigit():
                    is_headword = True
            
            if len(line.split()) >= 4 and not is_headword:
                if line[0].isupper() or line[0].isdigit() or line[0] in ['"', '“', '1', '2', '3']:
                    if not re.search(r',\s*¨?-[a-zäöüß]+', line) and not re.search(r',\s*[a-zäöüß]+s?t\b', line):
                        sentence_start_idx = idx
                        break
                        
        if sentence_start_idx != -1:
            word_lines = filtered_lines[:sentence_start_idx]
            sentence_lines = filtered_lines[sentence_start_idx:]
        else:
            word_lines = filtered_lines
            sentence_lines = []
            
        # Reconstruct headwords
        headwords = []
        current = []
        for line in word_lines:
            if len(line.strip()) == 1 and line.strip().isupper():
                continue
            words_in_line = line.split()
            if not words_in_line: continue
            
            starts_new = False
            first_w = words_in_line[0]
            
            if first_w in ["der", "die", "das", "der/das", "die/das", "sich"]:
                starts_new = True
            elif first_w[0].islower() and re.match(r'^[a-zäöüß\-]+$', first_w):
                if first_w not in ["hat", "ist", "schrieb", "fiel", "bog", "gab", "nahm", "war", "wurde", "geht", "ging", "hält"]:
                    starts_new = True
            elif first_w[0].isupper() and len(words_in_line) <= 2 and not first_w.endswith(".") and not first_w.isdigit():
                starts_new = True
                
            if current:
                prev = current[-1].strip()
                if prev.endswith(",") or prev.endswith(":") or prev.endswith("→") or prev.endswith("-") or prev.endswith("/"):
                    starts_new = False
                    
            if starts_new:
                if current:
                    headwords.append(" ".join(current))
                current = [line]
            else:
                if current:
                    current.append(line)
                else:
                    current = [line]
        if current:
            headwords.append(" ".join(current))
            
        # Reconstruct sentences
        sentences = []
        current_s = []
        for line in sentence_lines:
            starts_new = False
            words = line.split()
            if words:
                first_w = words[0]
                if re.match(r'^\d+\.', first_w):
                    starts_new = True
                elif first_w[0].isupper() or first_w[0] in ['"', '“', '‘', '(', '«', '»']:
                    if not current_s:
                        starts_new = True
                    else:
                        prev = current_s[-1].strip()
                        if prev.endswith(".") or prev.endswith("!") or prev.endswith("?") or prev.endswith('"') or prev.endswith('”') or prev.endswith('»'):
                            starts_new = True
            if starts_new:
                if current_s:
                    sentences.append(" ".join(current_s))
                current_s = [line]
            else:
                if current_s:
                    current_s.append(line)
                else:
                    current_s = [line]
        if current_s:
            sentences.append(" ".join(current_s))
            
        # Detect column split point (plurizentrische sorting)
        split_idx = -1
        for idx in range(1, len(headwords)):
            if clean_base_word(headwords[idx]) < clean_base_word(headwords[idx-1]):
                split_idx = idx
                break
                
        if split_idx != -1:
            col2_words = headwords[:split_idx]
            col1_words = headwords[split_idx:]
        else:
            col2_words = headwords
            col1_words = []
            
        all_words_ordered = col2_words + col1_words
        for idx, hw in enumerate(all_words_ordered):
            example_s = sentences[idx] if idx < len(sentences) else ""
            all_pairs.append({
                "headword_raw": hw,
                "example_sentence_de": example_s
            })
            
    # Standardize B1 entries
    standardized = []
    for item in all_pairs:
        raw_hw = item["headword_raw"]
        
        # Match noun
        match_noun = re.match(r'^(der|die|das|der/das|die/das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_/]+)(?:,\s*([^ ]+))?', raw_hw)
        if match_noun:
            gender_raw = match_noun.group(1).lower()
            gender = "der" if "der" in gender_raw else ("die" if "die" in gender_raw else "das")
            noun = match_noun.group(2)
            plural = match_noun.group(3) or None
            if plural:
                plural = plural.replace(",", "").strip()
            
            standardized.append({
                "german": f"{gender_raw} {noun}",
                "word_class": "Nomen",
                "gender": gender,
                "plural_raw": plural,
                "examples_de": [item["example_sentence_de"]] if item["example_sentence_de"] else []
            })
            continue
            
        # Match plural-only noun
        match_pl = re.match(r'^([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_/]+)\s+\(Pl\.\)', raw_hw)
        if match_pl:
            noun = match_pl.group(1)
            standardized.append({
                "german": noun,
                "word_class": "Nomen",
                "gender": "die",
                "plural_raw": "(Pl.)",
                "examples_de": [item["example_sentence_de"]] if item["example_sentence_de"] else []
            })
            continue
            
        # Prepositions, Adverbs, Verbs, etc.
        clean_w = raw_hw.split(",")[0].strip()
        word_class = "Verb" if clean_w.endswith("en") else "Andere"
        if clean_w in ["groß", "klein", "hell", "dunkel", "schön", "hässlich", "alt", "neu", "gut", "schlecht"]:
            word_class = "Adjektiv"
            
        standardized.append({
            "german": clean_w,
            "word_class": word_class,
            "gender": None,
            "plural_raw": None,
            "examples_de": [item["example_sentence_de"]] if item["example_sentence_de"] else []
        })
        
    print(f"Extracted {len(standardized)} raw entries for B1.")
    return standardized

# --- PIPELINE CONTROLLER CLI ---

def cmd_parse(level):
    if level == "a1":
        entries = parse_a1()
    elif level == "a2":
        entries = parse_a2()
    elif level == "b1":
        entries = parse_b1()
    else:
        print("Unknown level.")
        return
        
    out_path = os.path.join(SCRATCH_DIR, f"{level}_raw.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    print(f"Saved {len(entries)} raw entries to {out_path}")

def cmd_make_batches(level):
    raw_path = os.path.join(SCRATCH_DIR, f"{level}_raw.json")
    if not os.path.exists(raw_path):
        print(f"Error: Raw file {raw_path} not found. Run 'parse' first.")
        return
        
    with open(raw_path, "r", encoding="utf-8") as f:
        entries = json.load(f)
        
    print(f"Loaded {len(entries)} raw entries for {level}.")
    batch_size = 50
    for i in range(0, len(entries), batch_size):
        batch = entries[i:i+batch_size]
        batch_num = i // batch_size
        batch_path = os.path.join(SCRATCH_DIR, f"{level}_batch_{batch_num}.json")
        with open(batch_path, "w", encoding="utf-8") as f:
            json.dump(batch, f, indent=2, ensure_ascii=False)
        print(f"Created batch {batch_num} with {len(batch)} items at {batch_path}")
    print(f"All {len(entries)} words successfully chunked into {((len(entries)-1)//batch_size)+1} batches.")

def cmd_merge(level):
    raw_path = os.path.join(SCRATCH_DIR, f"{level}_raw.json")
    if not os.path.exists(raw_path):
        print(f"Error: Raw file {raw_path} not found. Run 'parse' first.")
        return
        
    with open(raw_path, "r", encoding="utf-8") as f:
        entries = json.load(f)
        
    batch_size = 50
    total_batches = ((len(entries) - 1) // batch_size) + 1
    
    completed_entries = []
    missing_batches = []
    
    for i in range(total_batches):
        comp_path = os.path.join(SCRATCH_DIR, f"{level}_completed_{i}.json")
        if os.path.exists(comp_path):
            with open(comp_path, "r", encoding="utf-8") as f:
                comp_batch = json.load(f)
                completed_entries.extend(comp_batch)
        else:
            missing_batches.append(i)
            
    if missing_batches:
        print(f"Warning: The following batches are missing completed translations: {missing_batches}")
        print(f"Completed so far: {len(completed_entries)} words out of {len(entries)}.")
        print("Merge aborted. Please make sure all batches are completed before merging.")
        return
        
    # Sort alphabetically by base word
    completed_entries.sort(key=lambda x: clean_base_word(x["german"]))
    
    # Assign sequential 1-indexed IDs
    for idx, card in enumerate(completed_entries):
        card["id"] = idx + 1
        
    # Write to target directory
    target_path = os.path.join(PROJECT_ROOT, level, "wordlist.json")
    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(completed_entries, f, indent=2, ensure_ascii=False)
        
    print(f"\n[SUCCESS] Successfully compiled, alphabetized, and deployed {len(completed_entries)} cards into {target_path}!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="German Vocabulary Ground-Truth Rebuild Pipeline.")
    parser.add_argument("command", choices=["parse", "make_batches", "merge"], help="Command to run.")
    parser.add_argument("level", choices=["a1", "a2", "b1"], help="CEFR Level to target.")
    args = parser.parse_args()
    
    if args.command == "parse":
        cmd_parse(args.level)
    elif args.command == "make_batches":
        cmd_make_batches(args.level)
    elif args.command == "merge":
        cmd_merge(args.level)
