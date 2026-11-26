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
