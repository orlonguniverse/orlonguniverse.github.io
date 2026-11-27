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
 const button=document.getElementById("themeButton")||document.getElementById("contentsThemeButton")||document.getElementById("mainMenuThemeButton");
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

 // Restore the familiar READ / COMMUNITY navigation. MAIN MENU is reserved
 // for personal settings, statistics and background music only.
 const navLinks=document.querySelector(".topbar-right, .top-actions");
 if(navLinks&&!navLinks.dataset.orlongGrouped){
  const original=[...navLinks.children];
  const accountButton=navLinks.querySelector("#openAccountButton, #mainAccountButton, .nav-account-button");
  const statsLink=[...navLinks.querySelectorAll("a")].find(a=>/MY STATISTICS/i.test(a.textContent)||/account\.html#dashboard|account\.html\?/.test(a.getAttribute("href")||""));
  const makeLink=(label,href,current=false)=>{
   const a=document.createElement("a");a.href=href;a.textContent=label;
   if(current)a.setAttribute("aria-current","page");
   return a;
  };
  const dropdown=(label,items)=>{
   const details=document.createElement("details");details.className="nav-dropdown";
   const summary=document.createElement("summary");summary.textContent=label;summary.setAttribute("aria-haspopup","true");
   const panel=document.createElement("div");panel.className="nav-dropdown-menu";
   items.forEach(item=>panel.append(makeLink(item[0],item[1],item[2])));
   details.append(summary,panel);
   summary.addEventListener("click",()=>navLinks.querySelectorAll(".nav-dropdown[open]").forEach(openMenu=>{if(openMenu!==details)openMenu.removeAttribute("open");}));
   return details;
  };
  const read=dropdown("READ",[
   ["HOME","/"],
   ["BOOK CONTENTS","/books/trials-of-eden/contents.html",location.pathname.endsWith("/contents.html")],
   ["READING ROOM","/books/trials-of-eden/",location.pathname.startsWith("/books/trials-of-eden/")&&!location.pathname.endsWith("contents.html")&&!location.pathname.endsWith("account.html")],
   ["EXPLORE EDEN","/explore-eden/",location.pathname.startsWith("/explore-eden")]
  ]);
  const communityItems=[
   ["EVENTS","/events.html",location.pathname.endsWith("/events.html")],
   ["EARLY ACCESS","/early-access/",location.pathname.startsWith("/early-access")],
   ["FOUNDING READERS","/founding-readers/",location.pathname.startsWith("/founding-readers")]
  ];
  const community=dropdown("COMMUNITY",communityItems);
  const main=document.createElement("details");main.className="nav-dropdown nav-main-menu";
  const mainSummary=document.createElement("summary");mainSummary.textContent="MAIN MENU";mainSummary.setAttribute("aria-haspopup","true");
  const panel=document.createElement("div");panel.className="nav-dropdown-menu nav-main-menu-panel";
  const settingsLabel=document.createElement("span");settingsLabel.className="nav-menu-section-label";settingsLabel.textContent="SETTINGS";
  const theme=document.createElement("button");theme.type="button";theme.id="mainMenuThemeButton";theme.className="nav-menu-action";theme.textContent=document.body.classList.contains("light")?"DARK MODE":"LIGHT MODE";theme.addEventListener("click",window.toggleSiteTheme);
  panel.append(settingsLabel,theme);
  if(statsLink){statsLink.textContent="MY STATISTICS";statsLink.href=statsLink.getAttribute("href")||"/books/trials-of-eden/account.html#dashboard";statsLink.classList.add("nav-menu-statistics");panel.append(statsLink);}
  const musicSlot=document.createElement("div");musicSlot.className="nav-menu-music-slot";musicSlot.id="orlongMenuMusicSlot";panel.append(musicSlot);
  main.append(mainSummary,panel);
  mainSummary.addEventListener("click",()=>navLinks.querySelectorAll(".nav-dropdown[open]").forEach(openMenu=>{if(openMenu!==main)openMenu.removeAttribute("open");}));
  const instagram=document.createElement("a");instagram.className="nav-social-link";instagram.href="https://www.instagram.com/orlong_official/";instagram.target="_blank";instagram.rel="noopener noreferrer";instagram.setAttribute("aria-label","Orlong on Instagram");instagram.title="Instagram";instagram.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
  navLinks.replaceChildren(read,community);
  if(accountButton)navLinks.append(accountButton);
  navLinks.append(main,instagram);
  navLinks.dataset.orlongGrouped="true";
  document.addEventListener("click",event=>{if(!navLinks.contains(event.target))navLinks.querySelectorAll(".nav-dropdown[open]").forEach(d=>d.removeAttribute("open"));});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")navLinks.querySelectorAll(".nav-dropdown[open]").forEach(d=>d.removeAttribute("open"));});
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
  const musicScript=document.createElement("script");musicScript.src="/assets/js/orlong-audio.js?v=stage-6c";musicScript.dataset.orlongMusic="true";document.body.appendChild(musicScript);
 }
});
