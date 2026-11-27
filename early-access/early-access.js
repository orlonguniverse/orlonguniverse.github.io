// ORLONG UNIVERSE — PRIVATE EARLY ACCESS
const EARLY_ACCESS_SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const EARLY_ACCESS_SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const earlyAccessClient=window.supabase.createClient(EARLY_ACCESS_SUPABASE_URL,EARLY_ACCESS_SUPABASE_KEY);
const byId=id=>document.getElementById(id);
let lastCheckedUserId=null,missionRows=[];
function showGateState(state){byId("checkingPanel").hidden=state!=="checking";byId("authPanel").hidden=state!=="signedout";byId("deniedPanel").hidden=state!=="denied";byId("errorPanel").hidden=state!=="error";byId("privateArea").hidden=state!=="granted";}
function renderMissionProgress(){
 const completed=missionRows.filter(m=>m.is_completed).length,total=missionRows.length,percent=total?Math.round(completed/total*100):0;
 byId("missionCount").textContent=total?completed+" / "+total+" MISSIONS":"NO MISSIONS";
 byId("missionProgressFill").style.width=percent+"%";byId("missionProgressTrack").setAttribute("aria-valuemax",String(total));byId("missionProgressTrack").setAttribute("aria-valuenow",String(completed));
 byId("missionProgressText").textContent=total?completed+" of "+total+" missions complete · "+percent+"% of your Founding Reader journey":"No active missions are available right now.";
 byId("rewardCount").textContent=completed+" / "+total+" CHARACTER PACKS OPENED";
}
function makeMissionCard(m){
 const card=document.createElement("article");card.className="mission-card"+(m.is_completed?" is-complete":"")+(m.is_verified&&!m.is_completed?" is-ready":"");
 const top=document.createElement("div");top.className="mission-card-top";
 const cat=document.createElement("span");cat.className="mission-category";cat.textContent=m.category;
 const status=document.createElement("span");status.className="mission-status";status.textContent=m.is_completed?"COMPLETED":m.is_verified?"READY TO CLAIM":"ACTIVITY REQUIRED";top.append(cat,status);
 const title=document.createElement("h3");title.textContent=m.title;
 const desc=document.createElement("p");desc.className="mission-description";desc.textContent=m.description;
 const instructions=document.createElement("p");instructions.className="mission-instructions";instructions.textContent=m.instructions;
 const actions=document.createElement("div");actions.className="mission-actions";
 const link=document.createElement("a");link.className="mission-visit-link";link.href=m.action_url;link.textContent=m.action_label;
 const button=document.createElement("button");button.type="button";button.className="mission-complete-button";
 button.textContent=m.is_completed?"MISSION COMPLETE ✓":m.is_verified?"OPEN CHARACTER PACK":"COMPLETE THE ACTIVITY FIRST";
 button.disabled=!!m.is_completed||!m.is_verified;
 if(!m.is_completed&&m.is_verified)button.addEventListener("click",()=>completeMission(m.mission_key,button));
 const visitTracked=["account-profile","reading-room","collectible-binder","trading-post","achievements","explore-eden","founding-readers"];
 if(visitTracked.includes(m.mission_key))link.addEventListener("click",async event=>{event.preventDefault();link.style.pointerEvents="none";link.textContent="RECORDING VISIT…";const {error}=await earlyAccessClient.rpc("record_early_access_mission_visit",{target_mission_key:m.mission_key});if(error){console.error(error);byId("missionMessage").textContent=error.message||"Visit could not be recorded. Please try again.";link.style.pointerEvents="";link.textContent=m.action_label;return;}window.location.href=m.action_url;});
 actions.append(link,button);card.append(top,title,desc,instructions,actions);
 if(m.is_completed&&m.reward_card_id){
  const reward=document.createElement("div");reward.className="mission-reward";
  const image=m.reward_card_artwork?document.createElement("img"):document.createElement("div");if(m.reward_card_artwork){image.src=m.reward_card_artwork;image.alt=m.reward_card_name+" collectible card";image.loading="lazy";}else{image.className="mission-reward-placeholder";image.textContent="SPECIAL EDITION";image.setAttribute("aria-label","Special Edition character card");}
  const details=document.createElement("div");details.className="mission-reward-details";
  const label=document.createElement("span");label.className="reward-eyebrow";label.textContent="EXCLUSIVE CARD UNLOCKED";
  const name=document.createElement("strong");name.textContent=m.reward_card_name;
  const number=document.createElement("small");number.textContent=m.reward_card_number+" · "+String(m.reward_card_rarity||"").toUpperCase();
  const note=document.createElement("small");note.textContent="Added to your reader binder.";details.append(label,name,number,note);reward.append(image,details);card.append(reward);
 }
 if(m.completed_at){const date=document.createElement("p");date.className="mission-date";date.textContent="Unlocked "+new Date(m.completed_at).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});card.append(date);}
 return card;
}
function renderMissions(){
 const list=byId("missionList");list.replaceChildren();
 if(!missionRows.length){const empty=document.createElement("div");empty.className="status";empty.textContent="There are no active missions at the moment.";list.append(empty);renderMissionProgress();return;}
 const groups=[["GETTING STARTED","YOUR READER ACCOUNT",["GETTING STARTED"]],["THE READING EXPERIENCE","EXPLORE & PARTICIPATE",["READING EXPERIENCE","COMMUNITY"]],["COLLECT & DISCOVER","THE COLLECTOR'S PATH",["COLLECTIBLES"]],["THE FINAL REVIEW","HELP SHAPE WHAT COMES NEXT",["FINAL REVIEW"]]];
 const assigned=new Set();
 groups.forEach(([eyebrow,title,categories])=>{const rows=missionRows.filter(m=>categories.includes(m.category));if(!rows.length)return;rows.forEach(m=>assigned.add(m.mission_key));
  const section=document.createElement("section");section.className="mission-group";const heading=document.createElement("div");heading.className="mission-group-heading";
  const small=document.createElement("span");small.textContent=eyebrow;const h=document.createElement("h3");h.textContent=title;heading.append(small,h);
  const cards=document.createElement("div");cards.className="mission-list";rows.forEach(m=>cards.append(makeMissionCard(m)));section.append(heading,cards);list.append(section);
 });
 const other=missionRows.filter(m=>!assigned.has(m.mission_key));if(other.length){const cards=document.createElement("div");cards.className="mission-list";other.forEach(m=>cards.append(makeMissionCard(m)));list.append(cards);}
 renderMissionProgress();
}
async function loadMissions(){
 byId("missionList").textContent="Loading your missions…";byId("missionMessage").textContent="";
 const {data,error}=await earlyAccessClient.rpc("get_my_early_access_missions");
 if(error){console.error(error);byId("missionList").textContent="We couldn't load your missions. Please run the Stage 4 verified-missions SQL migration, then refresh.";byId("missionCount").textContent="MISSIONS UNAVAILABLE";byId("missionProgressText").textContent="Mission progress is temporarily unavailable.";return;}
 missionRows=Array.isArray(data)?data:[];renderMissions();
}
async function completeMission(key,button){
 button.disabled=true;button.textContent="VERIFYING & UNLOCKING…";byId("missionMessage").textContent="";
 // The database RPC is the authority: never show a reveal on a failed claim.
 const {data,error}=await earlyAccessClient.rpc("complete_early_access_mission",{target_mission_key:key});
 if(error){console.error(error);byId("missionMessage").textContent=error.message||"The activity has not been verified yet. Visit the mission area and try again.";button.disabled=false;button.textContent="OPEN CHARACTER PACK";return;}
 await loadMissions();
 const awarded=missionRows.find(m=>m.mission_key===key);
 if(!awarded?.is_completed||!awarded?.reward_card_id){
  byId("missionMessage").textContent="Your mission was accepted by the server. Refresh your missions to view the card added to your binder.";
  return;
 }
 byId("missionMessage").textContent="Mission complete! Your card has been added to your reader binder.";
 // The sitewide card-copy watcher handles this reward, just like every other card award.
}
async function submitTesterFeedback(event){
 event.preventDefault();const input=byId("testerFeedbackText"),button=byId("submitTesterFeedbackButton"),message=byId("testerFeedbackMessage"),feedback=input.value.trim();
 if(feedback.length<20){message.textContent="Please enter at least 20 characters so your feedback is useful.";return;}
 button.disabled=true;button.textContent="SUBMITTING…";message.textContent="Saving your feedback securely…";
 const {error}=await earlyAccessClient.rpc("submit_early_access_feedback",{feedback_text:feedback});
 if(error){message.textContent=error.message||"We couldn't save your feedback. Please try again.";button.disabled=false;button.textContent="SUBMIT FEEDBACK";return;}
 input.value="";message.textContent="Thank you — your feedback has been submitted. Your final mission is now ready to claim.";await loadMissions();button.textContent="FEEDBACK SUBMITTED";
}
async function verifyEarlyAccess(user){
 window.updateOrlongAccountLabel?.(user||null);if(!user){lastCheckedUserId=null;showGateState("signedout");return;}if(user.id===lastCheckedUserId)return;
 lastCheckedUserId=user.id;showGateState("checking");
 try{const {data,error}=await earlyAccessClient.rpc("has_reader_access",{required_access_key:"early_access"});if(error)throw error;showGateState(data===true?"granted":"denied");if(data===true)await loadMissions();}
 catch(error){console.error(error);byId("accessErrorMessage").textContent=error.message?.includes("has_reader_access")?"The access database update hasn't been installed yet. Please run the Stage 2 database update, then refresh.":"We couldn't verify your invitation just now. Please refresh and try again.";showGateState("error");}
}
byId("earlyAccessSignIn").addEventListener("submit",async event=>{event.preventDefault();const button=byId("earlyAccessSignInButton"),message=byId("signInMessage");button.disabled=true;button.textContent="SIGNING IN…";message.textContent="Checking your account…";
 try{const {data,error}=await earlyAccessClient.auth.signInWithPassword({email:byId("earlyAccessEmail").value.trim(),password:byId("earlyAccessPassword").value});if(error)throw error;await verifyEarlyAccess(data.session?.user||null);}
 catch(error){message.textContent=error.message||"We couldn't sign you in. Please check your details.";}finally{button.disabled=false;button.textContent="SIGN IN AND CHECK ACCESS";}
});
byId("testerFeedbackForm").addEventListener("submit",submitTesterFeedback);
(async()=>{showGateState("checking");const {data,error}=await earlyAccessClient.auth.getSession();if(error){byId("accessErrorMessage").textContent="We couldn't check your current session. Please refresh and try again.";showGateState("error");return;}await verifyEarlyAccess(data.session?.user||null);earlyAccessClient.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>verifyEarlyAccess(session?.user||null),0));})();