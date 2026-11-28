(function(){
"use strict";
const SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
const labels={characters:"CHARACTERS",locations:"LOCATIONS",creatures:"CREATURES",organisations:"ORGANISATIONS",history:"HISTORY",technology:"TECHNOLOGY",events:"EVENTS",other:"OTHER"};
let client=null,entries=[],activeCategory="all";
const el=(tag,className,value)=>{const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;};
function safeUrl(value){try{const url=new URL(value,location.href);return ["https:","http:"].includes(url.protocol)?url.href:"";}catch(_){return "";}}
function paragraphs(parent,value){String(value||"").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean).forEach(part=>parent.append(el("p","",part)));}
function renderBlock(block,index){
 const type=block?.type||"text";
 if(type==="divider"){const divider=el("div","archive-sigil-divider");divider.append(el("span","","✧"));return divider;}
 if(type==="text"){const section=el("section","archive-block archive-block-text");if(block.heading)section.append(el("h3","archive-block-heading",block.heading));paragraphs(section,block.body);return section;}
 if(type==="quote"){const quote=el("blockquote","archive-block-quote");quote.append(el("p","",block.body||""));if(block.attribution)quote.append(el("cite","",block.attribution));return quote;}
 if(type==="image"){
  const url=safeUrl(block.url);if(!url)return el("p","archive-block-note","An image for this record has not been added yet.");
  const figure=el("figure","archive-block-image"),img=document.createElement("img");img.src=url;img.alt=block.alt||block.caption||"Archive illustration";img.loading="lazy";img.onerror=()=>figure.remove();figure.append(img);if(block.caption)figure.append(el("figcaption","",block.caption));return figure;
 }
 if(type==="callout"){const aside=el("aside","archive-block-callout");aside.append(el("span","archive-block-kicker","ARCHIVE NOTE"));if(block.heading)aside.append(el("h3","",block.heading));paragraphs(aside,block.body);return aside;}
 if(type==="reveal"){const details=el("details","archive-block-reveal"),summary=el("summary","",block.label||"REVEAL RECORD"),body=el("div","archive-reveal-body");paragraphs(body,block.body);details.append(summary,body);return details;}
 if(type==="timeline"){
  const section=el("section","archive-block-timeline");if(block.heading)section.append(el("h3","archive-block-heading",block.heading));
  const list=el("ol","");(block.items||[]).forEach(item=>{const li=el("li","");li.append(el("strong","",item.label||""),el("p","",item.body||""));list.append(li);});section.append(list);return section;
 }
 if(type==="facts"){
  const section=el("section","archive-block-facts");if(block.heading)section.append(el("h3","archive-block-heading",block.heading));
  const grid=el("dl","");(block.items||[]).forEach(item=>{const wrap=el("div","archive-fact");wrap.append(el("dt","",item.label||""),el("dd","",item.value||""));grid.append(wrap);});section.append(grid);return section;
 }
 if(type==="gallery"){
  const section=el("section","archive-block-gallery");if(block.heading)section.append(el("h3","archive-block-heading",block.heading));
  const grid=el("div","archive-gallery-grid");(block.items||[]).forEach(item=>{const url=safeUrl(item.url);if(!url)return;const figure=el("figure","");const img=document.createElement("img");img.src=url;img.alt=item.caption||"Archive gallery image";img.loading="lazy";img.onerror=()=>figure.remove();figure.append(img);if(item.caption)figure.append(el("figcaption","",item.caption));grid.append(figure);});section.append(grid);return section;
 }
 return el("p","archive-block-note","This archive section is not available.");
}
function openEntry(entry){
 $("archiveReaderCategory").textContent=labels[entry.category]||String(entry.category||"ARCHIVE").toUpperCase();
 $("archiveReaderTitle").textContent=entry.title;
 $("archiveReaderSummary").textContent=entry.summary||"";
 const cards=$("archiveReaderCards");cards.replaceChildren();
 (entry.requiredCards||[]).forEach(card=>cards.append(el("span","archive-card-chip",card.number+" · "+card.name)));
 const root=$("archiveReaderBlocks");root.replaceChildren();
 const blocks=Array.isArray(entry.contentBlocks)?entry.contentBlocks:[];
 if(blocks.length)blocks.forEach((block,index)=>root.append(renderBlock(block,index)));
 else paragraphs(root,entry.content||"");
 $("archiveReaderDialog").showModal();
 $("archiveReaderDialog").scrollTop=0;
}
function render(){
 const root=$("archiveEntryGrid");root.replaceChildren();
 const query=$("archiveSearch").value.trim().toLowerCase();
 const visible=entries.filter(entry=>(activeCategory==="all"||entry.category===activeCategory)&&(!query||(entry.title+" "+entry.summary+" "+entry.category).toLowerCase().includes(query)));
 visible.forEach((entry,index)=>{
  const card=el("article","archive-entry");card.style.setProperty("--entry-index",String(index));
  const top=el("div","archive-entry-top");top.append(el("span","archive-entry-category",labels[entry.category]||String(entry.category).toUpperCase()),el("span","archive-entry-unlocked","RECORD UNLOCKED"));
  const title=el("h3","",entry.title),summary=el("p","archive-entry-summary",entry.summary||"");
  const meta=el("div","archive-entry-meta");meta.append(el("span","","✧ "+(entry.requiredCards||[]).length+" DISCOVERY KEY"+((entry.requiredCards||[]).length===1?"":"S")),el("span","",(entry.contentBlocks||[]).length+" SECTIONS"));
  const button=el("button","archive-read-button","EXPLORE RECORD ↗");button.type="button";button.addEventListener("click",()=>openEntry(entry));
  card.append(top,title,summary,meta,button);root.append(card);
 });
 $("archiveEmpty").hidden=entries.length!==0;
 root.hidden=entries.length===0;
 if(entries.length&&visible.length===0){root.hidden=false;root.append(el("p","archive-message","No unlocked records match your search."));}
}
function renderFilters(){
 const root=$("archiveFilters");root.replaceChildren();
 const categories=[["all","ALL RECORDS"],...Object.entries(labels).filter(([id])=>entries.some(e=>e.category===id)).map(([id,label])=>[id,label])];
 categories.forEach(([id,label])=>{const button=el("button","archive-filter"+(activeCategory===id?" active":""),label);button.type="button";button.setAttribute("aria-pressed",String(activeCategory===id));button.addEventListener("click",()=>{activeCategory=id;renderFilters();render();});root.append(button);});
}
async function init(){
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 const {data,error}=await client.auth.getSession();if(error)throw error;
 if(!data.session){$("archiveSignIn").hidden=false;$("archiveStatus").textContent="Sign in to access your personal discoveries.";$("archiveCount").textContent="SIGN IN REQUIRED";return;}
 const {data:records,error:archiveError}=await client.rpc("get_my_eden_archive_entries");if(archiveError)throw archiveError;
 entries=Array.isArray(records)?records:[];
 $("archiveContent").hidden=false;
 $("archiveStatus").textContent=entries.length?"Your collected cards have revealed these records.":"Your archive is ready. Collect cards to reveal its first records.";
 $("archiveCount").textContent=entries.length+" ENTR"+(entries.length===1?"Y":"IES")+" UNLOCKED";
 renderFilters();render();$("archiveSearch").addEventListener("input",render);
 $("archiveReaderClose").addEventListener("click",()=>$("archiveReaderDialog").close());
 $("archiveReaderReturn").addEventListener("click",()=>$("archiveReaderDialog").close());
 $("archiveReaderDialog").addEventListener("click",event=>{if(event.target===$("archiveReaderDialog"))$("archiveReaderDialog").close();});
 client.auth.onAuthStateChange((_event,session)=>{if(!session)location.reload();});
}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error("Eden Archive:",error);$("archiveStatus").textContent="The archive could not be loaded. Please refresh or try again later.";}));
})();