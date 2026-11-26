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
        <svg viewBox="0 0 320 24" aria-hidden="true" focusable="false">
          <path class="scene-rule" d="M0 12 H133 M187 12 H320"/>
          <path class="scene-eel" d="M139 9 H171 L181 12 L171 15 H139 L133 12 Z"/>
          <circle class="scene-eel-eye" cx="173" cy="11" r="1"/>
          <path class="scene-eel-mark" d="M151 7 L147 12 H153 L149 17"/>
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
