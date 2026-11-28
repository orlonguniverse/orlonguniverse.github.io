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
 records.forEach(record=>{try{placeSection(renderSection(record),record,placed)}catch(e){console.warn("Could not place saved Orlong section:",record?.id,e)}});
 return {count:records.length};
}
async function start(db,path,bar){
 const {data,error}=await db.auth.getSession();if(error||!data.session)return;
 const {data:allowed}=await db.rpc("is_reader_moderator");if(allowed!==true)return;
 style();
 const add=$("button","","＋ ADD SECTION"),manage=$("button","","MANAGE SECTIONS"),pagesButton=$("button","","MANAGE CUSTOM PAGES"),mapButton=$("button","","ALL WEBSITE PAGES");
 Object.assign(add.style,{padding:"8px 11px",background:"#236caa",color:"#fff",border:"1px solid #6faee4",cursor:"pointer"});
 Object.assign(manage.style,{padding:"8px 11px",background:"#183553",color:"#fff",border:"1px solid #496886",cursor:"pointer"});Object.assign(pagesButton.style,{padding:"8px 11px",background:"#183553",color:"#fff",border:"1px solid #496886",cursor:"pointer"});Object.assign(mapButton.style,{padding:"8px 11px",background:"#183553",color:"#fff",border:"1px solid #496886",cursor:"pointer"});
 bar.insertBefore(add,bar.querySelector("#orlongEditorExit"));bar.insertBefore(manage,bar.querySelector("#orlongEditorExit"));bar.insertBefore(pagesButton,bar.querySelector("#orlongEditorExit"));bar.insertBefore(mapButton,bar.querySelector("#orlongEditorExit"));
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
  body.querySelectorAll(".native-section-inventory").forEach(el=>el.remove());
  const main=document.querySelector("main");if(!main)return;
  const host=$("div","native-section-inventory");
  const native=[...main.querySelectorAll("section,article,header,footer")]
   .filter(node=>!node.hasAttribute("data-orlong-section-id")&&!node.closest("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]"));
  const contentSelectorFor=node=>{
   if(node.id)return "#"+CSS.escape(node.id);
   const parts=[];let current=node;
   while(current&&current!==main&&current!==document.body&&parts.length<7){
    let part=current.tagName.toLowerCase();
    if(current.classList.length)part+="."+[...current.classList].slice(0,2).map(CSS.escape).join(".");
    const parent=current.parentElement;
    if(parent){const same=[...parent.children].filter(x=>x.tagName===current.tagName);if(same.length>1&&!current.classList.length)part+=":nth-of-type("+(same.indexOf(current)+1)+")"}
    parts.unshift(part);current=parent;
   }
   return "main > "+parts.join(" > ");
  };
  host.append($("h2","","EXISTING PAGE SECTIONS"),$("p","","These are sections already built into this page, not just sections you create. Hide or restore them here. To edit individual wording, images or links, select the visual editor and click that item on the page."));
  if(!native.length){host.append($("div","builder-entry","No built-in page sections were found inside the main content area."));body.append(host);return}
  native.forEach((node,index)=>{
   const title=node.querySelector("h1,h2,h3,h4")?.textContent?.trim()||node.getAttribute("aria-label")||node.className?.toString().split(" ")[0]||node.tagName.toLowerCase();
   const entry=$("div","builder-entry"),name=$("strong","",(index+1)+". "+title.slice(0,90));
   const meta=$("p","",node.hidden?"HIDDEN FROM READERS":"BUILT-IN PAGE SECTION");
   const actions=$("div","builder-row"),locate=$("button","","LOCATE SECTION"),toggle=$("button","",node.hidden?"RESTORE SECTION":"HIDE SECTION");
   locate.addEventListener("click",()=>{node.scrollIntoView({behavior:"smooth",block:"center"});node.style.outline="3px solid #78baff";window.setTimeout(()=>{node.style.outline=""},1800);message("Section located. Click an individual heading, paragraph, image or link on the page to edit it.")});
   toggle.addEventListener("click",async()=>{
    toggle.disabled=true;const next=!node.hidden,selector=contentSelectorFor(node);
    try{
     const {error}=await db.rpc("save_moderator_orlong_site_content",{p_page_path:path,p_selector:selector,p_property:"hidden",p_content_value:String(next),p_is_published:true});
     if(error)throw error;node.hidden=next;message(next?"Existing section hidden. You can restore it here at any time.":"Existing section restored.");renderNativeSections();
    }catch(e){message(e.message||"Could not change this section.")}finally{toggle.disabled=false}
   });
   actions.append(locate,toggle);entry.append(name,meta,actions);host.append(entry);
  });
 };
 const input=(label,value="",multiline=false)=>{const wrap=$("label","",label),field=$(multiline?"textarea":"input");field.value=value;wrap.append(field);return {wrap,field}};
 const choose=(label,values,value)=>{const wrap=$("label","",label),field=$("select");values.forEach(v=>{const o=$("option","",v[1]);o.value=v[0];field.append(o)});field.value=value;wrap.append(field);return {wrap,field}};
 const dialog=(title,fields,onSave,afterSave=reload,onCancel=reload)=>{
  body.replaceChildren();const h=$("h2","",title),fieldHost=$("div","builder-dialog-fields");body.append(h,fieldHost);
  const renderFields=()=>{const list=typeof fields==="function"?fields():fields;fieldHost.replaceChildren();list.forEach(f=>fieldHost.append(f?.wrap||f));};
  renderFields();
  const actions=$("div","builder-row"),saveBtn=$("button","","SAVE"),cancel=$("button","","CANCEL");saveBtn.type=cancel.type="button";cancel.addEventListener("click",onCancel);
  saveBtn.addEventListener("click",async()=>{saveBtn.disabled=true;try{await onSave();message("Saved successfully.");await afterSave();}catch(e){message(e.message||"Could not save this change.");}finally{saveBtn.disabled=false}});
  actions.append(saveBtn,cancel);body.append(actions);return renderFields;
 };
 const placementDescription=section=>{
  const option=placementOptions().find(item=>item.value===((section.anchorSelector||"main")+"|"+(section.data?.placement||"end")));
  return "POSITION: "+(option?.label||"At the bottom of the page");
 };
 const editSection=section=>{
  const title=input("SECTION TITLE",section.data.title||""),theme=choose("BACKGROUND",[["default","Transparent"],["panel","Dark panel"],["blue","Blue feature"],["light","Light panel"]],section.data.theme||"default"),width=choose("SECTION WIDTH",[["narrow","Narrow"],["standard","Standard"],["wide","Wide"],["full","Full width"]],section.data.width||"standard"),align=choose("ALIGNMENT",[["left","Left"],["center","Centred"]],section.data.align||"left"),placement=choose("WHERE SHOULD THIS SECTION APPEAR?",placementOptions().map(x=>[x.value,x.label]),(section.anchorSelector||"main")+"|"+(section.data.placement||"end"));
  const publishedWrap=$("label","","PUBLISH THIS SECTION"),publishedField=$("input");publishedField.type="checkbox";publishedField.checked=section.published!==false;publishedWrap.append(publishedField);
  dialog("EDIT SECTION",[title.wrap,theme.wrap,width.wrap,align.wrap,placement.wrap,publishedWrap],async()=>{const [selector,position]=placement.field.value.split("|");section.data={...section.data,title:title.field.value.trim(),theme:theme.field.value,width:width.field.value,align:align.field.value,placement:position||"end"};section.anchorSelector=selector||"main";section.published=publishedField.checked;await save(section)});
 };
 const addSection=async()=>{
  const title=input("SECTION TITLE","New section"),theme=choose("BACKGROUND",[["default","Transparent"],["panel","Dark panel"],["blue","Blue feature"],["light","Light panel"]],"panel"),width=choose("SECTION WIDTH",[["narrow","Narrow"],["standard","Standard"],["wide","Wide"],["full","Full width"]],"standard"),placement=choose("WHERE SHOULD THIS SECTION APPEAR?",placementOptions().map(x=>[x.value,x.label]),"main|end");
  const publishedWrap=$("label","","PUBLISH THIS SECTION");const publishedField=$("input");publishedField.type="checkbox";publishedField.checked=true;publishedWrap.append(publishedField);
  dialog("CREATE SECTION",[title.wrap,theme.wrap,width.wrap,placement.wrap,publishedWrap],async()=>{const [selector,position]=placement.field.value.split("|");const section={pagePath:path,anchorSelector:selector||"main",sortOrder:sections.length?Math.max(...sections.map(s=>s.sortOrder||0))+1:0,published:publishedField.checked,data:{title:title.field.value.trim(),theme:theme.field.value,width:width.field.value,align:"left",placement:position||"end",blocks:[]}};await save(section)});
 };
 const addBlock=section=>{
  const type=choose("CONTENT TYPE",[["heading","Heading"],["text","Text box / paragraph"],["callout","Highlighted text box"],["accordion","Collapsible menu"],["image","Image"],["button","Button / link"],["divider","Divider"]],"text");
  const fields=[type];const dynamic=()=>{fields.splice(1);const t=type.field.value;
   if(t==="heading"||t==="text"||t==="callout"){fields.push(input(t==="heading"?"HEADING TEXT":"TEXT CONTENT","",true))}
   if(t==="accordion"){fields.push(input("MENU TITLE","More information"));fields.push(input("ITEMS (one per line: title | content)","First item | Enter the content here",true))}
   if(t==="image"){fields.push(input("IMAGE URL (or upload below)",""));fields.push(input("IMAGE ALT TEXT",""));fields.push(input("IMAGE CAPTION",""));const fileWrap=$("label","","UPLOAD IMAGE");const file=$("input");file.type="file";file.accept="image/png,image/jpeg,image/webp,image/gif";fileWrap.append(file);fields.push({wrap:fileWrap,field:file})}
   if(t==="button"){fields.push(input("BUTTON TEXT","Learn more"));fields.push(input("DESTINATION URL","/"))}
  };
  const refreshFields=dialog("ADD CONTENT BLOCK",()=>fields,async()=>{
   const t=type.field.value,v=fields.slice(1).map(f=>f.field.value);
   let block={type:t};
   if(t==="heading"||t==="text"||t==="callout")block.text=v[0];
   if(t==="accordion"){block.title=v[0];block.items=v[1].split("\n").filter(Boolean).map(line=>{const i=line.indexOf("|");return {title:(i<0?line:line.slice(0,i)).trim(),text:(i<0?"":line.slice(i+1)).trim()}})}
   if(t==="image"){let url=v[0].trim();const file=fields[4]?.field?.files?.[0];if(file){if(file.size>15*1024*1024)throw new Error("Choose an image smaller than 15 MB.");const ext=file.type==="image/png"?"png":file.type==="image/gif"?"gif":file.type==="image/jpeg"?"jpg":"webp";const folder=path.replace(/[^a-z0-9]/gi,"-").replace(/-+/g,"-").replace(/^-|-$/g,"")||"site";const filePath=folder+"/"+Date.now()+"."+ext;const {error:uploadError}=await db.storage.from("orlong-site-media").upload(filePath,file,{upsert:false,cacheControl:"31536000"});if(uploadError)throw uploadError;url=db.storage.from("orlong-site-media").getPublicUrl(filePath).data.publicUrl}if(!safeUrl(url))throw new Error("Enter a valid image URL or upload an image.");block.url=url;block.alt=v[1];block.caption=v[2];}
   if(t==="button"){block.text=v[0];block.url=v[1];if(!safeUrl(block.url))throw new Error("Enter a valid button destination.");}
   section.data.blocks=[...(section.data.blocks||[]),block];await save(section);
  },()=>manageBlocks(section),()=>manageBlocks(section));
  type.field.addEventListener("change",()=>{dynamic();refreshFields()});dynamic();refreshFields();
 };
 const manageBlocks=section=>{
  body.replaceChildren($("h2","","EDIT SECTION CONTENT"),$("p","","This is the content inside this section. Edit an item, move it up or down, remove it, or add another item. Changes appear in the page preview as soon as they are saved."));
  const blocks=section.data.blocks||[];
  if(!blocks.length)body.append($("p","","This section is empty. Add your first content block."));
  blocks.forEach((block,index)=>{
   const entry=$("div","builder-entry"),name=$("strong","",(index+1)+". "+block.type.toUpperCase()),preview=$("p","",(block.text||block.title||block.caption||block.url||"").slice(0,150));
   const actions=$("div","builder-row"),edit=$("button","","EDIT"),remove=$("button","danger","REMOVE"),up=$("button","","↑"),down=$("button","","↓");
   edit.addEventListener("click",()=>editBlock(section,index));
   remove.addEventListener("click",async()=>{if(!confirm("Remove this content block?"))return;section.data.blocks.splice(index,1);try{await save(section);manageBlocks(section)}catch(e){message(e.message)}});
   up.disabled=index===0;down.disabled=index===blocks.length-1;
   up.addEventListener("click",async()=>{const a=section.data.blocks;[a[index-1],a[index]]=[a[index],a[index-1]];try{await save(section);manageBlocks(section)}catch(e){message(e.message)}});
   down.addEventListener("click",async()=>{const a=section.data.blocks;[a[index+1],a[index]]=[a[index],a[index+1]];try{await save(section);manageBlocks(section)}catch(e){message(e.message)}});
   actions.append(edit,up,down,remove);entry.append(name,preview,actions);body.append(entry);
  });
  const controls=$("div","builder-row"),addContent=$("button","","＋ ADD CONTENT BLOCK"),back=$("button","","BACK TO SECTIONS");addContent.addEventListener("click",()=>addBlock(section));back.addEventListener("click",reload);controls.append(addContent,back);body.append(controls);
 };
 const editBlock=(section,index)=>{
  const block=section.data.blocks[index],fields=[];
  const addField=(label,value,multi=false)=>{const f=input(label,value||"",multi);fields.push(f);return f};
  if(["heading","text","callout"].includes(block.type))addField(block.type==="heading"?"HEADING TEXT":"TEXT CONTENT",block.text,true);
  if(block.type==="accordion"){addField("MENU TITLE",block.title);addField("ITEMS (one per line: title | content)",(block.items||[]).map(x=>x.title+" | "+x.text).join("\n"),true)}
  if(block.type==="image"){addField("IMAGE URL",block.url);addField("ALT TEXT",block.alt);addField("CAPTION",block.caption)}
  if(block.type==="button"){addField("BUTTON TEXT",block.text);addField("DESTINATION URL",block.url)}
  dialog("EDIT "+block.type.toUpperCase(),fields.map(f=>f.wrap),async()=>{
   const v=fields.map(f=>f.field.value);
   if(["heading","text","callout"].includes(block.type))block.text=v[0];
   if(block.type==="accordion"){block.title=v[0];block.items=v[1].split("\n").filter(Boolean).map(line=>{const i=line.indexOf("|");return {title:(i<0?line:line.slice(0,i)).trim(),text:(i<0?"":line.slice(i+1)).trim()}})}
   if(block.type==="image"){if(!safeUrl(v[0]))throw new Error("Enter a valid image URL.");block.url=v[0];block.alt=v[1];block.caption=v[2]}
   if(block.type==="button"){if(!safeUrl(v[1]))throw new Error("Enter a valid button destination.");block.text=v[0];block.url=v[1]}
   section.data.blocks[index]=block;await save(section);
  },()=>manageBlocks(section),()=>manageBlocks(section));
 };
 const moveSection=async(section,delta)=>{const i=sections.findIndex(s=>s.id===section.id),j=i+delta;if(j<0||j>=sections.length)return;const a=sections[i],b=sections[j],n=a.sortOrder;a.sortOrder=b.sortOrder;b.sortOrder=n;try{await save(a);await save(b);await reload()}catch(e){message(e.message)}};
 const deleteSection=async section=>{if(!confirm("Delete this custom section and all its content?"))return;const {error:delError}=await db.rpc("delete_moderator_orlong_site_section",{p_section_id:section.id});if(delError){message(delError.message);return}await reload();message("Section deleted.")};
 const managedPageSave=async(page)=>{
  const {data,error}=await db.rpc("save_moderator_orlong_managed_page",{
   p_page_id:page.id||null,p_slug:page.slug,p_title:page.title,p_description:page.description||"",
   p_content:page.content||{blocks:[]},p_is_published:page.published===true,p_sort_order:page.sortOrder||0
  });
  if(error)throw error;page.id=data.page_id;page.slug=data.slug;return page;
 };
 const openPages=async()=>{
  body.replaceChildren($("h2","","CUSTOM PAGES"),$("p","","Create new pages, keep unfinished ideas as drafts, and publish them whenever you're ready. Each page gets its own shareable address."));
  const toolbar=$("div","builder-row"),create=$("button","","＋ CREATE NEW PAGE"),refresh=$("button","","REFRESH LIST");
  create.addEventListener("click",()=>editManagedPage(null));refresh.addEventListener("click",()=>openPages());toolbar.append(create,refresh);body.append(toolbar);
  const {data,error}=await db.rpc("get_moderator_orlong_managed_pages");if(error)throw error;
  const pages=Array.isArray(data)?data:[];
  if(!pages.length)body.append($("div","builder-entry","You haven't created any custom pages yet. Select CREATE NEW PAGE to begin."));
  pages.forEach(page=>{
   const entry=$("div","builder-entry"),title=$("strong","",page.title),meta=$("p","", "/managed-page.html?slug="+page.slug+" · "+((page.content?.blocks||[]).length)+" content blocks · "+(page.published?"PUBLISHED":"DRAFT"));
   const actions=$("div","builder-row"),edit=$("button","","EDIT PAGE"),content=$("button","","EDIT PAGE CONTENT"),preview=$("button","","OPEN PAGE ↗"),visual=$("button","","OPEN VISUAL EDITOR"),menu=$("button","","ADD TO WEBSITE MENU"),replaceMenu=$("button","","REPLACE MENU LINK"),copy=$("button","","DUPLICATE"),del=$("button","danger","DELETE");
   edit.addEventListener("click",()=>editManagedPage(page));
   content.addEventListener("click",()=>manageManagedPageBlocks(page));
   preview.addEventListener("click",()=>window.open("/managed-page.html?slug="+encodeURIComponent(page.slug)+"&preview=1","_blank","noopener"));
   visual.addEventListener("click",()=>window.open("/managed-page.html?slug="+encodeURIComponent(page.slug)+"&preview=1&orlong-edit=1","_blank","noopener"));
   menu.addEventListener("click",async()=>{try{const {data:config,error:loadError}=await db.rpc("get_moderator_orlong_site_map");if(loadError)throw loadError;config.links=config.links||[];const href="/managed-page.html?slug="+encodeURIComponent(page.slug);const existing=config.links.find(link=>link.href===href);if(existing){existing.label=page.title.toUpperCase();existing.enabled=true}else config.links.push({id:"managed-"+page.slug,label:page.title.toUpperCase(),href,group:"primary",order:Math.max(-1,...config.links.filter(link=>link.group==="primary").map(link=>link.order||0))+1,enabled:true});const {error:saveError}=await db.rpc("save_moderator_orlong_site_map",{p_config:config});if(saveError)throw saveError;message("Page added to the top navigation. You can move it or place it in a dropdown in WEBSITE MAP.")}catch(e){message(e.message||"Could not add this page to the website menu.")}});
   replaceMenu.addEventListener("click",async()=>{try{const {data:config,error}=await db.rpc("get_moderator_orlong_site_map");if(error)throw error;const links=(config.links||[]).filter(link=>link.enabled!==false);if(!links.length)throw new Error("There are no active menu links to replace.");body.replaceChildren($("h2","","REPLACE A MENU DESTINATION"),$("p","","Choose an existing menu link. Its wording and position will stay the same, but it will open this new page instead."));const target=choose("WHICH EXISTING MENU LINK SHOULD OPEN THIS PAGE?",links.map(link=>[link.id,(link.group||"menu").toUpperCase()+" — "+link.label]),links[0].id);const actions=$("div","builder-row"),save=$("button","","REPLACE DESTINATION"),back=$("button","","CANCEL");save.addEventListener("click",async()=>{const link=config.links.find(item=>item.id===target.field.value);if(!link)return;link.href="/managed-page.html?slug="+encodeURIComponent(page.slug);try{const {error:saveError}=await db.rpc("save_moderator_orlong_site_map",{p_config:config});if(saveError)throw saveError;message("Menu destination replaced. The original menu wording and position have been kept.");await openPages()}catch(e){message(e.message)}});back.addEventListener("click",openPages);body.append(target.wrap,actions);actions.append(save,back)}catch(e){message(e.message||"Could not load menu links.")}});
   copy.addEventListener("click",async()=>{const clone={...JSON.parse(JSON.stringify(page)),id:null,slug:page.slug+"-copy-"+Date.now().toString().slice(-5),title:"Copy of "+page.title,published:false,sortOrder:page.sortOrder||0};try{await managedPageSave(clone);message("Page duplicated as a draft.");await openPages()}catch(e){message(e.message)}});
   del.addEventListener("click",async()=>{if(!confirm("Permanently delete this custom page? This cannot be undone."))return;const {error}=await db.rpc("delete_moderator_orlong_managed_page",{p_page_id:page.id});if(error){message(error.message);return}message("Page deleted.");await openPages()});
   entry.append(title,meta,actions);actions.append(edit,content,preview,visual,menu,replaceMenu,copy,del);body.append(entry);
  });
  const back=$("button","","BACK TO THIS PAGE'S SECTIONS");back.addEventListener("click",reload);body.append(back);
 };
 const editManagedPage=page=>{
  const model=page?JSON.parse(JSON.stringify(page)):{id:null,slug:"",title:"",description:"",content:{blocks:[]},published:false,sortOrder:0};
  body.replaceChildren($("h2","",page?"EDIT PAGE DETAILS":"CREATE A NEW PAGE"),$("p","","This creates a real page on your website. You can keep it private as a draft until you're ready to publish it."));
  const title=input("PAGE TITLE",model.title),slug=input("PAGE ADDRESS (lowercase words separated by hyphens)",model.slug),description=input("SHORT INTRODUCTION",model.description,true);
  const published=$("label","","PUBLISH THIS PAGE"),check=$("input");check.type="checkbox";check.checked=model.published===true;published.append(check);
  const pathPreview=$("p","", "Page address: /managed-page.html?slug="+(model.slug||"your-page-name"));
  let slugManuallyEdited=Boolean(model.slug);slug.field.addEventListener("input",()=>{slugManuallyEdited=true;pathPreview.textContent="Page address: /managed-page.html?slug="+slug.field.value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")});title.field.addEventListener("input",()=>{if(!slugManuallyEdited){slug.field.value=title.field.value.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");pathPreview.textContent="Page address: /managed-page.html?slug="+slug.field.value}});
  const actions=$("div","builder-row"),saveBtn=$("button","","SAVE PAGE DETAILS"),contentBtn=$("button","","EDIT PAGE CONTENT"),back=$("button","","CANCEL");
  saveBtn.addEventListener("click",async()=>{model.title=title.field.value.trim();model.slug=slug.field.value.trim().toLowerCase();model.description=description.field.value.trim();model.published=check.checked;try{await managedPageSave(model);message("Page details saved.");editManagedPage(model)}catch(e){message(e.message)}});
  contentBtn.addEventListener("click",async()=>{model.title=title.field.value.trim();model.slug=slug.field.value.trim().toLowerCase();model.description=description.field.value.trim();model.published=check.checked;if(!model.id){try{await managedPageSave(model)}catch(e){message(e.message);return}}manageManagedPageBlocks(model)});
  back.addEventListener("click",openPages);
  [title.wrap,slug.wrap,description.wrap,published,pathPreview,actions].forEach(n=>body.append(n));actions.append(saveBtn,contentBtn,back);
 };
 const manageManagedPageBlocks=page=>{
  page.content=page.content||{blocks:[]};page.content.blocks=page.content.blocks||[];
  body.replaceChildren($("h2","","PAGE CONTENT"),$("p","","Build this page using headings, paragraphs, images, buttons and collapsible sections. Select EDIT to change an item or use the arrows to change its order."));
  page.content.blocks.forEach((block,index)=>{
   const entry=$("div","builder-entry"),summary=$("strong","",(index+1)+". "+block.type.toUpperCase()),preview=$("p","",(block.text||block.title||block.caption||block.url||"").slice(0,140)),actions=$("div","builder-row");
   const edit=$("button","","EDIT"),up=$("button","","MOVE UP"),down=$("button","","MOVE DOWN"),remove=$("button","danger","REMOVE");
   edit.addEventListener("click",()=>editManagedBlock(page,index));
   up.disabled=index===0;down.disabled=index===page.content.blocks.length-1;
   up.addEventListener("click",async()=>{[page.content.blocks[index-1],page.content.blocks[index]]=[page.content.blocks[index],page.content.blocks[index-1]];try{await managedPageSave(page);manageManagedPageBlocks(page)}catch(e){message(e.message)}});
   down.addEventListener("click",async()=>{[page.content.blocks[index+1],page.content.blocks[index]]=[page.content.blocks[index],page.content.blocks[index+1]];try{await managedPageSave(page);manageManagedPageBlocks(page)}catch(e){message(e.message)}});
   remove.addEventListener("click",async()=>{if(!confirm("Remove this content block?"))return;page.content.blocks.splice(index,1);try{await managedPageSave(page);manageManagedPageBlocks(page)}catch(e){message(e.message)}});
   actions.append(edit,up,down,remove);entry.append(summary,preview,actions);body.append(entry);
  });
  const actions=$("div","builder-row"),addContent=$("button","","＋ ADD CONTENT"),save=$("button","","SAVE PAGE"),back=$("button","","BACK TO PAGE DETAILS");
  addContent.addEventListener("click",()=>editManagedBlock(page,null));save.addEventListener("click",async()=>{try{await managedPageSave(page);message("Page content saved.")}catch(e){message(e.message)}});
  back.addEventListener("click",()=>editManagedPage(page));actions.append(addContent,save,back);body.append(actions);
 };
 const editManagedBlock=(page,index)=>{
  const old=index===null?{type:"text",text:""}:page.content.blocks[index],type=choose("CONTENT TYPE",[["heading","Heading"],["text","Text / paragraph"],["callout","Highlighted text box"],["accordion","Collapsible menu"],["image","Image"],["button","Button / link"],["divider","Divider"]],old.type);
  const fields=[type];const dynamic=()=>{fields.splice(1);const t=type.field.value;
   if(["heading","text","callout"].includes(t))fields.push(input(t==="heading"?"HEADING":"TEXT","",true));
   if(t==="accordion"){fields.push(input("MENU TITLE","More information"));fields.push(input("ITEMS — ONE PER LINE, TITLE | CONTENT","First question | Answer",true))}
   if(t==="image"){fields.push(input("IMAGE ADDRESS (OR UPLOAD BELOW)",""));fields.push(input("ALT TEXT",""));fields.push(input("CAPTION",""));const uploadWrap=$("label","","UPLOAD IMAGE FILE");const upload=$("input");upload.type="file";upload.accept="image/png,image/jpeg,image/webp,image/gif";uploadWrap.append(upload);fields.push({wrap:uploadWrap,field:upload})}
   if(t==="button"){fields.push(input("BUTTON LABEL","Learn more"));fields.push(input("DESTINATION","/"))}
   if(index!==null&&t===old.type){if(["heading","text","callout"].includes(t))fields[1].field.value=old.text||"";if(t==="accordion"){fields[1].field.value=old.title||"";fields[2].field.value=(old.items||[]).map(x=>x.title+" | "+x.text).join("\n")}if(t==="image"){fields[1].field.value=old.url||"";fields[2].field.value=old.alt||"";fields[3].field.value=old.caption||""}if(t==="button"){fields[1].field.value=old.text||"";fields[2].field.value=old.url||""}}
  };
  const render=dialog(index===null?"ADD PAGE CONTENT":"EDIT PAGE CONTENT",()=>fields,async()=>{
   const t=type.field.value,v=fields.slice(1).map(f=>f.field.value),b={type:t};
   if(["heading","text","callout"].includes(t))b.text=v[0]||"";
   if(t==="accordion"){b.title=v[0]||"";b.items=v[1].split("\n").filter(Boolean).map(line=>{const i=line.indexOf("|");return {title:(i<0?line:line.slice(0,i)).trim(),text:(i<0?"":line.slice(i+1)).trim()}})}
   if(t==="image"){let url=v[0].trim();const file=fields[4]?.field?.files?.[0];if(file){if(file.size>15*1024*1024)throw new Error("Choose an image smaller than 15 MB.");const ext=file.type==="image/png"?"png":file.type==="image/gif"?"gif":file.type==="image/jpeg"?"jpg":"webp";const folder=("managed-"+page.slug).replace(/[^a-z0-9-]/g,"-");const filePath=folder+"/"+Date.now()+"."+ext;const {error:uploadError}=await db.storage.from("orlong-site-media").upload(filePath,file,{upsert:false,cacheControl:"31536000"});if(uploadError)throw uploadError;url=db.storage.from("orlong-site-media").getPublicUrl(filePath).data.publicUrl}if(!safeUrl(url))throw new Error("Enter a valid image address or upload an image.");b.url=url;b.alt=v[1]||"";b.caption=v[2]||""}
   if(t==="button"){if(!safeUrl(v[1]))throw new Error("Enter a valid button destination.");b.text=v[0]||"Learn more";b.url=v[1]}
   if(index===null)page.content.blocks.push(b);else page.content.blocks[index]=b;
   await managedPageSave(page);
  },()=>manageManagedPageBlocks(page),()=>manageManagedPageBlocks(page));
  type.field.addEventListener("change",()=>{dynamic();render()});dynamic();render();
 };
 add.addEventListener("click",()=>{panel.hidden=false;addSection()});
 manage.addEventListener("click",()=>{panel.hidden=false;reload().catch(e=>message("Could not open section manager: "+e.message))});
 pagesButton.addEventListener("click",()=>{panel.hidden=false;openPages().catch(e=>message("Could not load custom page manager: "+e.message))});
 mapButton.addEventListener("click",()=>window.open("/moderator/#tab-sitemap","_blank","noopener"));
 try{await reload()}catch(e){message(e.message||"Could not load page sections. Run the Visual Page Builder migration first.");}
}
window.OrlongSiteBuilder={render,start};
})();