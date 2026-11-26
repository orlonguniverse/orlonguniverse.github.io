// THE TRIALS OF EDEN — PRIVATE READER STATISTICS
const ACCOUNT_SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const ACCOUNT_SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const accountClient=window.supabase.createClient(ACCOUNT_SUPABASE_URL,ACCOUNT_SUPABASE_KEY);
let accountMode="signin";
const accountById=id=>document.getElementById(id);
const chapterInfo=id=>(window.EDEN_CHAPTERS||[]).find(chapter=>chapter.id===id);
const safeDate=value=>value?new Date(value).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"}):"";
const setAuthMessage=message=>{
 const dashboardMessage=accountById("dashboardMessage");
 const authMessage=accountById("authMessage");
 if(dashboardMessage && !accountById("dashboard").hidden){
  dashboardMessage.textContent=message;
  dashboardMessage.hidden=false;
 }else if(authMessage){authMessage.textContent=message;}
};
function setMode(mode){
 accountMode=mode==="signup"?"signup":"signin";accountById("nameField").hidden=accountMode!=="signup";
 accountById("password").autocomplete=accountMode==="signup"?"new-password":"current-password";
 document.querySelectorAll("[data-mode]").forEach(button=>{button.classList.toggle("active",button.dataset.mode===accountMode);button.setAttribute("aria-pressed",String(button.dataset.mode===accountMode));});
 accountById("authSubmit").textContent=accountMode==="signup"?"CREATE FREE ACCOUNT":"SIGN IN";
 accountById("authHeading").textContent=accountMode==="signup"?"CREATE YOUR READER ACCOUNT":"YOUR READER ACCOUNT";
}
function addActivity(containerId,rows,emptyMessage,renderRow){
 const container=accountById(containerId);container.replaceChildren();
 if(!rows.length){const empty=document.createElement("div");empty.className="empty";empty.textContent=emptyMessage;container.appendChild(empty);return;}
 rows.forEach(row=>container.appendChild(renderRow(row)));
}
function activityCard(title,detail,body){
 const card=document.createElement("article");card.className="activity-item";
 const heading=document.createElement("strong");heading.textContent=title;
 const small=document.createElement("small");small.textContent=detail;card.append(heading,small);
 if(body){const paragraph=document.createElement("p");paragraph.textContent=body;card.appendChild(paragraph);}return card;
}
async function loadPersonalDashboard(user){
 const [profile,completionsResult,reactionsResult,commentsResult,preferencesResult,quizResult]=await Promise.all([
  accountClient.from("reader_profiles").select("display_name").eq("user_id",user.id).maybeSingle(),
  accountClient.from("chapter_completions").select("chapter_id,completed_at").eq("user_id",user.id).order("completed_at",{ascending:false}),
  accountClient.from("chapter_reactions").select("chapter_id,reaction,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}),
  accountClient.from("chapter_comments").select("id,chapter_id,body,moderation_status,created_at,contains_spoiler").eq("user_id",user.id).order("created_at",{ascending:false}),
  accountClient.from("reader_content_interests").select("interest_id,other_detail,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}),
  accountClient.from("chapter_quiz_attempts").select("id,chapter_id,answers,score,total_questions,submitted_at").eq("user_id",user.id).order("submitted_at",{ascending:false})
 ]);
 const errors=[completionsResult,reactionsResult,commentsResult,preferencesResult,quizResult].filter(result=>result.error);
 if(errors.length){setAuthMessage("We couldn't load all your statistics. Please refresh and try again.");console.error(errors);return;}
 const completions=completionsResult.data||[],reactions=reactionsResult.data||[],comments=commentsResult.data||[],preferences=preferencesResult.data||[],quizAttempts=quizResult.data||[];
 accountById("profileName").textContent=(profile.data?.display_name||"Reader").toUpperCase();
 const approved=comments.filter(x=>x.moderation_status==="approved").length,pending=comments.filter(x=>x.moderation_status==="pending").length,hidden=comments.filter(x=>x.moderation_status==="hidden").length;
 const reactionCounts=reactions.reduce((counts,item)=>{counts[item.reaction]=(counts[item.reaction]||0)+1;return counts;},{});
 const stats=[[completions.length,"CHAPTERS COMPLETED"],[quizAttempts.length,"QUIZ ATTEMPTS"],[reactions.length,"CHAPTER REACTIONS"],[comments.length,"COMMENTS SUBMITTED"],[approved,"COMMENTS APPROVED"],[pending,"COMMENTS PENDING"],[hidden,"COMMENTS HIDDEN"],[preferences.length,"CONTENT PREFERENCES"],[Object.keys(reactionCounts).length,"REACTION TYPES USED"]];
 accountById("personalStats").replaceChildren();
 stats.forEach(([value,label])=>{const card=document.createElement("div");card.className="stat";const number=document.createElement("strong");number.textContent=value.toLocaleString();const caption=document.createElement("span");caption.textContent=label;card.append(number,caption);accountById("personalStats").appendChild(card);});
 const released=(window.EDEN_CHAPTERS||[]).filter(chapter=>chapter.available);
 const completedIds=new Set(completions.map(item=>item.chapter_id));
 const completedReleased=released.filter(chapter=>completedIds.has(chapter.id)).length;
 const percent=released.length?Math.round(completedReleased/released.length*100):0;
 const progressText=accountById("progressSummary");
 if(progressText)progressText.textContent=released.length?completedReleased+" of "+released.length+" released chapters completed · "+percent+"%":"No chapters have been released yet.";
 const progressFill=accountById("accountProgressFill");
 if(progressFill)progressFill.style.width=percent+"%";
 const progressTrack=accountById("accountProgressTrack");
 if(progressTrack)progressTrack.setAttribute("aria-valuenow",String(percent));
 const progressList=accountById("releasedChapterProgress");
 if(progressList){
  progressList.replaceChildren();
  if(!released.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="Released chapters will appear here.";progressList.appendChild(empty);}
  released.forEach(chapter=>{
   const card=activityCard(chapter.number+" — "+chapter.title,completedIds.has(chapter.id)?"COMPLETED":"NOT YET COMPLETED");
   const action=document.createElement("button");action.type="button";action.className="personal-remove-button";
   action.textContent=completedIds.has(chapter.id)?"UNMARK COMPLETE":"MARK COMPLETE";
   action.addEventListener("click",async()=>{
    action.disabled=true;
    const result=completedIds.has(chapter.id)
     ? await accountClient.from("chapter_completions").delete().eq("user_id",user.id).eq("chapter_id",chapter.id)
     : await accountClient.from("chapter_completions").upsert({user_id:user.id,chapter_id:chapter.id},{onConflict:"user_id,chapter_id",ignoreDuplicates:true});
    if(result.error){setAuthMessage("We couldn't update that chapter milestone. Please try again.");action.disabled=false;return;}
    await loadPersonalDashboard(user);
   });
   card.appendChild(action);progressList.appendChild(card);
  });
 }

  const reactionLabels={like:"👍 Like",love:"❤️ Love",shocked:"😮 Shocked",sad:"😢 Sad",excited:"⚡ Excited"};
  addActivity("reactionList",reactions,"You haven't reacted to any chapters yet.",item=>{
    const c=chapterInfo(item.chapter_id),card=activityCard(c?c.number+" — "+c.title:item.chapter_id,(reactionLabels[item.reaction]||item.reaction)+" · "+safeDate(item.updated_at));
    const remove=document.createElement("button");remove.type="button";remove.className="personal-remove-button";remove.textContent="REMOVE REACTION";
    remove.addEventListener("click",async()=>{
      if(remove.disabled)return;
      remove.disabled=true;
      remove.textContent="REMOVING…";
      setAuthMessage("Removing your reaction…");
      try{
        const {data:deletedRows,error}=await accountClient
          .from("chapter_reactions")
          .delete()
          .eq("user_id",user.id)
          .eq("chapter_id",item.chapter_id)
          .select("user_id,chapter_id");
        if(error)throw error;

        // PostgREST can return no error when row-level security filters out
        // a DELETE. Verify that an actual row was removed before refreshing.
        if(!deletedRows || deletedRows.length===0){
          const {data:stillSaved,error:checkError}=await accountClient
            .from("chapter_reactions")
            .select("chapter_id")
            .eq("user_id",user.id)
            .eq("chapter_id",item.chapter_id)
            .maybeSingle();
          if(checkError)throw checkError;
          if(stillSaved){
            throw new Error("Supabase did not delete the reaction. Check the chapter_reactions DELETE policy for the signed-in reader.");
          }
        }

        await loadPersonalDashboard(user);
        setAuthMessage("Your reaction has been removed.");
      }catch(error){
        console.error("Could not remove chapter reaction:",error);
        setAuthMessage(error && error.message && error.message.includes("DELETE policy")
          ? "Supabase blocked the deletion. Please run the reaction-removal policy SQL supplied with this website update."
          : "We couldn't remove that reaction. Your other statistics are still safe. Please try again.");
        remove.disabled=false;
        remove.textContent="REMOVE REACTION";
      }
    });
    card.appendChild(remove);return card;
  });
  const breakdown=accountById("reactionBreakdown");breakdown.replaceChildren();
  Object.entries(reactionCounts).sort((a,b)=>b[1]-a[1]).forEach(([key,count])=>{const row=document.createElement("div");row.className="activity-item";const label=document.createElement("strong");label.textContent=(reactionLabels[key]||key)+" — "+count;const note=document.createElement("small");note.textContent="Across your chapter reactions";row.append(label,note);breakdown.appendChild(row);});
  if(!Object.keys(reactionCounts).length){const empty=document.createElement("div");empty.className="empty";empty.textContent="Your reaction breakdown will appear here once you react to chapters.";breakdown.appendChild(empty);}
 addActivity("commentList",comments,"You haven't submitted any comments yet.",item=>{const c=chapterInfo(item.chapter_id),status={approved:"APPROVED",pending:"AWAITING REVIEW",hidden:"HIDDEN"}[item.moderation_status]||item.moderation_status.toUpperCase();return activityCard(c?c.number+" — "+c.title:item.chapter_id,status+" · "+safeDate(item.created_at),item.body);});
 addActivity("quizAttemptList",quizAttempts,"You haven't completed any chapter challenges yet.",item=>{
  const c=chapterInfo(item.chapter_id);
  const card=activityCard(c?c.number+" — "+c.title:item.chapter_id,"SCORE: "+item.score+" / "+item.total_questions+" · "+safeDate(item.submitted_at),"Your submitted answers are saved as a locked attempt.");
  return card;
 });
 const labels={characters:"Characters",plot:"Plot and twists",worldbuilding:"Worldbuilding and lore",relationships:"Relationships",action:"Action and challenges",other:"Other"},container=accountById("preferenceList");container.replaceChildren();
 if(!preferences.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="You haven't saved any content preferences yet.";container.appendChild(empty);}
  preferences.forEach(item=>{
    const wrap=document.createElement("div");wrap.className="activity-item";
    const tag=document.createElement("strong");tag.textContent=labels[item.interest_id]||item.interest_id;wrap.appendChild(tag);
    if(item.other_detail){const detail=document.createElement("small");detail.textContent=item.other_detail;wrap.appendChild(detail);}
    const remove=document.createElement("button");remove.type="button";remove.className="personal-remove-button";remove.textContent="REMOVE SELECTION";
    remove.addEventListener("click",async()=>{const {error}=await accountClient.from("reader_content_interests").delete().eq("user_id",user.id).eq("interest_id",item.interest_id);if(error){setAuthMessage("We couldn't remove that preference. Please try again.");return;}await loadPersonalDashboard(user);});
    wrap.appendChild(remove);container.appendChild(wrap);
  });
}
async function showSession(session){
 const signedIn=Boolean(session?.user);accountById("authPanel").hidden=signedIn;accountById("dashboard").hidden=!signedIn;
 if(signedIn)await loadPersonalDashboard(session.user);
}
async function submitAccount(event){
 event.preventDefault();const email=accountById("email").value.trim(),password=accountById("password").value;
 if(accountMode==="signin"){const {data,error}=await accountClient.auth.signInWithPassword({email,password});if(error){setAuthMessage(error.message);return;}await showSession(data.session);return;}
 const displayName=accountById("displayName").value.trim()||"Reader";
 const {data,error}=await accountClient.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:window.location.origin+window.location.pathname}});
 if(error){setAuthMessage(error.message);return;}if(data.session)await showSession(data.session);else setAuthMessage("Account created! Check your email and confirm your address before signing in.");
}
async function signOutAccount(){const {error}=await accountClient.auth.signOut();if(error){setAuthMessage("We couldn't sign you out. Please try again.");return;}accountById("authPanel").hidden=false;accountById("dashboard").hidden=true;setMode("signin");setAuthMessage("You have signed out.");}
document.addEventListener("DOMContentLoaded",async()=>{
 document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
 accountById("authForm").addEventListener("submit",submitAccount);accountById("signOutButton").addEventListener("click",signOutAccount);setMode("signin");
 const {data}=await accountClient.auth.getSession();await showSession(data.session);
 accountClient.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>showSession(session),0));
});
