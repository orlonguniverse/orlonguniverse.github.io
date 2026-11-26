
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

function updateProgress() {

  const reader = document.getElementById("chapterText");
  const progressBar = document.getElementById("progressBar");

  if (!reader || !progressBar) return;

  const readerTop =
    window.scrollY + reader.getBoundingClientRect().top;

  const readerHeight = reader.offsetHeight;

  const availableScroll = readerHeight - window.innerHeight;

  let progress = 0;

  if (availableScroll > 0) {

    progress =
      ((window.scrollY - readerTop) / availableScroll) * 100;

  } else if (window.scrollY >= readerTop) {

    progress = 100;

  }

  progress = Math.max(0, Math.min(100, progress));

  progressBar.style.width = progress + "%";

}


// =====================================
// 7. LOAD SAVED SETTINGS
// =====================================

const savedTheme = localStorage.getItem("edenTheme") || "dark";

applyTheme(savedTheme);

const chapterText = document.getElementById("chapterText");

if (chapterText) {
  chapterText.style.fontSize = fontSize + "px";
}


// =====================================
// 8. EVENT LISTENERS
// =====================================

window.addEventListener("scroll", updateProgress, { passive: true });

window.addEventListener("resize", updateProgress);

window.addEventListener("load", updateProgress);
