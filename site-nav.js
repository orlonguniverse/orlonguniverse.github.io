// Shared Orlong navigation behaviour across every page.
window.updateOrlongAccountLabel=function(user){
 const button=document.getElementById("openAccountButton");
 if(!button)return;
 const metadataName=user?.user_metadata?.display_name;
 const emailName=user?.email?.split("@")[0];
 button.textContent=user?String(metadataName||emailName||"READER").toUpperCase():"SIGN IN";
 button.setAttribute("aria-label",user?"Signed in as "+String(metadataName||emailName||"Reader"):"Sign in");
};
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

 // Temporary Stage 2 route: keep Early Access discoverable from the shared main menu.
 const navLinks=document.querySelector(".topbar-right, .top-actions");
 if(navLinks&&!navLinks.querySelector("[data-early-access-nav]")){
  const earlyLink=document.createElement("a");
  earlyLink.href="/early-access/";
  earlyLink.textContent="EARLY ACCESS";
  earlyLink.dataset.earlyAccessNav="true";
  const eventsLink=[...navLinks.querySelectorAll("a")].find(link=>/events\\.html(?:$|[?#])/.test(link.getAttribute("href")||""));
  if(eventsLink)eventsLink.insertAdjacentElement("afterend",earlyLink);
  else navLinks.appendChild(earlyLink);
 }

 // Account forms manage their own session and call the shared label updater.
 const accountButton=document.getElementById("openAccountButton");
 if(!accountButton||document.getElementById("authForm")||!window.supabase?.createClient)return;
 const client=window.supabase.createClient(
  "https://kqfwtzrfqsfampqfzoal.supabase.co",
  "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes"
 );
 const setAccountLabel=user=>window.updateOrlongAccountLabel(user);
 client.auth.getSession().then(({data})=>setAccountLabel(data.session?.user||null));
 client.auth.onAuthStateChange((_event,session)=>window.setTimeout(()=>setAccountLabel(session?.user||null),0));
 if(document.getElementById("accountDialog"))return;
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
