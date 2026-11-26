// =====================================
// THE TRIALS OF EDEN — READER ENGAGEMENT
// Supabase public client. RLS protects all reader data.
// =====================================

const SUPABASE_URL = "https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";

const engagementClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
window.engagementClient = engagementClient;
let engagementUser = null;
let engagementProfile = null;
let currentReaction = null;
let currentCompletion = false;
let quizDraftEnabled = false;
let replyToComment = null;
let accountMode = "signin";
let lastHandledEngagementUserId = undefined;
let lastEngagementChapterLoaded = null;
let chapterEngagementTimer = null;

const CONTENT_INTERESTS = [
  { id:"characters", title:"Characters" },
  { id:"plot", title:"Plot and twists" },
  { id:"worldbuilding", title:"Worldbuilding and lore" },
  { id:"relationships", title:"Relationships" },
  { id:"action", title:"Action and challenges" },
  { id:"other", title:"Other" }
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
  document.querySelectorAll("#contentInterestControls input, #otherInterestDetail").forEach(input => input.disabled = !enabled);
  const interestSave = byId("saveContentInterestsButton");
  if (interestSave) interestSave.disabled = !enabled;
  const clearInterests = byId("clearContentInterestsButton");
  if (clearInterests) clearInterests.disabled = !enabled;
}

function renderContentInterests(interests = []) {
  const selected = new Set(interests.map(item => item.interest_id));
  document.querySelectorAll("#contentInterestControls input[type='checkbox']").forEach(input => {
    input.checked = selected.has(input.value);
    input.disabled = !engagementUser;
  });
  const other = interests.find(item => item.interest_id === "other");
  const detail = byId("otherInterestDetail");
  if (detail) {
    detail.value = other && other.other_detail ? other.other_detail : "";
    detail.disabled = !engagementUser;
  }
  const save = byId("saveContentInterestsButton");
  if (save) save.disabled = !engagementUser;
}

async function loadContentInterests() {
  if (!engagementUser) {
    renderContentInterests();
    setMessage("contentInterestMessage","Sign in to share what interests you.");
    return;
  }
  const { data, error } = await engagementClient.from("reader_content_interests")
    .select("interest_id,other_detail").eq("user_id",engagementUser.id);
  if (error) {
    setMessage("contentInterestMessage","Could not load your preferences. Please refresh.");
    return;
  }
  renderContentInterests(data || []);
  setMessage("contentInterestMessage", data && data.length ? "Your preferences are saved. You can change them at any time." : "Choose as many topics as you like.");
}

async function saveContentInterests() {
  if (!engagementUser) return;
  const selected = [...document.querySelectorAll("#contentInterestControls input[type='checkbox']:checked")].map(input => input.value);
  const otherDetail = byId("otherInterestDetail").value.trim();
  if (!selected.length) {
    const { error } = await engagementClient.from("reader_content_interests").delete().eq("user_id",engagementUser.id);
    if (error) { setMessage("contentInterestMessage","We could not clear your preferences. Please try again."); return; }
    renderContentInterests([]);
    setMessage("contentInterestMessage","Your content preferences have been cleared.");
    loadPublicStats();
    return;
  }
  if (!selected.includes("other") && otherDetail) {
    setMessage("contentInterestMessage","Select Other if you'd like to include an additional suggestion.");
    return;
  }
  const rows = selected.map(interest_id => ({
    user_id:engagementUser.id,
    interest_id,
    other_detail:interest_id === "other" ? (otherDetail || null) : null,
    updated_at:new Date().toISOString()
  }));
  const { error: deleteError } = await engagementClient.from("reader_content_interests")
    .delete().eq("user_id",engagementUser.id);
  if (deleteError) {
    setMessage("contentInterestMessage","We couldn't update your preferences. Please try again.");
    return;
  }
  const { error } = await engagementClient.from("reader_content_interests").insert(rows);
  if (error) {
    setMessage("contentInterestMessage","We couldn't save your preferences. Please try again.");
    return;
  }
  setMessage("contentInterestMessage","Thank you! Your preferences have been saved.");
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
    complete.setAttribute("aria-pressed","false");
  }
  currentReaction = null;
  currentCompletion = false;
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
  currentCompletion = Boolean(completionResult.data);
  if (complete) {
    complete.textContent = currentCompletion ? "✓ COMPLETED — UNMARK?" : "MARK CHAPTER COMPLETE";
    complete.disabled = false;
    complete.setAttribute("aria-pressed",String(currentCompletion));
  }
  if (currentCompletion) {
    setMessage("completionMessage", "This chapter is marked complete. You can undo this whenever you like.");
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
  const query = engagementClient.from("chapter_completions").delete()
    .eq("user_id",engagementUser.id).eq("chapter_id",engagementChapterId());
  const result = currentCompletion
    ? await query
    : await engagementClient.from("chapter_completions").upsert({
        user_id:engagementUser.id, chapter_id:engagementChapterId()
      }, { onConflict:"user_id,chapter_id", ignoreDuplicates:true });
  if (result.error) {
    setMessage("completionMessage",currentCompletion ? "We couldn't undo that milestone. Please try again." : "We couldn't save that milestone. Please try again.");
    return;
  }
  await loadChapterActivity();
  loadPublicStats();
}

async function saveReaction(reaction) {
  if (!engagementUser) return;
  if (currentReaction === reaction) {
    const { error } = await engagementClient.from("chapter_reactions").delete().eq("user_id",engagementUser.id).eq("chapter_id",engagementChapterId());
    if (error) { setMessage("reactionMessage","We could not remove your reaction. Please try again."); return; }
    currentReaction = null;
    document.querySelectorAll(".engagement-reactions button").forEach(button => button.classList.remove("selected"));
    setMessage("reactionMessage","Your reaction has been removed. Choose another whenever you like.");
  } else {
    const { error } = await engagementClient.from("chapter_reactions").upsert({user_id:engagementUser.id,chapter_id:engagementChapterId(),reaction,updated_at:new Date().toISOString()},{onConflict:"user_id,chapter_id"});
    if (error) { setMessage("reactionMessage","We could not save your reaction. Please try again."); return; }
    currentReaction = reaction;
    document.querySelectorAll(".engagement-reactions button").forEach(button => button.classList.toggle("selected",button.dataset.reaction === reaction));
    setMessage("reactionMessage","Your reaction is saved. Select it again to remove it, or choose another to change it.");
  }
  loadPublicStats();
}

function renderPublicBreakdown(containerId, items, labels, emptyMessage) {
  const container = byId(containerId);
  if (!container) return;
  container.replaceChildren();
  const usable = (items || []).map(item => ({
    label: labels[item.reaction || item.interest_id] || item.reaction || item.interest_id,
    value: Number(item.responses || item.count || 0)
  })).filter(item => item.value > 0).sort((a,b) => b.value - a.value);
  if (!usable.length) {
    const note = document.createElement("p");
    note.className = "engagement-muted";
    note.textContent = emptyMessage;
    container.appendChild(note);
    return;
  }
  const maximum = Math.max(...usable.map(item => item.value));
  usable.forEach(item => {
    const row = document.createElement("div");
    row.className = "public-breakdown-row";
    const label = document.createElement("span");
    label.className = "public-breakdown-label";
    label.textContent = item.label;
    const track = document.createElement("div");
    track.className = "public-breakdown-track";
    track.setAttribute("aria-label", item.label + ": " + item.value);
    const fill = document.createElement("div");
    fill.className = "public-breakdown-fill";
    fill.style.width = (item.value / maximum * 100) + "%";
    track.appendChild(fill);
    const value = document.createElement("strong");
    value.className = "public-breakdown-value";
    value.textContent = item.value.toLocaleString();
    row.append(label,track,value);
    container.appendChild(row);
  });
}

async function loadPublicStats() {
  const container = byId("publicStats");
  if (!container) return;
  const { data, error } = await engagementClient.rpc("get_public_engagement_stats");
  if (error || !data) {
    container.textContent = "Community statistics are temporarily unavailable.";
    return;
  }
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  const totals = chapters.reduce((sum, item) => ({
    completions: sum.completions + Number(item.completions || 0),
    reactions: sum.reactions + Number(item.reactions || 0),
    comments: sum.comments + Number(item.comments || 0)
  }), { completions:0, reactions:0, comments:0 });
  const interests = Array.isArray(data.content_interests) ? data.content_interests : [];
  const interestCount = interests.reduce((sum,item) => sum + Number(item.responses || 0), 0);
  const stats = [
    [totals.completions, "CHAPTER MILESTONES"],
    [totals.reactions, "TOTAL REACTIONS"],
    [totals.comments, "APPROVED COMMENTS"],
    [interestCount, "PREFERENCE SELECTIONS"]
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
  renderPublicBreakdown("publicReactionStats", data.reactions || [], {
    like:"Like", love:"Love", shocked:"Shocked", sad:"Sad", excited:"Excited"
  }, "No chapter reactions have been recorded yet.");
  renderPublicBreakdown("publicInterestStats", interests, {
    characters:"Characters", plot:"Plot and twists", worldbuilding:"Worldbuilding and lore",
    relationships:"Relationships", action:"Action and challenges", other:"Other"
  }, "No content preferences have been submitted yet.");
}

function createCommentElement(comment, profileName) {
  const article = document.createElement("article");
  article.className = "comment-item";
  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const author = document.createElement("div");
  author.className = "comment-author";
  if (profileName && profileName.avatar_url) {
    const avatar = document.createElement("img");
    avatar.className = "comment-avatar";
    avatar.src = profileName.avatar_url;
    avatar.alt = "";
    avatar.loading = "lazy";
    author.appendChild(avatar);
  } else {
    const fallback = document.createElement("span");
    fallback.className = "comment-avatar comment-avatar-fallback";
    fallback.textContent = (profileName && profileName.display_name ? profileName.display_name : "R").trim().charAt(0).toUpperCase();
    author.appendChild(fallback);
  }
  const name = document.createElement("strong");
  name.textContent = profileName && profileName.display_name ? profileName.display_name : "Reader";
  const date = new Date(comment.created_at);
  const timestamp = document.createElement("span");
  timestamp.textContent = " · " + date.toLocaleDateString();
  author.append(name,timestamp);
  meta.appendChild(author);
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
  const userIds=[...new Set(data.map(comment=>comment.user_id).filter(Boolean))];
  const profileMap=new Map();
  if(userIds.length){
    const {data:profiles}=await engagementClient.from("reader_profiles").select("user_id,display_name,avatar_url").in("user_id",userIds);
    (profiles||[]).forEach(profile=>profileMap.set(profile.user_id,profile));
  }
  data.filter(comment => !comment.parent_id).forEach(comment => {
    container.appendChild(createCommentElement(comment,profileMap.get(comment.user_id)));
    data.filter(reply => reply.parent_id === comment.id).forEach(reply => {
      const replyElement = createCommentElement(reply,profileMap.get(reply.user_id));
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
  // Chapter-specific data is loaded only after a chapter has actually rendered.
  // This avoids querying the same activity/comments/quiz both before and after chapter loading.
  await Promise.all([loadContentInterests(),loadModeratorPanel()]);
}

// CHAPTER CHALLENGE — each submission is a new immutable database row.
function renderQuizMessage(message) {
  const target = byId("chapterQuiz");
  if (!target) return;
  target.replaceChildren();
  const note = document.createElement("p");
  note.className = "engagement-muted";
  note.textContent = message;
  target.appendChild(note);
}

function renderQuizAttemptReview(quiz, attempt) {
  const target = byId("chapterQuiz");
  target.replaceChildren();
  const result = document.createElement("p");
  result.className = "quiz-result";
  result.textContent = "YOUR RESULT: " + attempt.score + " / " + attempt.total_questions;
  target.appendChild(result);
  const answers = Array.isArray(attempt.answers) ? attempt.answers : [];
  quiz.questions.slice(0,3).forEach((question,index) => {
    const answer = Number(answers[index]);
    const item = document.createElement("div");
    item.className = "quiz-review-item";
    const heading = document.createElement("strong");
    heading.textContent = (index+1) + ". " + question.question;
    const chosen = document.createElement("p");
    chosen.textContent = "Your answer: " + (question.options[answer] ?? "No answer");
    const correct = document.createElement("p");
    correct.textContent = "Correct answer: " + question.options[question.answer];
    item.append(heading,chosen,correct);
    if (question.explanation) {
      const explanation = document.createElement("small");
      explanation.textContent = question.explanation;
      item.appendChild(explanation);
    }
    target.appendChild(item);
  });
  const retake = document.createElement("button");
  retake.type = "button";
  retake.className = "quiz-retake-button";
  retake.textContent = "TAKE ANOTHER ATTEMPT";
  retake.addEventListener("click",() => renderQuizForm(quiz));
  target.appendChild(retake);
}

function renderQuizForm(quiz) {
  const target = byId("chapterQuiz");
  target.replaceChildren();
  const form = document.createElement("form");
  form.id = "chapterQuizForm";
  quiz.questions.slice(0,3).forEach((question,index) => {
    const fieldset = document.createElement("fieldset");
    fieldset.className = "quiz-question";
    const legend = document.createElement("legend");
    legend.textContent = (index+1) + ". " + question.question;
    fieldset.appendChild(legend);
    question.options.forEach((option,optionIndex) => {
      const label = document.createElement("label");
      label.className = "quiz-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "question-" + index;
      input.value = String(optionIndex);
      input.required = true;
      const span = document.createElement("span");
      span.textContent = option;
      label.append(input,span);
      fieldset.appendChild(label);
    });
    form.appendChild(fieldset);
  });
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "quiz-submit-button";
  submit.textContent = "SUBMIT MY ANSWERS";
  form.appendChild(submit);
  const note = document.createElement("p");
  note.className = "engagement-small";
  note.textContent = "Once submitted, this attempt is locked. You can review it later and start a separate attempt.";
  form.appendChild(note);
  form.addEventListener("submit",async event => {
    event.preventDefault();
    if (!engagementUser) return;
    const answers = quiz.questions.slice(0,3).map((_,index) => {
      const selected = form.querySelector('input[name="question-' + index + '"]:checked');
      return selected ? Number(selected.value) : -1;
    });
    if (answers.some(answer => answer < 0)) return;
    submit.disabled = true;
    submit.textContent = "SAVING ATTEMPT...";
    const score = answers.reduce((total,answer,index) => total + (answer === quiz.questions[index].answer ? 1 : 0),0);
    const {error} = await engagementClient.from("chapter_quiz_attempts").insert({
      user_id:engagementUser.id,
      chapter_id:engagementChapterId(),
      quiz_version:String(quiz.version || "1"),
      answers,
      score,
      total_questions:3
    });
    if (error) {
      submit.disabled = false;
      submit.textContent = "SUBMIT MY ANSWERS";
      const warning = document.createElement("p");
      warning.className = "engagement-small";
      warning.textContent = "We couldn't save your attempt. Please try again.";
      form.appendChild(warning);
      return;
    }
    await loadChapterQuiz();
  });
  target.appendChild(form);
}

async function loadChapterQuiz() {
  const target = byId("chapterQuiz");
  if (!target) return;
  const chapter = (window.EDEN_CHAPTERS || []).find(item => item.id === engagementChapterId());
  const quiz = chapter && chapter.quiz;
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length !== 3 ||
      quiz.questions.some(q => !q.question || !Array.isArray(q.options) || q.options.length < 2 ||
      !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length)) {
    renderQuizMessage("A three-question challenge for this chapter will appear here soon.");
    return;
  }
  if (!engagementUser) {
    renderQuizMessage("Sign in to take this chapter's three-question challenge and save your result.");
    return;
  }
  const {data,error} = await engagementClient.from("chapter_quiz_attempts")
    .select("id,answers,score,total_questions,submitted_at,quiz_version")
    .eq("user_id",engagementUser.id).eq("chapter_id",engagementChapterId())
    .order("submitted_at",{ascending:false});
  if (error) {
    renderQuizMessage("Your chapter challenge is temporarily unavailable. Please refresh.");
    return;
  }
  const history = data || [];
  if (history.length) {
    const count = document.createElement("p");
    count.className = "engagement-small";
    count.textContent = history.length + (history.length === 1 ? " attempt saved" : " attempts saved") + " for this chapter.";
    target.replaceChildren(count);
    const latest = history[0];
    const review = document.createElement("button");
    review.type = "button";
    review.className = "quiz-retake-button";
    review.textContent = "REVIEW LATEST ATTEMPT";
    review.addEventListener("click",() => renderQuizAttemptReview(quiz,latest));
    target.appendChild(review);
    const retake = document.createElement("button");
    retake.type = "button";
    retake.className = "quiz-retake-button";
    retake.textContent = "TAKE ANOTHER ATTEMPT";
    retake.addEventListener("click",() => renderQuizForm(quiz));
    target.appendChild(retake);
    return;
  }
  renderQuizForm(quiz);
}

function setAccountMode(mode) {
  accountMode = mode === "signup" ? "signup" : "signin";
  const nameField = byId("displayNameField");
  const nameInput = byId("readerDisplayName");
  const password = byId("readerPassword");
  if (nameField) nameField.hidden = accountMode !== "signup";
  if (nameInput) nameInput.required = false;
  if (password) password.autocomplete = accountMode === "signup" ? "new-password" : "current-password";
  document.querySelectorAll("[data-account-mode]").forEach(button => {
    button.classList.toggle("active", button.dataset.accountMode === accountMode);
    button.setAttribute("aria-pressed", String(button.dataset.accountMode === accountMode));
  });
  const submit = byId("accountSubmitButton");
  if (submit) submit.textContent = accountMode === "signup" ? "CREATE FREE ACCOUNT" : "SIGN IN";
  setMessage("accountMessage", accountMode === "signup"
    ? "Create a free account to save your reading milestones and join discussions."
    : "Welcome back. Enter your email address and password to continue.");
}

function openAccountDialog() {
  if (engagementUser) {
    const actions = byId("accountActionsDialog");
    if (actions && !actions.open) actions.showModal();
    return;
  }
  const dialog = byId("accountDialog");
  if (!dialog) return;
  setAccountMode("signin");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => (byId("readerEmail") || byId("closeAccountDialog")).focus(), 30);
}

async function handleAuthState(session) {
  const nextUserId = session && session.user ? session.user.id : null;
  if (lastHandledEngagementUserId === nextUserId) return;
  lastHandledEngagementUserId = nextUserId;
  lastEngagementChapterLoaded = null;
  engagementUser = session && session.user ? session.user : null;
  window.engagementUser = engagementUser;
  engagementProfile = null;
  if (engagementUser) {
    const { data } = await engagementClient.from("reader_profiles").select("display_name").eq("user_id",engagementUser.id).maybeSingle();
    engagementProfile = data || null;
  }
  const form = byId("accountForm");
  const displayName = engagementProfile && engagementProfile.display_name ? engagementProfile.display_name : "Reader";
  if (form) form.hidden = Boolean(engagementUser);
  if (engagementUser) {
    const message = "Signed in as " + displayName + ". Your participation is connected to this account.";
    setMessage("accountMessage",message);
    const navButton = byId("openAccountButton");
    if (navButton) navButton.textContent = displayName.toUpperCase();
    setMessage("accountActionsName",message);
  } else {
    setMessage("accountMessage","You can read without an account. Sign in or create one to save milestones and join discussions.");
    const navButton = byId("openAccountButton");
    if (navButton) navButton.textContent = "SIGN IN";
  }
  setEngagementEnabled(Boolean(engagementUser));
  if (window.startEdenReader) window.startEdenReader(session);
  await refreshEngagement();
}

async function submitAccountForm(event) {
  event.preventDefault();
  const email = byId("readerEmail").value.trim();
  const password = byId("readerPassword").value;
  if (accountMode === "signin") {
    const { data,error } = await engagementClient.auth.signInWithPassword({email,password});
    if (error) { setMessage("accountMessage",error.message); return; }
    await handleAuthState(data.session);
    byId("accountDialog")?.close();
    return;
  }
  const displayName = byId("readerDisplayName").value.trim() || "Reader";
  if (!email || password.length < 8) {
    setMessage("accountMessage","Enter a valid email and a password of at least 8 characters.");
    return;
  }
  const { data,error } = await engagementClient.auth.signUp({
    email,password,options:{
      data:{display_name:displayName},
      emailRedirectTo:window.location.origin + window.location.pathname + window.location.search
    }
  });
  if (error) { setMessage("accountMessage",error.message); return; }
  if (data.session) {
    await handleAuthState(data.session);
    byId("accountDialog")?.close();
  } else {
    setMessage("accountMessage","Account created! Check your email and confirm your address before signing in.");
  }
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
  byId("accountForm")?.addEventListener("submit",submitAccountForm);
  document.querySelectorAll("[data-account-mode]").forEach(button => button.addEventListener("click",() => setAccountMode(button.dataset.accountMode)));
  byId("openAccountButton")?.addEventListener("click",openAccountDialog);
  byId("closeAccountDialog")?.addEventListener("click",() => byId("accountDialog")?.close());
  byId("accountDialog")?.addEventListener("click",event => {
    if (event.target === byId("accountDialog")) byId("accountDialog").close();
  });
  byId("accountActionsSignOut")?.addEventListener("click",async () => { await signOut(); byId("accountActionsDialog")?.close(); });
  byId("closeAccountActions")?.addEventListener("click",() => byId("accountActionsDialog")?.close());
  byId("accountActionsDialog")?.addEventListener("click",event => { if(event.target === byId("accountActionsDialog")) byId("accountActionsDialog").close(); });
  setAccountMode("signin");
  byId("completeChapterButton")?.addEventListener("click",markChapterComplete);
  byId("commentForm")?.addEventListener("submit",submitComment);
  document.querySelectorAll(".engagement-reactions button").forEach(button => {
    button.addEventListener("click",() => saveReaction(button.dataset.reaction));
  });
  document.querySelectorAll("#contentInterestControls input").forEach(input => input.addEventListener("change",() => setMessage("contentInterestMessage","Remember to save your updated preferences.")));
  byId("saveContentInterestsButton")?.addEventListener("click",saveContentInterests);
  byId("clearContentInterestsButton")?.addEventListener("click",() => {
    document.querySelectorAll("#contentInterestControls input[type=checkbox]").forEach(input => { input.checked = false; });
    if (byId("otherInterestDetail")) byId("otherInterestDetail").value = "";
    saveContentInterests();
  });
  loadPublicStats();
  engagementClient.auth.onAuthStateChange((_event,session) => {
    // Defer database work out of the auth callback to avoid blocking token refresh.
    window.setTimeout(() => handleAuthState(session),0);
  });
  engagementClient.auth.getSession().then(({data}) => handleAuthState(data.session));
  const chapterTarget = byId("chapterContent");
  if (chapterTarget) {
    new MutationObserver(() => {
      window.clearTimeout(chapterEngagementTimer);
      chapterEngagementTimer = window.setTimeout(() => {
        const chapterId = engagementChapterId();
        if (!engagementUser || !chapterId || chapterId === lastEngagementChapterLoaded) return;
        lastEngagementChapterLoaded = chapterId;
        Promise.all([loadChapterActivity(),loadChapterComments(),loadChapterQuiz()]);
      },100);
    }).observe(chapterTarget,{childList:true,subtree:true});
  }
}

document.addEventListener("DOMContentLoaded",initialiseEngagement);
