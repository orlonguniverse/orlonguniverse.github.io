// =====================================
// THE TRIALS OF EDEN — READER ENGAGEMENT
// Supabase public client. RLS protects all reader data.
// =====================================

const SUPABASE_URL = "https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";

const engagementClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
let engagementUser = null;
let engagementProfile = null;
let currentReaction = null;
let replyToComment = null;

const ORLONG_SERIES = [
  { id: "eden", name: "Eden Trilogy", detail: "Maya Garcia's story" },
  { id: "bitsy", name: "Bitsy Series", detail: "The story of Bitsy" },
  { id: "evalon", name: "Evalon Trilogy", detail: "Rod White's story" },
  { id: "varex", name: "Varex Trilogy", detail: "Morph's story" },
  { id: "arcanet", name: "Arcanet Trilogy", detail: "Daniel Garcia's story" }
];

const byId = id => document.getElementById(id);
const setMessage = (id, message) => { const el = byId(id); if (el) el.textContent = message; };

function engagementChapterId() {
  return typeof currentChapter !== "undefined" && currentChapter ? currentChapter : "chapter-01";
}

function setEngagementEnabled(enabled) {
  ["completeChapterButton", "submitCommentButton"].forEach(id => {
    const el = byId(id);
    if (el) el.disabled = !enabled;
  });
  document.querySelectorAll(".engagement-reactions button").forEach(button => button.disabled = !enabled);
  document.querySelectorAll(".series-choice").forEach(button => button.disabled = !enabled);
}

function renderSeriesChoices(interests = []) {
  const container = byId("seriesInterestControls");
  if (!container) return;
  container.replaceChildren();
  ORLONG_SERIES.filter(series => series.id !== "eden").forEach(series => {
    const existing = interests.find(item => item.series_id === series.id);
    const row = document.createElement("div");
    row.className = "series-interest-row";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = series.name;
    const detail = document.createElement("small");
    detail.textContent = series.detail;
    info.append(title, detail);
    const choices = document.createElement("div");
    choices.className = "series-choice-group";
    [["interested","YES"],["maybe","MAYBE"],["not_now","NOT YET"]].forEach(([value,label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "series-choice" + (existing && existing.interest === value ? " selected" : "");
      button.textContent = label;
      button.disabled = !engagementUser;
      button.setAttribute("aria-pressed", String(Boolean(existing && existing.interest === value)));
      button.addEventListener("click", () => saveSeriesInterest(series.id, value));
      choices.appendChild(button);
    });
    row.append(info, choices);
    container.appendChild(row);
  });
}

async function loadSeriesInterests() {
  if (!engagementUser) { renderSeriesChoices(); return; }
  const { data, error } = await engagementClient.from("series_interest")
    .select("series_id,interest").eq("user_id", engagementUser.id);
  if (error) { setMessage("seriesInterestMessage", "Could not load your choices. Please refresh."); return; }
  renderSeriesChoices(data || []);
}

async function saveSeriesInterest(seriesId, interest) {
  if (!engagementUser) return;
  const { error } = await engagementClient.from("series_interest").upsert({
    user_id: engagementUser.id, series_id: seriesId, interest, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,series_id" });
  setMessage("seriesInterestMessage", error ? "We couldn't save that choice. Please try again." : "Your interest has been saved. You can change it whenever you like.");
  if (!error) loadSeriesInterests();
  loadPublicStats();
}

async function loadChapterActivity() {
  const chapterId = engagementChapterId();
  const chapter = (window.EDEN_CHAPTERS || []).find(item => item.id === chapterId);
  setMessage("chapterEngagementTitle", chapter ? chapter.number + " — " + chapter.title : "Current chapter");
  const complete = byId("completeChapterButton");
  if (complete) {
    complete.textContent = "MARK CHAPTER COMPLETE";
    complete.disabled = !engagementUser;
  }
  currentReaction = null;
  document.querySelectorAll(".engagement-reactions button").forEach(button => button.classList.remove("selected"));
  if (!engagementUser) {
    setMessage("completionMessage", "Sign in to save this chapter milestone.");
    setMessage("reactionMessage", "Sign in to react to this chapter.");
    return;
  }
  const [completionResult, reactionResult] = await Promise.all([
    engagementClient.from("chapter_completions").select("chapter_id").eq("user_id", engagementUser.id).eq("chapter_id", chapterId).maybeSingle(),
    engagementClient.from("chapter_reactions").select("reaction").eq("user_id", engagementUser.id).eq("chapter_id", chapterId).maybeSingle()
  ]);
  if (completionResult.error || reactionResult.error) {
    setMessage("completionMessage", "We couldn't load your saved chapter activity.");
    return;
  }
  if (completionResult.data) {
    if (complete) { complete.textContent = "✓ CHAPTER COMPLETED"; complete.disabled = true; }
    setMessage("completionMessage", "This chapter is saved as completed on your account.");
  } else {
    setMessage("completionMessage", "Finished reading? Save this milestone to your account.");
  }
  currentReaction = reactionResult.data ? reactionResult.data.reaction : null;
  if (currentReaction) {
    const selected = document.querySelector('[data-reaction="' + currentReaction + '"]');
    if (selected) selected.classList.add("selected");
    setMessage("reactionMessage", "Your reaction is saved. Choose another to change it.");
  } else {
    setMessage("reactionMessage", "Choose a reaction to share how this chapter made you feel.");
  }
}

async function markChapterComplete() {
  if (!engagementUser) return;
  const { error } = await engagementClient.from("chapter_completions").upsert({
    user_id: engagementUser.id, chapter_id: engagementChapterId()
  }, { onConflict: "user_id,chapter_id", ignoreDuplicates: true });
  if (error) { setMessage("completionMessage", "We couldn't save that milestone. Please try again."); return; }
  await loadChapterActivity();
  loadPublicStats();
}

async function saveReaction(reaction) {
  if (!engagementUser) return;
  const { error } = await engagementClient.from("chapter_reactions").upsert({
    user_id: engagementUser.id, chapter_id: engagementChapterId(), reaction, updated_at: new Date().toISOString()
  }, { onConflict: "user_id,chapter_id" });
  if (error) { setMessage("reactionMessage", "We couldn't save your reaction. Please try again."); return; }
  currentReaction = reaction;
  document.querySelectorAll(".engagement-reactions button").forEach(button => {
    button.classList.toggle("selected", button.dataset.reaction === reaction);
  });
  setMessage("reactionMessage", "Your reaction has been saved.");
  loadPublicStats();
}

async function loadPublicStats() {
  const container = byId("publicStats");
  if (!container) return;
  const { data, error } = await engagementClient.rpc("get_public_engagement_stats");
  if (error || !data) {
    container.textContent = "Community statistics will appear once the database is ready.";
    return;
  }
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const series = Array.isArray(data.series) ? data.series : [];
  const totals = chapters.reduce((sum, item) => ({
    completions: sum.completions + Number(item.completions || 0),
    reactions: sum.reactions + Number(item.reactions || 0),
    comments: sum.comments + Number(item.comments || 0)
  }), { completions:0, reactions:0, comments:0 });
  const interestCount = series.reduce((sum,item) => sum + Number(item.interested || 0) + Number(item.maybe || 0), 0);
  const stats = [
    [totals.completions, "CHAPTER MILESTONES"],
    [totals.reactions, "CHAPTER REACTIONS"],
    [totals.comments, "APPROVED COMMENTS"],
    [interestCount, "SERIES INTERESTS"]
  ];
  container.replaceChildren();
  stats.forEach(([value,label]) => {
    const card = document.createElement("div");
    card.className = "public-stat";
    const number = document.createElement("strong");
    number.textContent = value.toLocaleString();
    const caption = document.createElement("span");
    caption.textContent = label;
    card.append(number,caption);
    container.appendChild(card);
  });
}

function createCommentElement(comment, profileName) {
  const article = document.createElement("article");
  article.className = "comment-item";
  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const date = new Date(comment.created_at);
  meta.textContent = (profileName || "Reader") + " · " + date.toLocaleDateString();
  const body = document.createElement("p");
  body.className = "comment-body";
  if (comment.contains_spoiler) {
    const reveal = document.createElement("button");
    reveal.type = "button";
    reveal.className = "comment-spoiler";
    reveal.textContent = "SPOILER — REVEAL COMMENT";
    reveal.setAttribute("aria-expanded","false");
    reveal.addEventListener("click", () => {
      body.textContent = comment.body;
      reveal.remove();
    });
    article.append(meta,reveal,body);
  } else {
    body.textContent = comment.body;
    article.append(meta,body);
  }
  const tools = document.createElement("div");
  tools.className = "comment-tools";
  const reply = document.createElement("button");
  reply.type = "button";
  reply.textContent = "REPLY";
  reply.disabled = !engagementUser;
  reply.addEventListener("click", () => {
    replyToComment = comment.id;
    setMessage("commentMessage","Your reply will be submitted beneath this comment.");
    byId("commentBody").focus();
  });
  const report = document.createElement("button");
  report.type = "button";
  report.className = "secondary";
  report.textContent = "REPORT";
  report.disabled = !engagementUser || comment.user_id === engagementUser.id;
  report.addEventListener("click", () => reportComment(comment.id));
  tools.append(reply,report);
  article.appendChild(tools);
  return article;
}

async function loadChapterComments() {
  const container = byId("chapterComments");
  if (!container) return;
  const { data, error } = await engagementClient.from("chapter_comments")
    .select("id,user_id,chapter_id,parent_id,body,contains_spoiler,created_at")
    .eq("chapter_id",engagementChapterId()).eq("moderation_status","approved")
    .order("created_at",{ascending:true});
  container.replaceChildren();
  if (error) {
    const note = document.createElement("p");
    note.className = "engagement-muted";
    note.textContent = "Discussion is not available yet. The database setup may still be in progress.";
    container.appendChild(note);
    return;
  }
  if (!data || !data.length) {
    const note = document.createElement("p");
    note.className = "engagement-muted";
    note.textContent = "No approved comments yet. You could be the first to start the conversation.";
    container.appendChild(note);
    return;
  }
  data.filter(comment => !comment.parent_id).forEach(comment => {
    container.appendChild(createCommentElement(comment,"Reader"));
    data.filter(reply => reply.parent_id === comment.id).forEach(reply => {
      const replyElement = createCommentElement(reply,"Reader"));
      replyElement.style.marginLeft = "22px";
      container.appendChild(replyElement);
    });
  });
}

async function submitComment(event) {
  event.preventDefault();
  if (!engagementUser) return;
  const body = byId("commentBody").value.trim();
  if (!body) return;
  const { error } = await engagementClient.from("chapter_comments").insert({
    user_id:engagementUser.id, chapter_id:engagementChapterId(),
    parent_id:replyToComment, body, contains_spoiler:byId("commentSpoiler").checked,
    moderation_status:"pending"
  });
  if (error) { setMessage("commentMessage","Your comment could not be submitted. Please try again."); return; }
  byId("commentForm").reset();
  replyToComment = null;
  setMessage("commentMessage","Thank you! Your comment has been sent for review and will appear once approved.");
  loadPublicStats();
  loadModeratorPanel();
}

async function reportComment(commentId) {
  const reason = window.prompt("Why are you reporting this comment? Please briefly describe the concern.");
  if (!reason || reason.trim().length < 3) return;
  const { error } = await engagementClient.from("chapter_comment_reports").insert({
    comment_id:commentId, reporter_id:engagementUser.id, reason:reason.trim()
  });
  window.alert(error ? "We couldn't submit that report. It may already have been reported by your account." : "Thank you. Your report has been sent to the moderators.");
}

async function loadModeratorPanel() {
  if (!engagementUser) return;
  const { data: role } = await engagementClient.from("reader_moderators").select("user_id").eq("user_id",engagementUser.id).maybeSingle();
  const panel = byId("moderatorPanel");
  if (!panel) return;
  panel.hidden = !role;
  if (!role) return;
  const [pending,stats] = await Promise.all([
    engagementClient.from("chapter_comments").select("id,chapter_id,user_id,body,contains_spoiler,created_at").eq("moderation_status","pending").order("created_at",{ascending:true}),
    engagementClient.rpc("get_author_engagement_stats")
  ]);
  const target = byId("pendingComments");
  target.replaceChildren();
  if (stats.data) {
    const summary = document.createElement("p");
    summary.className = "engagement-muted";
    summary.textContent = "Unique readers with saved completions: " + (stats.data.unique_readers || 0) +
      " · Chapter completions: " + (stats.data.chapter_completions || 0) +
      " · Approved comments: " + (stats.data.approved_comments || 0);
    target.appendChild(summary);
  }
  (pending.data || []).forEach(comment => {
    const item = document.createElement("div");
    item.className = "moderator-item";
    const text = document.createElement("p");
    text.textContent = comment.chapter_id + (comment.contains_spoiler ? " · SPOILER" : "") + "\n" + comment.body;
    const actions = document.createElement("div");
    actions.className = "moderator-actions";
    [["approved","APPROVE"],["hidden","HIDE"]].forEach(([status,label]) => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = label;
      button.addEventListener("click",async () => {
        const result = await engagementClient.from("chapter_comments").update({moderation_status:status}).eq("id",comment.id);
        if (result.error) window.alert("Could not update this comment.");
        loadModeratorPanel(); loadChapterComments(); loadPublicStats();
      });
      actions.appendChild(button);
    });
    item.append(text,actions);
    target.appendChild(item);
  });
  if (!pending.data || !pending.data.length) {
    const empty = document.createElement("p"); empty.className = "engagement-muted"; empty.textContent = "There are no comments awaiting review."; target.appendChild(empty);
  }
}

async function refreshEngagement() {
  await Promise.all([loadChapterActivity(),loadSeriesInterests(),loadChapterComments(),loadModeratorPanel()]);
}

async function handleAuthState(session) {
  engagementUser = session && session.user ? session.user : null;
  engagementProfile = null;
  if (engagementUser) {
    const { data } = await engagementClient.from("reader_profiles").select("display_name").eq("user_id",engagementUser.id).maybeSingle();
    engagementProfile = data || null;
  }
  const form = byId("accountForm");
  const signOut = byId("signOutButton");
  if (form) form.hidden = Boolean(engagementUser);
  if (signOut) signOut.hidden = !engagementUser;
  if (engagementUser) {
    setMessage("accountMessage","Signed in as " + (engagementProfile && engagementProfile.display_name ? engagementProfile.display_name : "Reader") + ". Your participation is connected to this account.");
  } else {
    setMessage("accountMessage","Sign in or create a free account to take part. Reading remains open to everyone.");
  }
  setEngagementEnabled(Boolean(engagementUser));
  await refreshEngagement();
}

async function signIn(event) {
  event.preventDefault();
  const email = byId("readerEmail").value.trim();
  const password = byId("readerPassword").value;
  const { data,error } = await engagementClient.auth.signInWithPassword({email,password});
  if (error) { setMessage("accountMessage",error.message); return; }
  await handleAuthState(data.session);
}

async function signUp() {
  const email = byId("readerEmail").value.trim();
  const password = byId("readerPassword").value;
  const displayName = byId("readerDisplayName").value.trim() || "Reader";
  if (!email || password.length < 8) { setMessage("accountMessage","Enter a valid email and a password of at least 8 characters."); return; }
  const { data,error } = await engagementClient.auth.signUp({
    email,password,options:{
      data:{display_name:displayName},
      emailRedirectTo:window.location.origin + window.location.pathname + window.location.search
    }
  });
  if (error) { setMessage("accountMessage",error.message); return; }
  if (data.session) await handleAuthState(data.session);
  else setMessage("accountMessage","Account created! Check your email and confirm your address before signing in.");
}

async function signOut() {
  const { error } = await engagementClient.auth.signOut();
  if (error) { setMessage("accountMessage","We couldn't sign you out. Please try again."); return; }
  await handleAuthState(null);
}

function initialiseEngagement() {
  if (!window.supabase || !window.supabase.createClient) {
    setMessage("accountMessage","The secure account service did not load. Please refresh the page.");
    return;
  }
  byId("accountForm")?.addEventListener("submit",signIn);
  byId("signUpButton")?.addEventListener("click",signUp);
  byId("signOutButton")?.addEventListener("click",signOut);
  byId("completeChapterButton")?.addEventListener("click",markChapterComplete);
  byId("commentForm")?.addEventListener("submit",submitComment);
  document.querySelectorAll(".engagement-reactions button").forEach(button => {
    button.addEventListener("click",() => saveReaction(button.dataset.reaction));
  });
  renderSeriesChoices();
  loadPublicStats();
  engagementClient.auth.onAuthStateChange((_event,session) => {
    // Defer database work out of the auth callback to avoid blocking token refresh.
    window.setTimeout(() => handleAuthState(session),0);
  });
  engagementClient.auth.getSession().then(({data}) => handleAuthState(data.session));
  const chapterTarget = byId("chapterContent");
  if (chapterTarget) {
    new MutationObserver(() => {
      window.setTimeout(() => { loadChapterActivity(); loadChapterComments(); },150);
    }).observe(chapterTarget,{childList:true,subtree:true});
  }
}

document.addEventListener("DOMContentLoaded",initialiseEngagement);
