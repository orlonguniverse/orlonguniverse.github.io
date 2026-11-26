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
Change enabled: false to enabled: true when you are ready
to include either section. Create its HTML file in the
chapters folder and add its entry to EDEN_CHAPTERS.

IMPORTANT: ids must be unique, lowercase and hyphenated.
The id must match the HTML filename without ".html".
Use commas between entries.
============================================================
*/

// THE TEN PARTS OF THE BOOK
window.EDEN_PARTS = [
  { id: "part-01", title: "Part One" },
  { id: "part-02", title: "Part Two" },
  { id: "part-03", title: "Part Three" },
  { id: "part-04", title: "Part Four" },
  { id: "part-05", title: "Part Five" },
  { id: "part-06", title: "Part Six" },
  { id: "part-07", title: "Part Seven" },
  { id: "part-08", title: "Part Eight" },
  { id: "part-09", title: "Part Nine" },
  { id: "part-10", title: "Part Ten" }
];

// OPTIONAL OPENING / CLOSING SECTIONS
// Keep these disabled until their pages are ready.
window.EDEN_BOOK_SECTIONS = {
  prologue: {
    enabled: false,
    id: "prologue",
    number: "Prologue",
    title: "Prologue",
    partId: "front-matter",
    available: false
  },
  epilogue: {
    enabled: false,
    id: "epilogue",
    number: "Epilogue",
    title: "Epilogue",
    partId: "back-matter",
    available: false
  }
};

// CHAPTERS — PART ONE CURRENTLY HAS CHAPTERS 01–07.
// Add future chapters below and set the correct partId.
window.EDEN_CHAPTERS = [
  /*
    COMPANION REFERENCES — HOW TO ADD ONE
    Add reference objects inside that chapter's companionTerms.
    Example:
    {
      id: "maya-garcia",
      term: "Maya Garcia",
      triggers: ["Maya", "Maya Garcia"],
      category: "CHARACTER",
      description: "Write a short, spoiler-safe explanation here."
    }

    "triggers" lists every word or phrase that should open this entry.
    The reader automatically finds and highlights these phrases in the
    chapter text, so you do not need to wrap them manually in HTML.
    The entry only appears in the Companion when a trigger is found.
  */

  {
    id: "chapter-01",
    number: "Chapter 01",
    title: "Your Chapter Title",
    partId: "part-01",
    available: true,
    companionTerms: [
      {
        id: "maya-garcia",
        term: "Maya Garcia",
        triggers: ["Maya", "Maya Garcia"],
        category: "CHARACTER",
        description: "The protagonist of the story."
      }
      {
        id: "xantheon",
        term: "Xantheon
        triggers: ["Xantheon"],
        category: "SECTION",
        description: "The section of which Eden is located within."
      }
    ]
  },
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


// DISPLAY RULE: show every released chapter plus only the next two
// unreleased chapters. This keeps the public directory concise.
window.EDEN_UNRELEASED_AHEAD = 2;
window.getVisibleEdenChapters = function () {
  const chapters = window.EDEN_CHAPTERS || [];
  let lastReleasedIndex = -1;

  chapters.forEach((chapter, index) => {
    if (chapter.available) lastReleasedIndex = index;
  });

  // If nothing has been released yet, show the first two entries.
  const lastVisibleIndex = lastReleasedIndex === -1
    ? window.EDEN_UNRELEASED_AHEAD - 1
    : lastReleasedIndex + window.EDEN_UNRELEASED_AHEAD;

  return chapters.slice(0, lastVisibleIndex + 1);
};
