(()=>{"use strict";
const $=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const safeUrl=value=>{try{const u=new URL(value,location.origin);return ["http:","https:"].includes(u.protocol)?u.href:null}catch(_){return null}};
const style=()=>{if(document.getElementById("orlongBuilderStyles"))return;const s=$("style");s.id="orlongBuilderStyles";s.textContent=`
.orlong-custom-section{box-sizing:border-box;margin:34px auto;padding:30px 32px;border:1px solid rgba(120,160,205,.24);border-radius:5px;color:inherit;background:rgba(14,29,47,.72);font-family:Inter,Arial,sans-serif;line-height:1.75}
.orlong-custom-section.width-narrow{max-width:760px}.orlong-custom-section.width-standard{max-width:1040px}.orlong-custom-section.width-wide{max-width:1280px}.orlong-custom-section.width-full{max-width:none;width:100%;border-radius:0}
.orlong-custom-section.theme-default{background:transparent}.orlong-custom-section.theme-panel{background:rgba(14,29,47,.78)}.orlong-custom-section.theme-blue{background:linear-gradient(135deg,#102e4e,#0a1728);border-color:#315b85}.orlong-custom-section.theme-light{background:#edf2f8;color:#17283b;border-color:#cbd7e5}
.orlong-custom-section.align-center{text-align:center}.orlong-custom-section h2{font-family:Cinzel,Georgia,serif;font-size:clamp(20px,3vw,30px);letter-spacing:1px;margin:0 0 16px}.orlong-custom-section h3{font-family:Cinzel,Georgia,serif;font-size:19px;margin:22px 0 9px}.orlong-custom-section p{font-size:14px;line-height:1.9;white-space:pre-wrap}.orlong-builder-callout{padding:18px 20px;border-left:3px solid #5ba7ec;background:rgba(80,145,205,.12);margin:18px 0}.theme-light .orlong-builder-callout{background:#dce8f5}.orlong-builder-image{display:block;max-width:100%;height:auto;margin:18px auto;border-radius:4px}.orlong-builder-caption{font-size:12px;opacity:.75;text-align:center;margin-top:-10px}.orlong-builder-button{display:inline-block;margin:14px 8px 8px 0;padding:12px 20px;background:#2f77b9;color:#fff!important;text-decoration:none!important;border-radius:3px;font-weight:700;font-size:12px;letter-spacing:.8px}.orlong-builder-divider{border:0;border-top:1px solid currentColor;opacity:.2;margin:26px 0}.orlong-custom-section details{padding:14px 0;border-bottom:1px solid rgba(130,160,190,.25)}.orlong-custom-section summary{cursor:pointer;font-weight:700}.orlong-custom-section .orlong-builder-block{margin:12px 0}
.orlong-builder-panel{position:fixed;isolation:isolate;contain:layout style;pointer-events:auto;z-index:2147483646;left:0;top:58px;bottom:0;width:min(390px,calc(100vw - 24px));max-height:none;overflow:auto;padding:22px 20px 36px;background:#101d2d;color:#f4f7fb;border:0;border-right:1px solid #496886;box-shadow:12px 0 36px #0005;font:13px Inter,Arial,sans-serif}.orlong-builder-panel:before{content:"SITE DESIGN STUDIO";display:block;margin:-22px -20px 18px;padding:18px 20px;background:#172b42;border-bottom:1px solid #385674;color:#a9d4ff;font:700 11px Inter,Arial,sans-serif;letter-spacing:2px}.orlong-builder-panel h2{font-size:18px}.orlong-builder-panel .builder-entry{background:#14263a;border-radius:5px}.orlong-builder-panel .builder-row button{border-radius:3px}.orlong-builder-panel .builder-row button:focus-visible,.orlong-builder-panel button:focus-visible{outline:2px solid #8cc8ff;outline-offset:2px}.orlong-builder-panel h2{font:600 17px Cinzel,Georgia,serif;margin:0 0 12px}.orlong-builder-panel p{font-size:11px;line-height:1.6;color:#afc1d4}.orlong-builder-panel button,.orlong-builder-panel select,.orlong-builder-panel input,.orlong-builder-panel textarea{font:12px Inter,Arial,sans-serif}.orlong-builder-panel button{padding:8px 10px;border:1px solid #496886;background:#183553;color:#fff;cursor:pointer}.orlong-builder-panel button.danger{background:#512d36;border-color:#87505b}.orlong-builder-panel .builder-row{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}.orlong-builder-panel .builder-entry{padding:11px;border:1px solid #30465e;margin:8px 0}.orlong-builder-panel .builder-entry strong{display:block;margin-bottom:7px}.orlong-builder-panel label{display:grid;gap:5px;margin:10px 0;color:#c7d8e8;font-size:10px;letter-spacing:.5px}.orlong-builder-panel input,.orlong-builder-panel textarea,.orlong-builder-panel select{width:100%;box-sizing:border-box;padding:9px;background:#101f31;color:#fff;border:1px solid #405a76}.orlong-builder-panel textarea{min-height:90px}.orlong-builder-panel .builder-close{float:right}.orlong-builder-panel .builder-status{color:#a9d4ff;min-height:18px}
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
function placeSection(section,record){
 let anchor=null;try{anchor=document.querySelector(record.anchorSelector||"main")}catch(_){}
 if(!anchor||anchor.closest?.("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]"))anchor=document.querySelector("main")||document.body;
 const placement=record.data?.placement||"after";
 if(placement==="before"&&anchor!==document.body){anchor.parentNode?.insertBefore(section,anchor);return}
 if(placement==="inside"||placement==="end"||anchor===document.body||anchor.tagName?.toLowerCase()==="main"){anchor.append(section);return}
 anchor.insertAdjacentElement("afterend",section);
}
function selectorForPlacement(node){
 if(node===document.body)return "body";
 if(node.id)return "#"+CSS.escape(node.id);
 const parts=[];let current=node;
 while(current&&current!==document.body&&parts.length<5){
  let part=current.tagName.toLowerCase();
  const parent=current.parentElement;
  if(parent){const same=[...parent.children].filter(x=>x.tagName===current.tagName);if(same.length>1)part+=":nth-of-type("+(same.indexOf(current)+1)+")"}
  parts.unshift(part);current=parent;
 }
 return "main > "+parts.join(" > ");
}
function placementOptions(){
 const main=document.querySelector("main")||document.body,options=[{value:"main|end",label:"At the very bottom of this page"}];
 const candidates=[...main.querySelectorAll(":scope > header,:scope > section,:scope > article,:scope > div,:scope > h1,:scope > h2,:scope > h3,:scope > p")].filter(node=>!node.closest("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]")&&!node.hasAttribute("data-orlongSectionId"));
 candidates.forEach((node,index)=>{
  const heading=node.matches("h1,h2,h3")?node:node.querySelector("h1,h2,h3");
  const label=(heading?.textContent||node.getAttribute("aria-label")||node.tagName.toLowerCase()).trim().replace(/\\s+/g," ").slice(0,58);
  const selector=selectorForPlacement(node);
  options.push({value:selector+"|after",label:"After: "+label});
  options.push({value:selector+"|before",label:"Before: "+label});
 });
 options.push({value:"main|inside",label:"At the top of the main page content"});
 return options;
}
async function render(db,path){
 style();const {data,error}=await db.rpc("get_public_orlong_site_sections",{p_page_path:path});
 if(error){console.warn("Orlong page sections:",error.message);return}
 (Array.isArray(data)?data:[]).forEach(record=>placeSection(renderSection(record),record));
}
async function start(db,path,bar){
 const {data,error}=await db.auth.getSession();if(error||!data.session)return;
 const {data:allowed}=await db.rpc("is_reader_moderator");if(allowed!==true)return;
 style();
 const add=$("button","","＋ ADD SECTION"),manage=$("button","","MANAGE SECTIONS"),pagesButton=$("button","","MANAGE PAGES");
 Object.assign(add.style,{padding:"8px 11px",background:"#236caa",color:"#fff",border:"1px solid #6faee4",cursor:"pointer"});
 Object.assign(manage.style,{padding:"8px 11px",background:"#183553",color:"#fff",border:"1px solid #496886",cursor:"pointer"});
 bar.insertBefore(add,bar.querySelector("#orlongEditorExit"));bar.insertBefore(manage,bar.querySelector("#orlongEditorExit"));bar.insertBefore(pagesButton,bar.querySelector("#orlongEditorExit"));
 const panel=$("aside","orlong-builder-panel");panel.id="orlongBuilderPanel";panel.dataset.orlongEditorUi="true";panel.setAttribute("aria-label","Website design editor");panel.hidden=true;document.body.append(panel);
 const status=$("p","builder-status","Your page preview remains visible beside this sidebar. Select a section below or create a new one.");
 const head=$("h2","","PAGE DESIGN & CONTENT");const close=$("button","builder-close","CLOSE");close.type="button";close.addEventListener("click",()=>panel.hidden=true);
 const body=$("div");panel.append(close,head,$("p","","This sidebar controls the page preview behind it. Add sections, organise content, and adjust each section. Changes are saved to Supabase."),$("div","builder-entry","PAGE: "+path),status,body);
 let sections=[];
 const message=t=>status.textContent=t;
 const refreshPreview=()=>{
  document.querySelectorAll("[data-orlongSectionId]").forEach(node=>node.remove());
  [...sections].sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).forEach(record=>placeSection(renderSection(record),record));
 };
 const save=async(section)=>{
  const {data:result,error:saveError}=await db.rpc("save_moderator_orlong_site_section",{p_section_id:section.id||null,p_page_path:path,p_anchor_selector:section.anchorSelector||"main",p_sort_order:section.sortOrder||0,p_section_data:section.data,p_is_published:section.published!==false});
  if(saveError)throw saveError;section.id=result.section_id;
  const existing=sections.findIndex(item=>item.id===section.id);if(existing>=0)sections[existing]=section;else sections.push(section);
  refreshPreview();return section;
 };
 const reload=async()=>{const {data,error:loadError}=await db.rpc("get_moderator_orlong_site_sections",{p_page_path:path});if(loadError)throw loadError;sections=Array.isArray(data)?data:[];refreshPreview();body.replaceChildren();if(!sections.length){body.append($("p","","This page has no custom sections yet. Use the blue ＋ ADD SECTION button in the top toolbar to begin."));return}
 sections.forEach((section,index)=>{
  const entry=$("div","builder-entry"),title=$("strong","",section.data?.title||"Untitled section "+(index+1)),meta=$("p","",(section.data?.blocks||[]).length+" content blocks · "+(section.published?"PUBLISHED":"DRAFT"));
  const actions=$("div","builder-row");
  const edit=$("button","","EDIT SECTION");edit.addEventListener("click",()=>editSection(section));
  const block=$("button","","＋ ADD CONTENT");block.addEventListener("click",()=>addBlock(section));
  const manage=$("button","","EDIT CONTENT");manage.addEventListener("click",()=>manageBlocks(section));
  const visibility=$("button","",section.published===false?"PUBLISH":"HIDE");visibility.addEventListener("click",async()=>{section.published=section.published===false;try{await save(section);await reload();message(section.published?"Section published.":"Section hidden from readers.")}catch(e){message(e.message)}});
  const up=$("button","","↑");up.title="Move section up";up.disabled=index===0;up.addEventListener("click",()=>moveSection(section,-1));
  const down=$("button","","↓");down.title="Move section down";down.disabled=index===sections.length-1;down.addEventListener("click",()=>moveSection(section,1));
  const duplicate=$("button","","DUPLICATE");duplicate.addEventListener("click",async()=>{const copy={pagePath:path,anchorSelector:section.anchorSelector||"main",sortOrder:sections.length?Math.max(...sections.map(item=>item.sortOrder||0))+1:0,published:section.published!==false,data:JSON.parse(JSON.stringify(section.data||{}))};copy.data.title="Copy of "+(copy.data.title||"Untitled section");try{await save(copy);await reload();message("Section duplicated.")}catch(e){message(e.message||"Could not duplicate this section.")}});
  const del=$("button","danger","DELETE");del.addEventListener("click",()=>deleteSection(section));
  const placement=$("p","",placementDescription(section));
  actions.append(edit,block,manage,visibility,up,down,duplicate,del);entry.append(title,meta,placement,actions);body.append(entry);
 });
 };
 const input=(label,value="",multiline=false)=>{const wrap=$("label","",label),field=$(multiline?"textarea":"input");field.value=value;wrap.append(field);return {wrap,field}};
 const choose=(label,values,value)=>{const wrap=$("label","",label),field=$("select");values.forEach(v=>{const o=$("option","",v[1]);o.value=v[0];field.append(o)});field.value=value;wrap.append(field);return {wrap,field}};
 const dialog=(title,fields,onSave)=>{
  body.replaceChildren();const h=$("h2","",title),fieldHost=$("div","builder-dialog-fields");body.append(h,fieldHost);
  const renderFields=()=>{const list=typeof fields==="function"?fields():fields;fieldHost.replaceChildren();list.forEach(f=>fieldHost.append(f?.wrap||f));};
  renderFields();
  const actions=$("div","builder-row"),saveBtn=$("button","","SAVE"),cancel=$("button","","CANCEL");saveBtn.type=cancel.type="button";cancel.addEventListener("click",reload);
  saveBtn.addEventListener("click",async()=>{saveBtn.disabled=true;try{await onSave();message("Saved successfully.");await reload();}catch(e){message(e.message||"Could not save this change.");}finally{saveBtn.disabled=false}});
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
  });
  type.field.addEventListener("change",()=>{dynamic();refreshFields()});dynamic();refreshFields();
 };
 const manageBlocks=section=>{
  body.replaceChildren($("h2","","MANAGE SECTION CONTENT"));
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
  const back=$("button","","BACK TO SECTIONS");back.addEventListener("click",reload);body.append(back);
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
  });
 };
 const moveSection=async(section,delta)=>{const i=sections.findIndex(s=>s.id===section.id),j=i+delta;if(j<0||j>=sections.length)return;const a=sections[i],b=sections[j],n=a.sortOrder;a.sortOrder=b.sortOrder;b.sortOrder=n;try{await save(a);await save(b);await reload()}catch(e){message(e.message)}};
 const deleteSection=async section=>{if(!confirm("Delete this custom section and all its content?"))return;const {error:delError}=await db.rpc("delete_moderator_orlong_site_section",{p_section_id:section.id});if(delError){message(delError.message);return}await reload();message("Section deleted.")};
 add.addEventListener("click",()=>{panel.hidden=false;addSection()});
 manage.addEventListener("click",()=>{panel.hidden=false;reload().catch(e=>message("Could not open section manager: "+e.message))});
 pagesButton.addEventListener("click",()=>{panel.hidden=false;openPages().catch(e=>message("Could not load page manager: "+e.message))});
 try{await reload()}catch(e){message(e.message||"Could not load page sections. Run the Visual Page Builder migration first.");}
}
window.OrlongSiteBuilder={render,start};
})();