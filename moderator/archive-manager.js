(function(){
"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co";
const KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
let client=null,entries=[],cards=[],chapters=[];
const categoryNames={characters:"Characters",locations:"Locations",creatures:"Creatures",organisations:"Organisations",history:"History",technology:"Technology",events:"Events",other:"Other"};
const slug=value=>String(value||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
function message(value,error=false){$("archiveEntryMessage").textContent=value;$("archiveEntryMessage").style.color=error?"#ff9ca9":"#9dc9f5";}
function fillSelect(select,items,label,value,first){select.replaceChildren();if(first){const option=document.createElement("option");option.value="";option.textContent=first;select.append(option);}items.forEach(item=>{const option=document.createElement("option");option.value=item[value];option.textContent=item[label];select.append(option);});}
async function load(){
 $("archiveEntryList").textContent="Loading archive entries…";
 const [entryResult,cardResult,chapterResult]=await Promise.all([
  client.rpc("get_moderator_eden_archive_entries"),
  client.rpc("get_moderator_eden_archive_cards"),
  client.rpc("get_moderator_eden_book_structure")
 ]);
 if(entryResult.error)throw entryResult.error;
 if(cardResult.error)throw cardResult.error;
 if(chapterResult.error)throw chapterResult.error;
 entries=Array.isArray(entryResult.data)?entryResult.data:[];
 cards=Array.isArray(cardResult.data)?cardResult.data:[];
 chapters=chapterResult.data?.chapters||[];
 fillSelect($("archiveUnlockChapter"),chapters.map(c=>({id:c.id,label:c.number+" · "+c.title})),"label","id","No additional chapter gate");
 const cardSelect=$("archiveRequiredCards");cardSelect.replaceChildren();
 cards.forEach(card=>{const option=document.createElement("option");option.value=card.id;option.textContent=card.number+" · "+card.name+" ("+card.category+")";cardSelect.append(option);});
 renderList();
 const published=entries.filter(e=>e.published).length;
 $("archiveAdminStats").textContent=entries.length+" TOTAL ENTRIES · "+published+" PUBLISHED · "+cards.length+" ACTIVE CARDS";
}
function renderList(){
 const root=$("archiveEntryList");root.replaceChildren();
 if(!entries.length){root.append(el("p","hint","No archive entries yet. Create your first lore record above."));return;}
 entries.forEach(entry=>{
  const row=el("article","archive-admin-row");
  const info=el("div","archive-admin-info");
  info.append(el("strong","",entry.title),el("small","",String(entry.id).toUpperCase()+" · "+(categoryNames[entry.category]||entry.category)+" · "+(entry.requiredCardIds||[]).length+" REQUIRED CARD"+((entry.requiredCardIds||[]).length===1?"":"S")));
  if(entry.unlockChapterId){const chapter=chapters.find(c=>c.id===entry.unlockChapterId);info.append(el("small","", "CHAPTER GATE · "+(chapter?chapter.number+" · "+chapter.title:entry.unlockChapterId)));}
  const status=el("span","archive-admin-status "+(entry.published?"published":"draft"),entry.published?"PUBLISHED":"DRAFT");
  const actions=el("div","archive-admin-actions");
  const edit=el("button","secondary","EDIT");edit.type="button";edit.addEventListener("click",()=>editEntry(entry));
  const remove=el("button","danger","DELETE");remove.type="button";remove.addEventListener("click",()=>deleteEntry(entry));
  actions.append(edit,remove);row.append(info,status,actions);root.append(row);
 });
}
function el(tag,className,value){const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;}
function resetForm(){
 $("archiveEntryForm").reset();$("archiveEditingId").value="";$("archiveEntryId").disabled=false;$("archiveEntryId").dataset.manual="";
 $("archiveEntryDeleteButton").hidden=true;$("archiveEntrySaveButton").textContent="SAVE ARCHIVE ENTRY";
 [...$("archiveRequiredCards").options].forEach(o=>o.selected=false);
 $("archiveUnlockChapter").value="";message("Ready to create a new archive entry.");
}
function editEntry(entry){
 $("archiveEditingId").value=entry.id;$("archiveEntryId").value=entry.id;$("archiveEntryId").disabled=true;
 $("archiveEntryTitle").value=entry.title;$("archiveEntryCategory").value=entry.category;
 $("archiveEntrySummary").value=entry.summary||"";$("archiveEntryContent").value=entry.content||"";
 $("archiveUnlockChapter").value=entry.unlockChapterId||"";
 $("archiveEntrySort").value=entry.sortOrder??0;$("archiveEntryPublished").checked=Boolean(entry.published);
 const required=new Set(entry.requiredCardIds||[]);
 [...$("archiveRequiredCards").options].forEach(o=>o.selected=required.has(o.value));
 $("archiveEntryDeleteButton").hidden=false;$("archiveEntrySaveButton").textContent="SAVE CHANGES";
 message("Editing "+entry.title+".");$("archiveEntryForm").scrollIntoView({behavior:"smooth",block:"start"});
}
async function saveEntry(event){
 event.preventDefault();
 const editing=$("archiveEditingId").value;
 const id=editing||slug($("archiveEntryId").value||$("archiveEntryTitle").value);
 const required=[...$("archiveRequiredCards").selectedOptions].map(o=>o.value);
 if(!id){message("Enter a valid entry ID.",true);return;}
 if(!required.length){message("Select at least one required card.",true);return;}
 const button=$("archiveEntrySaveButton");button.disabled=true;button.textContent="SAVING…";
 try{
  const {data,error}=await client.rpc("save_moderator_eden_archive_entry",{
   p_entry_id:id,p_title:$("archiveEntryTitle").value.trim(),p_category:$("archiveEntryCategory").value,
   p_summary:$("archiveEntrySummary").value.trim(),p_content:$("archiveEntryContent").value,
   p_unlock_chapter_id:$("archiveUnlockChapter").value||null,p_required_card_ids:required,
   p_sort_order:Number($("archiveEntrySort").value||0),p_is_published:$("archiveEntryPublished").checked
  });
  if(error)throw error;
  message((editing?"Updated ":"Created ")+$("archiveEntryTitle").value.trim()+".");
  resetForm();await load();
 }catch(error){console.error(error);message(error.message||"The archive entry could not be saved.",true);}
 finally{button.disabled=false;button.textContent=$("archiveEditingId").value?"SAVE CHANGES":"SAVE ARCHIVE ENTRY";}
}
async function deleteEntry(entry){
 if(!window.confirm("Permanently delete the archive entry '"+entry.title+"'? Its card unlock connections will also be removed."))return;
 try{const {error}=await client.rpc("delete_moderator_eden_archive_entry",{p_entry_id:entry.id});if(error)throw error;resetForm();await load();message("Deleted "+entry.title+".");}
 catch(error){console.error(error);message(error.message||"The entry could not be deleted.",true);}
}
async function init(){
 if(!window.supabase?.createClient)return;
 client=window.supabase.createClient(URL_BASE,KEY);
 const {data,error}=await client.auth.getSession();if(error)throw error;
 if(!data.session)return;
 const {data:allowed,error:roleError}=await client.rpc("is_reader_moderator");
 if(roleError||allowed!==true)return;
 $("archiveEntryTitle").addEventListener("input",()=>{if(!$("archiveEditingId").value&&!$("archiveEntryId").dataset.manual)$("archiveEntryId").value=slug($("archiveEntryTitle").value);});
 $("archiveEntryId").addEventListener("input",()=>{$("archiveEntryId").dataset.manual="true";});
 $("archiveEntryForm").addEventListener("submit",saveEntry);
 $("archiveEntryClearButton").addEventListener("click",resetForm);
 $("archiveNewEntryButton").addEventListener("click",()=>{resetForm();$("archiveEntryForm").scrollIntoView({behavior:"smooth",block:"start"});});
 $("archiveEntryRefresh").addEventListener("click",()=>load().catch(error=>message(error.message,true)));
 $("archiveEntryDeleteButton").addEventListener("click",()=>{const entry=entries.find(e=>e.id===$("archiveEditingId").value);if(entry)deleteEntry(entry);});
 await load();
}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error("Archive manager:",error);$("archiveEntryList").textContent=error.message||"The archive manager could not load. Check the Stage 8D.2 migration.";}));
})();