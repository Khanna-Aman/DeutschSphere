import os
import json
import re
import sys
import argparse
from io import BytesIO
from PIL import Image, ImageDraw, ImageChops, ImageFilter

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

# Determine workspace paths relative to script location
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)

# Meta Dictionary of highly specific claymation metaphors for abstract / functional words
METAPHOR_MAP = {
    # Prepositions
    "an": "a cute 3D clay character sticking a vibrant sticky note onto a green wooden wall",
    "auf": "a cute 3D clay kitten sitting on top of a comfortable wooden stool",
    "in": "a bright red toy ball nestled inside a transparent glass jar",
    "unter": "a red toy ball sitting snugly directly under a rustic blue wooden box",
    "über": "a tiny toy plane flying over a cozy clay mountain peak",
    "neben": "a red toy ball resting right next to a small blue wooden box",
    "vor": "a friendly 3D clay character standing proudly in front of a rustic wooden door",
    "hinter": "a cute 3D clay character peeking out from behind a large green tree trunk",
    "zwischen": "a bright yellow ball sitting exactly between two tall blue wooden boxes",
    "bei": "a cozy small clay cottage sitting right beside a tall beautiful wooden tower",
    "mit": "a pair of red and blue clay socks folded snugly together",
    "ohne": "a cute clay coffee mug with a puzzle piece missing from its side",
    "nach": "a friendly toy clay train pointing forward along a tiny track towards a distant destination",
    "von": "a tiny clay envelope floating out from a small wooden mailbox",
    "zu": "a friendly clay character walking toward a bright shining golden star",
    "durch": "a small toy car driving happily through a green archway tunnel",
    "gegen": "two cute clay balls gently bumping against each other, action style",
    "um": "a small ring of colorful wooden toy blocks positioned around a tall red candle",

    # Conjunctions
    "weil": "two beautiful interlocking toy puzzle pieces or mechanical gears representing cause-and-effect",
    "und": "two friendly clay characters happily holding hands",
    "aber": "a small scale balance with a bright shiny diamond on one side and a heavy grey stone on the other side",
    "oder": "a wooden signpost with two arrows pointing in different left and right directions",
    "dass": "a small clay scroll containing a secret scroll message, cartoon style",
    "wenn": "a glowing golden key sitting next to a tiny locked chest, representing if-then condition",
    "ob": "a cute clay character scratching its head thoughtfully while looking at a question mark",

    # Pronouns & Greetings
    "ich": "a single cute clay character pointing smilingly at itself",
    "du": "a friendly clay character pointing forward in a warm greeting",
    "wir": "a small group of diverse friendly clay characters smiling and waving together",
    "ihr": "a group of clay characters standing together, looking friendly",
    "sie": "two friendly clay women waving",
    "es": "a small glowing abstract clay box representing an object, neon glow",
    "hallo": "a cheerful 3D clay character smiling and waving its hand high in the air",
    "tschüss": "a cute clay character smiling and waving goodbye as it walks away",
}

def remove_black_background(img, threshold=25, feather=True):
    """
    Applies high-speed chroma-keying to convert solid black backgrounds to transparent.
    Uses an advanced floodfill-based seed extraction to protect internal black pixels 
    (e.g., eyes, shadows, black objects) from becoming transparent.
    """
    img = img.convert("RGBA")
    width, height = img.size
    
    # 1. Split channels
    r, g, b, _ = img.split()
    
    # 2. Find near-black pixels (all channels < threshold)
    r_mask = r.point(lambda p: 255 if p < threshold else 0)
    g_mask = g.point(lambda p: 255 if p < threshold else 0)
    b_mask = b.point(lambda p: 255 if p < threshold else 0)
    
    # Bitwise AND to find pixels that are dark in R, G, AND B
    near_black = ImageChops.and_(r_mask, g_mask)
    near_black = ImageChops.and_(near_black, b_mask)
    
    # 3. Use flood fill from the 4 corners to isolate connected external background
    # This prevents internal blacks (eyes, shadows, dark clothing) from being removed.
    flood_img = near_black.copy()
    
    corners = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    for corner in corners:
        if flood_img.getpixel(corner) == 255:
            ImageDraw.floodfill(flood_img, corner, value=128)
            
    # Pixels marked with 128 are confirmed external background. 
    # Create final alpha channel: 0 (transparent) where background was detected, 255 (opaque) otherwise.
    bg_alpha = flood_img.point(lambda p: 0 if p == 128 else 255)
    
    if feather:
        # Blur the alpha mask slightly to feather borders and remove jagged dark pixels
        bg_alpha = bg_alpha.filter(ImageFilter.GaussianBlur(radius=1.2))
        
    img.putalpha(bg_alpha)
    return img

def trim_and_center(img, target_size=(256, 256), padding_percent=0.05):
    """
    Trims fully transparent boundary pixels using getbbox(), and rescales/centers 
    the active object with a clean, high-impact padding margin.
    """
    bbox = img.getbbox()
    if not bbox:
        # Fallback if image is completely transparent or empty
        return img.resize(target_size, Image.Resampling.LANCZOS)
        
    cropped = img.crop(bbox)
    cw, ch = cropped.size
    
    # Create target canvas
    canvas = Image.new("RGBA", target_size, (0, 0, 0, 0))
    tw, th = target_size
    
    # Calculate scale factor to maintain aspect ratio with specified padding
    max_w = int(tw * (1.0 - 2 * padding_percent))
    max_h = int(th * (1.0 - 2 * padding_percent))
    
    scale = min(max_w / cw, max_h / ch)
    new_w = max(1, int(cw * scale))
    new_h = max(1, int(ch * scale))
    
    resized = cropped.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Center paste
    px = (tw - new_w) // 2
    py = (th - new_h) // 2
    
    canvas.paste(resized, (px, py), resized)
    return canvas

def generate_metaphor_prompt(word_de, word_en, word_class):
    """
    Resolves the German word class and details to build a highly descriptive 
    visual prompt tailored for SOTA 3D Claymation assets.
    """
    # Clean articles for dictionary lookups
    de_clean = re.sub(r'^(der|die|das)\s+', '', word_de.lower()).strip()
    
    # Check if we have a hand-curated metaphorical prompt
    if de_clean in METAPHOR_MAP:
        metaphor = METAPHOR_MAP[de_clean]
    else:
        # Dynamic fallback prompts based on word classes
        if word_class == "Nomen":
            metaphor = f"A beautiful, detailed, colorful 3D claymation model representing '{word_en}'"
        elif word_class == "Verb":
            clean_verb = re.sub(r'^to\s+', '', word_en.lower()).strip()
            metaphor = f"A friendly, stylized 3D clay character dynamically performing the action of '{clean_verb}' in a cute cartoon scene"
        elif word_class == "Adjektiv" or "adjective" in word_class.lower():
            metaphor = f"A high-contrast, stylized 3D claymation scene visually demonstrating the concept of '{word_en}' through friendly cartoonish objects"
        else:
            metaphor = f"A cute, stylized 3D clay illustration symbolizing the concept of '{word_en}'"

    # Base prompt wrapping the metaphor with strict solid black background instructions
    prompt = (
        f"Cozy 3D claymation illustration representing the word '{word_en}'. {metaphor}. "
        f"Solid, flat, high-contrast pure-black background, 3D clay model, studio lighting, "
        f"cute and friendly, vibrant colors, premium mobile game asset style, no text, clean borders, 4k"
    )
    return prompt

def main():
    parser = argparse.ArgumentParser(description="A1-B1 German SOTA 3D Claymation Image Generator (Imagen 3)")
    parser.add_argument("--level", type=str, default="a1", choices=["a1", "a2", "b1"], help="Target CEFR level")
    parser.add_argument("--limit", type=int, default=10, help="Batch limit (number of images to generate)")
    parser.add_argument("--force", action="store_true", help="Force overwrite existing WebP images")
    args = parser.parse_args()

    print("=========================================================")
    print("💎 SOTA 3D CLAYMATION WEB-IMAGE GENERATOR STARTED 💎")
    print(f"Target Level: {args.level.upper()}")
    print(f"Batch Limit:  {args.limit}")
    print(f"Force Overwrite: {args.force}")
    print("=========================================================")

    if not GENAI_AVAILABLE:
        print("❌ Error: 'google-genai' library is not available. Please install it first.")
        sys.exit(1)

    # Try to load GEMINI_API_KEY from .env in the project root if not in environment
    if not os.environ.get("GEMINI_API_KEY"):
        env_path = os.path.join(PROJECT_ROOT, ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            if k.strip() == "GEMINI_API_KEY":
                                os.environ["GEMINI_API_KEY"] = v.strip().strip('"').strip("'")
                                break
            except Exception as e:
                print(f"⚠️ Warning: Could not read .env file: {e}")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ Error: GEMINI_API_KEY environment variable is not set.")
        print("Please set it in your system or create a .env file in the project root with:")
        print("  GEMINI_API_KEY=your_api_key_here")
        sys.exit(1)

    # Initialize Modern Google GenAI SDK Client
    client = genai.Client()

    # Paths
    level_dir = os.path.join(PROJECT_ROOT, args.level)
    json_path = os.path.join(level_dir, "wordlist.json")
    images_dir = os.path.join(level_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    if not os.path.exists(json_path):
        print(f"❌ Error: Wordlist json not found at {json_path}!")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        wordlist = json.load(f)

    # Filter items that need generation
    to_generate = []
    for item in wordlist:
        card_id = item.get("id")
        if not card_id:
            continue
        
        webp_filename = f"card_{card_id}.webp"
        webp_path = os.path.join(images_dir, webp_filename)

        # Generate if file does not exist, or if we force overwrite
        if not os.path.exists(webp_path) or args.force:
            to_generate.append(item)

    print(f"Found {len(to_generate)} total items requiring image generation.")
    
    # Process only up to the specified limit
    slice_to_generate = to_generate[:args.limit]
    print(f"Slicing batch to generate: {len(slice_to_generate)} items in this run.")

    if not slice_to_generate:
        print("🎉 No images need to be generated! All items already have local WebP assets.")
        sys.exit(0)

    generated_count = 0
    updated_wordlist = False

    for index, item in enumerate(slice_to_generate):
        card_id = item["id"]
        german = item["german"]
        english = item["english"]
        word_class = item.get("word_class", "Andere")
        
        webp_filename = f"card_{card_id}.webp"
        output_webp_path = os.path.join(images_dir, webp_filename)

        prompt = generate_metaphor_prompt(german, english, word_class)
        
        print(f"\n[{index+1}/{len(slice_to_generate)}] Generating card_{card_id} for '{german}' -> '{english}'")
        print(f"  Prompt: \"{prompt}\"")

        try:
            # Query SOTA Imagen 3 model via google-genai
            response = client.models.generate_images(
                model="imagen-3.0-generate-002",
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    output_mime_type="image/png",
                    aspect_ratio="1:1"
                )
            )

            if not response.generated_images:
                print(f"  ⚠️ Warning: Imagen returned empty response for card_{card_id}.")
                continue

            # Load image bytes
            img_bytes = response.generated_images[0].image.image_bytes
            raw_img = Image.open(BytesIO(img_bytes))

            # 1. Apply robust connected chroma-key masking
            transparent_img = remove_black_background(raw_img, threshold=25, feather=True)

            # 2. Trim empty transparent border pixels & center with 5% padding
            final_img = trim_and_center(transparent_img, target_size=(256, 256), padding_percent=0.05)

            # 3. Compress and save as SOTA WebP
            final_img.save(output_webp_path, "WEBP", quality=82)
            print(f"  ✅ Saved and compressed: {webp_filename} ({os.path.getsize(output_webp_path)} bytes)")

            # 4. Update the word list item schema
            item["image_tier"] = "B"
            item["image_path"] = f"images/{webp_filename}"
            item["image"] = f"images/{webp_filename}"  # Backwards compatibility
            
            generated_count += 1
            updated_wordlist = True

        except Exception as e:
            print(f"  ❌ Error generating card_{card_id}: {e}")
            continue

    if updated_wordlist:
        # Overwrite database with updated schema properties
        print(f"\nUpdating {json_path} wordlist database with generated image paths...")
        # To avoid saving partial dictionary updates if anything got corrupted, we read/write carefully
        with open(json_path, "r", encoding="utf-8") as f:
            full_db = json.load(f)

        # Merge changes back into full database
        db_by_id = {x["id"]: x for x in full_db}
        for item in slice_to_generate:
            if item["id"] in db_by_id and "image_path" in item:
                db_by_id[item["id"]]["image_tier"] = item["image_tier"]
                db_by_id[item["id"]]["image_path"] = item["image_path"]
                db_by_id[item["id"]]["image"] = item["image"]

        # Save back cleanly
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(full_db, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Batch run complete! Successfully generated {generated_count} SOTA 3D Claymation cards.")

if __name__ == "__main__":
    main()
