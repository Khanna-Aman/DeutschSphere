import os
import json
import re
import sys
import time
import argparse
from io import BytesIO
from PIL import Image, ImageDraw, ImageChops, ImageFilter

# Force UTF-8 encoding for stdout/stderr on Windows to support emojis cleanly
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

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
    "aus": "a cute, smiling 3D clay bird happily popping out of a beautiful rustic wooden cuckoo clock",
    "aus sein": "a cute 3D clay wall light switch in a pink frame, with the toggle flipped down to the off position, cartoon style",

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
    "ausflug": "a tiny cute 3D clay backpacker character happily hiking along a miniature clay mountain path, carrying a tiny blue backpack, cartoon style",
    "ausfüllen": "a cute 3D clay character smilingly holding a giant pencil, filling in a checklist form, cartoon style",
    "ausgang": "a bright green 3D clay exit sign with a running figure, glowing softly, cartoon style",
    "auskunft": "a stylized 3D clay desk booth with a large glowing golden letter 'i' above it, cartoon style",
    "ausland": "a beautiful 3D clay globe showing colorful flags and tiny cute airplanes flying around it, cartoon style"
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
    # Since r_mask, g_mask, b_mask are mode 'L' with 0 or 255 values, multiplying them
    # behaves as a logical AND (255 * 255 / 255 = 255; any 0 results in 0).
    near_black = ImageChops.multiply(r_mask, g_mask)
    near_black = ImageChops.multiply(near_black, b_mask)
    
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
            metaphor = f"a beautiful, detailed, colorful 3D claymation model representing the object {word_en}"
        elif word_class == "Verb":
            clean_verb = re.sub(r'^to\s+', '', word_en.lower()).strip()
            metaphor = f"a friendly, stylized 3D clay character dynamically performing the action of {clean_verb} in a cute cartoon scene"
        elif word_class == "Adjektiv" or "adjective" in word_class.lower():
            metaphor = f"a high-contrast, stylized 3D claymation scene visually demonstrating the concept of {word_en} through friendly cartoonish objects"
        else:
            metaphor = f"a cute, stylized 3D clay illustration symbolizing the concept of {word_en}"

    # Base prompt wrapping the metaphor with extremely strict isolated void and wordless instructions
    prompt = (
        f"A beautiful 3D claymation illustration of: {metaphor}. "
        f"Isolated asset floating on a 100% flat, solid, uniform pure black background. "
        f"Strictly no ground plane, no floor shadow, no floor surface, no horizon line, no table surface, completely suspended in pure black void. "
        f"Strictly no text, no letters, no words, no written characters, no alphabets, completely wordless. "
        f"Studio lighting, cute and friendly 3D clay model, vibrant colors, premium mobile game asset style, clean borders, 4k"
    )
    return prompt

def main():
    parser = argparse.ArgumentParser(description="A1-B1 German SOTA 3D Claymation Image Generator (Imagen 3)")
    parser.add_argument("--level", type=str, default="a1", choices=["a1", "a2", "b1"], help="Target CEFR level")
    parser.add_argument("--limit", type=int, default=10, help="Batch limit (number of images to generate)")
    parser.add_argument("--delay", type=int, default=12, help="Pacing delay (seconds) between successful generations")
    parser.add_argument("--skip", type=str, default="", help="Comma-separated card IDs to skip")
    parser.add_argument("--force", action="store_true", help="Force overwrite existing WebP images")
    args = parser.parse_args()

    print("=========================================================")
    print("💎 SOTA 3D CLAYMATION WEB-IMAGE GENERATOR STARTED 💎")
    print(f"Target Level: {args.level.upper()}")
    print(f"Batch Limit:  {args.limit}")
    print(f"Pacing Delay: {args.delay}s")
    if args.skip:
        print(f"Skipping Card IDs: {args.skip}")
    print(f"Force Overwrite: {args.force}")
    print("=========================================================")

    if not GENAI_AVAILABLE:
        print("❌ Error: 'google-genai' library is not available. Please install it first.")
        sys.exit(1)

    # Try to load keys from .env in the project root if not in environment
    env_path = os.path.join(PROJECT_ROOT, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if not os.environ.get(k):
                            os.environ[k] = v
        except Exception as e:
            print(f"⚠️ Warning: Could not read .env file: {e}")

    # Check if we should use Google Cloud Vertex AI or Google AI Studio
    gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if gac and not os.path.isabs(gac):
        gac_abs = os.path.abspath(os.path.join(PROJECT_ROOT, gac))
        if os.path.exists(gac_abs):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = gac_abs

    use_vertex = bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    
    if use_vertex:
        gcp_project = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT") or "antigravity-sandbox-500206"
        gcp_location = os.environ.get("GCP_LOCATION") or "us-central1"
        print("=========================================================")
        print(f"📡 Integration Path: Google Cloud Vertex AI Mode")
        print(f"   Project:  {gcp_project}")
        print(f"   Location: {gcp_location}")
        print(f"   Key File: {os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')}")
        print("=========================================================")
        client = genai.Client(vertexai=True, project=gcp_project, location=gcp_location)
    else:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            print("❌ Error: Neither GEMINI_API_KEY nor GOOGLE_APPLICATION_CREDENTIALS is set in environment or .env file.")
            print("Please create a .env file in the project root with either:")
            print("  GEMINI_API_KEY=your_gemini_api_key_here")
            print("Or to use Google Cloud Vertex AI (with your GCP Credits):")
            print("  GOOGLE_APPLICATION_CREDENTIALS=gcp-key.json")
            print("  GCP_PROJECT=antigravity-sandbox-500206")
            sys.exit(1)
        
        print("=========================================================")
        print("📡 Integration Path: Google AI Studio Mode")
        print("=========================================================")
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
    skip_ids = [s.strip() for s in args.skip.split(",") if s.strip()]
    to_generate = []
    for item in wordlist:
        card_id = item.get("id")
        if not card_id:
            continue
        
        # Skip specific card IDs if requested
        if str(card_id) in skip_ids:
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
        
        # Add a pacing delay before we generate (if we have successfully generated some cards)
        if index > 0 and generated_count > 0:
            pacing_delay = getattr(args, "delay", 12)
            if pacing_delay > 0:
                print(f"  Pacing delay: waiting {pacing_delay}s to respect Vertex AI quotas...")
                time.sleep(pacing_delay)

        print(f"\n[{index+1}/{len(slice_to_generate)}] Generating card_{card_id} for '{german}' -> '{english}'")
        print(f"  Prompt: \"{prompt}\"")

        try:
            # Query SOTA Imagen 3 model via google-genai with exponential backoff on 429
            max_retries = 4
            backoff_base = 15
            response = None
            
            for attempt in range(max_retries):
                try:
                    response = client.models.generate_images(
                        model="imagen-3.0-generate-002",
                        prompt=prompt,
                        config=types.GenerateImagesConfig(
                            number_of_images=1,
                            output_mime_type="image/png",
                            aspect_ratio="1:1",
                            person_generation="ALLOW_ALL",
                            safety_filter_level="BLOCK_ONLY_HIGH",
                            include_rai_reason=True
                        )
                    )
                    break  # Success!
                except Exception as e:
                    err_str = str(e).lower()
                    if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                        # Exponential backoff
                        sleep_time = backoff_base * (2 ** attempt)
                        print(f"  ⚠️ Rate limited (429/Quota). Retrying in {sleep_time}s... (Attempt {attempt+1}/{max_retries})")
                        time.sleep(sleep_time)
                    else:
                        raise e
            else:
                # If we exhausted retries and didn't get a response
                print(f"  ❌ Error: Exhausted all {max_retries} retries for card_{card_id} due to rate limits.")
                continue

            if not response or not response.generated_images:
                print(f"  ⚠️ Warning: Imagen returned empty response for card_{card_id}.")
                continue

            generated_image_obj = response.generated_images[0]
            if not generated_image_obj.image or not generated_image_obj.image.image_bytes:
                filter_reason = getattr(generated_image_obj, "rai_filtered_reason", "No reason provided")
                print(f"  ⚠️ Warning: Imagen image was filtered/blocked for card_{card_id}. Reason: {filter_reason}")
                continue

            # Load image bytes
            img_bytes = generated_image_obj.image.image_bytes
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
