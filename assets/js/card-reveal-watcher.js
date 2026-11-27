/* Universal card-copy listener. Any secure insert into reader_card_copies is revealed. */
(() => {
 if(window.OrlongCardRevealWatcher)return;
 let client=null,userId=null,busy=false,timer=null;
 const SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
 const SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
 function getClient(){
  if(window.orlongNavigationClient)return window.orlongNavigationClient;
  if(!window.supabase?.createClient)return null;
  window.orlongNavigationClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
  return window.orlongNavigationClient;
 }
 async function poll(){
  if(busy||!client||!window.OrlongCardReveal)return;
  busy=true;
  try{
   const {data:sessionData,error:sessionError}=await client.auth.getSession();
   if(sessionError)throw sessionError;
   const currentUser=sessionData.session?.user;
   userId=currentUser?.id||null;
   if(!userId)return;
   const {data:awards,error}=await client.rpc("claim_my_card_reveals",{p_limit:10});
   if(error)throw error;
   for(const award of awards||[]){
    if(!window.OrlongCardReveal)break;
    const card={
     id:award.card_id,
     name:award.card_name,
     number:award.card_number,
     rarity:award.rarity||"common",
     artwork:award.artwork_url?new URL(award.artwork_url,location.origin).href:"",
     description:award.spoiler_safe_description||"A new discovery has entered your collection.",
     category:award.category_label||"CHARACTER",
     chapterNumber:award.chapter_number||null,
     setId:award.set_id||"",
     bookLabel:award.book_id==="trials-of-eden"?"THE TRIALS OF EDEN":(award.book_id||"ORLONG ARCHIVE"),
     series:award.series_id||"",
     book:award.book_id||"",
     sourceLabel:award.source_label||"New collectible reward",
     sourceDetail:award.source_detail||"A new card has been added to your collection."
    };
    await window.OrlongCardReveal.play(card);
    const {error:ackError}=await client.rpc("acknowledge_my_card_reveals",{p_queue_ids:[award.queue_id]});
    if(ackError)throw ackError;
   }
  }catch(error){
   if(!String(error?.message||"").includes("No rows"))console.warn("Orlong card reveal check will retry:",error?.message||error);
  }finally{busy=false;}
 }
 function start(){
  if(timer)return;
  client=getClient();if(!client)return;
  client.auth.getSession().then(({data})=>{userId=data.session?.user?.id||null;poll();}).catch(()=>{});
  client.auth.onAuthStateChange((_event,session)=>{
   userId=session?.user?.id||null;
   if(userId)window.setTimeout(poll,0);
  });
  timer=window.setInterval(poll,1000);
 }
 window.OrlongCardRevealWatcher={start,poll};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();