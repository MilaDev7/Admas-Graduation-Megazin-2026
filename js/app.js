"use strict";

/* ============================================================
   CONFIG
   ============================================================ */
const TOTAL_PAGES = 307;
const PAGES_PATH = "images/pages/";
const THUMBS_PATH = "images/thumbs/";
const PRELOAD_RADIUS = 2; // how many pages ahead/behind to warm the cache
const BOOKMARK_KEY = "admas2026_bookmarks";
const THEME_KEY = "admas2026_theme";

const CATALOG = {
  degree: {
    label: "Degree",
    introPage: 9,
    departments: [
      { name: "Accounting", start: 10, end: 38 },
      { name: "Business Management", start: 40, end: 40 },
      { name: "Computer Science", start: 41, end: 62 },
      { name: "Marketing", start: 64, end: 65 },
    ],
  },
  tevt: {
    label: "TEVT / Diploma",
    introPage: 66,
    departments: [
      { name: "Accounting", start: 67, end: 102 },
      { name: "HNS", start: 104, end: 161 },
      { name: "Marketing", start: 163, end: 303 },
    ],
  },
};

function pad(n) { return String(n).padStart(3, "0"); }
function pageImg(n) { return `${PAGES_PATH}page-${pad(n)}.jpg`; }
function thumbImg(n) { return `${THUMBS_PATH}page-${pad(n)}.jpg`; }
function clampPage(n) { return Math.min(TOTAL_PAGES, Math.max(1, n)); }

/* ============================================================
   STATE
   ============================================================ */
let currentPage = 1;
let activeLayer = "a"; // which <img> layer is currently on top
let isAnimating = false;
let bookmarks = loadBookmarks();
const preloadedCache = new Set();

/* ============================================================
   DOM REFS
   ============================================================ */
const el = {
  pageA: document.getElementById("pageA"),
  pageB: document.getElementById("pageB"),
  stageLoading: document.getElementById("stageLoading"),
  stage: document.getElementById("stage"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  currentPageLabel: document.getElementById("currentPageLabel"),
  totalPageLabel: document.getElementById("totalPageLabel"),
  bookmarkFab: document.getElementById("bookmarkFab"),
  categorySelect: document.getElementById("categorySelect"),
  departmentSelect: document.getElementById("departmentSelect"),
  pageJumpForm: document.getElementById("pageJumpForm"),
  pageJumpInput: document.getElementById("pageJumpInput"),
  thumbsToggle: document.getElementById("thumbsToggle"),
  thumbsPanel: document.getElementById("thumbsPanel"),
  thumbGrid: document.getElementById("thumbGrid"),
  bookmarksToggle: document.getElementById("bookmarksToggle"),
  bookmarksPanel: document.getElementById("bookmarksPanel"),
  bookmarkList: document.getElementById("bookmarkList"),
  scrim: document.getElementById("scrim"),
  darkToggle: document.getElementById("darkToggle"),
};

el.totalPageLabel.textContent = TOTAL_PAGES;
el.pageJumpInput.max = TOTAL_PAGES;

/* ============================================================
   THEME
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
  const theme = saved || (prefersLight ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", theme);
}
el.darkToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_KEY, next);
});
initTheme();

/* ============================================================
   BOOKMARKS
   ============================================================ */
function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}
function saveBookmarks() {
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
  } catch {
    /* localStorage unavailable (private mode / quota) - fail silently, bookmarks stay in-memory */
  }
}
function isBookmarked(n) { return bookmarks.includes(n); }
function toggleBookmark(n) {
  if (isBookmarked(n)) {
    bookmarks = bookmarks.filter((p) => p !== n);
  } else {
    bookmarks.push(n);
    bookmarks.sort((a, b) => a - b);
  }
  saveBookmarks();
  renderBookmarkFab();
  renderBookmarkList();
}
function renderBookmarkFab() {
  const active = isBookmarked(currentPage);
  el.bookmarkFab.classList.toggle("is-bookmarked", active);
  el.bookmarkFab.setAttribute("aria-pressed", String(active));
}
function renderBookmarkList() {
  if (bookmarks.length === 0) {
    el.bookmarkList.innerHTML = '<p class="empty-state">No saved pages yet. Tap the ribbon icon on any page to save it here.</p>';
    return;
  }
  el.bookmarkList.innerHTML = "";
  bookmarks.forEach((n) => {
    const row = document.createElement("div");
    row.className = "bookmark-row";
    row.innerHTML = `
      <img src="${thumbImg(n)}" alt="" loading="lazy" />
      <button class="go" data-page="${n}">Page ${n}</button>
      <button class="remove" data-remove="${n}" aria-label="Remove page ${n} from saved">&times;</button>
    `;
    el.bookmarkList.appendChild(row);
  });
}
el.bookmarkFab.addEventListener("click", () => toggleBookmark(currentPage));
el.bookmarkList.addEventListener("click", (e) => {
  const goBtn = e.target.closest("[data-page]");
  const rmBtn = e.target.closest("[data-remove]");
  if (goBtn) {
    goToPage(Number(goBtn.dataset.page));
    closeAllPanels();
  } else if (rmBtn) {
    toggleBookmark(Number(rmBtn.dataset.remove));
  }
});

/* ============================================================
   VIEWER RENDERING
   ============================================================ */
function preloadPage(n) {
  if (n < 1 || n > TOTAL_PAGES || preloadedCache.has(n)) return;
  const img = new Image();
  img.src = pageImg(n);
  preloadedCache.add(n);
}
function warmNeighbors(n) {
  for (let i = n - PRELOAD_RADIUS; i <= n + PRELOAD_RADIUS; i++) preloadPage(i);
}

let transitionCounter = 0;

function renderPage(n, direction) {
  const incoming = activeLayer === "a" ? el.pageB : el.pageA;
  const outgoing = activeLayer === "a" ? el.pageA : el.pageB;

  el.stageLoading.classList.remove("is-hidden");

  const src = pageImg(n);
  const allClasses = ["is-active", "enter-from-right", "enter-from-left", "exit-to-left", "exit-to-right",
    "zoom-enter", "zoom-exit", "slide-up-enter", "slide-up-exit"];
  incoming.classList.remove(...allClasses);
  outgoing.classList.remove(...allClasses);
  incoming.alt = `Yearbook page ${n} of ${TOTAL_PAGES}`;

  transitionCounter++;
  const useZoom = transitionCounter % 3 === 0;

  const finish = () => {
    el.stageLoading.classList.add("is-hidden");

    if (direction === "next") {
      if (useZoom) {
        incoming.classList.add("zoom-enter");
        outgoing.classList.add("zoom-exit");
      } else {
        incoming.classList.add("enter-from-right");
        outgoing.classList.add("exit-to-left");
      }
    } else if (direction === "prev") {
      if (useZoom) {
        incoming.classList.add("zoom-enter");
        outgoing.classList.add("zoom-exit");
      } else {
        incoming.classList.add("enter-from-left");
        outgoing.classList.add("exit-to-right");
      }
    } else {
      incoming.classList.add("zoom-enter");
    }

    void incoming.offsetWidth;
    incoming.classList.add("is-active");
    incoming.classList.remove("enter-from-right", "enter-from-left", "zoom-enter", "slide-up-enter");
    outgoing.classList.remove("is-active");

    activeLayer = activeLayer === "a" ? "b" : "a";
    isAnimating = false;
  };

  if (incoming.src.endsWith(src)) {
    finish();
  } else {
    incoming.onload = finish;
    incoming.onerror = () => {
      el.stageLoading.classList.add("is-hidden");
      incoming.alt = `Page ${n} image not found`;
      finish();
    };
    incoming.src = src;
  }
}

function updateMedallion(n) {
  el.currentPageLabel.textContent = n;
}
function updateNavButtons(n) {
  el.prevBtn.disabled = n <= 1;
  el.nextBtn.disabled = n >= TOTAL_PAGES;
}
function updateURL(n) {
  const url = new URL(window.location.href);
  url.searchParams.set("page", n);
  window.history.replaceState({}, "", url);
}
function updateActiveThumb(n) {
  const prev = el.thumbGrid.querySelector(".thumb-item.is-active");
  if (prev) prev.classList.remove("is-active");
  const next = el.thumbGrid.querySelector(`[data-thumb="${n}"]`);
  if (next) {
    next.classList.add("is-active");
    next.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}
function updateDropdownsForPage(n) {
  // Reflect which category/department the current page falls into, without
  // triggering another jump (temporarily strip the change listeners' effect
  // by just setting .value directly - no event fires from that).
  let matchedCat = "";
  let matchedDept = "";
  for (const [key, cat] of Object.entries(CATALOG)) {
    const dept = cat.departments.find((d) => n >= d.start && n <= d.end);
    if (dept || n === cat.introPage) {
      matchedCat = key;
      matchedDept = dept ? dept.name : "";
      break;
    }
  }
  el.categorySelect.value = matchedCat;
  populateDepartments(matchedCat, { silent: true });
  if (matchedDept) el.departmentSelect.value = matchedDept;
}

function goToPage(n, opts = {}) {
  n = clampPage(Math.round(n) || 1);
  if (n === currentPage && !opts.force) return;
  if (isAnimating) return;
  isAnimating = true;

  const direction = opts.direction !== undefined ? opts.direction : (n > currentPage ? "next" : "prev");
  currentPage = n;

  renderPage(n, opts.animate === false ? null : direction);
  updateMedallion(n);
  updateNavButtons(n);
  updateURL(n);
  updateActiveThumb(n);
  renderBookmarkFab();
  warmNeighbors(n);
  if (!opts.skipDropdownSync) updateDropdownsForPage(n);
}

el.prevBtn.addEventListener("click", () => goToPage(currentPage - 1, { direction: "prev" }));
el.nextBtn.addEventListener("click", () => goToPage(currentPage + 1, { direction: "next" }));

/* ============================================================
   KEYBOARD NAV
   ============================================================ */
document.addEventListener("keydown", (e) => {
  const tag = document.activeElement.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (e.key === "ArrowLeft") goToPage(currentPage - 1, { direction: "prev" });
  if (e.key === "ArrowRight") goToPage(currentPage + 1, { direction: "next" });
  if (e.key === "Escape") closeAllPanels();
});

/* ============================================================
   ZOOM + PAN + SWIPE (focal-point zoom - anchors to pointer/pinch, not top-left)
   ============================================================ */
const zoomEl = document.getElementById("stageZoom");
const zoomState = { scale: 1, x: 0, y: 0 };
const MIN_ZOOM = 1, MAX_ZOOM = 4;

function applyZoom(animate) {
  zoomEl.classList.toggle("is-panning", !animate);
  zoomEl.style.transform = `translate(${zoomState.x}px, ${zoomState.y}px) scale(${zoomState.scale})`;
}
function clampPan() {
  const rect = el.stage.getBoundingClientRect();
  const maxX = (rect.width * (zoomState.scale - 1)) / 2;
  const maxY = (rect.height * (zoomState.scale - 1)) / 2;
  zoomState.x = Math.min(maxX, Math.max(-maxX, zoomState.x));
  zoomState.y = Math.min(maxY, Math.max(-maxY, zoomState.y));
}
// Zooms to newScale while keeping the content point under (clientX, clientY)
// visually fixed in place - this is the part a plain setZoom(scale) can't do.
function zoomAt(newScale, clientX, clientY, animate = false) {
  const rect = el.stage.getBoundingClientRect();
  const s0 = zoomState.scale;
  const s1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newScale));
  if (s1 === s0) return;
  // position of the anchor point relative to the stage's own center
  // (transform-origin is centered, so this is the frame our math must use)
  const localX = clientX - rect.left - rect.width / 2;
  const localY = clientY - rect.top - rect.height / 2;
  const ratio = s1 / s0;
  zoomState.x = localX * (1 - ratio) + zoomState.x * ratio;
  zoomState.y = localY * (1 - ratio) + zoomState.y * ratio;
  zoomState.scale = s1;
  if (s1 === 1) { zoomState.x = 0; zoomState.y = 0; }
  clampPan();
  applyZoom(animate);
}
function resetZoom() { zoomState.scale = 1; zoomState.x = 0; zoomState.y = 0; applyZoom(true); }

function stageCenter() {
  const rect = el.stage.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// Reset zoom whenever the page actually changes
const _goToPage = goToPage;
goToPage = function (...args) { resetZoom(); return _goToPage(...args); };

(function enableTouchAndWheel() {
  let mode = null; // "swipe" | "pan" | "pinch"
  let startX = 0, startY = 0, startPanX = 0, startPanY = 0;
  let pinchStartDist = 0, pinchStartScale = 1;
  let lastTapTime = 0;

  function dist(t1, t2) {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }
  function midpoint(t1, t2) {
    return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
  }

  el.stage.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) {
      mode = "pinch";
      pinchStartDist = dist(e.touches[0], e.touches[1]);
      pinchStartScale = zoomState.scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      const t = e.touches[0];
      if (now - lastTapTime < 300) {
        zoomAt(zoomState.scale > 1 ? 1 : 2.2, t.clientX, t.clientY, true);
        mode = null;
      } else if (zoomState.scale > 1) {
        mode = "pan";
        startX = t.clientX; startY = t.clientY;
        startPanX = zoomState.x; startPanY = zoomState.y;
      } else {
        mode = "swipe";
        startX = t.clientX; startY = t.clientY;
      }
      lastTapTime = now;
    }
  }, { passive: true });

  el.stage.addEventListener("touchmove", (e) => {
    if (mode === "pinch" && e.touches.length === 2) {
      // Recompute the anchor from the CURRENT finger midpoint every frame,
      // so the image stays glued under your fingers as they move, not just
      // at the spot they started the pinch.
      const newDist = dist(e.touches[0], e.touches[1]);
      const mid = midpoint(e.touches[0], e.touches[1]);
      zoomAt(pinchStartScale * (newDist / pinchStartDist), mid.x, mid.y, false);
    } else if (mode === "pan" && e.touches.length === 1) {
      zoomState.x = startPanX + (e.touches[0].clientX - startX);
      zoomState.y = startPanY + (e.touches[0].clientY - startY);
      clampPan();
      applyZoom(false);
    }
  }, { passive: true });

  el.stage.addEventListener("touchend", (e) => {
    if (mode === "swipe") {
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const THRESHOLD = 45;
      if (Math.abs(dx) > THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.3) {
        if (dx < 0) goToPage(currentPage + 1, { direction: "next" });
        else goToPage(currentPage - 1, { direction: "prev" });
      }
    }
    mode = null;
  }, { passive: true });

  // Desktop: mouse wheel zooms toward the cursor position, double-click zooms toward click point
  el.stage.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(zoomState.scale - e.deltaY * 0.0025, e.clientX, e.clientY, false);
  }, { passive: false });

  el.stage.addEventListener("dblclick", (e) => {
    zoomAt(zoomState.scale > 1 ? 1 : 2.2, e.clientX, e.clientY, true);
  });
})();

/* ============================================================
   PAGE JUMP FORM
   ============================================================ */
el.pageJumpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const val = Number(el.pageJumpInput.value);
  if (val) { goToPage(val, { animate: false }); el.pageJumpInput.value = ""; el.pageJumpInput.blur(); }
});
el.pageJumpInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); el.pageJumpForm.requestSubmit(); }
});

/* ============================================================
   CATEGORY / DEPARTMENT DROPDOWNS
   ============================================================ */
function populateDepartments(catKey, opts = {}) {
  const cat = CATALOG[catKey];
  el.departmentSelect.innerHTML = "";
  if (!cat) {
    el.departmentSelect.disabled = true;
    el.departmentSelect.innerHTML = '<option value="">Select category first</option>';
    return;
  }
  el.departmentSelect.disabled = false;
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = "All departments";
  el.departmentSelect.appendChild(blank);
  cat.departments.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.name;
    opt.textContent = `${d.name} (p.${d.start}${d.end !== d.start ? "-" + d.end : ""})`;
    el.departmentSelect.appendChild(opt);
  });
  if (!opts.silent && !opts.keepJump) {
    goToPage(cat.introPage, { animate: false });
  }
}

el.categorySelect.addEventListener("change", () => {
  const key = el.categorySelect.value;
  if (!key) {
    el.departmentSelect.disabled = true;
    el.departmentSelect.innerHTML = '<option value="">Select category first</option>';
    return;
  }
  populateDepartments(key);
});

el.departmentSelect.addEventListener("change", () => {
  const catKey = el.categorySelect.value;
  const cat = CATALOG[catKey];
  if (!cat) return;
  const dept = cat.departments.find((d) => d.name === el.departmentSelect.value);
  if (dept) goToPage(dept.start, { animate: false });
  else goToPage(cat.introPage, { animate: false });
});

/* ============================================================
   THUMBNAIL SIDEBAR (lazy-loaded via IntersectionObserver)
   ============================================================ */
function buildThumbnailGrid() {
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= TOTAL_PAGES; n++) {
    const btn = document.createElement("button");
    btn.className = "thumb-item";
    btn.type = "button";
    btn.dataset.thumb = n;
    btn.setAttribute("aria-label", `Open page ${n}`);
    btn.innerHTML = `<img data-src="${thumbImg(n)}" alt="" /><span class="thumb-item-num">${n}</span>`;
    frag.appendChild(btn);
  }
  el.thumbGrid.appendChild(frag);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const img = entry.target.querySelector("img[data-src]");
        if (img) {
          img.src = img.dataset.src;
          img.onload = () => img.classList.add("is-loaded");
          img.removeAttribute("data-src");
        }
        observer.unobserve(entry.target);
      }
    });
  }, { root: el.thumbGrid, rootMargin: "200px 0px" });

  el.thumbGrid.querySelectorAll(".thumb-item").forEach((item) => observer.observe(item));
}
el.thumbGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".thumb-item");
  if (btn) { goToPage(Number(btn.dataset.thumb), { animate: false }); closeAllPanels(); }
});

/* ============================================================
   SIDE PANELS OPEN / CLOSE
   ============================================================ */
function openPanel(panelEl, toggleBtn) {
  panelEl.classList.add("is-open");
  panelEl.setAttribute("aria-hidden", "false");
  toggleBtn.setAttribute("aria-expanded", "true");
  el.scrim.classList.add("is-visible");
}
function closeAllPanels() {
  [el.thumbsPanel, el.bookmarksPanel].forEach((p) => {
    p.classList.remove("is-open");
    p.setAttribute("aria-hidden", "true");
  });
  el.thumbsToggle.setAttribute("aria-expanded", "false");
  el.bookmarksToggle.setAttribute("aria-expanded", "false");
  el.scrim.classList.remove("is-visible");
}
el.thumbsToggle.addEventListener("click", () => {
  const isOpen = el.thumbsPanel.classList.contains("is-open");
  closeAllPanels();
  if (!isOpen) openPanel(el.thumbsPanel, el.thumbsToggle);
});
el.bookmarksToggle.addEventListener("click", () => {
  const isOpen = el.bookmarksPanel.classList.contains("is-open");
  closeAllPanels();
  if (!isOpen) openPanel(el.bookmarksPanel, el.bookmarksToggle);
});
el.scrim.addEventListener("click", closeAllPanels);
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeAllPanels());
});

/* ============================================================
   INIT
   ============================================================ */
function getInitialPage() {
  const params = new URLSearchParams(window.location.search);
  const fromURL = Number(params.get("page"));
  if (fromURL >= 1 && fromURL <= TOTAL_PAGES) return fromURL;
  return 1;
}

function init() {
  buildThumbnailGrid();
  renderBookmarkList();
  const start = getInitialPage();
  goToPage(start, { animate: false, force: true });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        /* offline caching is a nice-to-have; ignore registration failures (e.g. file:// protocol) */
      });
    });
  }
}
init();
