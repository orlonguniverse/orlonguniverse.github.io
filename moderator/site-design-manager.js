(()=>{"use strict";
const $=id=>document.getElementById(id);
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co",KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
let db,versions=[],editingId=null,editingStatus="draft";
const palettes={blue:"#398cff",red:"#e34b45",orange:"#f28a32",purple:"#a879e8",yellow:"#d7b83f",black:"#b8bec8"};
const say=t=>{$("designMessage").textContent=t};
const val=id=>$(id).value;
const put=(id,v)=>{$(id).value=v??""};
const localDate=iso=>{if(!iso)return"";const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};
function defaultDesign(){return{colors:{accent:"#398cff",highlight:"#a8ceff",background:"#12233b",surface:"#101a29",text:"#f1f5fb"},heroKicker:"A new world. A new beginning. A new nightmare.",heroTitle:"THE TRIALS\nOF EDEN",heroSubtitle:"EDEN TRILOGY · BOOK ONE",heroCopy:"Twenty contestants enter a competition built to test the limits of human potential. But in a world where every move is watched, the greatest danger may be what lies beyond the Trials.",primaryLabel:"ENTER THE READING ROOM",primaryHref:"/books/trials-of-eden/",secondaryLabel:"HOW IT WORKS",secondaryHref:"#your-first-visit",focusLabel:"READ WITHOUT DISTRACTIONS",heroNote:"Your story starts here. You can explore the wider world whenever you're ready.",bookEyebrow:"THE STORY BEGINS",bookTitle:"Welcome to Eden.",bookCopy1:"Maya Garcia has spent her life preparing for a future she never truly understood. Now she finds herself competing in the Trials of Eden, a prestigious competition where failure comes at a devastating cost.",bookCopy2:"Read at your own pace. The Reading Room keeps the chapters together and gives you the controls you need for a comfortable reading experience.",firstVisitTitle:"YOUR FIRST VISIT",firstVisitIntro:"You don't need to learn the whole website before you start. Follow these steps and discover the extra features only when you want them.",discoverTitle:"THERE'S MORE TO DISCOVER",discoverIntro:"The extras are optional. The book always comes first.",creatorTitle:"THE ORLONG UNIVERSE",creatorCopy:"Created by Callum Macann, Orlong is an interconnected science-fiction and fantasy universe exploring society, identity, power and the future of humanity.",heroAlignment:"center",heroHeight:"standard",heroBackgroundImage:"",showBookSection:true,showFirstVisit:true,showDiscover:true,showCreator:true}}
function formDesign(){return{colors:{accent:val("designAccentColor"),highlight:val("designHighlightColor"),background:val("designBackgroundColor"),surface:val("designSurfaceColor"),text:val("designTextColor")},heroKicker:val("designHeroKicker"),heroTitle:val("designHeroTitle"),heroSubtitle:val("designHeroSubtitle"),heroCopy:val("designHeroCopy"),primaryLabel:val("designPrimaryLabel"),primaryHref:val("designPrimaryHref"),secondaryLabel:val("designSecondaryLabel"),secondaryHref:val("designSecondaryHref"),focusLabel:val("designFocusLabel"),heroNote:val("designHeroNote"),bookEyebrow:val("designBookEyebrow"),bookTitle:val("designBookTitle"),bookCopy1:val("designBookCopy1"),bookCopy2:val("designBookCopy2"),firstVisitTitle:val("designFirstVisitTitle"),firstVisitIntro:val("designFirstVisitIntro"),discoverTitle:val("designDiscoverTitle"),discoverIntro:val("designDiscoverIntro"),creatorTitle:val("designCreatorTitle"),creatorCopy:val("designCreatorCopy"),heroAlignment:val("designHeroAlignment"),heroHeight:val("designHeroHeight"),heroBackgroundImage:val("designHeroBackgroundImage").trim(),showBookSection:$("designShowBook").checked,showFirstVisit:$("designShowFirstVisit").checked,showDiscover:$("designShowDiscover").checked,showCreator:$("designShowCreator").checked}}
function fill(d){const defaults=defaultDesign();d={...defaults,...(d||{}),colors:{...defaults.colors,...(d?.colors||{})}};const colors=d.colors;put("designAccentColor",colors.accent);put("designHighlightColor",colors.highlight);put("designBackgroundColor",colors.background);put("designSurfaceColor",colors.surface);put("designTextColor",colors.text);put("designHeroKicker",d.heroKicker);put("designHeroTitle",d.heroTitle);put("designHeroSubtitle",d.heroSubtitle);put("designHeroCopy",d.heroCopy);put("designPrimaryLabel",d.primaryLabel);put("designPrimaryHref",d.primaryHref);put("designSecondaryLabel",d.secondaryLabel);put("designSecondaryHref",d.secondaryHref);put("designFocusLabel",d.focusLabel);put("designHeroNote",d.heroNote);put("designBookEyebrow",d.bookEyebrow);put("designBookTitle",d.bookTitle);put("designBookCopy1",d.bookCopy1);put("designBookCopy2",d.bookCopy2);put("designFirstVisitTitle",d.firstVisitTitle);put("designFirstVisitIntro",d.firstVisitIntro);put("designDiscoverTitle",d.discoverTitle);put("designDiscoverIntro",d.discoverIntro);put("designCreatorTitle",d.creatorTitle);put("designCreatorCopy",d.creatorCopy);put("designHeroAlignment",d.heroAlignment||"center");put("designHeroHeight",d.heroHeight||"standard");put("designHeroBackgroundImage",d.heroBackgroundImage||"");$("designShowBook").checked=d.showBookSection!==false;$("designShowFirstVisit").checked=d.showFirstVisit!==false;$("designShowDiscover").checked=d.showDiscover!==false;$("designShowCreator").checked=d.showCreator!==false}
function themePreview(){const t=val("designTheme");$("designThemePreview").style.background="linear-gradient(120deg,"+val("designBackgroundColor")+","+val("designAccentColor")+")";$("designThemePreview").textContent=t.toUpperCase()+" SERIES THEME"}
function setThemeDefaults(){const sets={blue:["#398cff","#a8ceff","#12233b","#101a29","#f1f5fb"],red:["#e34b45","#ffb0a9","#421719","#281416","#fff1ef"],orange:["#f28a32","#ffd09b","#43230f","#28190f","#fff3e7"],purple:["#a879e8","#d9c0ff","#28183f","#1d172a","#f6efff"],yellow:["#d7b83f","#f4e6a1","#393116","#252113","#fffbe8"],black:["#b8bec8","#e3e6eb","#111318","#191b20","#f2f3f5"]};const ids=["designAccentColor","designHighlightColor","designBackgroundColor","designSurfaceColor","designTextColor"];ids.forEach((id,i)=>put(id,sets[val("designTheme")][i]));themePreview()}
function fresh(){editingId=null;editingStatus="draft";put("designVersionName","");put("designTheme","blue");fill(defaultDesign());put("designStatus","draft");put("designPublishAt","");put("designRevisionNote","New design");themePreview();$("designStatus").dispatchEvent(new Event("change"));say("New unpublished version. The live homepage has not changed.");}
function action(label,fn,kind="secondary"){const b=document.createElement("button");b.type="button";b.className=kind;b.textContent=label;b.addEventListener("click",fn);return b}
function render(){
 const root=$("designVersionList");root.replaceChildren();
 if(!versions.length){const p=document.createElement("p");p.className="hint";p.textContent="No saved homepage versions yet. Create your first version above.";root.append(p);return}
 versions.forEach(v=>{
  const card=document.createElement("article");card.className="design-version-card";
  const title=document.createElement("strong");title.textContent=v.name;
  const meta=document.createElement("p");const statusLabel=v.status==="scheduled"&&v.publishAt&&new Date(v.publishAt).getTime()<=Date.now()?"SCHEDULED · NOW LIVE":v.status.toUpperCase();meta.textContent=v.theme.toUpperCase()+" · "+statusLabel+" · "+v.revisionCount+" saved revision(s)"+(v.publishAt?" · "+new Date(v.publishAt).toLocaleString():"");
  const actions=document.createElement("div");actions.className="design-version-actions";
  actions.append(action("EDIT",()=>edit(v)),action("PREVIEW ↗",()=>window.open("/?design-preview="+encodeURIComponent(v.id),"_blank","noopener")),action("DUPLICATE",()=>duplicate(v)),action("VERSION HISTORY",()=>history(v)));
  if(v.status!=="published")actions.append(action("MAKE LIVE NOW",()=>activate(v),"primary"));
  if(v.status==="published")actions.append(action("ARCHIVE",()=>archive(v),"danger"));
  else actions.append(action("DELETE",()=>remove(v),"danger"));
  card.append(title,meta,actions);root.append(card);
 });
}
function edit(v){
 const isLive=v.status==="published";
 editingId=isLive?null:v.id;editingStatus=isLive?"draft":v.status;
 put("designVersionName",isLive?"Copy of "+v.name:v.name);put("designTheme",v.theme);fill(v.design);
 put("designStatus",isLive?"draft":v.status);put("designPublishAt",localDate(v.publishAt));
 put("designRevisionNote",isLive?"Copy of live version": "Edited version");
 themePreview();$("designStatus").dispatchEvent(new Event("change"));say(isLive?"This is a new draft copied from the live version. The current live homepage will remain unchanged.":"Editing saved version. Saving will add a revision to its history.");
 $("designEditor").scrollIntoView({behavior:"smooth",block:"start"});
}
function duplicate(v){editingId=null;editingStatus="draft";put("designVersionName","Copy of "+v.name);put("designTheme",v.theme);fill(v.design);put("designStatus","draft");put("designPublishAt","");put("designRevisionNote","Copied from "+v.name);themePreview();$("designStatus").dispatchEvent(new Event("change"));say("A new draft copy has been prepared. The original version is untouched.");$("designEditor").scrollIntoView({behavior:"smooth",block:"start"})}
async function history(v){
 say("Loading version history…");const {data,error}=await db.rpc("get_moderator_orlong_homepage_revisions",{p_version_id:v.id});if(error){say(error.message);return}
 const root=$("designHistory");root.replaceChildren();const h=document.createElement("h3");h.textContent="VERSION HISTORY — "+v.name;root.append(h);
 if(!data?.length){const p=document.createElement("p");p.textContent="No earlier revisions have been recorded.";root.append(p)}
 (data||[]).forEach(r=>{const row=document.createElement("div");row.className="design-history-row";const label=document.createElement("span");label.textContent="REVISION "+r.number+" · "+new Date(r.createdAt).toLocaleString()+" · "+(r.note||"No note");const load=action("RESTORE AS NEW DRAFT",()=>{const s=r.snapshot||{};editingId=null;editingStatus="draft";put("designVersionName","Restored: "+(s.name||v.name));put("designTheme",s.theme||"blue");fill(s.design);put("designStatus","draft");put("designPublishAt","");put("designRevisionNote","Restored from revision "+r.number);themePreview();$("designStatus").dispatchEvent(new Event("change"));say("Revision loaded as a new draft. Your original history is preserved.");$("designHistory").replaceChildren();$("designEditor").scrollIntoView({behavior:"smooth",block:"start"})});row.append(label,load);root.append(row)});
 say("History loaded. Restoring a revision creates a new draft and never overwrites the saved history.");
}
async function save(statusOverride){
 const status=statusOverride||val("designStatus"),dateVal=val("designPublishAt");let publishAt=null;
 if(status==="scheduled"){if(!dateVal){say("Choose the date and time for publication.");return}const d=new Date(dateVal);if(Number.isNaN(d.getTime())||d.getTime()<=Date.now()){say("The scheduled publication time must be in the future.");return}publishAt=d.toISOString()}
 const image=val("designHeroBackgroundImage").trim();if(image&&!/^https?:\\/\\//i.test(image)){say("The hero background image must use a full https:// or http:// address.");return}
 const name=val("designVersionName").trim();if(!name){say("Give this version a name.");return}
 const button=$("designSave");button.disabled=true;say("Saving homepage version…");
 try{
  const {data,error}=await db.rpc("save_moderator_orlong_homepage_version",{p_version_id:editingId,p_version_name:name,p_theme:val("designTheme"),p_design:formDesign(),p_status:status,p_publish_at:publishAt,p_revision_note:val("designRevisionNote")||"Updated design"});
  if(error)throw error;editingId=data.version_id;editingStatus=status;
  say(status==="scheduled"?"Saved safely in the background. It will replace the live homepage when its scheduled time arrives.":status==="published"?"Published. The homepage will use this design on the next page load.":"Saved as a draft. Readers cannot see it.");
  await load();
 }catch(e){say(e.message||"Could not save this homepage version.")}finally{button.disabled=false}
}
async function activate(v){if(!confirm("Make “"+v.name+"” the live homepage design now?"))return;const snap={...v};editingId=snap.id;put("designVersionName",snap.name);put("designTheme",snap.theme);fill(snap.design);put("designStatus","published");put("designPublishAt","");put("designRevisionNote","Published immediately");themePreview();$("designStatus").dispatchEvent(new Event("change"));await save("published")}
async function archive(v){if(!confirm("Archive this live version? The site will fall back to the previous eligible published design."))return;editingId=v.id;put("designVersionName",v.name);put("designTheme",v.theme);fill(v.design);put("designStatus","archived");put("designPublishAt","");put("designRevisionNote","Archived");$("designStatus").dispatchEvent(new Event("change"));await save("archived")}
async function remove(v){if(!confirm("Delete this draft or scheduled version and its revision history?"))return;const {error}=await db.rpc("delete_moderator_orlong_homepage_version",{p_version_id:v.id});if(error){say(error.message);return}await load();say("Version deleted.")}
async function load(){say("Loading saved homepage versions…");const {data,error}=await db.rpc("get_moderator_orlong_homepage_versions");if(error)throw error;versions=Array.isArray(data)?data:[];render();say("Homepage design studio ready. Your live site remains unchanged until a version is published or its scheduled time arrives.")}
async function init(){
 if(!$("designVersionList"))return;
 db=window.supabase.createClient(URL_BASE,KEY);const {data}=await db.auth.getSession();if(!data.session)return;
 const {data:ok}=await db.rpc("is_reader_moderator");if(ok!==true)return;
 $("designSave").addEventListener("click",()=>save());$("designNew").addEventListener("click",fresh);$("designRefresh").addEventListener("click",()=>load().catch(e=>say(e.message)));$("designTheme").addEventListener("change",setThemeDefaults);["designAccentColor","designHighlightColor","designBackgroundColor","designSurfaceColor","designTextColor"].forEach(id=>$(id).addEventListener("input",themePreview));
 $("designStatus").addEventListener("change",()=>{$("designScheduleFields").hidden=val("designStatus")!=="scheduled"});
 $("designStatus").dispatchEvent(new Event("change"));fresh();await load();
}
document.addEventListener("DOMContentLoaded",()=>init().catch(e=>say(e.message||"Homepage design studio could not load.")));
})();