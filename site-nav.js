// Shared Orlong navigation behaviour across every page.
window.updateOrlongAccountLabel=function(user){
 const button=document.getElementById("openAccountButton");
 if(!button)return;
 const metadataName=user?.user_metadata?.display_name;
 const emailName=user?.email?.split("@")[0];
 button.textContent=user?String(metadataName||emailName||"READER").toUpperCase():"SIGN IN";
 button.setAttribute("aria-label",user?"Signed in as "+String(metadataName||emailName||"Reader"):"Sign in");
};
window.updateOrlongModeratorLink=async function(user,client){
 const nav=document.querySelector(".topbar-right, .top-actions");
 if(!nav)return;
 const existing=nav.querySelector(".nav-moderator-link");
 if(!user){existing?.remove();return;}
 try{
  const {data,error}=await client.rpc("is_reader_moderator");
  if(error||data!==true){existing?.remove();return;}
  if(!nav.querySelector(".nav-moderator-link")){
   const link=document.createElement("a");link.href="/moderator/";link.textContent="MODERATOR HQ";link.className="nav-moderator-link";
   const menu=nav.querySelector(".nav-main-menu-panel");
   if(menu){const slot=menu.querySelector(".nav-menu-music-slot");menu.insertBefore(link,slot||null);}
   else nav.append(link);
  }
 }catch(error){existing?.remove();console.warn("Moderator navigation is unavailable:",error);}
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

 // One unified MAIN MENU for navigation, reader account, statistics and soundtrack.
 const navLinks=document.querySelector(".topbar-right, .top-actions");
 if(navLinks&&!navLinks.dataset.orlongGrouped){
  const accountButton=navLinks.querySelector("#openAccountButton, #mainAccountButton, .nav-account-button");
  const statsLink=[...navLinks.querySelectorAll("a")].find(a=>/account\\.html#dashboard|account\\.html\\?/.test(a.getAttribute("href")||"")||/MY STATISTICS/i.test(a.textContent));
  navLinks.replaceChildren();
  const details=document.createElement("details");details.className="nav-dropdown nav-main-menu";
  const summary=document.createElement("summary");summary.textContent="MAIN MENU";summary.setAttribute("aria-haspopup","true");details.append(summary);
  const menu=document.createElement("div");menu.className="nav-dropdown-menu nav-main-menu-panel";
  const addLink=(label,href,current=false)=>{const a=document.createElement("a");a.href=href;a.textContent=label;if(current)a.setAttribute("aria-current","page");menu.append(a);};
  addLink("HOME","/");
  addLink("BOOK CONTENTS","/books/trials-of-eden/contents.html",location.pathname.endsWith("/contents.html"));
  addLink("READING ROOM","/books/trials-of-eden/",location.pathname.startsWith("/books/trials-of-eden/")&&!location.pathname.endsWith("contents.html")&&!location.pathname.endsWith("account.html"));
  addLink("EXPLORE EDEN","/explore-eden/",location.pathname.startsWith("/explore-eden"));
  addLink("EVENTS","/events.html",location.pathname.endsWith("/events.html"));
  addLink("EARLY ACCESS","/early-access/",location.pathname.startsWith("/early-access"));
  addLink("FOUNDING READERS","/founding-readers/",location.pathname.startsWith("/founding-readers"));
  if(accountButton){accountButton.classList.add("nav-menu-account");menu.append(accountButton);}
  if(statsLink){statsLink.textContent="MY STATISTICS";menu.append(statsLink);}
  const musicSlot=document.createElement("div");musicSlot.className="nav-menu-music-slot";musicSlot.id="orlongMenuMusicSlot";menu.append(musicSlot);
  const instagram=document.createElement("a");instagram.className="nav-social-link";instagram.href="https://www.instagram.com/orlong_official/";instagram.target="_blank";instagram.rel="noopener noreferrer";instagram.textContent="INSTAGRAM";menu.append(instagram);
  details.append(menu);
  summary.addEventListener("click",()=>{navLinks.querySelectorAll(".nav-dropdown[open]").forEach(openMenu=>{if(openMenu!==details)openMenu.removeAttribute("open");});});
  navLinks.append(details);navLinks.dataset.orlongGrouped="true";
  document.addEventListener("click",event=>{if(!navLinks.contains(event.target))details.removeAttribute("open");});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")details.removeAttribute("open");});
 }
 // Keep the account button's navigation behaviour independent of authentication.
 const accountButton=document.getElementById("openAccountButton");
 if(accountButton&&!document.getElementById("authForm")&&!document.getElementById("accountDialog")){
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
 }

 // Load Supabase when a page does not already include it, so the signed-in
 // username is shown consistently throughout the entire website.
 const initialiseSharedAccountLabel=()=>{
  if(!window.supabase?.createClient)return;
  if(!window.orlongNavigationClient){
   window.orlongNavigationClient=window.supabase.createClient(
    "https://kqfwtzrfqsfampqfzoal.supabase.co",
    "sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes"
   );
  }
  const client=window.orlongNavigationClient;
  const setAccountLabel=user=>window.updateOrlongAccountLabel(user);
  client.auth.getSession().then(({data,error})=>{
   if(!error){const user=data.session?.user||null;setAccountLabel(user);window.updateOrlongModeratorLink?.(user,client);}
  }).catch(()=>{});
  client.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(()=>{const user=session?.user||null;setAccountLabel(user);window.updateOrlongModeratorLink?.(user,client);},0);
  });
 };
 if(window.supabase?.createClient){
  initialiseSharedAccountLabel();
 }else{
  if(!window.__orlongSupabaseLoad){
   window.__orlongSupabaseLoad=new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload=resolve;
    script.onerror=reject;
    document.head.appendChild(script);
   });
  }
  window.__orlongSupabaseLoad.then(initialiseSharedAccountLabel).catch(()=>{});
 }
 // Shared optional background soundtrack control on pages using the site navigation.
 if(!document.querySelector("script[data-orlong-music]")){
  const musicScript=document.createElement("script");musicScript.src="/assets/js/orlong-audio.js?v=stage-6a";musicScript.dataset.orlongMusic="true";document.body.appendChild(musicScript);
 }
});
