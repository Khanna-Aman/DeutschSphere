import os
import sys
import json
import requests

# Reconfigure stdout to use UTF-8 on Windows systems to avoid UnicodeEncodeErrors
try:
    if sys.stdout.encoding != 'utf-8':
        sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOTTIE_DIR = os.path.join(PROJECT_ROOT, "lottie")
os.makedirs(LOTTIE_DIR, exist_ok=True)

# Stable, high-quality public Lottie JSON URLs on GitHub (or CDNs)
LOTTIE_SOURCES = {
    "streak.json": [
        "https://raw.githubusercontent.com/airbnb/lottie-android/master/sample/src/main/assets/Bullseye.json", # Robust target
        "https://raw.githubusercontent.com/airbnb/lottie-web/master/demo/gobo/data.json"
    ],
    "level-complete.json": [
        "https://raw.githubusercontent.com/airbnb/lottie-android/master/sample/src/main/assets/Confetti.json", # Gorgeous confetti
        "https://raw.githubusercontent.com/felipecasali/react-web-animation/master/src/components/Success/lottie/confetti.json"
    ],
    "achievement.json": [
        "https://raw.githubusercontent.com/airbnb/lottie-android/master/sample/src/main/assets/GoldProgress.json", # High quality spinning gold badge
        "https://raw.githubusercontent.com/airbnb/lottie-android/master/sample/src/main/assets/LottieLogo1.json"
    ]
}

# Extremely lightweight, valid placeholder Lottie animation (pulsing yellow circle/star) 
# as a robust local backup in case of complete network outage during installation.
LOTTIE_PLACEHOLDER = {
    "v": "5.5.2", "fr": 60, "ip": 0, "op": 60, "w": 100, "h": 100, "nm": "Pulsing Star Placeholder",
    "ddd": 0, "assets": [],
    "layers": [
        {
            "ddd": 0, "ind": 1, "ty": 4, "nm": "Shape Layer", "sr": 1, "st": 0, "ip": 0, "op": 60,
            "ao": 0, "ks": {
                "o": {"a": 0, "k": 100, "ix": 11},
                "r": {"a": 0, "k": 0, "ix": 10},
                "p": {"a": 0, "k": [50, 50, 0], "ix": 2},
                "a": {"a": 0, "k": [0, 0, 0], "ix": 1},
                "s": {
                    "a": 1,
                    "k": [
                        {"t": 0, "s": [100, 100, 100], "h": 1},
                        {"t": 30, "s": [130, 130, 130], "h": 1},
                        {"t": 60, "s": [100, 100, 100]}
                    ],
                    "ix": 6
                }
            },
            "shapes": [
                {
                    "ty": "gr", "it": [
                        {
                            "d": 1, "ty": "el", "s": {"a": 0, "k": [40, 40], "ix": 3},
                            "p": {"a": 0, "k": [0, 0], "ix": 2}, "nm": "Ellipse Path", "mn": "ADBE Vector Shape - Ellipse"
                        },
                        {
                            "ty": "fl", "c": {"a": 0, "k": [1, 0.8, 0, 1], "ix": 4}, # Beautiful warm golden orange
                            "o": {"a": 0, "k": 100, "ix": 5}, "r": 1, "nm": "Fill", "mn": "ADBE Vector Graphic - Fill"
                        },
                        {
                            "ty": "tr", "p": {"a": 0, "k": [0, 0], "ix": 2}, "a": {"a": 0, "k": [0, 0], "ix": 1},
                            "s": {"a": 0, "k": [100, 100], "ix": 3}, "r": {"a": 0, "k": 0, "ix": 6},
                            "o": {"a": 0, "k": 100, "ix": 7}, "sk": {"a": 0, "k": 0, "ix": 4},
                            "sa": {"a": 0, "k": 0, "ix": 5}, "nm": "Transform"
                        }
                    ],
                    "nm": "Group 1", "np": 2, "cix": 2, "bm": 0, "ix": 1, "mn": "ADBE Vector Group"
                }
            ],
            "ip": 0, "op": 60, "st": 0, "bm": 0
        }
    ]
}

def download_file(filename, urls):
    dest_path = os.path.join(LOTTIE_DIR, filename)
    print(f"Downloading {filename}...")
    
    for url in urls:
        try:
            r = requests.get(url, timeout=10)
            if r.status_code == 200:
                # Confirm it is valid JSON
                data = r.json()
                with open(dest_path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)
                print(f"  [OK] Successfully downloaded from: {url}")
                return True
        except Exception as e:
            print(f"  [Skip] Attempt failed for {url}: {e}")
            continue

    # Fallback to local placeholder
    with open(dest_path, "w", encoding="utf-8") as f:
        json.dump(LOTTIE_PLACEHOLDER, f, ensure_ascii=False)
    print(f"  [Backup] Wrote robust, offline-first fallback placeholder for: {filename}")
    return False

def main():
    print("=========================================================")
    print(" LOTTIE ASSETS DOWNLOAD PIPELINE (OFFLINE-FIRST) ")
    print("=========================================================")
    
    for filename, urls in LOTTIE_SOURCES.items():
        download_file(filename, urls)
        
    print("\nLottie assets synchronization complete!")

if __name__ == "__main__":
    main()
