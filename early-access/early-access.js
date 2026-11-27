// ORLONG UNIVERSE — PRIVATE EARLY ACCESS GATE
// The private page is revealed only after a server-side permission check.
const EARLY_ACCESS_SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const EARLY_ACCESS_SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const earlyAccessClient=window.supabase.createClient(EARLY_ACCESS_SUPABASE_URL,EARLY_ACCESS_SUPABASE_KEY);
const byId=id=>document.getElementById(id);
let lastCheckedUserId=null;\nlet missionRows=[];

function showGateState(state){
 byId("checkingPanel").hidden=state!=="checking";
 byId("authPanel").hidden=state!=="signedout";
 byId("deniedPanel").hidden=state!=="denied";
 byId("errorPanel").hidden=state!=="error";
 byId("privateArea").hidden=state!=="granted";
}
function renderMissionProgress(){
 const completed=missionRows.filter(m=>m.is_completed).length;
 const total=missionRows.length;
 const percent=total?Math.round(completed/total*100):0;
 byId("missionCount").textContent=total?completed+" / "+total+" COMPLETE":"NO MISSIONS";
 byId("missionProgressFill").style.width=percent+"%";
 byId("missionProgressTrack").setAttribute("aria-valuemax",String(total));
 byId("missionProgressTrack").setAttribute("aria-valuenow",String(completed));
 byId("missionProgressText").textContent=total
  ?completed+" of "+total+" missions completed · "+percent+"%"
  :"No active missions are available right now.";
}
function renderMissions(){
 const list=byId("missionList");
 list.replaceChildren();
 if(!missionRows.length){
  const empty=document.createElement("div");empty.className="status";empty.textContent="There are no active missions at the moment.";list.append(empty);
  renderMissionProgress();return;
 }
 missionRows.forEach(mission=>{
  const card=document.createElement("article");
  card.className="mission-card"+(mission.is_completed?" is-complete":"");
  const top=document.createElement("div");top.className="mission-card-top";
  const category=document.createElement("span");category.className="mission-category";category.textContent=mission.category;
  const status=document.createElement("span");status.className="mission-status";status.textContent=mission.is_completed?"COMPLETED":"NOT YET COMPLETED";
  top.append(category,status);
  const title=document.createElement("h3");title.textContent=mission.title;
  const description=document.createElement("p");description.textContent=mission.description;
  const instructions=document.createElement("p");instructions.textContent=mission.instructions;
  const actions=document.createElement("div");actions.className="mission-actions";
  const link=document.createElement("a");link.className="secondary";link.href=mission.action_url;link.textContent=mission.action_label;
  const button=document.createElement("button");button.type="button";button.className="mission-complete-button";
  button.textContent=mission.is_completed?"MISSION COMPLETED ✓":"MARK AS COMPLETE";
  button.disabled=!!mission.is_completed;
  button.addEventListener("click",()=>completeMission(mission.mission_key,button));
  actions.append(link,button);
  if(mission.completed_at){
   const date=document.createElement("p");date.className="muted";
   date.textContent="Completed "+new Date(mission.completed_at).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
   card.append(top,title,description,instructions,actions,date);
  }else card.append(top,title,description,instructions,actions);
  list.append(card);
 });
 renderMissionProgress();
}
async function loadMissions(){
 byId("missionList").textContent="Loading your testing missions…";
 byId("missionMessage").textContent="";
 const {data,error}=await earlyAccessClient.rpc("get_my_early_access_missions");
 if(error){
  console.error("Could not load Early Access missions:",error);
  byId("missionList").textContent="We couldn't load your missions. Please check that the Stage 3 SQL migration has been run, then refresh this page.";
  byId("missionCount").textContent="UNAVAILABLE";
  byId("missionProgressText").textContent="Mission progress is temporarily unavailable.";
  return;
 }
 missionRows=Array.isArray(data)?data:[];
 renderMissions();
}
async function completeMission(missionKey,button){
 button.disabled=true;button.textContent="SAVING…";
 byId("missionMessage").textContent="";
 const {error}=await earlyAccessClient.rpc("complete_early_access_mission",{target_mission_key:missionKey});
 if(error){
  console.error("Could not complete Early Access mission:",error);
  byId("missionMessage").textContent=error.message||"We couldn't save that mission. Please try again.";
  button.disabled=false;button.textContent="MARK AS COMPLETE";
  return;
 }
 const mission=missionRows.find(item=>item.mission_key===missionKey);
 if(mission){mission.is_completed=true;mission.completed_at=new Date().toISOString();}
 renderMissions();
 byId("missionMessage").textContent="Mission completed — your progress has been saved to your account.";
}

async function verifyEarlyAccess(user){
 window.updateOrlongAccountLabel?.(user||null);
 if(!user){
  lastCheckedUserId=null;
  showGateState("signedout");
  return;
 }
 if(user.id===lastCheckedUserId)return;
 lastCheckedUserId=user.id;
 showGateState("checking");
 try{
  const {data,error}=await earlyAccessClient.rpc("has_reader_access",{required_access_key:"early_access"});
  if(error)throw error;
  showGateState(data===true?"granted":"denied");\n  if(data===true)await loadMissions();
 }catch(error){
  console.error("Early Access permission check failed:",error);
  byId("accessErrorMessage").textContent=error.message?.includes("has_reader_access")
   ?"The Stage 2 database update hasn't been installed yet. Please run supabase/early-access-stage-2.sql in Supabase, then refresh this page."
   :"We couldn't verify your invitation just now. Please refresh and try again.";
  showGateState("error");
 }
}
byId("earlyAccessSignIn").addEventListener("submit",async event=>{
 event.preventDefault();
 const button=byId("earlyAccessSignInButton"),message=byId("signInMessage");
 button.disabled=true;button.textContent="SIGNING IN…";message.textContent="Checking your account…";
 try{
  const {data,error}=await earlyAccessClient.auth.signInWithPassword({
   email:byId("earlyAccessEmail").value.trim(),
   password:byId("earlyAccessPassword").value
  });
  if(error)throw error;
  await verifyEarlyAccess(data.session?.user||null);
 }catch(error){
  message.textContent=error.message||"We couldn't sign you in. Please check your details.";
 }finally{button.disabled=false;button.textContent="SIGN IN AND CHECK ACCESS";}
});
(async()=>{
 showGateState("checking");
 const {data,error}=await earlyAccessClient.auth.getSession();
 if(error){
  byId("accessErrorMessage").textContent="We couldn't check your current session. Please refresh and try again.";
  showGateState("error");return;
 }
 await verifyEarlyAccess(data.session?.user||null);
 earlyAccessClient.auth.onAuthStateChange((_event,session)=>{
  window.setTimeout(()=>verifyEarlyAccess(session?.user||null),0);
 });
})();
