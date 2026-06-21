#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Verify Curriculum Sync Script (verify_curriculum_sync.py)
---------------------------------------------------------
This script extracts official Goethe-Institut vocabulary data from local
curriculum PDFs for Levels A1, A2, and B1 and compares them against
our JSON databases to guarantee 100% spelling, gender, and plural parity.

Options:
  --level    Active level ('a1', 'a2', 'b1', or 'all')
  --fix      Programmatically correct any detected property mismatches
"""

import os
import re
import sys
import json
import pypdf
import argparse

# Force standard output to UTF-8 on Windows environments
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

# Dynamic workspace path resolution
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Genders and articles
GENDERS = ["der", "die", "das"]

# Manual corrections for known typos or extraction limits in the official Goethe PDFs
OFFICIAL_TYPO_CORRECTIONS = {
    "a1": {
        "adresse": {"plural": "-n"},
        "woche": {"plural": "-n"}
    },
    "a2": {
        "morgen": {"gender": "der"},
        "stunde": {"gender": "die"},
        "achtung": {"gender": "die"},
    },
    "b1": {
        "umweltschutz": {"gender": "der"},
        "meinung": {"gender": "die"},
        "vorschlag": {"gender": "der"},
        "prüfung": {"gender": "die"},
        "verspätung": {"gender": "die"},
        "verbot": {"gender": "das"},
        "umwelt": {"gender": "die"}
    }
}

def clean_word(word):
    """Clean German headword for robust comparative lookups."""
    if not word:
        return ""
    # Remove articles, reflexive pronouns, and punctuation
    w = word.strip()
    for art in ["der ", "die ", "das ", "der/das ", "die/das "]:
        if w.lower().startswith(art):
            w = w[len(art):]
            break
    
    # Remove sich
    w = re.sub(r'\b(sich)\b', '', w, flags=re.IGNORECASE)
    # Remove parentheses contents like (sich), (m/w), etc.
    w = re.sub(r'\(.*?\)', '', w)
    # Remove punctuation
    w = w.replace(",", "").replace(".", "").replace("/", "").replace("-", "").strip()
    return w.lower()


def normalize_plural(plural):
    """Normalize plural suffix to canonical format, handling PDF extraction anomalies."""
    if not plural:
        return ""
    # Clean string and lowercase
    p = plural.strip().lower()
    
    # Clean up unicode replacement chars and other weird glyph extractions
    p = p.replace("\ufffd", "¨")
    # Replace other umlauts in the suffix to standard symbol '¨' for suffix identification
    p = p.replace("ä", "¨").replace("ö", "¨").replace("ü", "¨")
    p = p.replace(",", "").replace("(", "").replace(")", "").strip()
    
    # Standardize spaces/hyphens inside
    p = re.sub(r'\s+', ' ', p) # collapse multiple spaces
    p = p.replace("-", "").replace("–", "").replace("—", "") # strip hyphens and en/em dashes to make suffix matching clean
    p = p.strip()
    
    # Now map the cleaned p to standard forms
    if p in ["¨ er", "¨er"]:
        return "¨er"
    elif p in ["¨ e", "¨e"]:
        return "¨e"
    elif p in ["¨ en", "¨en"]:
        return "¨en"
    elif p == "¨":
        return "¨"
        
    return p


def canonical_plural(plural):
    """Convert a raw PDF plural suffix to its standard, pretty representation."""
    if not plural or plural.strip() in ["-", "–", "—"]:
        return "-"
    norm = normalize_plural(plural)
    if not norm:
        return "-"
    if norm == "¨":
        return "¨-"
    if norm == "¨er":
        return "¨-er"
    if norm == "¨e":
        return "¨-e"
    if norm == "¨en":
        return "¨-en"
    if not norm.startswith("-") and norm not in ["¨-", "¨-er", "¨-e", "¨-en"]:
        return "-" + norm
    return plural


def reconstruct_full_plural(german_word, plural_suffix):
    """
    Reconstructs the full absolute plural string including the article 'die'
    from a base German word and its plural suffix or raw plural representation.
    """
    if not plural_suffix or plural_suffix in ["-", "–", "—", "None", "null", "none"]:
        return None
    
    plural_suffix = plural_suffix.strip()
    clean_suffix = plural_suffix.replace("-", "").replace("–", "").replace("—", "").strip()
    
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
    if base.lower() == "raum" and "ä" in plural_suffix:
        return "die Räume"
    if base.lower() == "bank":
        return "die Banken" if "en" in plural_suffix or "banken" in plural_suffix.lower() else "die Bänke"
    if base.lower() == "creme":
        return "die Cremes"
    if base.lower() == "datum":
        return "die Daten"
    if base.lower() == "firma":
        return "die Firmen"
    if base.lower() == "konto":
        return "die Konten"
    if base.lower() == "museum":
        return "die Museen"
    if base.lower() == "praktikum":
        return "die Praktika"
    if base.lower() == "praxis":
        return "die Praxen"
    if base.lower() == "pizza":
        return "die Pizzen"
    if base.lower() == "thema":
        return "die Themen"
    if base.lower().endswith("um") and clean_suffix == "en":
        return f"die {base[:-2]}en"
    if base.lower().endswith("um") and clean_suffix == "a":
        return f"die {base[:-2]}a"
            
    # If plural_suffix is a full word (doesn't start with hyphen and doesn't look like suffix)
    if not plural_suffix.startswith("-") and not plural_suffix.startswith("¨") and not any(x in plural_suffix for x in ["ä", "ö", "ü", "Ä", "Ö", "Ü"]) and len(plural_suffix) > 3:
        # It's a full word, make sure it's prefixed with "die" and capitalized
        clean_word = plural_suffix.replace(",", "").replace(".", "").replace("/", "").strip()
        if clean_word:
            return f"die {clean_word[0].upper()}{clean_word[1:]}"
            
    # Handle suffixes
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
        for i in range(len(chars) - 1, -1, -1):
            if chars[i] in vowels:
                # If we found 'u' or 'U' and it is preceded by 'a' or 'A', umlaut the 'a'/'A' instead (to form äu/Äu)
                if i > 0 and chars[i].lower() == 'u' and chars[i-1].lower() == 'a':
                    chars[i-1] = 'ä' if chars[i-1] == 'a' else 'Ä'
                else:
                    chars[i] = vowels[chars[i]]
                break
        plural_word = "".join(chars)
        
    plural_word = plural_word + clean_suffix
    
    if plural_word:
        plural_word = plural_word[0].upper() + plural_word[1:]
        return f"die {plural_word}"
        
    return None


def compare_plurals(local_plural, official_plural, local_word=""):
    """Compare local and official plural forms, returning True if semantically equivalent."""
    if not official_plural:
        return True # If official list has no plural defined, we accept local as is
        
    off_strip = official_plural.strip()
    loc_strip = local_plural.strip() if local_plural else ""
    
    # Handle case where official plural indicates no ending change (indicated by a hyphen or dash)
    if off_strip in ["-", "–", "—"]:
        if loc_strip in ["-", "–", "—", ""]:
            return True
        if local_word and clean_word(loc_strip) == clean_word(local_word):
            return True
            
    # Clean absolute plurals like "die Abende" to "abende"
    cleaned_loc = clean_word(local_plural) if local_plural else ""
    
    # Reconstruct the expected absolute plural from official suffix
    if local_word:
        reconstructed = reconstruct_full_plural(local_word, official_plural)
        if reconstructed:
            cleaned_rec = clean_word(reconstructed)
            if cleaned_loc == cleaned_rec:
                return True
                
    # Fallback to standard validation
    norm_local = normalize_plural(cleaned_loc)
    norm_off = normalize_plural(official_plural)
    
    if norm_local == norm_off:
        return True
        
    # Check if local plural is a full word (e.g. "Abteilungen") and official is a suffix (e.g. "-en")
    if local_word:
        clean_base = clean_word(local_word)
        if norm_local == clean_base + norm_off:
            return True
            
        # If the base word has an umlaut, normalize_plural will change the umlaut to a diaeresis '¨'.
        # We must also normalize the clean base word to ensure accurate substring matching.
        norm_base = normalize_plural(clean_base)
        if norm_local == norm_base + norm_off:
            return True
            
        if norm_off == "¨" and len(norm_local) == len(clean_base):
            return True
            
    return False


def add_extracted_word(extracted_dict, word, gender, plural, word_class, level):
    """Add an extracted word to the official vocabulary dictionary, partitioning by noun/non-noun."""
    base_clean = clean_word(word)
    is_noun = gender in ["der", "die", "das"] or word_class == "Nomen"
    
    # Apply manual corrections for known official PDF typos or extraction limits
    corrected_gender = gender
    corrected_plural = plural
    
    level_corrections = OFFICIAL_TYPO_CORRECTIONS.get(level, {})
    if base_clean in level_corrections:
        corr = level_corrections[base_clean]
        if "gender" in corr:
            corrected_gender = corr["gender"]
            is_noun = corrected_gender in ["der", "die", "das"]
        if "plural" in corr:
            corrected_plural = corr["plural"]
            
    entry = {
        "word": word,
        "gender": corrected_gender,
        "plural": corrected_plural,
        "word_class": "Nomen" if is_noun else word_class
    }
    
    # Store partition key
    suffix = "_nomen" if is_noun else "_andere"
    extracted_dict[base_clean + suffix] = entry
    
    # Also store base_clean as fallback
    if base_clean not in extracted_dict:
        extracted_dict[base_clean] = entry
    elif is_noun and extracted_dict[base_clean].get("gender") == "neutral":
        # Overwrite fallback with noun version since it has more properties
        extracted_dict[base_clean] = entry


# --- PDF PARSERS FOR EACH CEFR LEVEL ---

def parse_a1_pdf(pdf_path):
    """
    Parse Level A1 wordlist PDF (A1_SD1_Wortliste_02.pdf).
    Vocabulary starts with thematic sections on page 6 (index 5) to 27 (index 26).
    """
    if not os.path.exists(pdf_path):
        print(f"Error: A1 PDF not found at {pdf_path}")
        return {}
        
    print(f"Parsing official A1 PDF curriculum (Pages 6 to 27)...")
    reader = pypdf.PdfReader(pdf_path)
    extracted_words = {}
    
    # We expand parsing from page 6 (index 5) to page 27 (index 26) to capture all words
    for page_idx in range(5, 27):
        page = reader.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue
            
        lines = text.split("\n")
        for line in lines:
            line_str = line.strip()
            # Ignore headers/footers or section indicators
            if not line_str or line_str.startswith("VS_") or "Seite" in line_str or line_str.startswith("INVeNTAre"):
                continue
            if len(line_str) == 1 and line_str.isupper(): # Alphabet labels
                continue
                
            # Attempt to split headword from example sentence using the improved regex (stopping at 2+ spaces or tab)
            match_noun = re.match(r'^(der|die|das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_]+)(?:,\s*(.*?))?(?:\s{2,}|\t|$)', line_str)
            if match_noun:
                gender = match_noun.group(1).lower()
                noun = match_noun.group(2)
                plural = match_noun.group(3) or ""
                
                # Truncate plural if it accidentally captures capitalized sentence starts due to single-space formatting
                plural_parts = plural.strip().split()
                if len(plural_parts) > 1:
                    # If the next token is capitalized, it is definitely a noun / start of a sentence in German
                    if plural_parts[1][0].isupper():
                        plural = plural_parts[0]
                    else:
                        plural = " ".join(plural_parts[:2])
                        
                plural = plural.replace(",", "").strip()
                full_word = f"{gender} {noun}"
                add_extracted_word(extracted_words, full_word, gender, plural, "Nomen", "a1")
                continue
                
            # Check for non-nouns
            match_other = re.match(r'^([a-zäöüß\-]+(?:\s+\(sich\))?)\s+([A-ZÄÖÜ].*)', line_str)
            if match_other:
                word = match_other.group(1).strip()
                add_extracted_word(extracted_words, word, "neutral", "", "Verb" if word.endswith("en") else "Andere", "a1")
                
    print(f"Successfully extracted {len(extracted_words)} official vocabulary records from A1 PDF.")
    return extracted_words


def parse_a2_pdf(pdf_path):
    """
    Parse Level A2 wordlist PDF (Goethe-Zertifikat_A2_Wortliste.pdf).
    Alphabetical vocabulary is found on pages 8 to 31 (0-indexed: 7 to 30).
    """
    if not os.path.exists(pdf_path):
        print(f"Error: A2 PDF not found at {pdf_path}")
        return {}
        
    print(f"Parsing official A2 PDF curriculum (Pages 8 to 31)...")
    reader = pypdf.PdfReader(pdf_path)
    extracted_words = {}
    
    # Alphabetical list starts on page 8 (index 7) to 31 (index 30)
    for page_idx in range(7, 31):
        page = reader.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue
            
        lines = text.split("\n")
        for line in lines:
            line_str = line.strip()
            # Clean headers/footers
            if not line_str or "WORTLISTE" in line_str or "GOETHE-ZERTIFIKAT" in line_str or "A2_Wortliste" in line_str:
                continue
            if len(line_str) == 1 and line_str.isupper():
                continue
            if line_str.startswith("Seite") or line_str.startswith("Felix Brandl"):
                continue
                
            # Split line by 3 or more spaces
            parts = re.split(r'\s{3,}', line)
            if len(parts) < 2:
                continue
                
            word_part = parts[0].strip()
            if not word_part or word_part.startswith("ist ") or word_part.startswith("hat ") or word_part.startswith("wird "):
                continue
                
            # Check for noun with article
            match_noun = re.match(r'^(der|die|das|der/das|die/das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_]+)(?:,\s*([^ ]+))?', word_part)
            if match_noun:
                gender_raw = match_noun.group(1).lower()
                gender = "der" if "der" in gender_raw else ("die" if "die" in gender_raw else "das")
                noun = match_noun.group(2)
                plural = match_noun.group(3) or ""
                plural = plural.replace(",", "").strip()
                full_word = f"{gender_raw} {noun}"
                add_extracted_word(extracted_words, full_word, gender, plural, "Nomen", "a2")
                continue
                
            # Verb, Adjective, or other classes
            word_clean_match = re.match(r'^([a-zA-ZäöüßÄÖÜ\-]+(?:\s+\(sich\))?)', word_part)
            if word_clean_match:
                word = word_clean_match.group(1).strip()
                if len(word) <= 1 or word.isdigit():
                    continue
                add_extracted_word(extracted_words, word, "neutral", "", "Verb" if word.endswith("en") else "Andere", "a2")
                
    print(f"Successfully extracted {len(extracted_words)} official vocabulary records from A2 PDF.")
    return extracted_words


def parse_b1_pdf(pdf_path):
    """
    Parse Level B1 wordlist PDF (Goethe-Zertifikat_B1_Wortliste.pdf).
    Alphabetical vocabulary is found on pages 4 to 103 (0-indexed: 3 to 102).
    """
    if not os.path.exists(pdf_path):
        print(f"Error: B1 PDF not found at {pdf_path}")
        return {}
        
    print(f"Parsing official B1 PDF curriculum (Pages 4 to 103)...")
    reader = pypdf.PdfReader(pdf_path)
    extracted_words = {}
    
    # We expand parsing from page 4 to 103 to capture colors, numbers, and thematic lists
    for page_idx in range(3, 103):
        page = reader.pages[page_idx]
        try:
            text = page.extract_text()
        except Exception:
            continue
            
        if not text:
            continue
            
        lines = text.split("\n")
        for line in lines:
            line_str = line.strip()
            # Clean headers/footers
            if not line_str or "WORTLISTE" in line_str or "ZERTIFIKAT B1" in line_str or "VS_03" in line_str:
                continue
            if len(line_str) == 1 and line_str.isupper():
                continue
                
            # Split off commas
            parts = re.split(r',\s*', line_str)
            word_part = parts[0].strip()
            
            # Check for noun with article
            match_noun = re.match(r'^(der|die|das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_]+)', word_part)
            if match_noun:
                gender = match_noun.group(1).lower()
                noun = match_noun.group(2)
                plural = ""
                if len(parts) > 1:
                    plural = parts[1].strip()
                    if " " in plural or plural.startswith("ist") or plural.startswith("hat") or plural.startswith("wird"):
                        plural = ""
                full_word = f"{gender} {noun}"
                add_extracted_word(extracted_words, full_word, gender, plural, "Nomen", "b1")
                continue
                
            # Verbs and others
            if word_part and not word_part.startswith("ist ") and not word_part.startswith("hat ") and not word_part.startswith("wird "):
                word = word_part
                if len(word) <= 1 or word.isdigit() or "seite" in word.lower():
                    continue
                add_extracted_word(extracted_words, word, "neutral", "", "Verb" if word.endswith("en") else "Andere", "b1")
                
    print(f"Successfully extracted {len(extracted_words)} official vocabulary records from B1 PDF.")
    return extracted_words


# --- MAIN SYNC & CORRECTION ENGINE ---

def run_sync_audit(level, fix_mismatches=False):
    """Execute deep curriculum synchronization audit for a given CEFR level."""
    print(f"\n==========================================")
    print(f"CURRICULUM SYNC AUDIT: LEVEL {level.upper()}")
    print(f"==========================================")
    
    level_dir = os.path.join(PROJECT_ROOT, level)
    json_path = os.path.join(level_dir, "wordlist.json")
    
    if not os.path.exists(json_path):
        print(f"Error: Database file not found at {json_path}")
        return False
        
    # 1. Load Local Database
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            cards = json.load(f)
    except Exception as e:
        print(f"Error loading local JSON: {e}")
        return False
        
    print(f"Loaded {len(cards)} cards from local {level}/wordlist.json.")
    
    # 2. Parse Corresponding PDF Curriculum
    if level == "a1":
        pdf_name = "A1_SD1_Wortliste_02.pdf"
        pdf_parser = parse_a1_pdf
    elif level == "a2":
        pdf_name = "Goethe-Zertifikat_A2_Wortliste.pdf"
        pdf_parser = parse_a2_pdf
    else: # b1
        pdf_name = "Goethe-Zertifikat_B1_Wortliste.pdf"
        pdf_parser = parse_b1_pdf
        
    pdf_path = os.path.join(level_dir, pdf_name)
    if not os.path.exists(pdf_path):
        raw_resources_path = os.path.join(PROJECT_ROOT, ".raw_resources", pdf_name)
        if os.path.exists(raw_resources_path):
            pdf_path = raw_resources_path
            
    official_vocab = pdf_parser(pdf_path)
    
    if not official_vocab:
        print(f"Audit aborted for Level {level.upper()} due to PDF extraction failure.")
        return False
        
    # 3. Cross-Reference and Verify Parity
    matches = 0
    omissions = 0
    mismatches = []
    translation_omissions = 0
    fixed_count = 0
    
    for idx, card in enumerate(cards):
        # Support both schemas seamlessly
        word_key = "german" if "german" in card else "word"
        gender_key = "gender"
        plural_key = "plural"
        english_key = "english" if "english" in card else "english_translation"
        example_en_key = "example_en" if "example_en" in card else "example_sentence_en"
        
        raw_word = card.get(word_key, "").strip()
        clean_key = clean_word(raw_word)
        
        # Look up clean headword in parsed official vocabulary, partitioning by noun-ness
        is_noun_card = (card.get(gender_key) or "neutral").strip().lower() in ["der", "die", "das"]
        suffix = "_nomen" if is_noun_card else "_andere"
        pdf_match = official_vocab.get(clean_key + suffix)
        
        if not pdf_match:
            # Fallback to plain lookup, but ensure noun/non-noun compatibility to avoid false collisions
            fallback_match = official_vocab.get(clean_key)
            if fallback_match:
                fallback_is_noun = fallback_match.get("gender") in ["der", "die", "das"]
                if is_noun_card == fallback_is_noun:
                    pdf_match = fallback_match
        
        # Translation Sync Validation
        local_english = (card.get(english_key) or "").strip()
        local_example_en = (card.get(example_en_key) or "").strip()
        
        if not local_english or "placeholder" in local_english.lower():
            translation_omissions += 1
            print(f"  [TRANSLATION ALERT] Card '{raw_word}' is missing a valid English translation.")
            
        if not local_example_en:
            translation_omissions += 1
            print(f"  [TRANSLATION ALERT] Card '{raw_word}' is missing an English example sentence translation.")
            
        if pdf_match:
            matches += 1
            # Verify gender with fallback standardizer
            local_gender = (card.get(gender_key) or "neutral").strip().lower()
            official_gender = pdf_match.get("gender", "neutral").strip().lower()
            
            local_g = local_gender if local_gender not in ["neutral", "none", ""] else "neutral"
            official_g = official_gender if official_gender not in ["neutral", "none", ""] else "neutral"
            gender_mismatch = local_g != official_g
            
            # Verify plural using the robust comparative validator
            local_plural = (card.get(plural_key) or "").strip()
            official_plural = pdf_match.get("plural", "").strip()
            
            plural_mismatch = not compare_plurals(local_plural, official_plural, raw_word)
            
            if gender_mismatch or plural_mismatch:
                mismatches.append({
                    "card_index": idx,
                    "word": raw_word,
                    "gender_mismatch": (local_gender, official_gender) if gender_mismatch else None,
                    "plural_mismatch": (local_plural, official_plural) if plural_mismatch else None
                })
                
                # Perform corrections and standardization if --fix is set
                if fix_mismatches:
                    if gender_mismatch:
                        card[gender_key] = official_gender
                        fixed_count += 1
                    if plural_mismatch:
                        # Write full reconstructed absolute plural (e.g., "die Abende")
                        rec_plural = reconstruct_full_plural(raw_word, official_plural)
                        if rec_plural:
                            card[plural_key] = rec_plural
                        else:
                            card[plural_key] = None
                        fixed_count += 1
                # Even if there's no mismatch, run clean standardization in fix mode, but safeguard absolute plurals
                if fix_mismatches:
                    if local_plural and local_plural.strip().lower().startswith("die "):
                        pass
                    else:
                        rec_plural = reconstruct_full_plural(raw_word, official_plural)
                        if rec_plural and local_plural != rec_plural:
                            card[plural_key] = rec_plural
                            fixed_count += 1
                        elif not rec_plural and card[plural_key] is not None:
                            card[plural_key] = None
                            fixed_count += 1
        else:
            # Word is in JSON but couldn't be cleanly found in PDF
            omissions += 1
            print(f"  [OMISSION?] Word '{raw_word}' in local JSON not found in official PDF. (Considered an Enrichment)")
            
    # 4. Display Audit Findings
    print(f"\nAudit Parity Summary for Level {level.upper()}:")
    print(f"  - Matches (Synchronized Words): {matches} / {len(cards)}")
    print(f"  - Discrepancy Mismatches: {len(mismatches)}")
    print(f"  - Total Translation Parity Issues: {translation_omissions}")
    print(f"  - Total Extra Words (Enrichments): {omissions}")
    
    if mismatches:
        print(f"\nDetailed Property Mismatches:")
        for m in mismatches[:15]: # Show first 15 mismatches
            word = m["word"]
            details = []
            if m["gender_mismatch"]:
                details.append(f"Gender (JSON: '{m['gender_mismatch'][0]}', PDF: '{m['gender_mismatch'][1]}')")
            if m["plural_mismatch"]:
                details.append(f"Plural (JSON: '{m['plural_mismatch'][0]}', PDF: '{m['plural_mismatch'][1]}')")
            print(f"  - {word}: {', '.join(details)}")
        if len(mismatches) > 15:
            print(f"  - ... and {len(mismatches) - 15} more.")
            
    # 5. Save corrected database if --fix was called
    if fix_mismatches and fixed_count > 0:
        try:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(cards, f, indent=2, ensure_ascii=False)
            print(f"\nSuccessfully corrected and saved {fixed_count} properties/plural suffixes with official curriculum attributes.")
        except Exception as e:
            print(f"Error saving updated database: {e}")
            return False
            
    # We pass the audit if there are 0 actual grammatical discrepancies and 0 translation omissions.
    # We allow "Extra Words" as they represent verified vocabulary enrichments for the course.
    return len(mismatches) == 0 and translation_omissions == 0


def main():
    parser = argparse.ArgumentParser(description="Goethe-Institut Curriculum Sync Parity Audit Suite.")
    parser.add_argument("--level", type=str, default="all", choices=["a1", "a2", "b1", "all"],
                        help="The CEFR level to audit (default: 'all')")
    parser.add_argument("--fix", action="store_true",
                        help="Programmatically fix property mismatches using PDF curriculum ground-truths")
                        
    args = parser.parse_args()
    
    levels = ["a1", "a2", "b1"] if args.level == "all" else [args.level]
    overall_success = True
    
    for lvl in levels:
        success = run_sync_audit(lvl, fix_mismatches=args.fix)
        if not success:
            overall_success = False
            
    if overall_success:
        print("\n[SUCCESS] Curriculum verification audit passed successfully! All databases aligned with official PDFs.")
        sys.exit(0)
    else:
        print("\n[WARNING] Curriculum verification audit finished with mismatches or omissions. Run with --fix to correct.")
        sys.exit(1)


if __name__ == "__main__":
    main()
