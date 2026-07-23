#!/usr/bin/env python3
"""
Generates 307 placeholder yearbook page images + matching thumbnails so the
viewer is fully testable before real scanned pages are dropped in.

Run once locally if you want fresh placeholders:
    pip install pillow
    python3 scripts/generate_demo_images.py

Real deployment: delete everything in images/pages and images/thumbs and
replace with your actual scans, named page-001.jpg ... page-307.jpg
(see scripts/optimize_images.py to batch-resize + generate thumbs from
your real scans).
"""
import os
from PIL import Image, ImageDraw, ImageFont

TOTAL_PAGES = 307
FULL_SIZE = (640, 900)
THUMB_SIZE = (130, 183)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES_DIR = os.path.join(ROOT, "images", "pages")
THUMBS_DIR = os.path.join(ROOT, "images", "thumbs")
os.makedirs(PAGES_DIR, exist_ok=True)
os.makedirs(THUMBS_DIR, exist_ok=True)

SECTIONS = [
    (1, 8, "Front Matter", (11, 18, 32)),
    (9, 9, "Degree Programs", (122, 31, 43)),
    (10, 38, "Degree - Accounting", (18, 42, 78)),
    (39, 39, "Degree", (11, 18, 32)),
    (40, 40, "Degree - Business Mgmt", (18, 42, 78)),
    (41, 62, "Degree - Computer Science", (18, 42, 78)),
    (63, 63, "Degree", (11, 18, 32)),
    (64, 65, "Degree - Marketing", (18, 42, 78)),
    (66, 66, "TEVT / Diploma", (122, 31, 43)),
    (67, 102, "TEVT - Accounting", (26, 58, 46)),
    (103, 103, "TEVT", (11, 18, 32)),
    (104, 161, "TEVT - HNS", (26, 58, 46)),
    (162, 162, "TEVT", (11, 18, 32)),
    (163, 303, "TEVT - Marketing", (26, 58, 46)),
    (304, 307, "Back Matter", (11, 18, 32)),
]

def section_for(page):
    for lo, hi, label, color in SECTIONS:
        if lo <= page <= hi:
            return label, color
    return "Unassigned", (40, 40, 40)

def font(size):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

def make_page(n):
    label, color = section_for(n)
    img = Image.new("RGB", FULL_SIZE, color)
    draw = ImageDraw.Draw(img)
    gold = (201, 162, 39)
    draw.rectangle([18, 18, FULL_SIZE[0] - 18, FULL_SIZE[1] - 18], outline=gold, width=3)
    big = font(64)
    small = font(22)
    label_font = font(20)
    num_text = str(n)
    bbox = draw.textbbox((0, 0), num_text, font=big)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(((FULL_SIZE[0] - w) / 2, (FULL_SIZE[1] - h) / 2 - 20), num_text, fill=(247, 243, 234), font=big)
    sub = f"Page {n} of {TOTAL_PAGES}"
    bbox2 = draw.textbbox((0, 0), sub, font=small)
    w2 = bbox2[2] - bbox2[0]
    draw.text(((FULL_SIZE[0] - w2) / 2, (FULL_SIZE[1] / 2) + 60), sub, fill=gold, font=small)
    bbox3 = draw.textbbox((0, 0), label, font=label_font)
    w3 = bbox3[2] - bbox3[0]
    draw.text(((FULL_SIZE[0] - w3) / 2, FULL_SIZE[1] - 60), label, fill=(230, 230, 230), font=label_font)
    return img

for n in range(1, TOTAL_PAGES + 1):
    img = make_page(n)
    full_path = os.path.join(PAGES_DIR, f"page-{n:03d}.jpg")
    img.save(full_path, "JPEG", quality=72, optimize=True)
    thumb = img.resize(THUMB_SIZE, Image.LANCZOS)
    thumb_path = os.path.join(THUMBS_DIR, f"page-{n:03d}.jpg")
    thumb.save(thumb_path, "JPEG", quality=60, optimize=True)
    if n % 50 == 0 or n == TOTAL_PAGES:
        print(f"generated {n}/{TOTAL_PAGES}")

print("Done. Placeholder images written to images/pages and images/thumbs.")
