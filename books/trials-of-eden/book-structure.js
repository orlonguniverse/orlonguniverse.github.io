// Supabase-backed book structure. The static chapters.js file remains a fallback
// if the database migration has not yet been installed or the service is unavailable.
(() => {
  "use strict";
  const URL_BASE = "https://kqfwtzrfqsfampqfzoal.supabase.co";
  const KEY = "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
  window.EDEN_STRUCTURE_READY = (async () => {
    if (!window.supabase?.createClient) throw new Error("Supabase is unavailable.");
    const client = window.supabase.createClient(URL_BASE, KEY);
    const { data, error } = await client.rpc("get_public_eden_book_structure");
    if (error) throw error;
    if (!data || !Array.isArray(data.parts) || !Array.isArray(data.chapters)) {
      throw new Error("The chapter directory response was incomplete.");
    }
    window.EDEN_PARTS = data.parts;
    window.EDEN_CHAPTERS = data.chapters;
    window.EDEN_BOOK_STRUCTURE_SOURCE = "supabase";
    if (typeof window.renderBookContents === "function") window.renderBookContents();
    if (typeof window.renderChapterDirectory === "function") window.renderChapterDirectory();
    if (typeof window.updateChapterNavigation === "function") window.updateChapterNavigation();
    return data;
  })().catch(error => {
    console.warn("Using the built-in Eden chapter directory because Supabase metadata is not available:", error);
    window.EDEN_BOOK_STRUCTURE_SOURCE = "static-fallback";
    return null;
  });
})();