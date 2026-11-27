// Records a mission visit only after the reader reaches the relevant page area.
(() => {
 const url="https://kqfwtzrfqsfampqfzoal.supabase.co";
 const key="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
 if(!window.supabase?.createClient)return;
 const client=window.accountClient||window.engagementClient||window.supabase.createClient(url,key);
 const path=location.pathname;
 const targets=path.includes("/books/trials-of-eden/account.html")
  ?[["#profilePicturePanel","account-profile"],["#cardCollectionPanel","collectible-binder"],["#tradingPost","trading-post"],["#achievementsPanel","achievements"]]
  :path.includes("/books/trials-of-eden/")?[[".reading-layout","reading-room"]]:[];
 if(!targets.length)return;
 let started=false;
 const startTracking=()=>{
  if(started)return;started=true;
  const record=mission=>client.rpc("record_early_access_mission_visit",{target_mission_key:mission})
   .then(({error})=>{if(error)console.info("Early Access visit not recorded:",mission,error.message);});
  if(!("IntersectionObserver" in window)){targets.forEach(([,mission])=>record(mission));return;}
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const target=targets.find(([selector])=>document.querySelector(selector)===entry.target);
    if(target){observer.unobserve(entry.target);record(target[1]);}
   });
  },{threshold:0.01,rootMargin:"0px 0px -10% 0px"});
  targets.forEach(([selector])=>{const element=document.querySelector(selector);if(element)observer.observe(element);});
 };
 client.auth.getSession().then(({data,error})=>{if(!error&&data?.session?.user)startTracking();})
  .catch(error=>console.info("Early Access mission tracker unavailable:",error));
 client.auth.onAuthStateChange((_event,session)=>{if(session?.user)startTracking();});
})();