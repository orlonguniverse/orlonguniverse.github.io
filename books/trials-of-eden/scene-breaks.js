// =====================================
// ORLONG UNIVERSE — REUSABLE SCENE BREAKS
// Add a scene break in any chapter with:
// <orlong-scene-break variant="electric-eel"></orlong-scene-break>
// =====================================

(function () {
  "use strict";

  const sceneBreaks = {
    "electric-eel": `
      <div class="orlong-scene-break" role="separator" aria-label="Scene break">
        <svg viewBox="0 0 180 48" aria-hidden="true" focusable="false">
          <g class="eel-body">
            <path d="M5 12 C13 2 21 22 30 12 S46 2 53 12"/>
            <path d="M65 24 C73 14 81 34 90 24 S106 14 113 24"/>
            <path d="M125 36 C133 26 141 46 150 36 S166 26 173 36"/>
          </g>
          <g class="eel-eye">
            <circle cx="53" cy="12" r="1.8"/>
            <circle cx="113" cy="24" r="1.8"/>
            <circle cx="173" cy="36" r="1.8"/>
          </g>
          <g class="eel-spark">
            <path d="M25 2 L21 7 L26 7 L22 12"/>
            <path d="M85 14 L81 19 L86 19 L82 24"/>
            <path d="M145 26 L141 31 L146 31 L142 36"/>
          </g>
        </svg>
      </div>
    `
  };

  class OrlongSceneBreak extends HTMLElement {
    connectedCallback() {
      const variant = (this.getAttribute("variant") || "electric-eel").toLowerCase();
      const markup = sceneBreaks[variant];

      if (!markup) {
        this.setAttribute("role", "separator");
        this.setAttribute("aria-label", "Scene break");
        console.warn("Unknown Orlong scene-break variant:", variant);
        return;
      }

      const template = document.createElement("template");
      template.innerHTML = markup.trim();
      const replacement = template.content.firstElementChild;
      if (replacement) this.replaceWith(replacement);
    }
  }

  if (!customElements.get("orlong-scene-break")) {
    customElements.define("orlong-scene-break", OrlongSceneBreak);
  }
})();
