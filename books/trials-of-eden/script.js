<!-- INTERACTIVE FEATURES -->

<script>

// =========================
// THEME SWITCH
// =========================

function toggleTheme() {

  const body = document.body;
  const button = document.getElementById("themeButton");

  body.classList.toggle("light");
  body.classList.toggle("dark");

  if (body.classList.contains("light")) {
    button.textContent = "DARK MODE";
  } else {
    button.textContent = "LIGHT MODE";
  }

}


// =========================
// TEXT SIZE CONTROL
// =========================

let fontSize = 16;

function changeFontSize(amount) {

  fontSize += amount;

  if (fontSize < 13) fontSize = 13;
  if (fontSize > 23) fontSize = 23;

  document.getElementById("chapterText").style.fontSize =
    fontSize + "px";

}


// =========================
// FOCUS MODE
// =========================

function toggleFocus() {

  document.body.classList.toggle("focus-mode");

}


// =========================
// READING COMPANION
// =========================

function toggleCompanion() {

  document.getElementById("companion").classList.toggle("companion-hidden");

}


function showCompanion(category) {

  const panel = document.getElementById("companionContent");

  if (category === "characters") {

    panel.innerHTML = `
      <h3>CHARACTER REFERENCES</h3>
      <p>
        Character information connected to this chapter
        will appear here.
      </p>
    `;

  }

  if (category === "locations") {

    panel.innerHTML = `
      <h3>LOCATION REFERENCES</h3>
      <p>
        Locations and places mentioned in this chapter
        will appear here.
      </p>
    `;

  }

  if (category === "notes") {

    panel.innerHTML = `
      <h3>AUTHOR NOTES</h3>
      <p>
        Additional commentary from Callum Macann
        will appear here.
      </p>
    `;

  }

}

</script>

// =========================
// READING PROGRESS
// =========================

window.addEventListener("scroll", updateProgress);

function updateProgress() {

  const reader = document.getElementById("chapterText");
  const progressBar = document.getElementById("progressBar");

  const rect = reader.getBoundingClientRect();

  const readerTop = window.scrollY + rect.top;
  const readerHeight = reader.offsetHeight;

  const availableScroll = readerHeight - window.innerHeight;

  let progress = 0;

  if (availableScroll > 0) {
    progress = ((window.scrollY - readerTop) / availableScroll) * 100;
  } else if (window.scrollY >= readerTop) {
    progress = 100;
  }

  progress = Math.max(0, Math.min(100, progress));

  progressBar.style.width = progress + "%";

}

window.addEventListener("load", updateProgress);
