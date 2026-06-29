import json
from pathlib import Path

path = Path(r"d:\Aman\_________Projects\A1-B1_German\b1\wordlist.json")
data = json.loads(path.read_text(encoding="utf-8-sig"))  # utf-8-sig strips BOM

fixes = {
    "greifen":    "images/card_724.svg",
    "klettern":   "images/card_918.svg",
    "der Ober":   "images/card_1240.svg",
    "siegen":     "images/card_1593.svg",
    "überfahren": "images/card_2124.svg",
    "überholen":  "images/card_2125.svg",
}

for entry in data:
    if entry["german"] in fixes:
        svg = fixes[entry["german"]]
        entry["image"] = svg
        entry["image_path"] = svg

path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Saved {len(data)} entries, no BOM, consistent formatting")
