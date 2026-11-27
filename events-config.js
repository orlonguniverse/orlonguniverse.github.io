/*
ORLONG EVENTS — YOUR EVENT EDITING FILE
=======================================

To add an event:
1. Copy one of the example event objects below.
2. Paste it inside the ORLONG_EVENTS array, between the [ and ].
3. Give it a unique id using lowercase letters, numbers and hyphens.
4. Choose type: "announcement" OR "interactive".
5. Edit the title, dates, description and rewards.
6. Save and publish the file.

EVENT TYPES
- announcement: displays information and rewards. No activity buttons.
- interactive: displays activities with buttons linking readers to a page or activity.

DATES
- Use "YYYY-MM-DD" (for example "2026-12-01").
- Set startDate/endDate to null for an event without a scheduled date.
- Events are labelled UPCOMING, LIVE or ENDED automatically.
- Set published:false to hide an event without deleting it.

REWARDS
- Rewards are descriptions shown to readers, e.g. "Exclusive event card: ..."
- This Events Hub does NOT automatically grant card ownership yet. Do not promise a collectible is awarded automatically until a reward-claim system is added in a later stage.

INTERACTIVE ACTIVITIES
- Each activity needs a title, description, buttonLabel and actionUrl.
- Use a full website path, e.g. "/books/trials-of-eden/contents.html".
- Buttons take readers to the activity. This first version does not verify task completion or track individual event progress.

You can add as many events and activities as you like. Keep commas between objects,
but do not put a comma after the final object in the array.
*/

window.ORLONG_EVENTS = [
  /*
  // EXAMPLE 1 — ANNOUNCEMENT
  {
    id: "winter-announcement-2026",
    type: "announcement",
    published: true,
    title: "A New Chapter Begins",
    eyebrow: "COMMUNITY ANNOUNCEMENT",
    startDate: "2026-12-01",
    endDate: "2026-12-31",
    summary: "A month of new discoveries across the Orlong Universe.",
    description: "Add the full event description here. Explain what is happening, why readers should care and any important details.",
    rewards: [
      "A first look at an upcoming Orlong feature",
      "A special event collectible (if separately configured and released)"
    ],
    activities: []
  },

  // EXAMPLE 2 — INTERACTIVE EVENT
  {
    id: "eden-exploration-week",
    type: "interactive",
    published: true,
    title: "Eden Exploration Week",
    eyebrow: "READER CHALLENGE",
    startDate: "2026-12-05",
    endDate: "2026-12-12",
    summary: "Return to Eden and explore the world behind the Trials.",
    description: "Readers are invited to revisit the released material and take part in these optional activities.",
    rewards: [
      "Recognition on the event page",
      "A chance to discover more about Eden"
    ],
    activities: [
      {
        title: "Return to the story",
        description: "Read the released chapters and revisit the details.",
        buttonLabel: "OPEN READING ROOM",
        actionUrl: "/books/trials-of-eden/index.html"
      },
      {
        title: "Explore the book",
        description: "Browse the chapter directory.",
        buttonLabel: "VIEW BOOK CONTENTS",
        actionUrl: "/books/trials-of-eden/contents.html"
      }
    ]
  }
  */
];
