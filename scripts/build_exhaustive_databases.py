import os
import re
import sys
import json
import pypdf
import urllib.parse
import requests
import time

try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

PROJECT_ROOT = r"d:\Aman\_________Projects\A1-B1_German"

# Path configs
A1_PDF_PATH = os.path.join(PROJECT_ROOT, "a1", "A1_SD1_Wortliste_02.pdf")
B1_PDF_PATH = os.path.join(PROJECT_ROOT, "b1", "Goethe-Zertifikat_B1_Wortliste.pdf")

A1_JSON_PATH = os.path.join(PROJECT_ROOT, "a1", "wordlist.json")
B1_JSON_PATH = os.path.join(PROJECT_ROOT, "b1", "wordlist.json")

# Helpers
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

def clean_for_sort(hw):
    w = hw.strip().lower()
    for art in ["der ", "die ", "das ", "der/das ", "die/das "]:
        if w.startswith(art):
            w = w[len(art):]
            break
    w = re.sub(r'\b(sich)\b', '', w)
    w = re.sub(r'[^a-zäöüß]', '', w)
    return w

def is_headword_line(line):
    words = line.split()
    if not words: return False
    if len(words) > 6:
        return False
    if re.match(r'^(der|die|das|der/das|die/das)\s+', line, re.IGNORECASE):
        return True
    if "," in line and any(x in line for x in ["te, hat", "t, hat", "en, ", "t, ist", "e, ist"]):
        return True
    if line.strip().startswith("hat ") or line.strip().startswith("ist "):
        return True
    if len(words) == 1 and words[0][0].islower() and re.match(r'^[a-zäöüß\-]+$', words[0]):
        return True
    if "→" in line or "/" in line:
        if len(words) <= 4:
            return True
    if len(words) <= 2 and words[0][0].isupper() and not words[0].endswith(".") and not words[0].isdigit():
        return True
    return False

# Free Translate API
def translate_text(text, target_lang="en", source_lang="de"):
    if not text: return ""
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={source_lang}&tl={target_lang}&dt=t&q={urllib.parse.quote(text)}"
    for attempt in range(3):
        try:
            r = requests.get(url, timeout=10)
            if r.status_code == 200:
                res = r.json()
                translations = res[0]
                translated_text = "".join([segment[0] for segment in translations if segment[0]])
                return translated_text.strip()
        except Exception as e:
            print(f"Translation error on attempt {attempt+1}: {e}")
            time.sleep(1)
    return ""

# Phonetic Pronunciation Hint Generator
def derive_pronunciation_hint(word):
    w = word.strip().lower()
    for art in ["der ", "die ", "das ", "der/das ", "die/das "]:
        if w.startswith(art):
            w = w[len(art):]
            break
    w = re.sub(r'\b(sich)\b', '', w).strip()
    w = re.sub(r'[^a-zäöüß\-]', '', w)
    
    if not w: return ""
    
    ph = w
    if ph.endswith("ig"):
        ph = ph[:-2] + "ikh"
    elif ph.endswith("ich"):
        ph = ph[:-3] + "ikh"
    elif ph.endswith("e"):
        ph = ph[:-1] + "uh"
    elif ph.endswith("en"):
        ph = ph[:-2] + "en"
    elif ph.endswith("er"):
        ph = ph[:-2] + "er"
        
    ph = ph.replace("sch", "sh")
    ph = ph.replace("ch", "kh")
    ph = ph.replace("ie", "ee")
    ph = ph.replace("ei", "y")
    ph = ph.replace("eu", "oy")
    ph = ph.replace("äu", "oy")
    ph = ph.replace("sp", "shp")
    ph = ph.replace("st", "sht")
    ph = ph.replace("qu", "kv")
    
    ph = ph.replace("ä", "ay")
    ph = ph.replace("ö", "oe")
    ph = ph.replace("ü", "ue")
    ph = ph.replace("ß", "ss")
    ph = ph.replace("j", "y")
    ph = ph.replace("v", "f")
    ph = ph.replace("w", "v")
    ph = ph.replace("z", "ts")
    ph = ph.replace("c", "k")
    
    if ph.startswith("s") and len(ph) > 1 and ph[1] in "aeiouy":
        ph = "z" + ph[1:]
        
    if ph.endswith("d"):
        ph = ph[:-1] + "t"
    elif ph.endswith("g"):
        ph = ph[:-1] + "k"
    elif ph.endswith("b"):
        ph = ph[:-1] + "p"
        
    if len(ph) >= 6:
        parts = []
        for i in range(0, len(ph), 3):
            parts.append(ph[i:i+3])
        ph = "-".join(parts)
        
    return ph.strip("-")

def get_keyword_category(word, english_translation):
    w = word.lower()
    e = english_translation.lower()
    
    # Vocabulary domains mapper
    if any(x in w or x in e for x in ["essen", "trinken", "brot", "apfel", "flasche", "kaffee", "tee", "milch", "käse", "gemüse", "obst", "suppe", "kuchen", "fleisch", "restaurant", "speise", "drink", "food", "eat", "wine", "beer"]):
        return "Essen & Trinken"
    if any(x in w or x in e for x in ["arzt", "ärztin", "krank", "fieber", "schmerz", "tablette", "medizin", "apotheke", "krankenhaus", "doctor", "health", "sick", "hospital"]):
        return "Gesundheit & Körper"
    if any(x in w or x in e for x in ["zug", "bahn", "bus", "auto", "reisen", "urlaub", "hotel", "flugzeug", "fliegen", "koffer", "gepäck", "fahrkarte", "ticket", "travel", "trip", "station"]):
        return "Reisen & Verkehr"
    if any(x in w or x in e for x in ["arbeit", "beruf", "firma", "büro", "kollege", "job", "chef", "angestellte", "bewerbung", "werkstatt", "office", "boss", "work", "career"]):
        return "Arbeit & Beruf"
    if any(x in w or x in e for x in ["mutter", "vater", "bruder", "schwester", "sohn", "tochter", "kind", "eltern", "familie", "freund", "freundin", "partner", "wife", "husband", "son", "daughter"]):
        return "Familie & Freunde"
    if any(x in w or x in e for x in ["haus", "wohnung", "zimmer", "tür", "fenster", "tisch", "stuhl", "bett", "schrank", "lampe", "kücke", "bad", "house", "room", "apartment", "furniture"]):
        return "Wohnen & Haushalt"
    if any(x in w or x in e for x in ["computer", "handy", "telefon", "internet", "website", "e-mail", "online", "tv", "radio", "media", "phone", "screen"]):
        return "Medien & Technik"
    if any(x in w or x in e for x in ["kaufen", "laden", "geschäft", "geld", "preis", "teuer", "billig", "bezahlen", "euro", "bank", "kreditkarte", "shop", "price", "money"]):
        return "Einkaufen & Finanzen"
    if any(x in w or x in e for x in ["schule", "lernen", "kurs", "prüfung", "studieren", "universität", "lehrer", "buch", "wörterbuch", "school", "learn", "study", "class"]):
        return "Schule & Bildung"
    if any(x in w or x in e for x in ["regen", "sonne", "wind", "schnee", "wetter", "kalt", "warm", "heiß", "sommer", "winter", "weather", "rain", "sun"]):
        return "Natur & Wetter"
    
    return "Alltag & Freizeit"

# Parsing level A1 PDF
def parse_a1_pdf_comprehensive():
    print("Parsing official A1 PDF...")
    reader = pypdf.PdfReader(A1_PDF_PATH)
    lines = []
    for idx in range(9, 27): # Pages 10 to 27 (0-indexed: 9 to 26)
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
        match_noun = re.match(r'^(der|die|das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ]+)(?:,\s*([\-a-zA-Zäöüß¨]+))?\s+(.*)$', line_str)
        if match_noun:
            gender = match_noun.group(1).lower()
            noun = match_noun.group(2)
            plural = match_noun.group(3) or "-"
            example = match_noun.group(4).strip()
            
            if plural != "-" and plural[0].isupper() and len(plural) > 2:
                example = plural + " " + example
                plural = "-"
                
            current_word = {
                "word": f"{gender} {noun}",
                "gender": gender,
                "plural": plural,
                "word_class": "Nomen",
                "example": example
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
                "word": word,
                "gender": "neutral",
                "plural": "-",
                "word_class": word_class,
                "example": example
            }
            parsed_words.append(current_word)
            continue
            
        if current_word and len(line_str.split()) >= 2:
            current_word["example"] += " " + line_str
            
    print(f"Extracted {len(parsed_words)} word-sentence pairings for A1.")
    return parsed_words

# Parsing level B1 PDF
def parse_b1_pdf_comprehensive():
    print("Parsing official B1 PDF...")
    reader = pypdf.PdfReader(B1_PDF_PATH)
    all_pairs = []
    
    for page_idx in range(15, 103): # Pages 16 to 103 (0-indexed: 15 to 102)
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
            
        sentence_start_idx = -1
        for idx, line in enumerate(filtered_lines):
            if len(line.split()) >= 4 and not is_headword_line(line):
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
            
        # Reconstruct words
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
            
        # Detect column split point
        split_idx = -1
        for idx in range(1, len(headwords)):
            if clean_for_sort(headwords[idx]) < clean_for_sort(headwords[idx-1]):
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
            
    print(f"Extracted {len(all_pairs)} word-sentence pairings for B1.")
    return all_pairs

# Word Properties Splitter
def parse_b1_headword_properties(hw_raw):
    # Match noun
    match_noun = re.match(r'^(der|die|das|der/das|die/das)\s+([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_/]+)(?:,\s*([^ ]+))?', hw_raw)
    if match_noun:
        gender = match_noun.group(1).lower()
        noun = match_noun.group(2)
        plural = match_noun.group(3) or "-"
        return f"{gender} {noun}", "Noun", gender, plural
        
    # Match plural-only noun
    match_pl = re.match(r'^([A-ZÄÖÜ][a-zA-ZäöüßÄÖÜ\-_/]+)\s+\(Pl\.\)', hw_raw)
    if match_pl:
        noun = match_pl.group(1)
        return noun, "Noun", "die", "(Pl.)"
        
    # Verbs & others
    clean_w = hw_raw.split(",")[0].strip()
    word_class = "Verb" if clean_w.endswith("en") else "Andere"
    if clean_w in ["groß", "klein", "hell", "dunkel", "schön", "hässlich", "alt", "neu", "gut", "schlecht"]:
        word_class = "Adjective"
    return clean_w, word_class, "neutral", "-"

def build_exhaustive_databases():
    # 1. Load existing databases
    with open(A1_JSON_PATH, "r", encoding="utf-8") as f:
        existing_a1 = json.load(f)
    with open(B1_JSON_PATH, "r", encoding="utf-8") as f:
        existing_b1 = json.load(f)
        
    print(f"Loaded existing card counts: A1 = {len(existing_a1)}, B1 = {len(existing_b1)}")
    
    # Active base word sets for non-destructive protection
    active_a1_bases = {clean_base_word(c["word"]) for c in existing_a1}
    active_b1_bases = {clean_base_word(c["german"]) for c in existing_b1}
    
    # 2. Extract words from PDFs
    a1_candidates = parse_a1_pdf_comprehensive()
    b1_candidates = parse_b1_pdf_comprehensive()
    
    # 3. Process Level A1 missing words
    new_a1_cards = []
    a1_processed_count = 0
    
    print("\n--- Processing A1 missing vocabulary ---")
    for cand in a1_candidates:
        word = cand["word"]
        base = clean_base_word(word)
        if not base or base in active_a1_bases:
            continue
            
        a1_processed_count += 1
        print(f"[A1 Ingest #{a1_processed_count}] Word: '{word}'...")
        
        # Translate
        en_word = translate_text(word)
        de_ex = cand["example"]
        en_ex = translate_text(de_ex) if de_ex else ""
        
        # Pronunciation
        pron = derive_pronunciation_hint(word)
        
        # Category
        cat = get_keyword_category(word, en_word)
        
        new_card = {
            "word": word,
            "word_class": cand["word_class"],
            "gender": cand["gender"],
            "plural": cand["plural"],
            "english_translation": en_word,
            "category": cat,
            "example_sentence_de": de_ex,
            "example_sentence_en": en_ex,
            "antonym": "",
            "pronunciation_hint": pron,
            "image": None
        }
        new_a1_cards.append(new_card)
        active_a1_bases.add(base)
        
        # Modest rate limit sleep
        time.sleep(0.15)
        
    # Process Level B1 missing words
    new_b1_cards = []
    b1_processed_count = 0
    
    print("\n--- Processing B1 missing vocabulary ---")
    for cand in b1_candidates:
        raw_hw = cand["headword_raw"]
        german, word_class, gender, plural = parse_b1_headword_properties(raw_hw)
        base = clean_base_word(german)
        
        if not base or base in active_b1_bases:
            continue
            
        b1_processed_count += 1
        print(f"[B1 Ingest #{b1_processed_count}] Word: '{german}'...")
        
        # Translate
        en_word = translate_text(german)
        de_ex = cand["example_sentence_de"]
        en_ex = translate_text(de_ex) if de_ex else ""
        
        # Pronunciation
        pron = derive_pronunciation_hint(german)
        
        # Category
        theme = get_keyword_category(german, en_word)
        
        new_card = {
            "german": german,
            "word_class": word_class,
            "gender": gender,
            "plural": plural,
            "english": en_word,
            "pronunciation": pron,
            "theme": theme,
            "antonym": "",
            "example_de": de_ex,
            "example_en": en_ex,
            "image": None
        }
        new_b1_cards.append(new_card)
        active_b1_bases.add(base)
        
        time.sleep(0.15)
        
    print(f"\nCompleted mass translations. Newly ingested cards: A1 = {len(new_a1_cards)}, B1 = {len(new_b1_cards)}")
    
    # 4. Merge, Sort, and Re-index
    # Merge Level A1
    full_a1_list = existing_a1 + new_a1_cards
    # Sort alphabetically by base word for clean UI traversal
    full_a1_list.sort(key=lambda x: clean_base_word(x["word"]))
    
    # Merge Level B1
    full_b1_list = existing_b1 + new_b1_cards
    # Sort alphabetically by german word
    full_b1_list.sort(key=lambda x: clean_base_word(x["german"]))
    # Re-assign IDs
    for idx, card in enumerate(full_b1_list):
        card["id"] = idx + 1
        
    # Write back
    print(f"Writing exhaustive databases... A1 total = {len(full_a1_list)}, B1 total = {len(full_b1_list)}")
    with open(A1_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(full_a1_list, f, indent=2, ensure_ascii=False)
    with open(B1_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(full_b1_list, f, indent=2, ensure_ascii=False)
        
    print("Database build and merge operations complete!")

if __name__ == "__main__":
    build_exhaustive_databases()
