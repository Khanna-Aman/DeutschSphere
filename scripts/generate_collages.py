import os
import re
import json
import argparse
from PIL import Image, ImageDraw, ImageFont

def generate_collages(level="a2"):
    level_lower = level.lower()
    level_upper = level_lower.upper()
    print("=========================================================")
    # Format success headers to avoid Unicode emoji print crashes on CP1252 Windows shells
    print(f"[START] COMPILING LEVEL {level_upper} COLLAGE SHEETS [START]")
    print("=========================================================")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    
    level_dir = os.path.join(project_root, level_lower)
    images_dir = os.path.join(level_dir, "images")
    collages_dir = os.path.join(level_dir, "collages")
    os.makedirs(collages_dir, exist_ok=True)
    
    if not os.path.exists(images_dir):
        print(f"Error: {images_dir} does not exist.")
        return
    
    # Find all card webp files
    pattern = re.compile(r"card_(\d+)\.webp")
    image_files = []
    for f in os.listdir(images_dir):
        m = pattern.match(f)
        if m:
            card_id = int(m.group(1))
            image_files.append((card_id, os.path.join(images_dir, f)))

    # Sort images by Card ID
    image_files.sort(key=lambda x: x[0])
    total_images = len(image_files)
    print(f"Found {total_images} Level {level_upper} WebP files on disk to process.")

    if total_images == 0:
        print("No WebP files found to compile. Exiting.")
        return

    # Collage configuration
    cols = 15
    rows = 20
    cell_size = 150  # 150x150px per card thumbnail
    items_per_sheet = cols * rows  # 300 images per sheet

    # Calculate total sheets
    total_sheets = (total_images + items_per_sheet - 1) // items_per_sheet
    print(f"Creating {total_sheets} collage sheets ({cols}x{rows} grid, up to {items_per_sheet} cards per sheet).")

    # Font handling
    font = None
    try:
        # Try loading a standard Windows system font
        font = ImageFont.truetype("arial.ttf", 14)
    except IOError:
        # Fallback to default
        font = ImageFont.load_default()

    for sheet_idx in range(total_sheets):
        start_idx = sheet_idx * items_per_sheet
        end_idx = min(start_idx + items_per_sheet, total_images)
        sheet_images = image_files[start_idx:end_idx]

        # Sheet dimensions
        sheet_w = cols * cell_size
        sheet_h = rows * cell_size
        collage_img = Image.new("RGB", (sheet_w, sheet_h), (0, 0, 0))
        draw = ImageDraw.Draw(collage_img)

        for idx, (card_id, img_path) in enumerate(sheet_images):
            grid_col = idx % cols
            grid_row = idx // cols
            
            x = grid_col * cell_size
            y = grid_row * cell_size

            try:
                with Image.open(img_path) as img:
                    # Resize to fit grid cell using high quality LANCZOS
                    thumb = img.convert("RGBA").resize((cell_size, cell_size), Image.Resampling.LANCZOS)
                    # Paste into collage sheet
                    collage_img.paste(thumb, (x, y), thumb)
            except Exception as e:
                print(f"Warning: Failed to load card {card_id} image at {img_path}: {e}")
                # Draw a placeholder red box for failed load
                draw.rectangle([x, y, x + cell_size - 1, y + cell_size - 1], fill=(40, 10, 10), outline=(255, 0, 0))

            # Draw cell border
            draw.rectangle([x, y, x + cell_size - 1, y + cell_size - 1], outline=(30, 30, 30), width=1)

            # Draw Card ID text in bottom right corner
            text_str = f"#{card_id}"
            # Calculate text box size
            if hasattr(draw, 'textbbox'):
                text_bbox = draw.textbbox((0, 0), text_str, font=font)
                text_w = text_bbox[2] - text_bbox[0]
                text_h = text_bbox[3] - text_bbox[1]
            else:
                text_w, text_h = draw.textsize(text_str, font=font) if hasattr(draw, 'textsize') else (30, 12)

            tx = x + cell_size - text_w - 6
            ty = y + cell_size - text_h - 6
            
            # Semi-transparent dark background block behind the ID text for high legibility
            draw.rectangle([tx - 4, ty - 2, x + cell_size - 2, y + cell_size - 2], fill=(0, 0, 0, 180))
            draw.text((tx, ty), text_str, fill=(240, 240, 240), font=font)

        # Save collage sheet
        sheet_num = sheet_idx + 1
        output_filename = f"{level_lower}_collage_sheet_{sheet_num}.webp"
        output_filepath = os.path.join(collages_dir, output_filename)
        
        try:
            collage_img.save(output_filepath, "WEBP", quality=85)
            # Display absolute file paths inside standard Markdown links as specified in guidelines
            print(f"[SUCCESS] Saved Sheet {sheet_num}/{total_sheets}: Range #{sheet_images[0][0]}-#{sheet_images[-1][0]} -> {level_lower}/collages/{output_filename}")
        except Exception as e:
            print(f"Error saving sheet {sheet_num}: {e}")

    print("=========================================================")
    print(f"[SUCCESS] ALL {level_upper} COLLAGE SHEETS COMPILED SUCCESSFULLY!")
    print("=========================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile Level Collage Sheets")
    parser.add_argument("--level", type=str, default="a2", help="CEFR Level (a1, a2, b1)")
    args = parser.parse_args()
    generate_collages(level=args.level)
