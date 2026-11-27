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

async function loadReaderAchievements(){
 const grid=accountById("achievementGrid");
 const summary=accountById("achievementSummary");
 if(!grid||!summary)return;
 grid.replaceChildren();
 summary.textContent="CHECKING YOUR MILESTONES...";
 const {data,error}=await accountClient.rpc("get_my_achievements");
 if(error){
  const note=document.createElement("div");note.className="empty";
  note.textContent="Your achievements are temporarily unavailable. The Stage 5 database update may still need to be run.";
  grid.appendChild(note);summary.textContent="ACHIEVEMENTS UNAVAILABLE";
  console.error("Could not load reader achievements:",error);return;
 }
 const achievements=data||[];
 const unlocked=achievements.filter(item=>item.is_unlocked).length;
 summary.textContent=unlocked+" OF "+achievements.length+" ACHIEVEMENTS UNLOCKED";
 const wrap=document.createElement("div");wrap.className="achievement-grid";
 achievements.forEach(item=>{
  const card=document.createElement("article");
  card.className="achievement-item"+(item.is_unlocked?" is-unlocked":"");
  const top=document.createElement("div");top.className="achievement-topline";
  const title=document.createElement("strong");title.className="achievement-title";title.textContent=item.title;
  const status=document.createElement("span");status.className="achievement-status";status.textContent=item.is_unlocked?"UNLOCKED":"IN PROGRESS";
  top.append(title,status);
  const description=document.createElement("p");description.className="achievement-description";description.textContent=item.description;
  const track=document.createElement("div");track.className="achievement-progress";
  track.setAttribute("role","progressbar");track.setAttribute("aria-label",item.title+" progress");
  track.setAttribute("aria-valuemin","0");track.setAttribute("aria-valuemax",String(item.target_progress));
  track.setAttribute("aria-valuenow",String(item.progress));
  const fill=document.createElement("div");fill.className="achievement-progress-fill";
  fill.style.width=Math.min(100,Math.round(Number(item.progress)/Math.max(1,Number(item.target_progress))*100))+"%";
  track.appendChild(fill);
  const label=document.createElement("small");label.className="achievement-progress-label";
  label.textContent=item.is_unlocked
   ?"MILESTONE ACHIEVED"+(item.unlocked_at?" · "+safeDate(item.unlocked_at):"")
   :Math.min(Number(item.progress),Number(item.target_progress))+" / "+item.target_progress+" COMPLETE";
  card.append(top,description,track,label);wrap.appendChild(card);
 });
 grid.appendChild(wrap);
}


function getDismissedTradeIds(userId){
 try{return new Set(JSON.parse(localStorage.getItem("edenDismissedTrades:"+userId)||"[]"));}
 catch(_){return new Set();}
}
function saveDismissedTradeIds(userId,ids){
 try{localStorage.setItem("edenDismissedTrades:"+userId,JSON.stringify([...ids]));}
 catch(error){console.warn("Could not save dismissed trade offers:",error);}
}

async function loadTradingPost(){
 const status=accountById("tradeStatus"),directory=accountById("publicCollectionDirectory"),offers=accountById("myTradeOffers"),toggle=accountById("publicCollectionToggle");
 if(!status||!directory||!offers||!toggle)return;
 status.textContent="Loading Trading Post...";
 const [visibilityResult,copiesResult,directoryResult,tradesResult]=await Promise.all([
  accountClient.rpc("get_my_card_collection_visibility"),
  accountClient.rpc("get_my_tradeable_card_copies"),
  accountClient.rpc("get_public_card_collections"),
  accountClient.rpc("get_my_card_trades")
 ]);
 const failed=[visibilityResult,copiesResult,directoryResult,tradesResult].find(result=>result.error);
 if(failed){console.error("Could not load Trading Post:",failed.error);status.textContent="The Trading Post could not load. Please check that the Stage 6 database update completed successfully.";return;}
 toggle.checked=visibilityResult.data===true;
 const myCopies=copiesResult.data||[];
 const readers=directoryResult.data||[];
 const myTrades=tradesResult.data||[];
 const {data:userResult}=await accountClient.auth.getUser();
 const currentUserId=userResult?.user?.id;
 const dismissedTradeIds=currentUserId?getDismissedTradeIds(currentUserId):new Set();
 const now=Date.now();
 const visibleTrades=myTrades.filter(trade=>{
  if(trade.status==="pending")return true;
  if(dismissedTradeIds.has(trade.offer_id))return false;
  const resolvedAt=trade.responded_at?new Date(trade.responded_at).getTime():new Date(trade.created_at).getTime();
  return !Number.isFinite(resolvedAt)||now-resolvedAt<24*60*60*1000;
 });
 status.textContent="Your binder is "+(toggle.checked?"PUBLIC":"PRIVATE")+" · "+myCopies.length+" card copies currently available to offer.";
 if(!toggle.dataset.bound){
  toggle.dataset.bound="true";
  toggle.addEventListener("change",async()=>{
   toggle.disabled=true;
   const {data,error}=await accountClient.rpc("set_my_card_collection_visibility",{make_public:toggle.checked});
   if(error){console.error(error);toggle.checked=!toggle.checked;status.textContent="We couldn't update your collection visibility. Please try again.";}
   else status.textContent=data?"Your binder is now public. Other signed-in readers can browse it and make offers.":"Your binder is private. Other readers can no longer browse it.";
   toggle.disabled=false;
   await loadTradingPost();
  });
 }
 directory.replaceChildren();
 if(!readers.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="No readers have made their collections public yet. You can make your own binder public using the setting above.";directory.appendChild(empty);}
 for(const reader of readers){
  const article=document.createElement("article");article.className="trade-reader";
  const heading=document.createElement("div");heading.className="trade-reader-heading";
  const name=document.createElement("strong");name.textContent=reader.display_name||"Reader";
  const count=document.createElement("span");count.className="trade-reader-count";count.textContent=Number(reader.unique_cards||0)+" UNIQUE CARDS · "+Number(reader.total_copies||0)+" COPIES";
  heading.append(name,count);article.appendChild(heading);
  const cardsWrap=document.createElement("div");cardsWrap.className="trade-card-options";
  const view=document.createElement("button");view.type="button";view.className="trade-action secondary";view.textContent="VIEW COLLECTION";
  const cardHolder=document.createElement("div");cardHolder.hidden=true;
  view.addEventListener("click",async()=>{
   if(!cardHolder.hidden){cardHolder.hidden=true;view.textContent="VIEW COLLECTION";return;}
   view.disabled=true;view.textContent="LOADING...";
   const {data,error}=await accountClient.rpc("get_public_card_collection",{target_reader_id:reader.reader_id});
   view.disabled=false;
   if(error){console.error(error);view.textContent="TRY AGAIN";status.textContent="We couldn't open that public binder.";return;}
   cardHolder.replaceChildren();
   cardsWrap.replaceChildren();
   if(!data?.length){const empty=document.createElement("p");empty.className="empty";empty.textContent="This reader's public binder is currently empty.";cardHolder.appendChild(empty);}
   (data||[]).forEach(card=>{
    const option=document.createElement("div");option.className="trade-card-option";
    const title=document.createElement("strong");title.textContent=(card.card_number||"CARD")+" · "+card.card_name;
    const meta=document.createElement("small");meta.textContent=[card.category_label,card.rarity,Number(card.copy_count||0)+" owned"].filter(Boolean).join(" · ");
    option.append(title,meta);
    if(myCopies.length){
     const select=document.createElement("select");select.setAttribute("aria-label","Choose a card to offer for "+card.card_name);
     const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Choose one of your cards to offer";select.appendChild(placeholder);
     myCopies.forEach(copy=>{const opt=document.createElement("option");opt.value=copy.copy_id;opt.textContent=copy.card_number+" · "+copy.card_name;select.appendChild(opt);});
     const send=document.createElement("button");send.type="button";send.textContent="OFFER THIS CARD";send.disabled=true;
     select.addEventListener("change",()=>{send.disabled=!select.value;});
     send.addEventListener("click",async()=>{
      send.disabled=true;send.textContent="SENDING...";
      const {error:offerError}=await accountClient.rpc("create_card_trade_offer",{target_recipient_id:reader.reader_id,offered_copy:select.value,requested_card:card.card_id});
      if(offerError){console.error(offerError);status.textContent=offerError.message||"We couldn't send that offer.";send.disabled=false;send.textContent="OFFER THIS CARD";return;}
      status.textContent="Your trade offer has been sent to "+(reader.display_name||"the reader")+".";
      await loadTradingPost();
     });
     option.append(select,send);
    }else{
     const note=document.createElement("small");note.textContent="You don't currently have an available card copy to offer.";option.appendChild(note);
    }
    cardsWrap.appendChild(option);
   });
   cardHolder.appendChild(cardsWrap);cardHolder.hidden=false;view.textContent="HIDE COLLECTION";
  });
  article.append(view,cardHolder);directory.appendChild(article);
 }
 offers.replaceChildren();
 const historyNote=document.createElement("p");historyNote.className="trade-history-note";
 historyNote.textContent="Completed offers disappear automatically after 24 hours. You can also dismiss them sooner.";
 offers.appendChild(historyNote);
 if(!visibleTrades.length){const empty=document.createElement("div");empty.className="empty";empty.textContent=myTrades.length?"No active or recent trade offers. Completed offers are hidden after 24 hours or when dismissed.":"You don't have any trade offers yet. Offers you send or receive will appear here.";offers.appendChild(empty);}
 visibleTrades.forEach(trade=>{
  const article=document.createElement("article");article.className="trade-offer";
  const role=trade.trade_role==="incoming"?"OFFER RECEIVED FROM ":"OFFER SENT TO ";
  const heading=document.createElement("strong");heading.textContent=role+(trade.other_display_name||"Reader");
  const detail=document.createElement("p");detail.className="muted";detail.textContent="You offer: "+trade.offered_card_number+" · "+trade.offered_card_name+"  |  You request: "+trade.requested_card_number+" · "+trade.requested_card_name;
  const state=document.createElement("p");state.className="trade-status";state.textContent=String(trade.status||"").toUpperCase()+" · "+safeDate(trade.created_at);
  article.append(heading,detail,state);
  if(trade.status==="pending"){
   const actions=document.createElement("div");actions.className="trade-offer-actions";
   const action=(label,accept,secondary,kind)=>{const button=document.createElement("button");button.type="button";button.className="trade-action"+(secondary?" secondary":"");button.textContent=label;button.addEventListener("click",async()=>{button.disabled=true;const result=kind==="cancel"?await accountClient.rpc("cancel_card_trade_offer",{target_offer_id:trade.offer_id}):await accountClient.rpc("respond_to_card_trade",{target_offer_id:trade.offer_id,accept_offer:accept});if(result.error||result.data===false){console.error(result.error);status.textContent=result.error?.message||"We couldn't update this trade.";button.disabled=false;return;}status.textContent=accept?"Trade accepted! Both card copies have been transferred.":"Trade updated.";await loadTradingPost();});actions.appendChild(button);};
   if(trade.trade_role==="incoming"){action("ACCEPT TRADE",true,false);action("DECLINE",false,true);}
   else action("CANCEL OFFER",false,true,"cancel");
   article.appendChild(actions);
  }else{
   const dismiss=document.createElement("button");dismiss.type="button";dismiss.className="trade-action secondary trade-dismiss";
   dismiss.textContent="DISMISS OFFER";
   dismiss.addEventListener("click",()=>{
    dismissedTradeIds.add(trade.offer_id);
    if(currentUserId)saveDismissedTradeIds(currentUserId,dismissedTradeIds);
    article.remove();
    if(!offers.querySelector(".trade-offer")){const empty=document.createElement("div");empty.className="empty";empty.textContent="No active or recent trade offers. Completed offers are hidden after 24 hours or when dismissed.";offers.appendChild(empty);}
   });
   article.appendChild(dismiss);
  }
  offers.appendChild(article);
 });
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
  await Promise.all([loadCardCollection(session.user),loadReaderAchievements(),loadTradingPost()]);
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
