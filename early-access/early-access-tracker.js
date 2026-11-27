// Records visits to Early Access mission areas. The server still verifies
// actual quiz/community/feedback activity before those missions can complete.
(() => {
 const url="https://kqfwtzrfqsfampqfzoal.supabase.co";
 const key="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
 if(!window.supabase?.createClient)return;
 const client=window.supabase.createClient(url,key);
 const page=location.pathname;
 const missions=page.includes("/books/trials-of-eden/account.html")
  ?["account-profile","collectible-binder","trading-post","achievements"]
  :page.includes("/books/trials-of-eden/")?["reading-room"]:[];
 if(!missions.length)return;
 client.auth.getSession().then(async({data,error})=>{
  if(error||!data?.session?.user)return;
  for(const mission of missions){
   const result=await client.rpc("record_early_access_mission_visit",{target_mission_key:mission});
   if(result.error)console.info("Early Access mission visit not recorded:",mission,result.error.message);
  }
 }).catch(error=>console.info("Early Access mission tracker unavailable:",error));
})();