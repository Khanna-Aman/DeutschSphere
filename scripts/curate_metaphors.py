#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
curate_metaphors.py — Level A2 Decoupled Metaphor Lookahead Curation
Reads the remaining Level A2 vocabulary wordlist and queries gemini-2.5-flash
to pre-curate SOTA 3D visual metaphors for any word not covered in METAPHOR_MAP.
Saves and caches results to a2/curated_metaphors.json.
"""

import os
import sys
import json
import re
import time
import argparse

# Set working directory to project root
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPTS_DIR)
sys.path.append(SCRIPTS_DIR)

# Load METAPHOR_MAP from generate_assets
try:
    from generate_assets import METAPHOR_MAP
except ImportError:
    print("⚠️ Warning: Could not import METAPRAP_MAP from generate_assets.py directly.")
    METAPHOR_MAP = {}

# Import google-genai SDK
try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


def load_env_variables():
    """Load env keys from .env in project root if not already in system env."""
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

    # Configure GCP Vertex Credentials if specified
    gac = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if gac and not os.path.isabs(gac):
        gac_abs = os.path.abspath(os.path.join(PROJECT_ROOT, gac))
        if os.path.exists(gac_abs):
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = gac_abs


def is_covered_by_metaphor_map(word_de, word_en):
    """Checks if a word is already covered by the hardcoded METAPHOR_MAP."""
    de_exact = word_de.lower().strip()
    de_clean = re.sub(r'^(der|die|das)\s+', '', word_de.lower()).strip()
    en_clean = word_en.lower().strip()
    en_sub = re.sub(r'\(.*?\)', '', en_clean).strip()
    
    keys_to_try = [
        f"{de_exact} ({en_clean})",
        f"{de_clean} ({en_clean})",
        f"{de_exact} ({en_sub})",
        f"{de_clean} ({en_sub})",
        de_exact,
        de_clean
    ]
    for key in keys_to_try:
        if key in METAPHOR_MAP:
            return True
            
    # Check stripped version
    de_exact_strip = de_exact.rstrip('-')
    de_clean_strip = de_clean.rstrip('-')
    keys_to_try_strip = [
        f"{de_exact_strip} ({en_clean})",
        f"{de_clean_strip} ({en_clean})",
        f"{de_exact_strip} ({en_sub})",
        f"{de_clean_strip} ({en_sub})",
        de_exact_strip,
        de_clean_strip
    ]
    for key in keys_to_try_strip:
        if key in METAPHOR_MAP:
            return True
            
    return False


SYSTEM_PROMPT = """You are an elite, senior creative director specializing in educational linguistics and premium 3D digital art assets.
Your task is to generate highly creative, intuitive, 100% wordless (zero text, letters, or characters) 3D visual metaphors for German vocabulary words.

For each vocabulary word, formulate a beautiful, single-focus 3D visual metaphor that perfectly captures the semantic essence of the word.
Guidelines for visual metaphors:
1. **Completely Wordless**: Never use text, labels, numbers, or letters in the visual metaphor. For abstract verbs or concepts, use metaphorical objects. (e.g. for "buchen" (to book), use a golden translucent calendar with a checkmarked glossy ticket, rather than writing the word "RESERVATION").
2. **Premium 3D Claymation/Glossy Style**: The visual must represent a SOTA 3D game asset made from high-gloss enamel, translucent glowing glassmorphism, or soft-touch resin, floating on a pitch-black studio backdrop.
3. **Single Core Focus**: Focus on a single central object/metaphor (e.g. a cozy cuckoo clock for 'aus', a glowing checkmarked calendar for 'ab'). Avoid busy scenes, backgrounds, or multiple disconnected elements.
4. **No characters/figures unless necessary**: If a person/character is needed (e.g. for a verb), specify a "cute, stylized 3D toy character" performing a simple, clear action.

You will be given a JSON list of German words, their word classes, English translations, and example sentences.
You must return a JSON object mapping the German headword to a brief, highly-descriptive 3D visual metaphor prompt string.
Do NOT include the surrounding base style wrapper (like 'A masterfully rendered... Isolated asset...'); just provide the raw visual metaphor object description (usually 10-25 words).

Example Input:
[
  {"id": 181, "german": "die Cafeteria", "english": "cafeteria", "word_class": "Nomen", "example_de": "Ich gehe jetzt in die Cafeteria."},
  {"id": 183, "german": "chatten", "english": "to chat (online)", "word_class": "Verb", "example_de": "Luis chattet gern mit seinen Freunden."}
]

Example Output:
{
  "die Cafeteria": "A stylized high-gloss 3D espresso machine next to a miniature ceramic cup with glowing warm translucent steam trails",
  "chatten": "A stylized glossy 3D chat bubble in neon pink with a glowing translucent heart symbol nested inside, floating at an energetic angle"
}
"""


def main():
    parser = argparse.ArgumentParser(description="German Metaphor Bulk Lookahead Curator")
    parser.add_argument("--level", type=str, default="a2", choices=["a1", "a2", "b1"], help="CEFR Level")
    parser.add_argument("--batch-size", type=int, default=30, help="Number of words to process per API call")
    parser.add_argument("--model", type=str, default="gemini-2.5-flash", help="Gemini Text Model to use")
    args = parser.parse_args()

    print("=========================================================")
    print("🧠 DECOUPLED METAPHOR LOOKAHEAD CURATOR STARTED 🧠")
    print(f"Target Level: {args.level.upper()}")
    print(f"Batch Size:   {args.batch_size}")
    print(f"Model:        {args.model}")
    print("=========================================================")

    if not GENAI_AVAILABLE:
        print("❌ Error: 'google-genai' library is not available. Please install it.")
        sys.exit(1)

    load_env_variables()

    # Instantiate Gemini client
    use_vertex = bool(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")) or bool(os.environ.get("GCP_PROJECT"))
    if use_vertex:
        gcp_project = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")
        if not gcp_project:
            print("❌ Error: GCP_PROJECT is not set in environment or .env file when using Vertex AI.")
            sys.exit(1)
        gcp_location = os.environ.get("GCP_LOCATION") or "us-central1"
        key_file_display = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") or "None (Using Local Application Default Credentials via gcloud)"
        print(f"📡 Using Google Cloud Vertex AI (Project: {gcp_project}, Location: {gcp_location}, Credentials: {key_file_display})")
        client = genai.Client(vertexai=True, project=gcp_project, location=gcp_location)
    else:
        if not os.environ.get("GEMINI_API_KEY"):
            print("❌ Error: Neither GEMINI_API_KEY, GCP_PROJECT, nor GOOGLE_APPLICATION_CREDENTIALS is set.")
            sys.exit(1)
        client = genai.Client()
        print("📡 Using Google AI Studio Mode")

    # Paths
    level_dir = os.path.join(PROJECT_ROOT, args.level)
    json_path = os.path.join(level_dir, "wordlist.json")
    curated_json_path = os.path.join(level_dir, "curated_metaphors.json")

    if not os.path.exists(json_path):
        print(f"❌ Error: Wordlist not found at {json_path}")
        sys.exit(1)

    with open(json_path, "r", encoding="utf-8") as f:
        wordlist = json.load(f)

    # Load existing curated metaphors if any
    curated_map = {}
    if os.path.exists(curated_json_path):
        try:
            with open(curated_json_path, "r", encoding="utf-8") as f:
                curated_map = json.load(f)
            print(f"Loaded {len(curated_map)} existing curated metaphors from cache.")
        except Exception as e:
            print(f"⚠️ Warning: Could not parse {curated_json_path}, starting fresh. Error: {e}")

    # Determine which words need curation
    to_curate = []
    skipped_completed = 0
    skipped_mapped = 0
    skipped_cached = 0

    for item in wordlist:
        german = item.get("german")
        english = item.get("english")
        card_id = item.get("id")
        if not german or not card_id:
            continue

        # Skip if already generated WebP file
        webp_filename = f"card_{card_id}.webp"
        webp_path = os.path.join(level_dir, "images", webp_filename)
        if os.path.exists(webp_path):
            skipped_completed += 1
            continue

        # Skip if in cache
        if german in curated_map:
            skipped_cached += 1
            continue

        # Skip if already covered by METAPHOR_MAP
        if is_covered_by_metaphor_map(german, english):
            skipped_mapped += 1
            continue

        to_curate.append({
            "id": card_id,
            "german": german,
            "english": english,
            "word_class": item.get("word_class", "Andere"),
            "example_de": item.get("example_de", "")
        })

    print(f"Wordlist Analysis:")
    print(f"  - Already generated WebP: {skipped_completed}")
    print(f"  - Already cached in curated_metaphors.json: {skipped_cached}")
    print(f"  - Covered by hardcoded METAPHOR_MAP: {skipped_mapped}")
    print(f"  - Requiring active curation: {len(to_curate)}")
    print("=========================================================")

    if not to_curate:
        print("🎉 No new words require metaphor curation! Cache is fully populated.")
        sys.exit(0)

    # Partition curation into batches to prevent output truncation and token exhaustion
    batches = [to_curate[i:i + args.batch_size] for i in range(0, len(to_curate), args.batch_size)]
    print(f"Split {len(to_curate)} words into {len(batches)} batches of up to {args.batch_size} words.")

    success_count = 0
    for batch_index, batch in enumerate(batches):
        print(f"\n[Batch {batch_index+1}/{len(batches)}] Sending {len(batch)} words to {args.model}...")
        
        # Format batch as clean, compact JSON to send in context
        input_data = []
        for x in batch:
            input_data.append({
                "id": x["id"],
                "german": x["german"],
                "english": x["english"],
                "word_class": x["word_class"],
                "example_de": x["example_de"]
            })
        
        user_prompt = f"Please generate high-gloss 3D visual metaphors for the following words:\n{json.dumps(input_data, indent=2, ensure_ascii=False)}"

        max_attempts = 4
        success = False
        for attempt in range(max_attempts):
            try:
                # Query text model
                response = client.models.generate_content(
                    model=args.model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_PROMPT,
                        response_mime_type="application/json",
                        temperature=0.2,
                    )
                )

                # Parse response
                if not response or not response.text:
                    raise ValueError("Received empty text response from Gemini.")

                batch_result = json.loads(response.text)
                if not isinstance(batch_result, dict):
                    raise ValueError("Gemini response is not a valid JSON dictionary.")

                # Clean and insert into our central map
                for german_word, metaphor_string in batch_result.items():
                    # Clean metaphor string of any base wrappers (just in case model added them)
                    clean_metaphor = metaphor_string.strip()
                    curated_map[german_word] = clean_metaphor
                    success_count += 1

                # Incremental Save to protect progress
                with open(curated_json_path, "w", encoding="utf-8") as f:
                    json.dump(curated_map, f, indent=2, ensure_ascii=False)

                print(f"  ✅ Successfully curated and saved {len(batch_result)} words in this batch!")
                success = True
                break

            except Exception as e:
                err_lower = str(e).lower()
                if "429" in err_lower or "resource_exhausted" in err_lower or "quota" in err_lower:
                    sleep_time = 30 * (attempt + 1)
                    print(f"  ⚠️ Rate limited (429). Sleeping {sleep_time}s... (Attempt {attempt+1}/{max_attempts})")
                    time.sleep(sleep_time)
                else:
                    print(f"  ⚠️ Attempt {attempt+1} failed with error: {e}")
                    time.sleep(10)

        if not success:
            print(f"  ❌ Error: Failed to process batch starting with ID {batch[0]['id']} after {max_attempts} attempts.")
            time.sleep(10)

        # Minor cooling delay between text batches
        time.sleep(2.0)

    print("\n=========================================================")
    print(f"🎉 Curation complete! Total cached metaphors: {len(curated_map)} (+{success_count} added)")
    print(f"Curation JSON saved to: {curated_json_path}")
    print("=========================================================")


if __name__ == "__main__":
    main()
