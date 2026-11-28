(function(){
"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co";
const KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
let client=null,entries=[],cards=[],chapters=[],archiveBlocks=[];
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
 $("archiveEntryDeleteButton").hidden=true;$("archiveEntrySaveButton").textContent="SAVE ARCHIVE ENTRY";archiveBlocks=[];renderBlocks();
 [...$("archiveRequiredCards").options].forEach(o=>o.selected=false);
 $("archiveUnlockChapter").value="";message("Ready to create a new archive entry.");
}
function editEntry(entry){
 $("archiveEditingId").value=entry.id;$("archiveEntryId").value=entry.id;$("archiveEntryId").disabled=true;
 $("archiveEntryTitle").value=entry.title;$("archiveEntryCategory").value=entry.category;
 $("archiveEntrySummary").value=entry.summary||"";$("archiveEntryContent").value=entry.content||"";
 $("archiveUnlockChapter").value=entry.unlockChapterId||"";
 $("archiveEntrySort").value=entry.sortOrder??0;$("archiveEntryPublished").checked=Boolean(entry.published);archiveBlocks=Array.isArray(entry.contentBlocks)?JSON.parse(JSON.stringify(entry.contentBlocks)):[];renderBlocks();
 const required=new Set(entry.requiredCardIds||[]);
 [...$("archiveRequiredCards").options].forEach(o=>o.selected=required.has(o.value));
 $("archiveEntryDeleteButton").hidden=false;$("archiveEntrySaveButton").textContent="SAVE CHANGES";
 message("Editing "+entry.title+".");$("archiveEntryForm").scrollIntoView({behavior:"smooth",block:"start"});
}
const blockLabels={text:"TEXT SECTION",quote:"PULL QUOTE",image:"IMAGE / ILLUSTRATION",callout:"HIGHLIGHTED NOTE",divider:"ORLONG DIVIDER",timeline:"TIMELINE",reveal:"INTERACTIVE REVEAL",facts:"FACT PANEL",gallery:"IMAGE GALLERY"};
function rowsToText(items,type){return (items||[]).map(item=>type==="timeline"?[item.label,item.body].join(" | "):type==="facts"?[item.label,item.value].join(" | "):[item.url,item.caption].join(" | ")).join("\n");}
function textToRows(value,type){return value.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split("|").map(x=>x.trim());return type==="timeline"?{label:parts[0]||"",body:parts.slice(1).join(" | ")}:type==="facts"?{label:parts[0]||"",value:parts.slice(1).join(" | ")}:{url:parts[0]||"",caption:parts.slice(1).join(" | ")};});}
async function uploadArchiveAsset(file){
 if(!file||!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Choose a PNG, JPEG or WebP image.");
 if(file.size>12*1024*1024)throw new Error("Each archive image must be smaller than 12 MB.");
 const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
 const path="archive/"+slug(file.name.replace(/\\.[^.]+$/,""))+"-"+Date.now()+"-"+Math.random().toString(36).slice(2,7)+"."+extension;
 const {error}=await client.storage.from("orlong-card-artwork").upload(path,file,{contentType:file.type,upsert:false,cacheControl:"31536000"});
 if(error)throw error;
 return client.storage.from("orlong-card-artwork").getPublicUrl(path).data.publicUrl;
}
function addImageUpload(fields,block,multiple=false){
 const wrap=el("label","archive-block-field archive-block-upload");wrap.append(el("span","",multiple?"UPLOAD GALLERY IMAGES":"UPLOAD IMAGE"));
 const input=document.createElement("input");input.type="file";input.accept="image/png,image/jpeg,image/webp";input.multiple=multiple;
 input.addEventListener("change",async()=>{
  const files=[...(input.files||[])];if(!files.length)return;
  input.disabled=true;
  try{
   const urls=[];for(const file of files)urls.push(await uploadArchiveAsset(file));
   if(multiple){block.items=Array.isArray(block.items)?block.items:[];urls.forEach((url,i)=>block.items.push({url,caption:files[i].name.replace(/\\.[^.]+$/,"")}));}
   else block.url=urls[0];
   renderBlocks();message(multiple?urls.length+" gallery image(s) uploaded.":"Image uploaded and attached to this block.");
  }catch(error){message(error.message||"The image could not be uploaded.",true);input.disabled=false;}
 });
 wrap.append(input);fields.append(wrap);
}
function renderBlocks(){
 const root=$("archiveBlockList");root.replaceChildren();
 if(!archiveBlocks.length){root.append(el("p","hint","No content blocks yet. Add your first block above."));return;}
 archiveBlocks.forEach((block,index)=>{
  const card=el("article","archive-block-card"),head=el("div","archive-block-card-head");
  head.append(el("strong","",String(index+1).padStart(2,"0")+" · "+(blockLabels[block.type]||"CONTENT BLOCK")));
  const actions=el("div","archive-block-actions");
  [["↑","Move up",index>0,()=>{[archiveBlocks[index-1],archiveBlocks[index]]=[archiveBlocks[index],archiveBlocks[index-1]];renderBlocks();}],["↓","Move down",index<archiveBlocks.length-1,()=>{[archiveBlocks[index+1],archiveBlocks[index]]=[archiveBlocks[index],archiveBlocks[index+1]];renderBlocks();}],["REMOVE","Remove block",true,()=>{archiveBlocks.splice(index,1);renderBlocks();}]].forEach(([label,title,enabled,fn])=>{const b=el("button","secondary archive-block-action",label);b.type="button";b.title=title;b.disabled=!enabled;b.addEventListener("click",fn);actions.append(b);});
  head.append(actions);card.append(head);
  const fields=el("div","archive-block-fields");
  const addField=(label,key,value,multiline=false,placeholder="")=>{
   const wrap=el("label","archive-block-field");wrap.append(el("span","",label));
   const control=multiline?document.createElement("textarea"):document.createElement("input");
   if(multiline){control.rows=4;control.value=value||"";}else{control.type="text";control.value=value||"";}
   control.placeholder=placeholder;control.addEventListener("input",()=>{block[key]=control.value;});
   wrap.append(control);fields.append(wrap);
  };
  if(block.type==="text"||block.type==="callout"){addField("HEADING","heading",block.heading);addField("BODY TEXT","body",block.body,true,"Write this section. Paragraph breaks are preserved.");}
  else if(block.type==="quote"){addField("QUOTATION","body",block.body,true,"A memorable line, testimony or excerpt.");addField("ATTRIBUTION","attribution",block.attribution);}
  else if(block.type==="image"){addField("IMAGE URL","url",block.url,false,"https://…");addImageUpload(fields,block,false);addField("IMAGE DESCRIPTION (ALT TEXT)","alt",block.alt);addField("CAPTION","caption",block.caption);}
  else if(block.type==="timeline"){addField("TIMELINE HEADING","heading",block.heading);addField("TIMELINE MOMENTS","itemsText",rowsToText(block.items,"timeline"),true,"One moment per line: DATE / PERIOD | What happened");const ctl=fields.lastChild.querySelector("textarea");ctl.addEventListener("input",()=>{block.items=textToRows(ctl.value,"timeline");});}
  else if(block.type==="reveal"){addField("READER-FACING BUTTON LABEL","label",block.label||"REVEAL RECORD");addField("HIDDEN CONTENT","body",block.body,true,"The information revealed when the reader chooses to open it.");}
  else if(block.type==="facts"){addField("PANEL HEADING","heading",block.heading);addField("FACTS","itemsText",rowsToText(block.items,"facts"),true,"One fact per line: LABEL | VALUE");const ctl=fields.lastChild.querySelector("textarea");ctl.addEventListener("input",()=>{block.items=textToRows(ctl.value,"facts");});}
  else if(block.type==="gallery"){addField("GALLERY HEADING","heading",block.heading);addField("GALLERY IMAGES","itemsText",rowsToText(block.items,"gallery"),true,"One image per line: IMAGE URL | CAPTION");const ctl=fields.lastChild.querySelector("textarea");ctl.addEventListener("input",()=>{block.items=textToRows(ctl.value,"gallery");});addImageUpload(fields,block,true);}
  else if(block.type==="divider"){fields.append(el("p","hint","A decorative Orlong sigil divider. It creates breathing room between sections."));}
  card.append(fields);root.append(card);
 });
}
function addBlock(){
 const type=$("archiveBlockType").value;
 const defaults={text:{type,heading:"",body:""},quote:{type,body:"",attribution:""},image:{type,url:"",alt:"",caption:""},callout:{type,heading:"",body:""},divider:{type},timeline:{type,heading:"",items:[]},reveal:{type,label:"REVEAL RECORD",body:""},facts:{type,heading:"",items:[]},gallery:{type,heading:"",items:[]}};
 archiveBlocks.push(defaults[type]);renderBlocks();
 const last=$("archiveBlockList").lastElementChild;last?.scrollIntoView({behavior:"smooth",block:"nearest"});
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
  const {data,error}=await client.rpc("save_moderator_eden_archive_entry_v2",{
   p_entry_id:id,p_title:$("archiveEntryTitle").value.trim(),p_category:$("archiveEntryCategory").value,
   p_summary:$("archiveEntrySummary").value.trim(),p_content:$("archiveEntryContent").value.trim()||$("archiveEntrySummary").value.trim(),
   p_content_blocks:archiveBlocks,
   p_unlock_chapter_id:$("archiveUnlockChapter").value||null,p_required_card_ids:required,
   p_sort_order:Number($("archiveEntrySort").value||0),p_is_published:$("archiveEntryPublished").checked
  });
  if(error)throw error;
  const savedTitle=$("archiveEntryTitle").value.trim();
  resetForm();await load();message((editing?"Updated ":"Created ")+savedTitle+".");
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
 $("archiveEntryForm").addEventListener("submit",saveEntry);$("archiveBlockAdd").addEventListener("click",addBlock);renderBlocks();
 $("archiveEntryClearButton").addEventListener("click",resetForm);
 $("archiveNewEntryButton").addEventListener("click",()=>{resetForm();$("archiveEntryForm").scrollIntoView({behavior:"smooth",block:"start"});});
 $("archiveEntryRefresh").addEventListener("click",()=>load().catch(error=>message(error.message,true)));
 $("archiveEntryDeleteButton").addEventListener("click",()=>{const entry=entries.find(e=>e.id===$("archiveEditingId").value);if(entry)deleteEntry(entry);});
 await load();
}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error("Archive manager:",error);$("archiveEntryList").textContent=error.message||"The archive manager could not load. Check the Stage 8D.2 migration.";}));
})();