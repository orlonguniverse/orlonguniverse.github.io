const FOUNDING_SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const FOUNDING_SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const foundingClient=window.supabase.createClient(FOUNDING_SUPABASE_URL,FOUNDING_SUPABASE_KEY);
const foundingById=id=>document.getElementById(id);
function renderFoundingReaders(rows){
 const list=foundingById("foundingReaderList");list.replaceChildren();
 if(!rows.length){const empty=document.createElement("div");empty.className="empty";empty.textContent="The acknowledgements will appear here as Founding Readers choose to make their names public. The total count includes private members too.";list.append(empty);return;}
 rows.forEach(row=>{const card=document.createElement("article");card.className="reader";const name=document.createElement("strong");name.textContent=row.display_name||"Reader";const date=document.createElement("small");date.textContent="JOINED "+new Date(row.qualified_at).toLocaleDateString(undefined,{month:"short",year:"numeric"});card.append(name,date);list.append(card);});
}
(async()=>{
 const count=await foundingClient.rpc("get_founding_reader_count");foundingById("foundingReaderCount").textContent=count.error?"—":String(count.data??0);
 const roster=await foundingClient.rpc("get_public_founding_readers");
 if(roster.error){console.error(roster.error);foundingById("foundingReaderList").textContent="The acknowledgements are temporarily unavailable. Please refresh in a moment.";return;}
 renderFoundingReaders(Array.isArray(roster.data)?roster.data:[]);
})();
