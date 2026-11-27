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
   const link=document.createElement("a");link.href="/moderator/";link.textContent="MODERATOR HQ";link.className="nav-direct-link nav-moderator-link";
   nav.insertBefore(link,nav.querySelector("#openAccountButton, #mainAccountButton, .nav-account-button")||null);
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

 // Compact shared navigation: related destinations are grouped into accessible dropdowns.
 const navLinks=document.querySelector(".topbar-right, .top-actions");
 if(navLinks&&!navLinks.dataset.orlongGrouped){
  const accountButton=navLinks.querySelector("#openAccountButton, #mainAccountButton, .nav-account-button");
  const statsLink=[...navLinks.querySelectorAll("a")].find(a=>/account\.html#dashboard|account\.html\?/.test(a.getAttribute("href")||"")||/MY STATISTICS/i.test(a.textContent));
  navLinks.replaceChildren();
  const makeDropdown=(label,items)=>{
   const details=document.createElement("details");details.className="nav-dropdown";
   const summary=document.createElement("summary");summary.textContent=label;summary.setAttribute("aria-haspopup","true");details.append(summary);
   summary.addEventListener("click",()=>{navLinks.querySelectorAll(".nav-dropdown[open]").forEach(openMenu=>{if(openMenu!==details)openMenu.removeAttribute("open");});});
   const menu=document.createElement("div");menu.className="nav-dropdown-menu";
   items.forEach(item=>{const link=document.createElement("a");link.href=item.href;link.textContent=item.label;if(item.current)link.setAttribute("aria-current","page");menu.append(link);});
   details.append(menu);return details;
  };
  navLinks.append(
   makeDropdown("READ",[
    {label:"BOOK CONTENTS",href:"/books/trials-of-eden/contents.html",current:location.pathname.endsWith("/contents.html")},
    {label:"READING ROOM",href:"/books/trials-of-eden/index.html#chapter",current:location.pathname.endsWith("/books/trials-of-eden/")}
   ]),
   makeDropdown("COMMUNITY",[
    {label:"EVENTS",href:"/events.html",current:location.pathname.endsWith("/events.html")},
    {label:"EARLY ACCESS",href:"/early-access/",current:location.pathname.startsWith("/early-access")},
    {label:"FOUNDING READERS",href:"/founding-readers/",current:location.pathname.startsWith("/founding-readers")}
   ]),
   (()=>{const link=document.createElement("a");link.href="/explore-eden/";link.textContent="EXPLORE EDEN";link.className="nav-direct-link";if(location.pathname.startsWith("/explore-eden"))link.setAttribute("aria-current","page");return link;})()
  );
  if(accountButton)navLinks.append(accountButton);
  if(statsLink)navLinks.append(statsLink);
  const instagram=document.createElement("a");instagram.className="nav-social-link";instagram.href="https://www.instagram.com/orlong_official/";instagram.target="_blank";instagram.rel="noopener noreferrer";instagram.setAttribute("aria-label","Visit Orlong on Instagram");instagram.title="Orlong on Instagram";
  instagram.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="18" cy="6" r="0.8" fill="currentColor" stroke="none"></circle></svg>';
  navLinks.append(instagram);
  navLinks.dataset.orlongGrouped="true";
  // Only one navigation dropdown may remain open at a time.
  document.addEventListener("click",event=>{
   if(!navLinks.contains(event.target))navLinks.querySelectorAll(".nav-dropdown[open]").forEach(menu=>menu.removeAttribute("open"));
  });
  document.addEventListener("keydown",event=>{
   if(event.key==="Escape")navLinks.querySelectorAll(".nav-dropdown[open]").forEach(menu=>menu.removeAttribute("open"));
  });
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
});
