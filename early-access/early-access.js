// ORLONG UNIVERSE — PRIVATE EARLY ACCESS GATE
// The private page is revealed only after a server-side permission check.
const EARLY_ACCESS_SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const EARLY_ACCESS_SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const earlyAccessClient=window.supabase.createClient(EARLY_ACCESS_SUPABASE_URL,EARLY_ACCESS_SUPABASE_KEY);
const byId=id=>document.getElementById(id);
let lastCheckedUserId=null;

function showGateState(state){
 byId("checkingPanel").hidden=state!=="checking";
 byId("authPanel").hidden=state!=="signedout";
 byId("deniedPanel").hidden=state!=="denied";
 byId("errorPanel").hidden=state!=="error";
 byId("privateArea").hidden=state!=="granted";
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
  showGateState(data===true?"granted":"denied");
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
