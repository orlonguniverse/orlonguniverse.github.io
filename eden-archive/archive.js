(function(){
"use strict";
const SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
const labels={characters:"CHARACTERS",locations:"LOCATIONS",creatures:"CREATURES",organisations:"ORGANISATIONS",history:"HISTORY",technology:"TECHNOLOGY",events:"EVENTS",other:"OTHER"};
let client=null,entries=[],activeCategory="all";
const el=(tag,className,value)=>{const node=document.createElement(tag);if(className)node.className=className;if(value!==undefined)node.textContent=value;return node;};
function render(){
 const root=$("archiveEntryGrid");root.replaceChildren();
 const query=$("archiveSearch").value.trim().toLowerCase();
 const visible=entries.filter(entry=>(activeCategory==="all"||entry.category===activeCategory)&&(!query||(entry.title+" "+entry.summary+" "+entry.content).toLowerCase().includes(query)));
 visible.forEach(entry=>{
  const card=el("article","archive-entry");
  const top=el("div","archive-entry-top");
  top.append(el("span","archive-entry-category",labels[entry.category]||entry.category.toUpperCase()),el("span","archive-entry-unlocked","RECORD UNLOCKED"));
  const title=el("h3","",entry.title),summary=el("p","archive-entry-summary",entry.summary);
  const cards=el("div","archive-entry-cards");
  (entry.requiredCards||[]).forEach(required=>cards.append(el("span","archive-card-chip",required.number+" · "+required.name)));
  const button=el("button","archive-read-button","READ ARCHIVE ENTRY");button.type="button";button.setAttribute("aria-expanded","false");
  const content=el("div","archive-entry-content",entry.content);content.hidden=true;
  button.addEventListener("click",()=>{const open=content.hidden;content.hidden=!open;button.textContent=open?"CLOSE ENTRY":"READ ARCHIVE ENTRY";button.setAttribute("aria-expanded",String(open));});
  card.append(top,title,summary,cards,button,content);root.append(card);
 });
 $("archiveEmpty").hidden=entries.length!==0;
 $("archiveEntryGrid").hidden=entries.length===0;
 if(entries.length&&visible.length===0){root.hidden=false;root.append(el("p","archive-message","No unlocked records match your search."));}
}
function renderFilters(){
 const root=$("archiveFilters");root.replaceChildren();
 const categories=[...new Set(entries.map(e=>e.category))];
 [["all","ALL RECORDS"],...categories.map(c=>[c,labels[c]||c.toUpperCase()])].forEach(([id,label])=>{
  const button=el("button","archive-filter"+(activeCategory===id?" active":""),label);button.type="button";
  button.addEventListener("click",()=>{activeCategory=id;renderFilters();render();});root.append(button);
 });
}
async function init(){
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 const {data,error}=await client.auth.getSession();
 if(error)throw error;
 if(!data.session){$("archiveSignIn").hidden=false;$("archiveStatus").textContent="Sign in to access your personal discoveries.";$("archiveCount").textContent="SIGN IN REQUIRED";return;}
 const {data:records,error:archiveError}=await client.rpc("get_my_eden_archive_entries");
 if(archiveError)throw archiveError;
 entries=Array.isArray(records)?records:[];
 $("archiveContent").hidden=false;
 $("archiveStatus").textContent=entries.length?"Your collected cards have revealed these records.":"Your archive is ready. Collect cards to reveal its first records.";
 $("archiveCount").textContent=entries.length+" ENTR"+(entries.length===1?"Y":"IES")+" UNLOCKED";
 renderFilters();render();
 $("archiveSearch").addEventListener("input",render);
 client.auth.onAuthStateChange((_event,session)=>{if(!session){location.reload();}});
}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error("Eden Archive:",error);$("archiveStatus").textContent="The archive could not be loaded. Please refresh or try again later.";}));
})();