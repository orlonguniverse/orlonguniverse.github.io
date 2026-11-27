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
 client.auth.getSession().then(({data,error})=>{
  if(error||!data?.session?.user)return;
  const record=mission=>client.rpc("record_early_access_mission_visit",{target_mission_key:mission})
   .then(({error:rpcError})=>{if(rpcError)console.info("Early Access visit not recorded:",mission,rpcError.message);});
  if(!("IntersectionObserver" in window)){targets.forEach(([,mission])=>record(mission));return;}
  const observer=new IntersectionObserver(entries=>{
   entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    const mission=targets.find(([selector])=>document.querySelector(selector)===entry.target)?.[1];
    if(mission){observer.unobserve(entry.target);record(mission);}
   });
  },{threshold:0.12,rootMargin:"0px 0px -12% 0px"});
  targets.forEach(([selector])=>{const element=document.querySelector(selector);if(element)observer.observe(element);});
 }).catch(error=>console.info("Early Access mission tracker unavailable:",error));
})();