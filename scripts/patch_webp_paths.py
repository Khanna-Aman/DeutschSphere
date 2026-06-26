import os
import json

def patch_paths():
    print("=== PATCOV-WEBP-PATHS: Scanning Level A2 Database ===")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    a2_dir = os.path.join(project_root, "a2")
    wordlist_path = os.path.join(a2_dir, "wordlist.json")
    images_dir = os.path.join(a2_dir, "images")
    
    if not os.path.exists(wordlist_path):
        print(f"Error: {wordlist_path} not found.")
        return
        
    with open(wordlist_path, "r", encoding="utf-8") as f:
        words = json.load(f)
        
    updated_count = 0
    missing_images = []
    
    for word in words:
        card_id = word.get("id")
        if not card_id:
            continue
            
        webp_filename = f"card_{card_id}.webp"
        webp_path = os.path.join(images_dir, webp_filename)
        
        # Check if the WebP image actually exists on disk
        if os.path.exists(webp_path):
            current_image = word.get("image", "")
            # If the current image path points to .svg, patch it to point to .webp
            if current_image.endswith(".svg") or not current_image:
                word["image"] = f"images/{webp_filename}"
                updated_count += 1
                print(f"  Patched Card ID {card_id} ({word.get('german')}) -> images/{webp_filename}")
        else:
            missing_images.append((card_id, word.get("german")))
            
    if updated_count > 0:
        # Save the updated wordlist file
        with open(wordlist_path, "w", encoding="utf-8") as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        print(f"\n[SUCCESS] Successfully updated {updated_count} cards to point to existing WebP files!")
    else:
        print("\nNo database path updates were needed. All completed WebPs are correctly referenced in the JSON database.")
        
    print(f"Total cards without WebP images: {len(missing_images)}")
    if missing_images:
        print("\nMissing WebP images for the following cards (still exist as SVGs):")
        for cid, de in missing_images:
            print(f"  - Card ID {cid}: {de}")

if __name__ == "__main__":
    patch_paths()
