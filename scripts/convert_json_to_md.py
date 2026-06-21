import json
import os

def clean_val(val):
    if val is None:
        return ""
    return str(val).strip()

def generate_table_md(json_data):
    lines = []
    lines.append("# German A2 Vocabulary Wordlist Table")
    lines.append("")
    lines.append("| ID | German | Word Class | Gender | Plural | English | Pronunciation | Theme | Antonym | Example (DE) | Example (EN) |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|---|")
    
    for item in json_data:
        row = [
            clean_val(item.get("id")),
            clean_val(item.get("german")),
            clean_val(item.get("word_class")),
            clean_val(item.get("gender")),
            clean_val(item.get("plural")),
            clean_val(item.get("english")),
            clean_val(item.get("pronunciation")),
            clean_val(item.get("theme")),
            clean_val(item.get("antonym")),
            clean_val(item.get("example_de")),
            clean_val(item.get("example_en"))
        ]
        # Escape pipe symbols in content to avoid breaking the markdown table
        row_escaped = [val.replace("|", "\\|") for val in row]
        lines.append("| " + " | ".join(row_escaped) + " |")
        
    return "\n".join(lines)

def generate_list_md(json_data):
    # Group by theme
    by_theme = {}
    for item in json_data:
        theme = clean_val(item.get("theme")) or "Uncategorized"
        if theme not in by_theme:
            by_theme[theme] = []
        by_theme[theme].append(item)
        
    lines = []
    lines.append("# German A2 Vocabulary (Grouped by Theme)")
    lines.append("")
    lines.append("This document contains the complete A2 wordlist with translations, pronunciations, grammatical details, and example sentences, organized by topic/theme.")
    lines.append("")
    
    # Sort themes alphabetically
    for theme in sorted(by_theme.keys()):
        lines.append(f"## {theme.upper()}")
        lines.append("---")
        lines.append("")
        
        # Sort items within theme by german word
        items = sorted(by_theme[theme], key=lambda x: clean_val(x.get("german")).lower())
        
        for item in items:
            german = clean_val(item.get("german"))
            word_class = clean_val(item.get("word_class"))
            gender = clean_val(item.get("gender"))
            plural = clean_val(item.get("plural"))
            english = clean_val(item.get("english"))
            pron = clean_val(item.get("pronunciation"))
            antonym = clean_val(item.get("antonym"))
            ex_de = clean_val(item.get("example_de"))
            ex_en = clean_val(item.get("example_en"))
            
            # Format word header nicely (e.g. including gender/plural for Nouns)
            header_parts = []
            if word_class == "Noun":
                noun_str = ""
                if gender:
                    noun_str += f"{gender} "
                noun_str += german
                if plural:
                    noun_str += f", {plural}"
                header_parts.append(f"**{noun_str}**")
            else:
                header_parts.append(f"**{german}**")
                
            if word_class:
                header_parts.append(f"({word_class})")
                
            header_str = " ".join(header_parts)
            lines.append(f"* {header_str}: {english}")
            
            # Additional details as sub-bullets
            sub_bullets = []
            if pron:
                sub_bullets.append(f"*Pronunciation:* /{pron}/")
            if antonym:
                sub_bullets.append(f"*Antonym:* {antonym}")
            if ex_de:
                ex_str = f"*Beispiel:* {ex_de}"
                if ex_en:
                    ex_str += f" ({ex_en})"
                sub_bullets.append(ex_str)
                
            for sub in sub_bullets:
                lines.append(f"  * {sub}")
                
        lines.append("")
        
    return "\n".join(lines)

def run():
    json_path = 'wordlist.json'
    if not os.path.exists(json_path):
        print(f"Error: {json_path} not found!")
        return
        
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
        
    print(f"Loaded {len(json_data)} vocabulary items from {json_path}.")
    
    # 1. Generate table md
    table_md = generate_table_md(json_data)
    table_path = 'wordlist.md'
    with open(table_path, 'w', encoding='utf-8') as f:
        f.write(table_md)
    print(f"Successfully generated table markdown in '{table_path}' ({len(table_md)} characters).")
    
    # 2. Generate study guide list md
    list_md = generate_list_md(json_data)
    list_path = 'master_wordlist.md'
    with open(list_path, 'w', encoding='utf-8') as f:
        f.write(list_md)
    print(f"Successfully generated grouped list markdown in '{list_path}' ({len(list_md)} characters).")

if __name__ == '__main__':
    run()
