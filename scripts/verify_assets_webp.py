import os
import json
import sys
from PIL import Image

def verify_webp_assets(level):
    print(f"=== PROGRAMMATIC WEBP ASSET VERIFIER: LEVEL {level.upper()} ===")
    
    # Resolve relative paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    level_dir = os.path.join(project_root, level)
    wordlist_path = os.path.join(level_dir, "wordlist.json")
    images_dir = os.path.join(level_dir, "images")
    
    if not os.path.exists(wordlist_path):
        print(f"[ERROR] Database file not found: {wordlist_path}")
        return False
        
    if not os.path.exists(images_dir):
        print(f"[ERROR] Images directory not found: {images_dir}")
        return False
        
    # Load and parse JSON wordlist
    try:
        with open(wordlist_path, "r", encoding="utf-8") as f:
            words = json.load(f)
    except Exception as e:
        print(f"[ERROR] Failed to parse {wordlist_path}: {e}")
        return False
        
    total_cards = len(words)
    print(f"Loaded {total_cards} cards from database.")
    
    missing_image_property = []
    missing_on_disk = []
    invalid_webp_files = []
    incorrect_paths = []
    success_count = 0
    
    for word in words:
        card_id = word.get("id")
        german = word.get("german", "Unknown")
        
        if not card_id:
            print(f"[WARNING] Card found without ID property: {word}")
            continue
            
        image_val = word.get("image")
        image_path_val = word.get("image_path")
        
        # Verify image properties exist
        if not image_val:
            missing_image_property.append((card_id, german, "image property missing"))
            continue
            
        # Check standard format
        expected_format = f"images/card_{card_id}.webp"
        if image_val != expected_format:
            incorrect_paths.append((card_id, german, f"image value '{image_val}' (expected '{expected_format}')"))
            
        if image_path_val and image_path_val != expected_format:
            incorrect_paths.append((card_id, german, f"image_path value '{image_path_val}' (expected '{expected_format}')"))
            
        # Check image existence on disk
        webp_filename = f"card_{card_id}.webp"
        webp_filepath = os.path.join(images_dir, webp_filename)
        
        if not os.path.exists(webp_filepath):
            missing_on_disk.append((card_id, german, webp_filepath))
            continue
            
        # Verify image validity with PIL
        try:
            with Image.open(webp_filepath) as img:
                img.verify() # Verify file integrity without loading whole image
            success_count += 1
        except Exception as e:
            invalid_webp_files.append((card_id, german, f"PIL verify failed: {e}"))
            
    # Print report
    print("\n" + "="*50)
    print(f"VERIFICATION REPORT FOR LEVEL {level.upper()}")
    print("="*50)
    print(f"Total Database Cards:       {total_cards}")
    print(f"Valid WebP Images Audited:  {success_count} / {total_cards} ({success_count/total_cards*100:.1f}%)")
    print(f"Missing Image Properties:   {len(missing_image_property)}")
    print(f"Missing WebP Files on Disk: {len(missing_on_disk)}")
    print(f"Invalid WebP Images:        {len(invalid_webp_files)}")
    print(f"Incorrect Path References:  {len(incorrect_paths)}")
    print("="*50)
    
    # Detail failures safely avoiding stdout encoding crashes
    if missing_image_property:
        print("\n[FAIL] Missing image properties (first 10):")
        for cid, de, err in missing_image_property[:10]:
            print(f"  - Card #{cid} ({de.encode('ascii', 'replace').decode()}): {err}")
            
    if incorrect_paths:
        print("\n[FAIL] Incorrect path format in database (first 10):")
        for cid, de, err in incorrect_paths[:10]:
            print(f"  - Card #{cid} ({de.encode('ascii', 'replace').decode()}): {err}")
            
    if missing_on_disk:
        print("\n[FAIL] Missing image files on disk (first 10):")
        for cid, de, path in missing_on_disk[:10]:
            print(f"  - Card #{cid} ({de.encode('ascii', 'replace').decode()}): File missing at {path}")
            
    if invalid_webp_files:
        print("\n[FAIL] Corrupted/Invalid WebP images (first 10):")
        for cid, de, err in invalid_webp_files[:10]:
            print(f"  - Card #{cid} ({de.encode('ascii', 'replace').decode()}): {err}")
            
    # Success decision
    overall_success = (
        len(missing_image_property) == 0 and 
        len(missing_on_disk) == 0 and 
        len(invalid_webp_files) == 0 and 
        len(incorrect_paths) == 0
    )
    
    if overall_success:
        print(f"\n[SUCCESS] Level {level.upper()} WebP assets are 100% clean and programmatically valid! Code 0.")
        return True
    else:
        print(f"\n[FAILURE] Level {level.upper()} asset verification failed. Code 1.")
        return False

if __name__ == "__main__":
    target_level = "a2"
    if len(sys.argv) > 1:
        arg = sys.argv[1].lower().strip()
        if arg in ["a1", "a2", "b1"]:
            target_level = arg
            
    success = verify_webp_assets(target_level)
    sys.exit(0 if success else 1)
