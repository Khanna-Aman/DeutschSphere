import json
import os
from collections import Counter

PROJECT_ROOT = r"d:\Aman\_________Projects\A1-B1_German"

for level in ["a1", "a2", "b1"]:
    path = os.path.join(PROJECT_ROOT, level, "wordlist.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        themes = [item.get("theme", "None") for item in data]
        counter = Counter(themes)
        print(f"Level {level.upper()} Top 15 themes:")
        for t, count in counter.most_common(15):
            print(f"  - {t}: {count}")
        print()
