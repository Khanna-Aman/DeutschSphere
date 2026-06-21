import os
import json
import xml.etree.ElementTree as ET
import sys

# Determine workspace paths relative to script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Get target level from command line arguments (default to 'a2')
LEVEL = "a2"
if len(sys.argv) > 1:
    arg = sys.argv[1].lower().strip()
    if arg in ["a1", "a2", "b1"]:
        LEVEL = arg
    else:
        print(f"Warning: Unknown level '{arg}'. Defaulting to 'a2'.")

BASE_DIR = os.path.join(PROJECT_ROOT, LEVEL)
JSON_PATH = os.path.join(BASE_DIR, "wordlist.json")
IMAGES_DIR = os.path.join(BASE_DIR, "images")

def verify():
    print("Starting automated asset verification...")

    # 1. Load wordlist
    if not os.path.exists(JSON_PATH):
        print(f"Error: {JSON_PATH} does not exist.")
        return False
        
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {JSON_PATH}: {e}")
        return False

    print(f"Loaded {len(data)} cards from wordlist.json.")

    # 2. Check for each file and parse
    missing_files = []
    malformed_files = []
    invalid_structure_files = []
    checked_count = 0

    for index, item in enumerate(data):
        image_path = item.get("image")
        if not image_path:
            continue
            
        checked_count += 1
        card_id = item.get("id", index + 1)
        filename = f"card_{card_id}.svg"
        filepath = os.path.join(IMAGES_DIR, filename)

        # Check existence
        if not os.path.exists(filepath):
            missing_files.append(filename)
            continue

        # Parse SVG
        try:
            tree = ET.parse(filepath)
            root = tree.getroot()

            # Check root details
            if not root.tag.endswith('svg'):
                invalid_structure_files.append((filename, "Root is not <svg>"))
                continue

            viewbox = root.attrib.get("viewBox")
            if viewbox != "0 0 200 200":
                invalid_structure_files.append((filename, f"Invalid viewBox: {viewbox} (expected 0 0 200 200)"))
                continue

            # Verify that we have a group with translation/scale
            g_found = False
            for child in root:
                if child.tag.endswith('g'):
                    transform = child.attrib.get("transform", "")
                    if "translate(30, 30)" in transform and "scale(3.8888)" in transform:
                        g_found = True
                        break

            if not g_found:
                invalid_structure_files.append((filename, "Missing wrapped group <g transform=\"translate(30, 30) scale(3.8888)\">"))
                continue

        except ET.ParseError as pe:
            malformed_files.append((filename, f"XML Parse Error: {pe}"))
        except Exception as ex:
            malformed_files.append((filename, f"Error: {ex}"))

    # Print summary
    print("\nVerification Summary:")
    print(f"Total checked: {checked_count} cards with images (from {len(data)} total cards)")
    print(f"Successful: {checked_count - len(missing_files) - len(malformed_files) - len(invalid_structure_files)}")
    print(f"Missing files: {len(missing_files)}")
    print(f"Malformed XML: {len(malformed_files)}")
    print(f"Invalid SVG structures: {len(invalid_structure_files)}")

    if missing_files:
        print("\nMissing Files (first 10):")
        for f in missing_files[:10]:
            print(f"  - {f}")
            
    if malformed_files:
        print("\nMalformed XML Files (first 10):")
        for f, err in malformed_files[:10]:
            print(f"  - {f}: {err}")
            
    if invalid_structure_files:
        print("\nInvalid Structure Files (first 10):")
        for f, err in invalid_structure_files[:10]:
            print(f"  - {f}: {err}")

    # Return overall result
    success = len(missing_files) == 0 and len(malformed_files) == 0 and len(invalid_structure_files) == 0
    return success

if __name__ == "__main__":
    success = verify()
    if success:
        print("\nAll assets validated successfully! Code 0.")
        sys.exit(0)
    else:
        print("\nAsset validation failed. Code 1.")
        sys.exit(1)
