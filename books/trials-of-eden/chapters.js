/*
============================================================
THE TRIALS OF EDEN — BOOK STRUCTURE
============================================================

THIS FILE CONTROLS BOTH the Reading Room chapter menu and
the Book Contents page.

HOW TO ADD A CHAPTER
1. Create a new HTML file inside the "chapters" folder.
2. Copy the layout from chapter-01.html.
3. Rename it to match the id below.
   Example: id "chapter-08" = chapters/chapter-08.html
4. Change the chapter number, title and manuscript.
5. Add an entry to EDEN_CHAPTERS under the correct Part.
6. Set available: true when the chapter is ready to read.

HOW TO ADD A NEW PART
1. Add a Part object to EDEN_PARTS below.
2. Give it a unique id, e.g. "part-11".
3. Set each new chapter's partId to that Part id.
4. The Contents page will group those chapters automatically.

OPTIONAL PROLOGUE / EPILOGUE
Change enabled: false to enabled: true in EDEN_BOOK_SECTIONS.
Create prologue.html or epilogue.html in the chapters folder,
then add its entry to EDEN_CHAPTERS using partId
"front-matter" or "back-matter".

IMPORTANT: ids must be unique, lowercase and hyphenated.
The id must match the HTML filename without ".html".
Use commas between entries.
============================================================
*/

// THE TEN PARTS OF THE BOOK
window.EDEN_PARTS = [
  { id: "part-01", title: "Part One" },
];

// OPTIONAL OPENING / CLOSING SECTIONS
window.EDEN_BOOK_SECTIONS = {
  prologue: { enabled: true, id: "prologue", number: "Prologue", title: "Prologue", partId: "front-matter", available: false },
  epilogue: { enabled: false, id: "epilogue", number: "Epilogue", title: "Epilogue", partId: "back-matter", available: false }
};

// CHAPTERS — PART ONE CURRENTLY HAS CHAPTERS 01–07.
// Add future chapters below and set the correct partId.
window.EDEN_CHAPTERS = [
  /*
    COMPANION REFERENCES — HOW TO ADD ONE
    Add objects inside companionTerms. Example:
    { id: "maya-garcia", term: "Maya Garcia", category: "CHARACTER",
      description: "Write a short, spoiler-safe explanation here." }

    Then wrap the matching manuscript word/name in chapter-01.html:
    <button type="button" class="companion-trigger" data-companion-term="maya-garcia">Maya Garcia</button>

    The data-companion-term id MUST match the id below.
    All entries automatically appear in the Companion's reference list.
  */
   
   {
  id: "maya-garcia",
  term: "Maya Garcia",
  category: "CHARACTER",
  description: "The protagonist of the story."
   }
   
  { id: "chapter-01", number: "Chapter 01", title: "Your Chapter Title", partId: "part-01", available: true, companionTerms: [
    // ADD THIS CHAPTER'S REFERENCES HERE.
    // { id: "maya-garcia", term: "Maya Garcia", category: "CHARACTER", description: "Your description here." }
  ] },
  { id: "chapter-02", number: "Chapter 02", title: "Chapter title to be added", partId: "part-01", available: false },
  { id: "chapter-03", number: "Chapter 03", title: "Chapter title to be added", partId: "part-01", available: false },
  { id: "chapter-04", number: "Chapter 04", title: "Chapter title to be added", partId: "part-01", available: false },
  { id: "chapter-05", number: "Chapter 05", title: "Chapter title to be added", partId: "part-01", available: false },
  { id: "chapter-06", number: "Chapter 06", title: "Chapter title to be added", partId: "part-01", available: false },
  { id: "chapter-07", number: "Chapter 07", title: "Chapter title to be added", partId: "part-01", available: false }

  // ADD NEW CHAPTERS ABOVE THIS LINE.
  // Example for Chapter 08 in Part Two:
  // { id: "chapter-08", number: "Chapter 08", title: "Your title", partId: "part-02", available: false }
];
