/*
============================================================
THE TRIALS OF EDEN — CHAPTER DIRECTORY
============================================================

HOW TO ADD A CHAPTER
1. Create a new HTML file inside the "chapters" folder.
2. Name it to match the id below, followed by .html.
   Example: id "chapter-04" needs "chapter-04.html".
3. Copy the layout from chapter-01.html into your new file.
4. Replace its chapter number, title and manuscript text.
5. Add a new entry to the list below.
6. Set available: true when you want readers to access it.

HOW TO HIDE A CHAPTER
Set available: false. It appears as "Not yet released"
and readers cannot open it.

IMPORTANT
- Keep every id unique.
- Use lowercase letters and hyphens in ids.
- Put a comma after each entry except the final entry.
============================================================
*/

window.EDEN_CHAPTERS = [
  // ========================================================
  // CHAPTER 01
  // File: chapters/chapter-01.html
  // ========================================================
  {
    id: "chapter-01",              // Must match the HTML filename
    number: "Chapter 01",           // Label shown in the menu
    title: "Your Chapter Title",    // Actual chapter title
    available: true                 // true = readers can open it
  },

  // ========================================================
  // CHAPTER 02 — FUTURE CHAPTER EXAMPLE
  // Create: chapters/chapter-02.html
  // ========================================================
  {
    id: "chapter-02",
    number: "Chapter 02",
    title: "Coming Soon",
    available: false
  },

  // ========================================================
  // CHAPTER 03 — FUTURE CHAPTER EXAMPLE
  // Create: chapters/chapter-03.html
  // ========================================================
  {
    id: "chapter-03",
    number: "Chapter 03",
    title: "Coming Soon",
    available: false
  }

  // ADD NEW CHAPTER ENTRIES ABOVE THIS LINE.
];
