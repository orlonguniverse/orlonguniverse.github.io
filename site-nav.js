// Shared Orlong navigation behaviour across every page.
window.toggleSiteTheme=function(){
 const light=document.body.classList.toggle("light");
 document.body.classList.toggle("dark",!light);
 localStorage.setItem("orlongSiteTheme",light?"light":"dark");
 const button=document.getElementById("themeButton")||document.getElementById("contentsThemeButton");
 if(button)button.textContent=light?"DARK MODE":"LIGHT MODE";
};
document.addEventListener("DOMContentLoaded",()=>{
 const saved=localStorage.getItem("orlongSiteTheme");
 if(saved==="light"||saved==="dark"){
  document.body.classList.toggle("light",saved==="light");
  document.body.classList.toggle("dark",saved==="dark");
 }
 const themeButton=document.getElementById("themeButton")||document.getElementById("contentsThemeButton");
 if(themeButton)themeButton.textContent=document.body.classList.contains("light")?"DARK MODE":"LIGHT MODE";

 // The Reading Room has its own account dialog and auth controller.
 // Other pages use this shared account shortcut to reach the reader profile.
 const accountButton=document.getElementById("openAccountButton");
 if(!accountButton||document.getElementById("accountDialog"))return;
 const accountUrl=accountButton.dataset.accountHref||"account.html";
 let signedIn=false;
 const setAccountLabel=async user=>{
  signedIn=Boolean(user);
  if(!user){accountButton.textContent="SIGN IN";return;}
  let name=user.user_metadata?.display_name||"READER";
  try{
   const client=window.supabase?.createClient?.(
    "https://kqfwtzrfqsfampqfzoal.supabase.co",
    "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes"
   );
   if(client){
    const {data}=await client.from("reader_profiles").select("display_name").eq("user_id",user.id).maybeSingle();
    if(data?.display_name)name=data.display_name;
   }
  }catch(error){console.warn("Could not load reader display name.",error);}
  accountButton.textContent=String(name).toUpperCase();
 };
 if(window.supabase?.createClient){
  const client=window.supabase.createClient(
   "https://kqfwtzrfqsfampqfzoal.supabase.co",
   "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes"
  );
  client.auth.getSession().then(({data})=>setAccountLabel(data.session?.user||null));
  client.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>setAccountLabel(session?.user||null),0));
 }
 accountButton.addEventListener("click",()=>{
  const target=accountButton.dataset.accountTarget;
  if(target){
   const panel=document.querySelector(signedIn?"#dashboard": "#authPanel")||document.querySelector(target);
   if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"});
   else window.location.href=accountUrl;
   return;
  }
  window.location.href=accountUrl;
 });
});