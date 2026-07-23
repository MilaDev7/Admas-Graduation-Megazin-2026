#!/usr/bin/env python3
"""
Batch-optimizes your real scanned yearbook pages for the web.

Usage:
    pip install pillow
    python3 scripts/optimize_images.py /path/to/raw_scans

Expects raw scans named so they SORT in page order (e.g. 001.jpg, 002.jpg,
or scan1.jpg, scan2.jpg...). It renumbers them sequentially as
page-001.jpg ... page-307.jpg based on sort order - so double check the
sort order matches the real page order before running.

Produces:
    images/pages/page-XXX.jpg   (max 900px tall, quality 78 - fast mobile load)
    images/thumbs/page-XXX.jpg  (130x183, quality 60 - thumbnail rail)
"""
import os
import sys
from PIL import Image

FULL_MAX_H = 1000
THUMB_SIZE = (130, 183)

def main():
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/optimize_images.py /path/to/raw_scans")
        sys.exit(1)

    src_dir = sys.argv[1]
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pages_dir = os.path.join(root, "images", "pages")
    thumbs_dir = os.path.join(root, "images", "thumbs")
    os.makedirs(pages_dir, exist_ok=True)
    os.makedirs(thumbs_dir, exist_ok=True)

    valid_ext = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp")
    files = sorted(f for f in os.listdir(src_dir) if f.lower().endswith(valid_ext))

    if not files:
        print(f"No images found in {src_dir}")
        sys.exit(1)

    print(f"Found {len(files)} images. Renumbering as page-001 .. page-{len(files):03d}")
    confirm = input("Proceed? [y/N] ")
    if confirm.lower() != "y":
        print("Aborted.")
        sys.exit(0)

    for i, fname in enumerate(files, start=1):
        path = os.path.join(src_dir, fname)
        img = Image.open(path).convert("RGB")

        if img.height > FULL_MAX_H:
            ratio = FULL_MAX_H / img.height
            img = img.resize((int(img.width * ratio), FULL_MAX_H), Image.LANCZOS)

        out_full = os.path.join(pages_dir, f"page-{i:03d}.jpg")
        img.save(out_full, "JPEG", quality=78, optimize=True, progressive=True)

        thumb = img.copy()
        thumb.thumbnail((THUMB_SIZE[0] * 2, THUMB_SIZE[1] * 2), Image.LANCZOS)
        out_thumb = os.path.join(thumbs_dir, f"page-{i:03d}.jpg")
        thumb.save(out_thumb, "JPEG", quality=60, optimize=True)

        if i % 25 == 0 or i == len(files):
            print(f"processed {i}/{len(files)}")

    print("Done. Update TOTAL_PAGES in js/app.js if the count differs from 307.")

if __name__ == "__main__":
    main()
