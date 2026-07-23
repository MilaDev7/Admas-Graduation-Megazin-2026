# Admas University Mekanisa Campus — 2026 Digital Yearbook

Static, zero-build, image-based magazine viewer. No frameworks, no bundler,
no backend. Runs from a QR code straight into the browser.

## Folder structure

```
yearbook/
├── index.html            # markup + all UI panels
├── manifest.json          # PWA metadata (add-to-homescreen)
├── sw.js                  # service worker: shell cache + image runtime cache
├── css/
│   └── style.css          # all styling, themes, animations
├── js/
│   └── app.js              # all viewer logic (~1 file, no dependencies)
├── images/
│   ├── pages/page-001.jpg … page-307.jpg    # full-size page images
│   └── thumbs/page-001.jpg … page-307.jpg   # thumbnail rail images
├── scripts/
│   ├── generate_demo_images.py   # regenerates the placeholder demo set
│   └── optimize_images.py        # batch-converts YOUR real scans
└── README.md
```

**Right now, `images/` is filled with 307 placeholder graphics** (page
number + department label) so you can test every feature — navigation,
thumbnails, bookmarks, category/department jump, dark mode — before you
have real photos.

## Swapping in the real 307 scans

1. Put your raw scans in one folder, named so they **sort in the correct
   page order** (`001.jpg`, `002.jpg`, … or however your scanner exports
   them).
2. Run:
   ```bash
   pip install pillow
   python3 scripts/optimize_images.py /path/to/raw_scans
   ```
   This resizes each to a web-friendly height (max 1000px), re-encodes as
   quality-78 progressive JPEG, and generates matching thumbnails —
   overwriting the placeholder set in `images/pages` and `images/thumbs`.
3. If your final page count isn't exactly 307, update `TOTAL_PAGES` in
   `js/app.js` (line 5) and the page ranges in the `CATALOG` object
   (lines ~13–31) to match your actual department boundaries.

## Running locally

No build step. Just serve the folder (opening `index.html` directly via
`file://` will break the service worker and fetch calls):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

## Deployment

### GitHub Pages
```bash
git init
git add .
git commit -m "Yearbook launch"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```
Then: repo **Settings → Pages → Source: `main` branch, `/ (root)`**. Your
site publishes at `https://<you>.github.io/<repo>/`.

### Netlify
Drag the `yearbook/` folder onto https://app.netlify.com/drop — done, no
config needed. Or connect the GitHub repo for auto-deploys on push.

### Vercel
```bash
npm i -g vercel
vercel --prod
```
Static site, no framework preset needed — Vercel will serve it as-is.

### QR code
Point the QR code at whatever URL the host gives you
(`https://your-site.netlify.app/`). Deep-linking to a specific page works
too: `https://your-site.netlify.app/?page=41`.

## Known trade-offs (read before you assume something is missing)

- **Page transition is a slide/crossfade, not a 3D page-curl.** A real
  curl effect (like Turn.js) needs paired page spreads and a heavier JS
  library — for single scanned images on mobile it adds weight for a
  cosmetic win. If you want the curl effect specifically, say so and I'll
  wire in a page-flip library, but budget for a bigger JS payload and more
  jank on low-end Android phones.
- **Bookmarks are per-device (localStorage).** They are not synced to an
  account or server. Clearing browser data clears bookmarks. That's the
  correct trade-off for a no-backend static site — a synced version needs
  a database and auth.
- **Service worker caches at most 80 images** (`MAX_IMAGE_ENTRIES` in
  `sw.js`) to keep mobile storage bounded. Increase it if you want more of
  the 307 pages available offline, at the cost of more device storage.
