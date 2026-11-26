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

 // Reading Room and account pages manage their own authentication.
 const accountButton=document.getElementById("openAccountButton");
 if(!accountButton||document.getElementById("accountDialog")||document.getElementById("authForm"))return;
 if(!window.supabase?.createClient)return;
 const client=window.supabase.createClient(
  "https://kqfwtzrfqsfampqfzoal.supabase.co",
  "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes"
 );
 const setAccountLabel=user=>{
  accountButton.textContent=user
   ? String(user.user_metadata?.display_name||"READER").toUpperCase()
   : "SIGN IN";
 };
 client.auth.getSession().then(({data})=>setAccountLabel(data.session?.user||null));
 client.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>setAccountLabel(session?.user||null),0));
 accountButton.addEventListener("click",()=>{
  const target=accountButton.dataset.accountTarget;
  if(target){
   const panel=document.querySelector(target);
   if(panel)panel.scrollIntoView({behavior:"smooth",block:"start"});
   else window.location.href=accountButton.dataset.accountHref||"account.html";
   return;
  }
  window.location.href=accountButton.dataset.accountHref||"books/trials-of-eden/account.html";
 });
});
