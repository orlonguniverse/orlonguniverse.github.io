// =====================================
// THE TRIALS OF EDEN — READING ROOM
// Shared reader, chapter loading and preferences
// =====================================

const BOOK_ID = "trials-of-eden";
const DEFAULT_CHAPTER = "chapter-01";
const WORDS_PER_MINUTE = 220;

let fontSize = Number(localStorage.getItem("edenFontSize")) || 16;
let currentChapter = null;
let chapterTotalWords = 0;
let latestProgress = 0;


// =====================================
// 1. THEME, TYPE AND READER SETTINGS
// Only settings with a direct, visible effect are offered.
// =====================================

function applyTheme(theme) {
  document.body.classList.remove("dark", "light");
  document.body.classList.add(theme);
  const button = document.getElementById("themeButton");
  if (button) button.textContent = theme === "light" ? "DARK MODE" : "LIGHT MODE";
  localStorage.setItem("edenTheme", theme);
}

function toggleTheme() {
  applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
}

function changeFontSize(amount) {
  applyReaderSize(fontSize + amount);
}

function applyReaderTheme(theme) {
  const valid = ["classic", "paper", "sepia", "midnight"];
  const selected = valid.includes(theme) ? theme : "classic";
  document.body.dataset.readerTheme = selected;
  const control = document.getElementById("readerThemeSelect");
  if (control) control.value = selected;
  localStorage.setItem("edenReaderTheme", selected);
}

function applyReaderFont(font) {
  const valid = ["literary", "atkinson", "arial", "lora"];
  const selected = valid.includes(font) ? font : "literary";
  document.body.dataset.readerFont = selected;
  const control = document.getElementById("readerFontSelect");
  if (control) control.value = selected;
  localStorage.setItem("edenReaderFont", selected);
}

function applyReaderSize(value) {
  const size = Math.max(14, Math.min(30, Number(value) || 16));
  fontSize = size;
  document.body.style.setProperty("--reader-font-size", size + "px");
  const slider = document.getElementById("readerTextSize");
  const label = document.getElementById("readerTextSizeValue");
  if (slider) slider.value = String(size);
  if (label) label.textContent = size + "px";
  localStorage.setItem("edenFontSize", String(size));
}

function toggleFocus() {
  const active = document.body.classList.toggle("focus-mode");
  const button = document.getElementById("readingFocusButton");
  if (button) button.textContent = active ? "EXIT FOCUS MODE" : "ENTER FOCUS MODE";
  const exit = document.querySelector(".focus-exit");
  if (exit) exit.setAttribute("aria-pressed", String(active));
  localStorage.setItem("edenFocusMode", String(active));
}
function toggleBookOnlyMode(force) {
  const active = typeof force === "boolean" ? force : !document.body.classList.contains("book-only-mode");
  document.body.classList.toggle("book-only-mode", active);
  localStorage.setItem("edenBookOnlyMode", String(active));
  localStorage.setItem("orlongBookOnlyMode", String(active));
  const button = document.getElementById("bookOnlyToggle");
  if (button) {
    button.textContent = active ? "EXIT BOOK-ONLY MODE" : "BOOK-ONLY MODE";
    button.setAttribute("aria-pressed", String(active));
  }
  if (active) {
    // Entering this mode should take the reader directly to the manuscript,
    // not leave them at the Reading Room introduction.
    if (window.location.hash !== "#chapter") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search + "#chapter");
    }
    document.getElementById("chapter")?.scrollIntoView({behavior:"auto",block:"start"});
  }
}
function setMobileFocusMode(active) {
  const button = document.getElementById("mobileFocusToggle");
  // Mobile Focus is temporary and independent of the site-wide Book-Only preference.
  if (active && window.matchMedia && !window.matchMedia("(max-width: 700px)").matches) return;
  if (document.body.classList.contains("book-only-mode")) active = false;
  document.body.classList.toggle("mobile-focus-mode", Boolean(active));
  if (button) {
    button.textContent = active ? "SHOW MENU" : "HIDE MENU";
    button.setAttribute("aria-pressed", String(Boolean(active)));
    button.setAttribute("aria-label", active ? "Show the Reading Room menu" : "Hide the Reading Room menu");
  }
}
function toggleMobileFocus() {
  setMobileFocusMode(!document.body.classList.contains("mobile-focus-mode"));
}
// Never leave the desktop layout with mobile-only navigation hidden after a resize.
window.addEventListener("resize", () => {
  if (window.matchMedia && !window.matchMedia("(max-width: 700px)").matches) setMobileFocusMode(false);
});
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("mobile-focus-mode")) {
    setMobileFocusMode(false);
    document.getElementById("mobileFocusToggle")?.focus();
  }
});

function toggleCompanion() {
  const companion = document.getElementById("companion");
  if (companion) companion.classList.toggle("companion-hidden");
}

function applyReferenceLinePreference(showLines) {
  document.body.classList.toggle("hide-reference-lines", !showLines);
  const toggle = document.getElementById("referenceLinesToggle");
  if (toggle) toggle.checked = showLines;
  localStorage.setItem("edenReferenceLines", String(showLines));
}



function toggleCompanion() {
  const companion = document.getElementById("companion");
  if (companion) companion.classList.toggle("companion-hidden");
}

// =====================================
// INTERACTIVE READING COMPANION
// Reference definitions live beside each chapter in chapters.js.
// =====================================
// Return the phrases that should open a Companion entry.
// If no trigger list is supplied, the entry's display term is used.
function getCompanionTriggers(reference) {
  const triggers = Array.isArray(reference.triggers) ? reference.triggers : [reference.term];
  return [...new Set(triggers.filter(trigger => typeof trigger === "string" && trigger.trim()))];
}

// Escape punctuation so trigger phrases are treated as literal text in a regular expression.
function escapeCompanionTrigger(trigger) {
  return trigger.replace(/[.*+?^$()|[\]\\{}]/g, "\\$&");
}

// Automatically turn matching manuscript phrases into Companion links.
// Longer phrases are checked first, so "Maya Garcia" is linked as one phrase
// rather than being split into "Maya" and "Garcia".
function applyChapterCompanionTriggers(chapter) {
  const reader = document.getElementById("chapterText");
  if (!reader) return [];

  const references = Array.isArray(chapter.companionTerms) ? chapter.companionTerms : [];
  const text = reader.textContent || "";
  const matchingReferences = references.filter(reference => {
    const triggers = getCompanionTriggers(reference);
    return triggers.some(trigger =>
      new RegExp("\\b" + escapeCompanionTrigger(trigger) + "\\b", "i").test(text)
    );
  });

  const triggerMap = [];
  matchingReferences.forEach(reference => {
    getCompanionTriggers(reference).forEach(trigger => {
      triggerMap.push({ trigger, id: reference.id });
    });
  });
  triggerMap.sort((a, b) => b.trigger.length - a.trigger.length);

  if (!triggerMap.length) return matchingReferences;

  const escapedTriggers = triggerMap.map(item => escapeCompanionTrigger(item.trigger));
  const matcher = new RegExp("\\b(" + escapedTriggers.join("|") + ")\\b", "gi");
  const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || parent.closest("button, a, script, style, textarea, .companion-trigger")) continue;
    matcher.lastIndex = 0;
    if (node.nodeValue && matcher.test(node.nodeValue)) textNodes.push(node);
  }

  textNodes.forEach(node => {
    const value = node.nodeValue;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    matcher.lastIndex = 0;
    let match;

    while ((match = matcher.exec(value)) !== null) {
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
      }

      const matchedPhrase = match[0];
      const reference = triggerMap.find(item => item.trigger.toLowerCase() === matchedPhrase.toLowerCase());
      if (reference) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "companion-trigger";
        button.dataset.companionTerm = reference.id;
        button.textContent = matchedPhrase;
        button.setAttribute("aria-label", "Open Companion reference: " + matchedPhrase);
        fragment.appendChild(button);
      } else {
        fragment.appendChild(document.createTextNode(matchedPhrase));
      }
      lastIndex = match.index + matchedPhrase.length;
    }

    if (lastIndex < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
    }
    node.parentNode.replaceChild(fragment, node);
  });

  return matchingReferences;
}

function renderCompanion(chapter, matchingReferences) {
  const list = document.getElementById("companionTermList");
  const details = document.getElementById("companionDetails");
  if (!list || !details) return;
  list.innerHTML = "";
  details.innerHTML = "<h3>CHAPTER REFERENCES</h3><p>Select a reference to read its description. You can also select highlighted words in the manuscript.</p>";

  const references = Array.isArray(matchingReferences) ? matchingReferences : [];
  if (!references.length) {
    const note = document.createElement("p");
    note.className = "companion-empty";
    note.textContent = "There are no companion references for this chapter yet.";
    list.appendChild(note);
    return;
  }

  references.forEach(reference => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "companion-reference-button";
    button.textContent = reference.term;
    button.dataset.companionTerm = reference.id;
    button.setAttribute("aria-label", "Show reference: " + reference.term);
    list.appendChild(button);
  });
}

function showCompanionTerm(termId) {
  const chapter = (window.EDEN_CHAPTERS || []).find(item => item.id === currentChapter);
  const details = document.getElementById("companionDetails");
  if (!chapter || !details) return;
  const reference = (chapter.companionTerms || []).find(item => item.id === termId);
  if (!reference) return;
  details.innerHTML = "";
  const category = document.createElement("span");
  category.className = "companion-category";
  category.textContent = reference.category || "CHAPTER REFERENCE";
  const heading = document.createElement("h3");
  heading.textContent = reference.term;
  const description = document.createElement("p");
  description.textContent = reference.description;
  details.append(category, heading, description);
  document.querySelectorAll(".companion-reference-button").forEach(button => {
    const selected = button.dataset.companionTerm === termId;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}


// =====================================
// 2. CHAPTER DIRECTORY AND LOADING
// =====================================

function getChapterIdFromUrl() {
  const requested = new URLSearchParams(window.location.search).get("chapter");
  return requested || DEFAULT_CHAPTER;
}

function chapterUrl(chapterId) {
  return "chapters/" + encodeURIComponent(chapterId) + ".html";
}

function renderChapterDirectory() {
  const list = document.getElementById("chapterList");
  if (!list || !Array.isArray(window.EDEN_CHAPTERS)) return;

  list.innerHTML = "";
  const visibleChapters = window.getVisibleEdenChapters
    ? window.getVisibleEdenChapters()
    : window.EDEN_CHAPTERS;
  visibleChapters.forEach(chapter => {
    const item = document.createElement(chapter.available ? "a" : "div");
    item.className = "chapter-item" + (chapter.id === currentChapter ? " active" : "");
    if (chapter.available) {
      item.href = "?chapter=" + encodeURIComponent(chapter.id);
      if (chapter.id === currentChapter) item.setAttribute("aria-current", "page");
      item.setAttribute("aria-label", chapter.number + ": " + chapter.title);
    } else {
      item.setAttribute("aria-disabled", "true");
    }
    const number = document.createElement("span");
    number.className = "chapter-number";
    number.textContent = chapter.number;
    const name = document.createElement("span");
    name.className = "chapter-name";
    name.textContent = chapter.title;
    const status = document.createElement("span");
    status.className = "chapter-status";
    status.textContent = chapter.available ? (chapter.id === currentChapter ? "Currently reading" : "Available to read") : "Not yet released";
    item.append(number, name, status);
    list.appendChild(item);
  });
}

function updateChapterNavigation() {
  const chapters = (window.EDEN_CHAPTERS || []).filter(chapter => chapter.available);
  const index = chapters.findIndex(chapter => chapter.id === currentChapter);
  const previous = document.getElementById("previousChapter");
  const next = document.getElementById("nextChapter");

  if (previous) {
    // The first available chapter has no previous chapter, so hide this control.
    previous.hidden = index <= 0;
    previous.disabled = index <= 0;
    previous.onclick = () => {
      if (index > 0) window.location.href = "?chapter=" + encodeURIComponent(chapters[index - 1].id);
    };
    if (index > 0) {
      previous.setAttribute("aria-label", "Go to previous chapter: " + chapters[index - 1].title);
    }
  }
  if (next) {
    next.disabled = index < 0 || index >= chapters.length - 1;
    next.onclick = () => {
      if (index >= 0 && index < chapters.length - 1) window.location.href = "?chapter=" + encodeURIComponent(chapters[index + 1].id);
    };
    if (index >= 0 && index < chapters.length - 1) {
      next.setAttribute("aria-label", "Go to next chapter: " + chapters[index + 1].title);
    }
  }
}

// Store chapter manuscripts in IndexedDB rather than localStorage.
// IndexedDB can hold much larger files, so full-length chapters are cached reliably.
const CHAPTER_CACHE_DATABASE = "eden-reader-chapters";
const CHAPTER_CACHE_STORE = "chapters";
let chapterCacheDatabasePromise = null;
const chapterLoadsInProgress = new Map();
const chapterMemoryCache = new Map();

function openChapterCacheDatabase() {
  if (!("indexedDB" in window)) return Promise.reject(new Error("IndexedDB is unavailable."));
  if (!chapterCacheDatabasePromise) {
    chapterCacheDatabasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(CHAPTER_CACHE_DATABASE, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(CHAPTER_CACHE_STORE)) {
          database.createObjectStore(CHAPTER_CACHE_STORE, { keyPath: "chapterId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open the chapter cache."));
    });
  }
  return chapterCacheDatabasePromise;
}

async function getCachedChapterSource(chapterId) {
  if (chapterMemoryCache.has(chapterId)) return chapterMemoryCache.get(chapterId);
  try {
    const database = await openChapterCacheDatabase();
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction(CHAPTER_CACHE_STORE, "readonly")
        .objectStore(CHAPTER_CACHE_STORE).get(chapterId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    if (record && record.source) {
      chapterMemoryCache.set(chapterId, record.source);
      return record.source;
    }
  } catch (error) {
    console.warn("IndexedDB chapter cache is unavailable; checking the older browser cache.", error);
  }

  // Migrate any earlier, smaller localStorage cache into IndexedDB.
  try {
    const legacySource = localStorage.getItem("edenChapterCache:" + chapterId);
    if (legacySource) {
      chapterMemoryCache.set(chapterId, legacySource);
      await saveCachedChapterSource(chapterId, legacySource);
      try { localStorage.removeItem("edenChapterCache:" + chapterId); } catch (_) {}
      return legacySource;
    }
  } catch (error) {
    console.warn("Could not read the older chapter cache:", error);
  }
  return null;
}

async function saveCachedChapterSource(chapterId, source) {
  chapterMemoryCache.set(chapterId, source);
  try {
    const database = await openChapterCacheDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(CHAPTER_CACHE_STORE, "readwrite");
      transaction.objectStore(CHAPTER_CACHE_STORE).put({
        chapterId,
        source,
        savedAt: Date.now()
      });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Chapter cache write was cancelled."));
    });
  } catch (error) {
    // The chapter remains readable online even if browser storage is disabled.
    console.warn("Could not save the chapter in IndexedDB:", error);
  }
}

function validateChapterSource(source) {
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const chapterDocument = parsed.querySelector(".chapter-document");
  const manuscript = chapterDocument?.querySelector("#chapterText, .chapter-text");
  const manuscriptText = manuscript?.textContent.trim() || "";

  // Read optional quiz data from this chapter's private Supabase HTML file.
  window.EDEN_ACTIVE_CHAPTER_QUIZ = null;
  const quizElement = chapterDocument?.querySelector("#chapterQuizData");
  if (quizElement) {
    try {
      window.EDEN_ACTIVE_CHAPTER_QUIZ = JSON.parse(quizElement.textContent);
    } catch (error) {
      console.error("This chapter's quiz data contains invalid JSON:", error);
    }
    quizElement.remove();
  }
  if (!chapterDocument || !manuscript || !manuscriptText ||
      manuscriptText.includes("Your first paragraph goes here.") ||
      manuscriptText.includes("Your second paragraph goes here.") ||
      manuscriptText.includes("Your third paragraph goes here.")) {
    throw new Error("The chapter file is incomplete or still contains the blank template text.");
  }
  return source;
}

async function downloadChapterSource(chapterId) {
  const { data, error } = await window.engagementClient.storage
    .from("eden-chapters").download(chapterId + ".html");
  if (error || !data) throw error || new Error("This chapter has not been uploaded to the private reading library yet.");
  return validateChapterSource(await data.text());
}

// Refresh cached content quietly. The current reading session is never interrupted.
async function refreshChapterCache(chapter) {
  if (chapterLoadsInProgress.has(chapter.id)) return chapterLoadsInProgress.get(chapter.id);
  const task = (async () => {
    try {
      const freshSource = await downloadChapterSource(chapter.id);
      await saveCachedChapterSource(chapter.id, freshSource);
    } catch (error) {
      console.warn("Background chapter refresh was skipped:", error);
    } finally {
      chapterLoadsInProgress.delete(chapter.id);
    }
  })();
  chapterLoadsInProgress.set(chapter.id, task);
  return task;
}

// Preload the next released chapter during browser idle time, never in the reader's critical path.
function preloadNextChapter(chapterId) {
  const chapters = (window.EDEN_CHAPTERS || []).filter(item => item.available);
  const index = chapters.findIndex(item => item.id === chapterId);
  const nextChapter = index >= 0 ? chapters[index + 1] : null;
  if (!nextChapter || chapterLoadsInProgress.has(nextChapter.id)) return;

  const preload = async () => {
    const cached = await getCachedChapterSource(nextChapter.id);
    if (cached || chapterLoadsInProgress.has(nextChapter.id)) return;
    await refreshChapterCache(nextChapter);
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(preload, { timeout: 2500 });
  } else {
    window.setTimeout(preload, 1200);
  }
}

function renderChapterSource(source, chapter) {
  const target = document.getElementById("chapterContent");
  const parsed = new DOMParser().parseFromString(source, "text/html");
  const chapterDocument = parsed.querySelector(".chapter-document");
  const manuscript = chapterDocument?.querySelector("#chapterText, .chapter-text");
  const manuscriptText = manuscript?.textContent.trim() || "";
  if (!chapterDocument || !manuscript || !manuscriptText ||
      manuscriptText.includes("Your first paragraph goes here.") ||
      manuscriptText.includes("Your second paragraph goes here.") ||
      manuscriptText.includes("Your third paragraph goes here.")) {
    throw new Error("This chapter still contains the blank template text. Replace the sample paragraphs with your manuscript, then upload the finished HTML again.");
  }

  target.innerHTML = chapterDocument.innerHTML;
  const heading = target.querySelector(".chapter-heading h2");
  const number = target.querySelector(".chapter-heading .chapter-number");
  if (heading) document.title = heading.textContent + " | The Trials of Eden";
  if (number) number.textContent = chapter.number.toUpperCase();

  const reader = document.getElementById("chapterText");
  applyReaderSize(localStorage.getItem("edenFontSize") || 16);
  applyReaderFont(localStorage.getItem("edenReaderFont") || "literary");
  chapterTotalWords = reader && reader.innerText.trim() ? reader.innerText.trim().split(/\s+/).length : 0;

  const part = (window.EDEN_PARTS || []).find(item => item.id === chapter.partId);
  const partLabel = document.getElementById("currentPartLabel");
  if (partLabel) partLabel.textContent = part ? part.title.toUpperCase() : "BOOK SECTION";

  const matchingReferences = applyChapterCompanionTriggers(chapter);
  renderCompanion(chapter, matchingReferences);
  renderChapterDirectory();
  updateChapterNavigation();
  restoreReadingPosition();
  updateProgress();
}

async function loadChapter(chapterId) {
  const chapter = (window.EDEN_CHAPTERS || []).find(item => item.id === chapterId && item.available);
  const target = document.getElementById("chapterContent");
  if (!target) return;

  if (!chapter) {
    target.innerHTML = '<p class="placeholder">This chapter is not available yet.</p>';
    return;
  }

  currentChapter = chapter.id;
  if (!window.engagementClient || !window.engagementUser) {
    target.innerHTML = '<p class="placeholder">Please sign in to read this chapter.</p>';
    return;
  }

  target.innerHTML = '<p class="placeholder">Opening your chapter...</p>';
  let cachedSource = null;
  try {
    cachedSource = await getCachedChapterSource(chapter.id);
  } catch (error) {
    console.warn("Could not read the saved chapter:", error);
  }
  if (currentChapter !== chapter.id) return;

  if (cachedSource) {
    try {
      renderChapterSource(cachedSource, chapter);
      // Show the saved copy immediately. Network refresh and next-chapter preload
      // happen separately and never delay the reading experience.
      refreshChapterCache(chapter);
      preloadNextChapter(chapter.id);
      return;
    } catch (cacheError) {
      console.warn("The saved chapter copy was invalid; fetching a fresh copy.", cacheError);
    }
  }

  try {
    const freshSource = await downloadChapterSource(chapter.id);
    await saveCachedChapterSource(chapter.id, freshSource);
    if (currentChapter !== chapter.id) return;
    renderChapterSource(freshSource, chapter);
    preloadNextChapter(chapter.id);
  } catch (error) {
    console.error("The Trials of Eden chapter could not be loaded:", error);
    if (currentChapter !== chapter.id) return;
    const message = document.createElement("p");
    message.className = "placeholder";
    message.textContent = error && error.message
      ? "CHAPTER NOT LOADED: " + error.message
      : "We could not load this chapter. Please refresh the page and try again.";
    target.replaceChildren(message);
  }
}

// =====================================
// 3. LIVE CHAPTER READING PROGRESS
// =====================================

function getChapterProgress() {
  const reader = document.getElementById("chapterText");
  if (!reader || chapterTotalWords === 0) return 0;

  const rect = reader.getBoundingClientRect();
  // Measure how much of the text has passed a reading line 65% down the screen.
  const readingLine = window.innerHeight * 0.65;
  const progress = ((readingLine - rect.top) / Math.max(rect.height, 1)) * 100;
  return Math.max(0, Math.min(100, progress));
}

function updateProgress() {
  const reader = document.getElementById("chapterText");
  if (!reader) return;

  latestProgress = getChapterProgress();
  const percentage = Math.round(latestProgress);
  const remainingWords = Math.ceil(chapterTotalWords * (1 - latestProgress / 100));
  const minutesRemaining = Math.ceil(remainingWords / WORDS_PER_MINUTE);

  const topBar = document.getElementById("progressBar");
  if (topBar) topBar.style.width = percentage + "%";

  const fill = document.getElementById("widgetProgressFill");
  const percent = document.getElementById("widgetProgressPercent");
  const time = document.getElementById("widgetTimeRemaining");
  const track = document.getElementById("widgetProgressTrack");

  if (fill) fill.style.width = percentage + "%";
  if (percent) percent.textContent = percentage + "%";
  if (time) {
    time.textContent = percentage >= 100 ? "Chapter complete" :
      (minutesRemaining < 1 ? "Less than a minute left" : "~" + minutesRemaining + " min left");
  }
  if (track) track.setAttribute("aria-valuenow", percentage);

  const status = document.getElementById("readingStatus");
  if (status && !status.dataset.manualMessage) status.textContent = "YOUR READING PROGRESS SAVES AUTOMATICALLY";
}


// =====================================
// 4. SAVED POSITIONS AND BOOKMARKS
// =====================================

function storageKey(type) {
  return BOOK_ID + "_" + currentChapter + "_" + type;
}

function saveReadingProgress() {
  if (!currentChapter) return;
  localStorage.setItem(storageKey("position"), String(window.scrollY));
}

function restoreReadingPosition() {
  if (!currentChapter) return;
  const saved = Number(localStorage.getItem(storageKey("position")) || 0);
  if (saved > 0) {
    window.scrollTo({ top: saved, behavior: "auto" });
    const status = document.getElementById("readingStatus");
    if (status) status.textContent = "YOUR PREVIOUS READING POSITION HAS BEEN RESTORED";
  }
}

function saveBookmark() {
  if (!currentChapter) return;
  localStorage.setItem(storageKey("bookmark"), String(window.scrollY));
  const status = document.getElementById("readingStatus");
  if (status) {
    status.textContent = "BOOKMARK SAVED FOR THIS CHAPTER";
    status.dataset.manualMessage = "true";
  }
}

function goToBookmark() {
  if (!currentChapter) return;
  const bookmark = localStorage.getItem(storageKey("bookmark"));
  const status = document.getElementById("readingStatus");
  if (bookmark === null) {
    if (status) status.textContent = "YOU HAVEN'T SAVED A BOOKMARK IN THIS CHAPTER";
    return;
  }
  window.scrollTo({ top: Number(bookmark), behavior: "smooth" });
  if (status) status.textContent = "RETURNING TO YOUR BOOKMARK";
}


// =====================================
// 5. FLOATING READING PANEL
// =====================================

function setReadingWidgetState() {
  const widget = document.getElementById("readingWidget");
  const pinButton = document.getElementById("pinReadingWidget");
  const collapseButton = document.getElementById("collapseReadingWidget");
  if (!widget) return;

  const pinned = localStorage.getItem("edenWidgetPinned") === "true";
  const collapsed = localStorage.getItem("edenWidgetCollapsed") === "true";
  widget.classList.toggle("is-pinned", pinned);
  widget.classList.toggle("is-collapsed", collapsed && !pinned);

  if (pinButton) {
    pinButton.classList.toggle("selected", pinned);
    pinButton.setAttribute("aria-pressed", String(pinned));
    pinButton.textContent = pinned ? "PINNED" : "PIN";
  }
  if (collapseButton) {
    collapseButton.textContent = collapsed && !pinned ? "+" : "−";
    collapseButton.setAttribute("aria-expanded", String(!(collapsed && !pinned)));
  }
}

function toggleReadingWidgetPin() {
  const pinned = localStorage.getItem("edenWidgetPinned") === "true";
  localStorage.setItem("edenWidgetPinned", String(!pinned));
  if (!pinned) localStorage.setItem("edenWidgetCollapsed", "false");
  setReadingWidgetState();
}

function toggleReadingWidgetCollapse() {
  const collapsed = localStorage.getItem("edenWidgetCollapsed") === "true";
  localStorage.setItem("edenWidgetCollapsed", String(!collapsed));
  setReadingWidgetState();
}


// =====================================
// 6. INITIALISE READER
// =====================================

const savedTheme = localStorage.getItem("edenTheme") || "dark";
applyTheme(savedTheme);

applyReaderTheme(localStorage.getItem("edenReaderTheme") || "classic");
applyReaderFont(localStorage.getItem("edenReaderFont") || "literary");
applyReaderSize(localStorage.getItem("edenFontSize") || 16);

const themeControl = document.getElementById("readerThemeSelect");
if (themeControl) themeControl.addEventListener("change", event => applyReaderTheme(event.target.value));

const fontControl = document.getElementById("readerFontSelect");
if (fontControl) fontControl.addEventListener("change", event => applyReaderFont(event.target.value));

const sizeControl = document.getElementById("readerTextSize");
if (sizeControl) sizeControl.addEventListener("input", event => applyReaderSize(event.target.value));


// The script is loaded after the HTML controls, so they can be connected here.
setReadingWidgetState();
const bookOnlyPreference = localStorage.getItem("orlongBookOnlyMode") === "true" || localStorage.getItem("edenBookOnlyMode") === "true";
toggleBookOnlyMode(bookOnlyPreference);
if (bookOnlyPreference) localStorage.setItem("orlongBookOnlyMode","true");
if (localStorage.getItem("edenFocusMode") === "true") document.body.classList.add("focus-mode");

const pinButton = document.getElementById("pinReadingWidget");
const collapseButton = document.getElementById("collapseReadingWidget");

if (pinButton) pinButton.addEventListener("click", toggleReadingWidgetPin);
if (collapseButton) collapseButton.addEventListener("click", toggleReadingWidgetCollapse);

window.addEventListener("scroll", () => {
  updateProgress();
  saveReadingProgress();
}, { passive: true });

window.addEventListener("resize", updateProgress);

// Connect highlighted manuscript words and Companion index entries.
document.addEventListener("click", event => {
  if (!(event.target instanceof Element)) return;
  const trigger = event.target.closest("[data-companion-term]");
  if (!trigger) return;

  showCompanionTerm(trigger.dataset.companionTerm);

  // If the reader selects a highlighted manuscript term, bring the
  // Companion into view so the matching reference is easy to find.
  if (trigger.closest("#chapterContent")) {
    const companion = document.getElementById("companion");
    if (companion && companion.classList.contains("companion-hidden")) {
      companion.classList.remove("companion-hidden");
    }
    if (companion) companion.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
});

// Build the chapter menu, but do not load manuscript content until Supabase confirms a signed-in session.
renderChapterDirectory();
updateChapterNavigation();
window.startEdenReader = async function (session) {
  const target = document.getElementById("chapterContent");
  if (!target) return;
  if (!session || !session.user) {
    currentChapter = null;
    chapterTotalWords = 0;
    target.innerHTML = '<div class="reader-access-gate"><h2>READER ACCOUNT REQUIRED</h2><p>The Trials of Eden chapters are available to registered readers. Sign in or create a free account to continue reading.</p><button type="button" id="readerAccessSignIn">SIGN IN / CREATE FREE ACCOUNT</button></div>';
    document.getElementById("readerAccessSignIn")?.addEventListener("click", () => document.getElementById("openAccountButton")?.click());
    updateChapterNavigation();
    return;
  }
  if (window.EDEN_STRUCTURE_READY) await window.EDEN_STRUCTURE_READY;
  renderChapterDirectory();
  updateChapterNavigation();
  loadChapter(getChapterIdFromUrl());
};
