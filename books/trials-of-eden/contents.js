/*
The contents page reads all Parts and chapters from chapters.js.
Add and organise chapters in chapters.js; this file updates itself.
*/
function renderBookContents() {
  const container = document.getElementById("bookContents");
  if (!container) return;
  const parts = window.EDEN_PARTS || [];
  const chapters = window.EDEN_CHAPTERS || [];
  const visibleChapters = window.getVisibleEdenChapters
    ? window.getVisibleEdenChapters()
    : chapters;
  const special = window.EDEN_BOOK_SECTIONS || {};
  container.innerHTML = "";

  if (special.prologue && special.prologue.enabled) renderSpecialSection(container, special.prologue);

  parts.forEach(part => {
    const entries = visibleChapters.filter(chapter => chapter.partId === part.id);

    // Do not display Parts that have no visible chapters yet.
    if (!entries.length) return;

    const section = document.createElement("section");
    section.className = "part-section";
    const heading = document.createElement("div");
    heading.className = "part-heading";
    const title = document.createElement("h2");
    title.textContent = part.title;
    const count = document.createElement("span");
    count.className = "part-count";
    count.textContent = entries.length ? entries.length + (entries.length === 1 ? " CHAPTER" : " CHAPTERS") : "CHAPTERS TO BE ADDED";
    heading.append(title, count);
    section.appendChild(heading);

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "part-empty";
      empty.textContent = "Chapters for this Part will appear here.";
      section.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "contents-chapter-list";
      entries.forEach(chapter => {
        const item = document.createElement(chapter.available ? "a" : "div");
        item.className = "contents-chapter " + (chapter.available ? "is-available" : "is-unavailable");
        if (chapter.available) {
          item.href = "index.html?chapter=" + encodeURIComponent(chapter.id);
          item.setAttribute("aria-label", "Read " + chapter.number + ": " + chapter.title);
        } else {
          item.setAttribute("aria-disabled", "true");
        }
        const details = document.createElement("div");
        details.className = "contents-chapter-details";
        const number = document.createElement("span");
        number.className = "contents-chapter-number";
        number.textContent = chapter.number;
        const name = document.createElement("span");
        name.className = "contents-chapter-title";
        name.textContent = chapter.title;
        details.append(number, name);
        const status = document.createElement("span");
        status.className = "contents-chapter-status";
        status.textContent = chapter.available ? "READ CHAPTER" : (chapter.accessLocked ? "SPECIAL ACCESS REQUIRED" : "COMING SOON");
        item.append(details, status);
        list.appendChild(item);
      });
      section.appendChild(list);
    }
    container.appendChild(section);
  });

  if (special.epilogue && special.epilogue.enabled) renderSpecialSection(container, special.epilogue);

  const first = chapters.find(chapter => chapter.available);
  const start = document.getElementById("startReading");
  if (start && first) {
    start.href = "index.html?chapter=" + encodeURIComponent(first.id);
    start.textContent = "START READING";
    start.classList.remove("is-disabled");
    start.removeAttribute("aria-disabled");
  }
}

function renderSpecialSection(container, entry) {
  const section = document.createElement("section");
  section.className = "part-section special-section";
  const heading = document.createElement("div");
  heading.className = "part-heading";
  const title = document.createElement("h2");
  title.textContent = entry.title;
  const label = document.createElement("span");
  label.className = "part-count";
  label.textContent = entry.available ? "AVAILABLE" : "COMING SOON";
  heading.append(title, label);
  section.appendChild(heading);
  const item = document.createElement(entry.available ? "a" : "div");
  item.className = "contents-chapter " + (entry.available ? "is-available" : "is-unavailable");
  if (entry.available) item.href = "index.html?chapter=" + encodeURIComponent(entry.id);
  const number = document.createElement("span");
  number.className = "contents-chapter-number";
  number.textContent = entry.number;
  const status = document.createElement("span");
  status.className = "contents-chapter-status";
  status.textContent = entry.available ? "READ SECTION" : "COMING SOON";
  item.append(number, status);
  section.appendChild(item);
  container.appendChild(section);
}

function applyContentsTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  document.body.classList.toggle("dark", theme !== "light");
  const button = document.getElementById("contentsThemeButton");
  if (button) button.textContent = theme === "light" ? "DARK MODE" : "LIGHT MODE";
  localStorage.setItem("edenTheme", theme);
}
function toggleContentsTheme() {
  applyContentsTheme(document.body.classList.contains("light") ? "dark" : "light");
}
applyContentsTheme(localStorage.getItem("edenTheme") || "dark");
renderBookContents();
