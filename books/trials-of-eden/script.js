
// =====================================
// THE TRIALS OF EDEN — READING ROOM
// Interactive features and preferences
// =====================================


// =====================================
// 1. READER PREFERENCES
// =====================================

let fontSize = Number(localStorage.getItem("edenFontSize")) || 16;


// =====================================
// 2. THEME SETTINGS
// =====================================

function applyTheme(theme) {

  document.body.classList.remove("dark", "light");
  document.body.classList.add(theme);

  const button = document.getElementById("themeButton");

  if (button) {
    button.textContent =
      theme === "light" ? "DARK MODE" : "LIGHT MODE";
  }

  localStorage.setItem("edenTheme", theme);
}


function toggleTheme() {

  const newTheme =
    document.body.classList.contains("dark") ? "light" : "dark";

  applyTheme(newTheme);
}


// =====================================
// 3. FONT SIZE
// =====================================

function changeFontSize(amount) {

  fontSize += amount;

  fontSize = Math.max(13, Math.min(23, fontSize));

  const chapterText = document.getElementById("chapterText");

  if (chapterText) {
    chapterText.style.fontSize = fontSize + "px";
  }

  localStorage.setItem("edenFontSize", fontSize);
}


// =====================================
// 4. FOCUS MODE
// =====================================

function toggleFocus() {

  document.body.classList.toggle("focus-mode");

}


// =====================================
// 5. READING COMPANION
// =====================================

function toggleCompanion() {

  const companion = document.getElementById("companion");

  if (companion) {
    companion.classList.toggle("companion-hidden");
  }

}


function showCompanion(category) {

  const panel = document.getElementById("companionContent");

  if (!panel) return;

  if (category === "characters") {

    panel.innerHTML = `
      <h3>CHARACTER REFERENCES</h3>
      <p>
        Character information connected to this chapter
        will appear here.
      </p>
    `;

  } else if (category === "locations") {

    panel.innerHTML = `
      <h3>LOCATION REFERENCES</h3>
      <p>
        Locations and places mentioned in this chapter
        will appear here.
      </p>
    `;

  } else if (category === "notes") {

    panel.innerHTML = `
      <h3>AUTHOR NOTES</h3>
      <p>
        Additional commentary from Callum Macann
        will appear here.
      </p>
    `;

  }

}



// =====================================
// 6. READING PROGRESS
// =====================================

let chapterTotalWords = null;

function updateProgress() {

  const reader = document.getElementById("chapterText");
  const progressBar = document.getElementById("progressBar");

  const progressFill = document.getElementById("chapterProgressFill");
  const progressPercent = document.getElementById("chapterProgressPercent");
  const readingTime = document.getElementById("readingTimeRemaining");
  const wordCountDisplay = document.getElementById("chapterWordCount");
  const progressTrack = document.getElementById("chapterProgressTrack");

  if (!reader) return;

  // Find the chapter's position and dimensions.
  const readerTop =
    window.scrollY + reader.getBoundingClientRect().top;

  const readerHeight = reader.offsetHeight;

  const availableScroll = readerHeight - window.innerHeight;

  let progress = 0;

  // Calculate progress through the chapter.
  if (availableScroll > 0) {

    progress =
      ((window.scrollY - readerTop) / availableScroll) * 100;

  } else if (reader.getBoundingClientRect().bottom <= window.innerHeight) {

    progress = 100;

  }

  // Keep progress between 0 and 100.
  progress = Math.max(0, Math.min(100, progress));

  const percentage = Math.round(progress);

  // Update the thin progress bar at the top.
  if (progressBar) {
    progressBar.style.width = percentage + "%";
  }

  // Update the larger chapter progress panel.
  if (progressFill) {
    progressFill.style.width = percentage + "%";
  }

  if (progressPercent) {
    progressPercent.textContent = percentage + "% COMPLETE";
  }

  if (progressTrack) {
    progressTrack.setAttribute("aria-valuenow", percentage);
  }

  // Calculate the chapter's word count only once.
if (chapterTotalWords === null) {

  const text = reader.innerText.trim();

  chapterTotalWords = text
    ? text.split(/\s+/).length
    : 0;

}

const totalWords = chapterTotalWords;

if (wordCountDisplay) {
  wordCountDisplay.textContent =
    totalWords.toLocaleString() + " WORDS";
}

  // Estimate remaining reading time.
  const remainingWords = Math.ceil(
    totalWords * (1 - progress / 100)
  );

  const minutesRemaining = remainingWords / 220;

  if (readingTime) {

    if (percentage >= 100 || totalWords === 0) {

      readingTime.textContent =
        totalWords === 0 ? "No chapter text yet" : "CHAPTER COMPLETE";

    } else if (minutesRemaining < 1) {

      readingTime.textContent =
        "Less than a minute remaining";

    } else {

      readingTime.textContent =
        "~" + Math.ceil(minutesRemaining) + " MIN REMAINING";

    }

  }

}


// =====================================
// 7. SAVED READING PROGRESS & BOOKMARKS
// =====================================

// Each chapter gets its own saved position.
const chapterId = "chapter-one";

const progressKey = "edenProgress_" + chapterId;
const bookmarkKey = "edenBookmark_" + chapterId;


// Automatically save the reader's current position.
function saveReadingProgress() {

  localStorage.setItem(progressKey, window.scrollY);

  const status = document.getElementById("readingStatus");

  if (status) {
    status.textContent = "YOUR READING PROGRESS IS SAVED";
  }

}


// Restore the reader's previous position.
function restoreReadingProgress() {

  const savedPosition = Number(localStorage.getItem(progressKey));

  if (savedPosition > 0) {

    window.scrollTo({
      top: savedPosition,
      behavior: "auto"
    });

    const status = document.getElementById("readingStatus");

    if (status) {
      status.textContent = "YOUR PREVIOUS READING POSITION HAS BEEN RESTORED";
    }

  }

  updateProgress();

}


// Save a specific bookmark.
function saveBookmark() {

  localStorage.setItem(bookmarkKey, window.scrollY);

  const status = document.getElementById("readingStatus");

  if (status) {
    status.textContent = "BOOKMARK SAVED SUCCESSFULLY";
  }

}


// Return to the saved bookmark.
function goToBookmark() {

  const bookmark = localStorage.getItem(bookmarkKey);

  const status = document.getElementById("readingStatus");

  if (bookmark === null) {

    if (status) {
      status.textContent = "YOU HAVEN'T SAVED A BOOKMARK YET";
    }

    return;
  }

  window.scrollTo({
    top: Number(bookmark),
    behavior: "smooth"
  });

}


// =====================================
// 8. LOAD SAVED SETTINGS
// =====================================

const savedTheme = localStorage.getItem("edenTheme") || "dark";

applyTheme(savedTheme);

const chapterText = document.getElementById("chapterText");

if (chapterText) {
  chapterText.style.fontSize = fontSize + "px";
}


// =====================================
// 9. EVENT LISTENERS
// =====================================

// Update progress and save position while scrolling.
window.addEventListener("scroll", function() {

  updateProgress();
  saveReadingProgress();

}, { passive: true });

window.addEventListener("resize", updateProgress);

// Restore progress when the page has finished loading.
window.addEventListener("load", restoreReadingProgress);
