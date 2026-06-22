import json
import sys

def get_words(start_id, end_id, level='a1'):
    filepath = f"{level}/wordlist.json"
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for w in data:
        if start_id <= w['id'] <= end_id:
            print(f"{w['id']}: {w['german']} ({w['word_class']}) -> {w['english']}")

if __name__ == '__main__':
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 226
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 255
    level = sys.argv[3] if len(sys.argv) > 3 else 'a1'
    get_words(start, end, level)
