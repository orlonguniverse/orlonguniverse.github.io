// THE TRIALS OF EDEN — PRIVATE READER STATISTICS
const ACCOUNT_SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const ACCOUNT_SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const accountClient=window.supabase.createClient(ACCOUNT_SUPABASE_URL,ACCOUNT_SUPABASE_KEY);
let accountMode="signin";
let lastDashboardUserId=undefined;
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
async function loadPersonalDashboard(user,cachedData=null,silent=false){
 let profile,completionsResult,reactionsResult,commentsResult,preferencesResult,quizResult;
 if(cachedData){
  profile={data:cachedData.profile};
  completionsResult={data:cachedData.completions||[]};
  reactionsResult={data:cachedData.reactions||[]};
  commentsResult={data:cachedData.comments||[]};
  preferencesResult={data:cachedData.preferences||[]};
  quizResult={data:cachedData.quizAttempts||[]};
 }else{
  [profile,completionsResult,reactionsResult,commentsResult,preferencesResult,quizResult]=await Promise.all([
   accountClient.from("reader_profiles").select("display_name,avatar_url").eq("user_id",user.id).maybeSingle(),
   accountClient.from("chapter_completions").select("chapter_id,completed_at").eq("user_id",user.id).order("completed_at",{ascending:false}),
   accountClient.from("chapter_reactions").select("chapter_id,reaction,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}),
   accountClient.from("chapter_comments").select("id,chapter_id,body,moderation_status,created_at,contains_spoiler").eq("user_id",user.id).order("created_at",{ascending:false}),
   accountClient.from("reader_content_interests").select("interest_id,other_detail,updated_at").eq("user_id",user.id).order("updated_at",{ascending:false}),
   accountClient.from("chapter_quiz_attempts").select("id,chapter_id,answers,score,total_questions,submitted_at").eq("user_id",user.id).order("submitted_at",{ascending:false})
  ]);
  const errors=[completionsResult,reactionsResult,commentsResult,preferencesResult,quizResult].filter(result=>result.error);
  if(errors.length){if(!silent)setAuthMessage("We couldn't load all your statistics. Please refresh and try again.");console.error(errors);return;}
  try{
   sessionStorage.setItem("edenDashboard:"+user.id,JSON.stringify({
    profile:profile.data,completions:completionsResult.data||[],reactions:reactionsResult.data||[],
    comments:commentsResult.data||[],preferences:preferencesResult.data||[],quizAttempts:quizResult.data||[]
   }));
  }catch(cacheError){console.warn("Could not cache the statistics dashboard.",cacheError);}
 }
 const completions=completionsResult.data||[],reactions=reactionsResult.data||[],comments=commentsResult.data||[],preferences=preferencesResult.data||[],quizAttempts=quizResult.data||[];
 accountById("profileName").textContent=(profile.data?.display_name||"Reader").toUpperCase();
 const avatarPreview=accountById("accountAvatarPreview");
 if(avatarPreview){if(profile.data?.avatar_url){avatarPreview.src=profile.data.avatar_url;avatarPreview.hidden=false;}else{avatarPreview.removeAttribute("src");avatarPreview.hidden=true;}}

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
        const {data:removed,error}=await accountClient.rpc("remove_own_chapter_reaction",{
          target_chapter_id:item.chapter_id
        });
        if(error)throw error;
        if(removed!==true){
          throw new Error("No matching saved reaction was removed. Refresh your statistics and try again.");
        }

        try {
          await loadPersonalDashboard(user);
          setAuthMessage("Your reaction has been removed.");
        } catch(refreshError) {
          console.error("Reaction removed, but statistics could not refresh:",refreshError);
          setAuthMessage("Your reaction was removed, but your statistics could not refresh. Please reload this page.");
        }
      }catch(error){
        console.error("Could not remove chapter reaction:",error);
        setAuthMessage(error && error.message && error.message.includes("remove_own_chapter_reaction")
          ? "The reaction-removal database update has not been installed yet. Please run the SQL migration supplied with this update in Supabase."
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


async function loadCardCollection(user){
 const grid=accountById("cardCollectionGrid");
 const summary=accountById("cardCollectionSummary");
 const filters=accountById("cardCategoryFilters");
 const dialog=accountById("cardDetailDialog");
 if(!grid||!summary)return;
 grid.replaceChildren();
 if(filters)filters.replaceChildren();
 summary.textContent="LOADING YOUR COLLECTION...";
 const {data,error}=await accountClient.rpc("get_my_card_collection");
 if(error){
  const note=document.createElement("div");note.className="empty";
  note.textContent="Your card collection is temporarily unavailable. The Stage 3 database update may still need to be run.";
  grid.appendChild(note);summary.textContent="COLLECTION UNAVAILABLE";console.error("Could not load card collection:",error);return;
 }
 const cards=data||[];
 const totalCopies=cards.reduce((total,card)=>total+Number(card.copy_count||0),0);
 summary.textContent=totalCopies+" CARD "+(totalCopies===1?"COPY":"COPIES")+" · "+cards.length+" UNIQUE "+(cards.length===1?"CARD":"CARDS");
 if(!cards.length){
  const empty=document.createElement("div");empty.className="empty";
  empty.textContent="Your binder is empty for now. Earn your first collectible by completing an eligible Reading Room activity.";
  grid.appendChild(empty);return;
 }
 let selectedCategory="all";
 const categories=[...new Set(cards.map(card=>card.category_label||"Other"))];
 const renderCards=()=>{
  grid.replaceChildren();
  const visible=selectedCategory==="all"?cards:cards.filter(card=>(card.category_label||"Other")===selectedCategory);
  visible.forEach(card=>{
   const item=document.createElement("button");item.type="button";item.className="owned-card";
   item.setAttribute("aria-label","View "+card.card_name+", "+card.card_number);
   if(card.artwork_url){
    const image=document.createElement("img");image.className="owned-card-image";
    image.src=new URL(card.artwork_url,window.location.origin).href;
    image.alt=card.card_name+" collectible card";image.loading="lazy";
    image.onerror=()=>{image.hidden=true;};
    item.appendChild(image);
   }
   const number=document.createElement("p");number.className="owned-card-number";number.textContent=card.card_number||"COLLECTIBLE";
   const name=document.createElement("h3");name.textContent=card.card_name;
   const meta=document.createElement("p");meta.className="owned-card-meta";
   meta.textContent=[card.category_label,card.rarity].filter(Boolean).join(" · ");
   const count=document.createElement("span");count.className="owned-card-count";
   const copies=Number(card.copy_count||0);count.textContent=copies+" "+(copies===1?"COPY":"COPIES");
   item.append(number,name,meta,count);
   item.addEventListener("click",()=>openCardDetails(card));
   grid.appendChild(item);
  });
 };
 const renderFilters=()=>{
  if(!filters)return;
  filters.replaceChildren();
  const options=[{id:"all",label:"ALL CARDS"},...categories.map(category=>({id:category,label:category.toUpperCase()}))];
  options.forEach(option=>{
   const button=document.createElement("button");button.type="button";button.className="card-category-filter";
   button.textContent=option.label;button.setAttribute("aria-pressed",String(selectedCategory===option.id));
   button.addEventListener("click",()=>{selectedCategory=option.id;renderFilters();renderCards();});
   filters.appendChild(button);
  });
 };
 function openCardDetails(card){
  if(!dialog)return;
  const artwork=accountById("cardDetailArtwork");
  const number=accountById("cardDetailNumber");
  const name=accountById("cardDetailName");
  const meta=accountById("cardDetailMeta");
  const description=accountById("cardDetailDescription");
  const copies=accountById("cardDetailCopies");
  number.textContent=card.card_number||"COLLECTIBLE";
  name.textContent=card.card_name||"Collectible";
  meta.textContent=[card.category_label,card.rarity].filter(Boolean).join(" · ").toUpperCase();
  description.textContent=card.spoiler_safe_description||"More information about this collectible will be added to Explore Eden as its companion entry is released.";
  const copyCount=Number(card.copy_count||0);
  copies.textContent=copyCount+" "+(copyCount===1?"COPY":"COPIES")+" IN YOUR BINDER";
  if(card.artwork_url){
   artwork.src=new URL(card.artwork_url,window.location.origin).href;
   artwork.alt=card.card_name+" collectible card";
   artwork.hidden=false;
  }else{
   artwork.removeAttribute("src");artwork.alt="";artwork.hidden=true;
  }
  if(typeof dialog.showModal==="function")dialog.showModal();
 }
 const closeButton=accountById("closeCardDetail");
 if(closeButton&&dialog&&!closeButton.dataset.bound){
  closeButton.dataset.bound="true";
  closeButton.addEventListener("click",()=>dialog.close());
 }
 if(dialog&&!dialog.dataset.backdropBound){
  dialog.dataset.backdropBound="true";
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
 }
 renderFilters();
 renderCards();
}
async function uploadProfilePicture(){
 const input=accountById("accountAvatarInput"),button=accountById("uploadAvatarButton"),message=accountById("avatarUploadMessage");
 const file=input?.files?.[0];
 if(!file){if(message)message.textContent="Choose an image first.";return;}
 if(!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)){message.textContent="Please choose a JPG, PNG, WebP or GIF image.";return;}
 if(file.size>2*1024*1024){message.textContent="That image is larger than 2 MB. Please choose a smaller file.";return;}
 const result=await accountClient.auth.getUser();
 const user=result.data.user;
 if(!user){message.textContent="Please sign in again before uploading.";return;}
 button.disabled=true;message.textContent="Uploading your profile picture...";
 try{
  const uploaded=await accountClient.storage.from("reader-avatars").upload(user.id+"/avatar",file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if(uploaded.error)throw uploaded.error;
  const urlResult=accountClient.storage.from("reader-avatars").getPublicUrl(user.id+"/avatar");
  const publicUrl=urlResult.data.publicUrl+"?v="+Date.now();
  const updated=await accountClient.from("reader_profiles").update({avatar_url:publicUrl}).eq("user_id",user.id);
  if(updated.error)throw updated.error;
  const preview=accountById("accountAvatarPreview");preview.src=publicUrl;preview.hidden=false;
  input.value="";message.textContent="Your profile picture has been updated.";
 }catch(error){console.error("Profile picture upload failed:",error);message.textContent=error.message||"We couldn't upload that picture. Please try again.";}
 finally{button.disabled=false;}
}

async function showSession(session){
 window.updateOrlongAccountLabel?.(session?.user||null);
 const signedIn=Boolean(session?.user);accountById("authPanel").hidden=signedIn;accountById("dashboard").hidden=!signedIn;
 const userId=signedIn?session.user.id:null;
 if(userId===lastDashboardUserId)return;
 if(!userId&&lastDashboardUserId){try{sessionStorage.removeItem("edenDashboard:"+lastDashboardUserId);}catch(_){}}
 lastDashboardUserId=userId;
 if(signedIn){
  const name=session.user.user_metadata?.display_name;
  if(name)accountById("profileName").textContent=String(name).toUpperCase();
  let cached=null;
  try{cached=JSON.parse(sessionStorage.getItem("edenDashboard:"+userId)||"null");}catch(_){}
  if(cached){
   await loadPersonalDashboard(session.user,cached);
   loadPersonalDashboard(session.user,null,true);
  }else{
   await loadPersonalDashboard(session.user);
  }
  await loadCardCollection(session.user);
 }
}
async function submitAccount(event){
 event.preventDefault();const email=accountById("email").value.trim(),password=accountById("password").value;
 if(accountMode==="signin"){const {data,error}=await accountClient.auth.signInWithPassword({email,password});if(error){setAuthMessage(error.message);return;}await showSession(data.session);return;}
 const displayName=accountById("displayName").value.trim()||"Reader";
 const {data,error}=await accountClient.auth.signUp({email,password,options:{data:{display_name:displayName},emailRedirectTo:window.location.origin+window.location.pathname}});
 if(error){setAuthMessage(error.message);return;}if(data.session)await showSession(data.session);else setAuthMessage("Account created! Check your email and confirm your address before signing in.");
}
async function signOutAccount(){const {error}=await accountClient.auth.signOut();if(error){setAuthMessage("We couldn't sign you out. Please try again.");return;}window.updateOrlongAccountLabel?.(null);lastDashboardUserId=null;accountById("authPanel").hidden=false;accountById("dashboard").hidden=true;setMode("signin");setAuthMessage("You have signed out.");}
document.addEventListener("DOMContentLoaded",async()=>{
 document.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
 accountById("authForm").addEventListener("submit",submitAccount);accountById("signOutButton").addEventListener("click",signOutAccount);accountById("uploadAvatarButton")?.addEventListener("click",uploadProfilePicture);setMode("signin");
 const {data}=await accountClient.auth.getSession();await showSession(data.session);
 accountClient.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>showSession(session),0));
});
