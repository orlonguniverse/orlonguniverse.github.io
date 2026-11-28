(()=>{"use strict";
const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const safeUrl=value=>{try{const u=new URL(value,location.origin);return ["http:","https:"].includes(u.protocol)?u.href:null}catch(_){return null}};
const style=()=>{if(document.getElementById("orlongBuilderStyles"))return;const s=$("style");s.id="orlongBuilderStyles";s.textContent=`
.orlong-custom-section{box-sizing:border-box;margin:34px auto;padding:30px 32px;border:1px solid rgba(120,160,205,.24);border-radius:5px;color:inherit;background:rgba(14,29,47,.72);font-family:Inter,Arial,sans-serif;line-height:1.75}
.orlong-custom-section.width-narrow{max-width:760px}.orlong-custom-section.width-standard{max-width:1040px}.orlong-custom-section.width-wide{max-width:1280px}.orlong-custom-section.width-full{max-width:none;width:100%;border-radius:0}
.orlong-custom-section.theme-default{background:transparent}.orlong-custom-section.theme-panel{background:rgba(14,29,47,.78)}.orlong-custom-section.theme-blue{background:linear-gradient(135deg,#102e4e,#0a1728);border-color:#315b85}.orlong-custom-section.theme-light{background:#edf2f8;color:#17283b;border-color:#cbd7e5}
.orlong-custom-section.align-center{text-align:center}.orlong-custom-section h2{font-family:Cinzel,Georgia,serif;font-size:clamp(20px,3vw,30px);letter-spacing:1px;margin:0 0 16px}.orlong-custom-section h3{font-family:Cinzel,Georgia,serif;font-size:19px;margin:22px 0 9px}.orlong-custom-section p{font-size:14px;line-height:1.9;white-space:pre-wrap}.orlong-builder-callout{padding:18px 20px;border-left:3px solid #5ba7ec;background:rgba(80,145,205,.12);margin:18px 0}.theme-light .orlong-builder-callout{background:#dce8f5}.orlong-builder-image{display:block;max-width:100%;height:auto;margin:18px auto;border-radius:4px}.orlong-builder-caption{font-size:12px;opacity:.75;text-align:center;margin-top:-10px}.orlong-builder-button{display:inline-block;margin:14px 8px 8px 0;padding:12px 20px;background:#2f77b9;color:#fff!important;text-decoration:none!important;border-radius:3px;font-weight:700;font-size:12px;letter-spacing:.8px}.orlong-builder-divider{border:0;border-top:1px solid currentColor;opacity:.2;margin:26px 0}.orlong-custom-section details{padding:14px 0;border-bottom:1px solid rgba(130,160,190,.25)}.orlong-custom-section summary{cursor:pointer;font-weight:700}.orlong-custom-section .orlong-builder-block{margin:12px 0}
.orlong-builder-panel{position:fixed;isolation:isolate;contain:layout style;pointer-events:auto;z-index:2147483646;left:0;top:58px;bottom:0;width:min(390px,calc(100vw - 24px));max-height:none;overflow:auto;padding:22px 20px 36px;background:#101d2d;color:#f4f7fb;border:0;border-right:1px solid #496886;box-shadow:12px 0 36px #0005;font:13px Inter,Arial,sans-serif}.orlong-builder-panel:before{content:"SITE DESIGN STUDIO";display:block;margin:-22px -20px 18px;padding:18px 20px;background:#172b42;border-bottom:1px solid #385674;color:#a9d4ff;font:700 11px Inter,Arial,sans-serif;letter-spacing:2px}.orlong-builder-panel h2{font-size:18px}.orlong-builder-panel .builder-entry{background:#14263a;border-radius:5px}.orlong-builder-panel .builder-row button{border-radius:3px}.orlong-builder-panel .builder-row button:focus-visible,.orlong-builder-panel button:focus-visible{outline:2px solid #8cc8ff;outline-offset:2px}.orlong-builder-panel h2{font:600 17px Cinzel,Georgia,serif;margin:0 0 12px}.orlong-builder-panel p{font-size:11px;line-height:1.6;color:#afc1d4}.orlong-builder-panel button,.orlong-builder-panel select,.orlong-builder-panel input,.orlong-builder-panel textarea{font:12px Inter,Arial,sans-serif}.orlong-builder-panel button{padding:8px 10px;border:1px solid #496886;background:#183553;color:#fff;cursor:pointer}.orlong-builder-panel button.danger{background:#512d36;border-color:#87505b}.orlong-builder-panel .builder-row{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}.orlong-builder-panel .builder-entry{padding:13px;border:1px solid #30465e;margin:10px 0}.orlong-builder-panel .builder-entry>p{font-size:11px}.orlong-builder-panel .builder-entry>strong{font-size:13px;color:#e6f2ff}.orlong-builder-panel .builder-dialog-fields{padding:12px;background:#13263a;border:1px solid #30465e;border-radius:5px}.orlong-builder-panel .builder-status{padding:8px 10px;background:#152d45;border-radius:4px}.orlong-builder-panel button:disabled{opacity:.4;cursor:not-allowed}.orlong-builder-panel .builder-entry strong{display:block;margin-bottom:7px}.orlong-builder-panel label{display:grid;gap:5px;margin:10px 0;color:#c7d8e8;font-size:10px;letter-spacing:.5px}.orlong-builder-panel input,.orlong-builder-panel textarea,.orlong-builder-panel select{width:100%;box-sizing:border-box;padding:9px;background:#101f31;color:#fff;border:1px solid #405a76}.orlong-builder-panel textarea{min-height:90px}.orlong-builder-panel .builder-close{float:right}.orlong-builder-panel .builder-status{color:#a9d4ff;min-height:18px}
@media(max-width:600px){.orlong-custom-section{padding:22px 17px;margin:22px 10px}.orlong-builder-panel{top:58px;left:0;right:auto;bottom:0;width:min(390px,calc(100vw - 24px));max-height:none}}
`;document.head.append(s)};
function makeBlock(block){
 const wrap=$("div","orlong-builder-block");
 if(block.type==="heading"){wrap.append($("h3","",block.text||""));return wrap}
 if(block.type==="text"){wrap.append($("p","",block.text||""));return wrap}
 if(block.type==="callout"){wrap.append($("div","orlong-builder-callout",block.text||""));return wrap}
 if(block.type==="divider"){wrap.append($("hr","orlong-builder-divider"));return wrap}
 if(block.type==="image"){const url=safeUrl(block.url||"");if(!url)return wrap;const img=$("img","orlong-builder-image");img.src=url;img.alt=block.alt||"";if(block.width)img.style.width=block.width;wrap.append(img);if(block.caption)wrap.append($("div","orlong-builder-caption",block.caption));return wrap}
 if(block.type==="button"){const url=safeUrl(block.url||"");if(!url)return wrap;const a=$("a","orlong-builder-button",block.text||"LEARN MORE");a.href=url;if(/^https?:/.test(url))a.rel="noopener noreferrer";wrap.append(a);return wrap}
 if(block.type==="accordion"){if(block.title)wrap.append($("h3","",block.title));(block.items||[]).forEach(item=>{const d=$("details"),s=$("summary","",item.title||"More information"),p=$("p","",item.text||"");d.append(s,p);wrap.append(d)});return wrap}
 return wrap
}
function renderSection(record){
 const data=record.data||{},section=$("section","orlong-custom-section width-"+(data.width||"standard")+" theme-"+(data.theme||"default")+(data.align==="center"?" align-center":""));
 section.dataset.orlongSectionId=record.id;
 if(data.title)section.append($("h2","",data.title));
 (data.blocks||[]).forEach(b=>section.append(makeBlock(b)));
 return section
}
function resolvePlacementAnchor(selector){
 const value=String(selector||"main");
 if(value.startsWith("@heading:")){const wanted=value.slice(9);return [...document.querySelectorAll("main h1,main h2,main h3")].find(node=>node.textContent.trim()===wanted)||null}
 if(value.startsWith("@section:")){const wanted=value.slice(9);return [...document.querySelectorAll("main section,main article,main header")].find(node=>(node.querySelector("h1,h2,h3")?.textContent||"").trim()===wanted)||null}
 try{return document.querySelector(value)}catch(_){return null}
}
function placeSection(section,record,placed=new Map()){
 const selector=record.anchorSelector||"main";
 let anchor=resolvePlacementAnchor(selector);
 if(!anchor||anchor.closest?.("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]"))anchor=document.querySelector("main")||document.body;
 const placement=record.data?.placement||"after",key=selector+"|"+placement,previous=placed.get(key);
 if(placement==="before"&&anchor!==document.body){anchor.parentNode?.insertBefore(section,anchor);return}
 if(placement==="inside"){
  if(previous&&previous.parentNode===anchor)previous.insertAdjacentElement("afterend",section);else anchor.prepend(section);
  placed.set(key,section);return
 }
 if(placement==="end"||anchor===document.body||anchor.tagName?.toLowerCase()==="main"){anchor.append(section);return}
 if(placement==="after"){
  if(previous&&previous.parentNode===anchor.parentNode)previous.insertAdjacentElement("afterend",section);else anchor.insertAdjacentElement("afterend",section);
  placed.set(key,section);return
 }
 anchor.insertAdjacentElement("afterend",section);
}
function selectorForPlacement(node){
 if(!node)return "main";
 if(node.id)return "#"+CSS.escape(node.id);
 if(node.matches("h1,h2,h3"))return "@heading:"+node.textContent.trim().slice(0,180);
 const heading=node.querySelector?.("h1,h2,h3");
 if(heading&&node.matches("section,article,header"))return "@section:"+heading.textContent.trim().slice(0,180);
 const main=document.querySelector("main"),parts=[];let current=node;
 while(current&&current!==main&&current!==document.body&&parts.length<7){
  let part=current.tagName.toLowerCase();
  const parent=current.parentElement;
  if(parent){const same=[...parent.children].filter(x=>x.tagName===current.tagName);if(same.length>1)part+=":nth-of-type("+(same.indexOf(current)+1)+")"}
  parts.unshift(part);current=parent;
 }
 return parts.length?"main > "+parts.join(" > "):"main";
}
function placementOptions(){
 const main=document.querySelector("main")||document.body,options=[{value:"main|end",label:"At the very bottom of this page"}];
 const candidates=[...main.querySelectorAll("header,section,article,h1,h2,h3") ].filter(node=>!node.closest("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]")&&!node.hasAttribute("data-orlongSectionId"));
 candidates.forEach((node,index)=>{
  const heading=node.matches("h1,h2,h3")?node:node.querySelector("h1,h2,h3");
  const label=(node.matches("h1,h2,h3")?"Heading — ":"Section — ")+(heading?.textContent||node.getAttribute("aria-label")||node.tagName.toLowerCase()).trim().replace(/\s+/g," ").slice(0,52);
  const selector=selectorForPlacement(node);
  options.push({value:selector+"|after",label:"After: "+label});
  options.push({value:selector+"|before",label:"Before: "+label});
 });
 options.push({value:"main|inside",label:"At the top of the main page content"});
 return options;
}
async function render(db,path){
 style();
 const {data,error}=await db.rpc("get_public_orlong_site_sections",{p_page_path:path});
 if(error){console.warn("Orlong page sections:",error.message);return {error:error.message,count:0}}
 const records=Array.isArray(data)?data:[];
 const placed=new Map();
 records.forEach(record=>{
  try{const section=renderSection(record);placeSection(section,record,placed)}
  catch(e){console.warn("Could not place saved Orlong section:",record?.id,e)}
 });
 return {count:records.length};
}
async function start(db,path,bar){
 const {data,error}=await db.auth.getSession();if(error||!data.session)return;
 const {data:allowed}=await db.rpc("is_reader_moderator");if(allowed!==true)return;
 style();
 const add=$("button","","＋ ADD SECTION"),manage=$("button","","MANAGE SECTIONS"),pagesButton=$("button","","MANAGE PAGES");
 Object.assign(add.style,{padding:"8px 11px",background:"#236caa",color:"#fff",border:"1px solid #6faee4",cursor:"pointer"});
 Object.assign(manage.style,{padding:"8px 11px",background:"#183553",color:"#fff",border:"1px solid #496886",cursor:"pointer"});Object.assign(pagesButton.style,{padding:"8px 11px",background:"#183553",color:"#fff",border:"1px solid #496886",cursor:"pointer"});
 bar.insertBefore(add,bar.querySelector("#orlongEditorExit"));bar.insertBefore(manage,bar.querySelector("#orlongEditorExit"));bar.insertBefore(pagesButton,bar.querySelector("#orlongEditorExit"));
 const panel=$("aside","orlong-builder-panel");panel.id="orlongBuilderPanel";panel.dataset.orlongEditorUi="true";panel.setAttribute("aria-label","Website design editor");panel.hidden=true;document.body.append(panel);
 const status=$("p","builder-status","Your page preview remains visible beside this sidebar. Select a section below or create a new one.");
 const head=$("h2","","PAGE DESIGN & CONTENT");const close=$("button","builder-close","CLOSE");close.type="button";close.addEventListener("click",()=>panel.hidden=true);
 const body=$("div");panel.append(close,head,$("p","","This sidebar controls the page preview behind it. Add sections, organise content, and adjust each section. Changes are saved to Supabase."),$("div","builder-entry","PAGE: "+path),status,body);
 let sections=[];
 const message=t=>status.textContent=t;
 const refreshPreview=()=>{
  document.querySelectorAll("[data-orlong-section-id]").forEach(node=>node.remove());
  const placed=new Map();[...sections].sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).forEach(record=>placeSection(renderSection(record),record,placed));
 };
 const save=async(section)=>{
  const {data:result,error:saveError}=await db.rpc("save_moderator_orlong_site_section",{p_section_id:section.id||null,p_page_path:path,p_anchor_selector:section.anchorSelector||"main",p_sort_order:section.sortOrder||0,p_section_data:section.data,p_is_published:section.published!==false});
  if(saveError)throw saveError;if(!result?.section_id)throw new Error("The section was not saved. The database did not return a section ID.");section.id=result.section_id;
  const existing=sections.findIndex(item=>item.id===section.id);if(existing>=0)sections[existing]=section;else sections.push(section);
  refreshPreview();return section;
 };
 const reload=async()=>{
  const {data,error:loadError}=await db.rpc("get_moderator_orlong_site_sections",{p_page_path:path});
  if(loadError)throw loadError;
  sections=Array.isArray(data)?data:[];refreshPreview();body.replaceChildren();
  body.append($("h2","","SECTIONS ON THIS PAGE"),$("p","","Each card below represents one section of this page. Move sections up or down to change their order. EDIT SECTION changes its position and appearance; EDIT CONTENT changes its words, images and links."));
  const createBar=$("div","builder-row"),createButton=$("button","","＋ ADD A SECTION");createButton.addEventListener("click",addSection);createBar.append(createButton);body.append(createBar);
  if(!sections.length){body.append($("div","builder-entry","There are no custom sections on this page yet. Select ADD A SECTION to create your first one."));return}
  sections.forEach((section,index)=>{
  const entry=$("div","builder-entry"),title=$("strong","", "SECTION "+(index+1)+" — "+(section.data?.title||"Untitled section")),meta=$("p","",(section.data?.blocks||[]).length+" content blocks · "+(section.published?"PUBLISHED":"DRAFT"));
  const actions=$("div","builder-row");
  const edit=$("button","","EDIT SECTION");edit.addEventListener("click",()=>editSection(section));
  const block=$("button","","＋ ADD CONTENT");block.addEventListener("click",()=>addBlock(section));
  const manage=$("button","","EDIT CONTENT");manage.addEventListener("click",()=>manageBlocks(section));
  const visibility=$("button","",section.published===false?"PUBLISH":"HIDE");visibility.addEventListener("click",async()=>{section.published=section.published===false;try{await save(section);await reload();message(section.published?"Section published.":"Section hidden from readers.")}catch(e){message(e.message)}});
  const up=$("button","","MOVE UP");up.title="Move section up";up.disabled=index===0;up.addEventListener("click",()=>moveSection(section,-1));
  const down=$("button","","MOVE DOWN");down.title="Move section down";down.disabled=index===sections.length-1;down.addEventListener("click",()=>moveSection(section,1));
  const duplicate=$("button","","DUPLICATE");duplicate.addEventListener("click",async()=>{const copy={pagePath:path,anchorSelector:section.anchorSelector||"main",sortOrder:sections.length?Math.max(...sections.map(item=>item.sortOrder||0))+1:0,published:section.published!==false,data:JSON.parse(JSON.stringify(section.data||{}))};copy.data.title="Copy of "+(copy.data.title||"Untitled section");try{await save(copy);await reload();message("Section duplicated.")}catch(e){message(e.message||"Could not duplicate this section.")}});
  const del=$("button","danger","DELETE");del.addEventListener("click",()=>deleteSection(section));
  const placement=$("p","",placementDescription(section));
  actions.append(edit,block,manage,visibility,up,down,duplicate,del);entry.append(title,meta,placement,actions);body.append(entry);
 });
  renderNativeSections();
 }; 
 const renderNativeSections=()=>{
  const main=document.querySelector("main");if(!main)return;
  const native=[...main.querySelectorAll(":scope > section,:scope > article,:scope > header,:scope > footer")]
   .filter(node=>!node.hasAttribute("data-orlong-section-id")&&!node.closest("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]"));
  const heading=$("h2","","EXISTING PAGE SECTIONS");
  const intro=$("p","","These are the sections already built into this page. They are separate from the extra sections you create above. You can hide or restore a section here, or open the visual editor and click its individual text, image or link to edit it.");
  body.append(heading,intro);
  if(!native.length){body.append($("div","builder-entry","No built-in page sections were found inside the main content area."));return}
  native.forEach((node,index)=>{
   const title=node.querySelector("h1,h2,h3,h4")?.textContent?.trim()||node.getAttribute("aria-label")||node.className?.toString().split(" ")[0]||node.tagName.toLowerCase();
   const entry=$("div","builder-entry"),name=$("strong","",(index+1)+". "+title.slice(0,90));
   const meta=$("p","",node.hidden?"HIDDEN FROM READERS":"BUILT-IN PAGE SECTION");
   const actions=$("div","builder-row"),locate=$("button","","LOCATE SECTION"),toggle=$("button","",node.hidden?"RESTORE SECTION":"HIDE SECTION");
   locate.addEventListener("click",()=>{node.scrollIntoView({behavior:"smooth",block:"center"});node.style.outline="3px solid #78baff";setTimeout(()=>{node.style.outline=""},1800);message("Section located. Click an individual heading, paragraph, image or link on the page to edit it.")});
   toggle.addEventListener("click",async()=>{
    toggle.disabled=true;const next=!node.hidden;const selector=selectorForPlacement(node);
    try{
     const {error}=await db.rpc("save_moderator_orlong_site_content",{p_page_path:path,p_selector:selector,p_property:"hidden",p_content_value:String(next),p_is_published:true});
     if(error)throw error;node.hidden=next;message(next?"Existing section hidden. You can restore it here at any time.":"Existing section restored.");
     renderNativeSections();
    }catch(e){message(e.message||"Could not change this section.")}finally{toggle.disabled=false}
   });
   actions.append(locate,toggle);entry.append(name,meta,actions);body.append(entry);
  });
 }
 const input=