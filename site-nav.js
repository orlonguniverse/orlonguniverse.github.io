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
   nav.append(link);
  }
 }catch(error){existing?.remove();console.warn("Moderator navigation is unavailable:",error);}
};
window.enterBookOnlyMode=function(){
 try{localStorage.setItem("orlongBookOnlyMode","true");localStorage.setItem("edenBookOnlyMode","true");}catch(error){}
 const readerPath="/books/trials-of-eden/";
 if(window.location.pathname===readerPath||window.location.pathname===readerPath+"index.html"){
  if(window.location.hash!=="#chapter")window.history.replaceState(null,"",window.location.pathname+window.location.search+"#chapter");
  window.location.reload();
  return;
 }
 window.location.href=readerPath+"#chapter";
};
window.toggleSiteTheme=function(){
 const light=document.body.classList.toggle("light");
 document.body.classList.toggle("dark",!light);
 localStorage.setItem("orlongSiteTheme",light?"light":"dark");
 const button=document.getElementById("mainMenuThemeButton");
 if(button)button.textContent=light?"DARK MODE":"LIGHT MODE";
};
document.addEventListener("DOMContentLoaded",()=>{
 const bookOnlyEnabled=localStorage.getItem("orlongBookOnlyMode")==="true"||localStorage.getItem("edenBookOnlyMode")==="true";
 const isReadingRoom=location.pathname==="/books/trials-of-eden/"||location.pathname==="/books/trials-of-eden/index.html";
 if(bookOnlyEnabled&&isReadingRoom)document.body.classList.add("book-only-mode");
 const saved=localStorage.getItem("orlongSiteTheme");
 if(saved==="light"||saved==="dark"){
  document.body.classList.toggle("light",saved==="light");
  document.body.classList.toggle("dark",saved==="dark");
 }
 // Build the same navigation on every page from one shared template.
 const navLinks=document.querySelector(".topbar-right, .top-actions");
 if(navLinks&&!navLinks.dataset.orlongGrouped){
  const accountButton=navLinks.querySelector("#openAccountButton, #mainAccountButton, .nav-account-button");
  const statsLink=[...navLinks.querySelectorAll("a")].find(a=>/MY STATISTICS/i.test(a.textContent)||/account\.html(?:#dashboard|\?)/i.test(a.getAttribute("href")||""))||document.createElement("a");
  statsLink.textContent="MY STATISTICS";
  statsLink.href="/books/trials-of-eden/account.html#dashboard";
  statsLink.classList.add("nav-menu-statistics");
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
  const startReading=makeLink("START READING","/books/trials-of-eden/",location.pathname.startsWith("/books/trials-of-eden/")&&!location.pathname.endsWith("contents.html")&&!location.pathname.endsWith("account.html"));
  startReading.classList.add("nav-start-reading");
  const read=dropdown("THE BOOK",[
   ["READING ROOM","/books/trials-of-eden/"],
   ["CHAPTER CONTENTS","/books/trials-of-eden/contents.html",location.pathname.endsWith("/contents.html")]
  ]);
  const exploreEden=makeLink("EXPLORE EDEN","/explore-eden/",location.pathname.startsWith("/explore-eden"));
  exploreEden.classList.add("nav-explore-eden");
  const community=dropdown("DISCOVER",[
   ["EVENTS","/events.html",location.pathname.endsWith("/events.html")],
   ["EDEN ARCHIVE","/eden-archive/",location.pathname.startsWith("/eden-archive")],
   ["EARLY ACCESS","/early-access/",location.pathname.startsWith("/early-access")],
   ["FOUNDING READERS","/founding-readers/",location.pathname.startsWith("/founding-readers")]
  ]);
  const main=document.createElement("details");main.className="nav-dropdown nav-main-menu";
  const mainSummary=document.createElement("summary");mainSummary.textContent="MAIN MENU";mainSummary.setAttribute("aria-haspopup","true");
  const panel=document.createElement("div");panel.className="nav-dropdown-menu nav-main-menu-panel";
  const settingsLabel=document.createElement("span");settingsLabel.className="nav-menu-section-label";settingsLabel.textContent="SETTINGS";
  const theme=document.createElement("button");theme.type="button";theme.id="mainMenuThemeButton";theme.className="nav-menu-action";theme.textContent=document.body.classList.contains("light")?"DARK MODE":"LIGHT MODE";theme.addEventListener("click",window.toggleSiteTheme);
  const bookOnly=document.createElement("button");bookOnly.type="button";bookOnly.id="mainMenuBookOnlyButton";bookOnly.className="nav-menu-action";bookOnly.textContent="TURN ON BOOK-ONLY MODE";bookOnly.addEventListener("click",()=>window.enterBookOnlyMode());
  const musicSlot=document.createElement("div");musicSlot.className="nav-menu-music-slot";musicSlot.id="orlongMenuMusicSlot";
  const guideLink=makeLink("READER GUIDE","/getting-started.html",location.pathname.endsWith("/getting-started.html"));
  guideLink.classList.add("nav-guide-link");
  panel.append(guideLink,settingsLabel,theme,bookOnly,statsLink,musicSlot);
  main.append(mainSummary,panel);
  mainSummary.addEventListener("click",()=>navLinks.querySelectorAll(".nav-dropdown[open]").forEach(openMenu=>{if(openMenu!==main)openMenu.removeAttribute("open");}));
  const bookOnlyEntry=document.createElement("button");
  bookOnlyEntry.type="button";
  bookOnlyEntry.id="navBookOnlyModeButton";
  bookOnlyEntry.className="nav-book-only-entry";
  bookOnlyEntry.textContent="BOOK-ONLY MODE";
  bookOnlyEntry.setAttribute("aria-label","Enter Book-Only Mode");
  bookOnlyEntry.addEventListener("click",window.enterBookOnlyMode);
  const instagram=document.createElement("a");instagram.className="nav-social-link";instagram.href="https://www.instagram.com/orlong_official/";instagram.target="_blank";instagram.rel="noopener noreferrer";instagram.setAttribute("aria-label","Orlong on Instagram");instagram.title="Instagram";instagram.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>';
  if(bookOnlyEnabled&&isReadingRoom){
   const exitBookOnly=document.createElement("button");
   exitBookOnly.type="button";
   exitBookOnly.id="exitBookOnlyModeButton";
   exitBookOnly.className="nav-menu-action nav-book-only-exit";
   exitBookOnly.textContent="EXIT BOOK-ONLY MODE";
   exitBookOnly.setAttribute("aria-label","Exit Book-Only Mode and restore website navigation");
   exitBookOnly.addEventListener("click",()=>{
    localStorage.setItem("orlongBookOnlyMode","false");
    localStorage.setItem("edenBookOnlyMode","false");
    window.location.reload();
   });
   navLinks.replaceChildren();
   if(accountButton)navLinks.append(accountButton);
   navLinks.append(exitBookOnly,instagram);
  }else{
   navLinks.replaceChildren(startReading,read,exploreEden,community);
   if(accountButton)navLinks.append(accountButton);
   navLinks.append(main,bookOnlyEntry,instagram);
  }
  navLinks.dataset.orlongGrouped="true";
  // Load moderator-managed navigation when the Website Map migration is installed.
  const loadManagedNavigation=async()=>{
   if(bookOnlyEnabled&&isReadingRoom)return;
   try{
    const navClient=window.orlongNavigationClient||window.supabase?.createClient?.("https://kqfwtzrfqsfampqfzoal.supabase.co","sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes");
    if(!navClient)return;
    const {data,error}=await navClient.rpc("get_public_orlong_navigation");
    if(error||!data||!Array.isArray(data.links))return;
    const items=data.links.filter(item=>item.enabled!==false).sort((a,b)=>(a.group||"").localeCompare(b.group||"")||(a.order??0)-(b.order??0));
    const makeManagedLink=item=>{const a=makeLink(item.label,item.href,location.pathname===item.href||location.pathname===item.href.replace(/index\\.html$/,""));a.dataset.navigationId=item.id;return a;};
    const primary=items.filter(item=>item.group==="primary").map(makeManagedLink);
    const bookItems=items.filter(item=>item.group==="book").map(item=>[item.label,item.href,location.pathname===item.href]);
    const discoverItems=items.filter(item=>item.group==="discover").map(item=>[item.label,item.href,location.pathname===item.href]);
    const menuSettings=Array.isArray(data.menus)?data.menus:[{id:"book",label:"THE BOOK",enabled:true},{id:"discover",label:"DISCOVER",enabled:true}];
    const bookSettings=menuSettings.find(item=>item.id==="book")||{label:"THE BOOK",enabled:true};
    const discoverSettings=menuSettings.find(item=>item.id==="discover")||{label:"DISCOVER",enabled:true};
    const mainSettings=data.mainMenu||{};
    mainSummary.textContent=mainSettings.label||"MAIN MENU";
    panel.replaceChildren();
    if(mainSettings.showGuide!==false)panel.append(guideLink);
    if(mainSettings.showTheme!==false||mainSettings.showBookOnly!==false){
     panel.append(settingsLabel);
     if(mainSettings.showTheme!==false)panel.append(theme);
     if(mainSettings.showBookOnly!==false)panel.append(bookOnly);
    }
    if(mainSettings.showStatistics!==false)panel.append(statsLink);
    if(mainSettings.showSoundtrack!==false)panel.append(musicSlot);
    const managedMenus=menuSettings.filter(item=>item.enabled!==false).sort((a,b)=>(a.order??0)-(b.order??0)).map(item=>dropdown(item.label||(item.id==="book"?"THE BOOK":"DISCOVER"),item.id==="book"?bookItems:discoverItems));
    navLinks.replaceChildren(...primary,...managedMenus);
    if(accountButton)navLinks.append(accountButton);
    if(mainSettings.enabled!==false)navLinks.append(main);
    navLinks.append(bookOnlyEntry,instagram);
   }catch(error){console.warn("Managed Orlong navigation could not load:",error);}
  };
  window.applyOrlongManagedNavigation=loadManagedNavigation;
  document.addEventListener("click",event=>{if(!navLinks.contains(event.target))navLinks.querySelectorAll(".nav-dropdown[open]").forEach(d=>d.removeAttribute("open"));});
  document.addEventListener("keydown",event=>{if(event.key==="Escape")navLinks.querySelectorAll(".nav-dropdown[open]").forEach(d=>d.removeAttribute("open"));});
 }
 const accountButton=document.getElementById("openAccountButton");
 if(accountButton&&!document.getElementById("authForm")&&!document.getElementById("accountDialog")){
  accountButton.addEventListener("click",()=>{
   const target=accountButton.dataset.accountTarget;
   if(target){const panel=document.querySelector(target);if(panel){panel.scrollIntoView({behavior:"smooth",block:"start"});return;}}
   window.location.href=accountButton.dataset.accountHref||"/books/trials-of-eden/account.html";
  });
 }
 // Install reveal/audio features only after their functions are defined, avoiding
 // the intermittent temporal-dead-zone error on pages where Supabase loads first.
 const installCardRevealSystem=()=>{
  if(!document.querySelector("link[data-orlong-reveal-css]")){
   const css=document.createElement("link");css.rel="stylesheet";css.href="/assets/css/card-reveal.css?v=stage-7d4";css.dataset.orlongRevealCss="true";document.head.append(css);
  }
  const loadWatcher=()=>{
   if(window.OrlongCardRevealWatcher){window.OrlongCardRevealWatcher.start();return;}
   if(document.querySelector("script[data-orlong-reveal-watcher]"))return;
   const watcher=document.createElement("script");watcher.src="/assets/js/card-reveal-watcher.js?v=stage-7d3";watcher.dataset.orlongRevealWatcher="true";document.body.append(watcher);
  };
  if(window.OrlongCardReveal){loadWatcher();return;}
  if(document.querySelector("script[data-orlong-reveal-core]"))return;
  const reveal=document.createElement("script");reveal.src="/assets/js/card-reveal.js?v=stage-7d3";reveal.dataset.orlongRevealCore="true";reveal.onload=loadWatcher;document.body.append(reveal);
 };
 const initialiseSharedAccountLabel=()=>{
  if(!window.supabase?.createClient)return;
  if(!window.orlongNavigationClient){
   window.orlongNavigationClient=window.supabase.createClient("https://kqfwtzrfqsfampqfzoal.supabase.co","sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes");
  }
  const client=window.orlongNavigationClient;
  client.auth.getSession().then(({data,error})=>{
   if(!error){const user=data.session?.user||null;window.updateOrlongAccountLabel(user);window.updateOrlongModeratorLink?.(user,client);}
  }).catch(()=>{});
  client.auth.onAuthStateChange((_event,session)=>{
   window.setTimeout(()=>{const user=session?.user||null;window.updateOrlongAccountLabel(user);window.updateOrlongModeratorLink?.(user,client);},0);
  });
 };
 const installSharedAudio=()=>{
  if(!document.querySelector("script[data-orlong-music]")){
   const script=document.createElement("script");script.src="/assets/js/orlong-audio.js?v=stage-8d3d";script.dataset.orlongMusic="true";document.body.appendChild(script);
  }
 };
 const installSharedContentManager=()=>{if(!document.querySelector("script[data-orlong-site-content]")){const script=document.createElement("script");script.src="/assets/js/site-content.js?v=stage-8d4";script.dataset.orlongSiteContent="true";document.body.appendChild(script);}};
 const initialiseSharedFeatures=()=>{initialiseSharedAccountLabel();installCardRevealSystem();installSharedAudio();installSharedContentManager();window.applyOrlongManagedNavigation?.();};
 if(window.supabase?.createClient)initialiseSharedFeatures();
 else{
  if(!window.__orlongSupabaseLoad){
   window.__orlongSupabaseLoad=new Promise((resolve,reject)=>{
    const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";script.onload=resolve;script.onerror=reject;document.head.appendChild(script);
   });
  }
  window.__orlongSupabaseLoad.then(initialiseSharedFeatures).catch(()=>{installCardRevealSystem();installSharedAudio();});
 }
});
