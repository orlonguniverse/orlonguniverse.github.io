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
  fontSize = Math.max(13, Math.min(23, fontSize + amount));
  const reader = document.getElementById("chapterText");
  if (reader) reader.style.fontSize = fontSize + "px";
  localStorage.setItem("edenFontSize", fontSize);
}

function toggleFocus() {
  document.body.classList.toggle("focus-mode");
}

function toggleCompanion() {
  const companion = document.getElementById("companion");
  if (companion) companion.classList.toggle("companion-hidden");
}

function showCompanion(category) {
  const panel = document.getElementById("companionContent");
  if (!panel) return;
  const content = {
    characters: ["CHARACTER REFERENCES", "Character information connected to this chapter will appear here."],
    locations: ["LOCATION REFERENCES", "Locations and places mentioned in this chapter will appear here."],
    notes: ["AUTHOR NOTES", "Additional commentary from Callum Macann will appear here."]
  }[category];
  if (content) panel.innerHTML = "<h3>" + content[0] + "</h3><p>" + content[1] + "</p>";
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
  window.EDEN_CHAPTERS.forEach(chapter => {
    const item = document.createElement(chapter.available ? "a" : "div");
    item.className = "chapter-item" + (chapter.id === currentChapter ? " active" : "");
    if (chapter.available) item.href = "?chapter=" + encodeURIComponent(chapter.id);
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
    previous.disabled = index <= 0;
    previous.onclick = () => {
      if (index > 0) window.location.href = "?chapter=" + encodeURIComponent(chapters[index - 1].id);
    };
  }
  if (next) {
    next.disabled = index < 0 || index >= chapters.length - 1;
    next.onclick = () => {
      if (index >= 0 && index < chapters.length - 1) window.location.href = "?chapter=" + encodeURIComponent(chapters[index + 1].id);
    };
  }
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
  target.innerHTML = '<p class="placeholder">Loading chapter...</p>';

  try {
    const response = await fetch(chapterUrl(chapter.id));
    if (!response.ok) throw new Error("Chapter file could not be loaded.");
    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, "text/html");
    const chapterDocument = parsed.querySelector(".chapter-document");
    if (!chapterDocument) throw new Error("Chapter file is missing its chapter-document wrapper.");

    target.innerHTML = chapterDocument.innerHTML;
    const heading = target.querySelector(".chapter-heading h2");
    const number = target.querySelector(".chapter-heading .chapter-number");
    if (heading) document.title = heading.textContent + " | The Trials of Eden";
    if (number) number.textContent = chapter.number.toUpperCase();

    const reader = document.getElementById("chapterText");
    if (reader) reader.style.fontSize = fontSize + "px";
    chapterTotalWords = reader && reader.innerText.trim() ? reader.innerText.trim().split(/\s+/).length : 0;

    renderChapterDirectory();
    updateChapterNavigation();
    restoreReadingPosition();
    updateProgress();
  } catch (error) {
    console.error(error);
    target.innerHTML = '<p class="placeholder">We could not load this chapter. Please refresh the page and try again.</p>';
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

const initialReader = document.getElementById("chapterText");
if (initialReader) initialReader.style.fontSize = fontSize + "px";

// The script is loaded after the HTML controls, so they can be connected here.
setReadingWidgetState();

const pinButton = document.getElementById("pinReadingWidget");
const collapseButton = document.getElementById("collapseReadingWidget");

if (pinButton) pinButton.addEventListener("click", toggleReadingWidgetPin);
if (collapseButton) collapseButton.addEventListener("click", toggleReadingWidgetCollapse);

window.addEventListener("scroll", () => {
  updateProgress();
  saveReadingProgress();
}, { passive: true });

window.addEventListener("resize", updateProgress);

// Build the chapter menu and load the selected chapter.
renderChapterDirectory();
updateChapterNavigation();
loadChapter(getChapterIdFromUrl());
