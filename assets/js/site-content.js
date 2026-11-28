(()=>{"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co",KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const allowed=new Set(["text","href","src","alt","title","placeholder","value","hidden","aria-label"]);
const client=()=>window.supabase?.createClient?window.supabase.createClient(URL_BASE,KEY):null;
const pagePath=()=>location.pathname==="/managed-page.html"&&new URLSearchParams(location.search).get("slug")?"/managed-pages/"+new URLSearchParams(location.search).get("slug"):location.pathname.replace(/\\/g,"/")||"/";
async function loadBuilder(){if(window.OrlongSiteBuilder)return;await new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="/assets/js/site-builder.js?v=stage-8d14";script.onload=resolve;script.onerror=()=>reject(new Error("The visual page builder could not load."));document.body.append(script)})}
function apply(records){records.forEach(r=>{if(!allowed.has(r.property))return;let nodes=[];try{nodes=[...document.querySelectorAll(r.selector)]}catch(_){return}nodes.forEach(node=>{if(r.property==="text")node.textContent=r.value;else if(r.property==="value")node.value=r.value;else if(r.property==="hidden")node.hidden=r.value==="true";else if(r.property==="href"||r.property==="src"){if(r.value==="")node.removeAttribute(r.property);else node.setAttribute(r.property,r.value)}else node.setAttribute(r.property,r.value)})})}
function selectorFor(node){if(!node||node.closest("#orlongVisualEditor,#orlongBuilderPanel,[data-orlong-editor-ui]"))return null;if(node.id)return "#"+CSS.escape(node.id);const parts=[];let current=node;while(current&&current!==document.body&&parts.length<6){let part=current.tagName.toLowerCase();if(current.classList.length)part+="."+[...current.classList].slice(0,2).map(CSS.escape).join(".");const parent=current.parentElement;if(parent){const same=[...parent.children].filter(x=>x.tagName===current.tagName);if(same.length>1)part+=":nth-of-type("+(same.indexOf(current)+1)+")"}parts.unshift(part);current=parent}return "body > "+parts.join(" > ")}
async function visualEditor(db){
 const {data,error}=await db.auth.getSession();if(error||!data.session)return;
 const {data:ok}=await db.rpc("is_reader_moderator");if(ok!==true)return;
 const bar=document.createElement("div");bar.id="orlongVisualEditor";bar.dataset.orlongEditorUi="true";bar.setAttribute("aria-label","Orlong visual editor toolbar");
 const brand=document.createElement("strong");brand.textContent="ORLONG VISUAL EDITOR";
 const hint=document.createElement("span");hint.textContent="Select any text, heading, image or link on the page to edit it.";
 const exit=document.createElement("button");exit.type="button";exit.id="orlongEditorExit";exit.textContent="EXIT EDITOR";
 bar.append(brand,hint,exit);
 Object.assign(bar.style,{position:"fixed",isolation:"isolate",contain:"layout style",pointerEvents:"auto",zIndex:"2147483647",top:"0",left:"0",right:"0",padding:"12px 16px",background:"#10243b",color:"#fff",display:"flex",gap:"14px",alignItems:"center",font:"12px Arial",boxShadow:"0 3px 16px #0008"});
 Object.assign(exit.style,{marginLeft:"auto",padding:"8px 12px",cursor:"pointer"});
 document.body.append(bar);document.body.style.paddingTop="58px";
 const inspector=document.createElement("aside");inspector.id="orlongElementInspector";inspector.dataset.orlongEditorUi="true";
 Object.assign(inspector.style,{position:"fixed",zIndex:"2147483645",top:"58px",right:"0",bottom:"0",width:"min(360px,calc(100vw - 24px))",overflow:"auto",padding:"22px",background:"#101d2d",color:"#f4f7fb",borderLeft:"1px solid #496886",boxShadow:"-12px 0 36px #0005",font:"13px Inter,Arial,sans-serif",display:"none"});
 const style=document.createElement("style");style.textContent="#orlongElementInspector h2{font:600 17px Cinzel,Georgia,serif;margin:0 0 12px}#orlongElementInspector p{font-size:11px;color:#afc1d4;line-height:1.6}#orlongElementInspector label{display:grid;gap:6px;margin:14px 0;color:#c7d8e8;font-size:10px;letter-spacing:.5px}#orlongElementInspector input,#orlongElementInspector textarea,#orlongElementInspector select{width:100%;box-sizing:border-box;padding:10px;background:#101f31;color:#fff;border:1px solid #405a76;font:12px Inter,Arial,sans-serif}#orlongElementInspector textarea{min-height:150px}#orlongElementInspector button{padding:9px 12px;background:#183553;color:#fff;border:1px solid #496886;cursor:pointer;margin:4px 5px 4px 0}#orlongElementInspector .inspector-status{color:#a9d4ff;min-height:18px}";document.head.append(style);
 const heading=document.createElement("h2");heading.textContent="EDIT PAGE ELEMENT";
 const explanation=document.createElement("p");explanation.textContent="Choose what to change for the selected item. Your changes are saved to the website and reused when readers visit.";
 const selected=document.createElement("p");selected.textContent="Nothing selected yet.";
 const propertyLabel=document.createElement("label");propertyLabel.textContent="WHAT WOULD YOU LIKE TO EDIT?";
 const property=document.createElement("select");
 const propertyLabels={text:"Text / wording",href:"Link destination",src:"Image address",alt:"Image description (alt text)",title:"Tooltip / title",placeholder:"Placeholder text",value:"Input value",hidden:"Show or hide this item", "aria-label":"Accessibility label"};
 [...allowed].forEach(key=>{const option=document.createElement("option");option.value=key;option.textContent=propertyLabels[key]||key;property.append(option)});
 propertyLabel.append(property);
 const valueLabel=document.createElement("label");valueLabel.textContent="CONTENT";
 const value=document.createElement("textarea");valueLabel.append(value);
 const status=document.createElement("p");status.className="inspector-status";status.setAttribute("role","status");
 const actions=document.createElement("div"),save=document.createElement("button"),cancel=document.createElement("button");save.type=cancel.type="button";save.textContent="SAVE CHANGES";cancel.textContent="CLOSE";
 actions.append(save,cancel);inspector.append(heading,explanation,selected,propertyLabel,valueLabel,actions,status);document.body.append(inspector);
 let chosen=null,chosenSelector=null;
 const currentValue=(node,key)=>key==="text"?node.textContent:key==="hidden"?(node.hidden?"true":"false"):node.getAttribute(key)||"";
 const setValue=(node,key,next)=>{if(key==="text")node.textContent=next;else if(key==="value")node.value=next;else if(key==="hidden")node.hidden=next==="true";else if(next==="")node.removeAttribute(key);else node.setAttribute(key,next)};
 const updateField=()=>{if(!chosen)return;value.value=currentValue(chosen,property.value);valueLabel.firstChild.textContent=propertyLabels[property.value]||"CONTENT";valueLabel.firstChild.textContent=(propertyLabels[property.value]||"CONTENT").toUpperCase()};
 const openInspector=(node,selector)=>{
  chosen=node;chosenSelector=selector;inspector.style.display="block";
  selected.textContent="Selected: "+node.tagName.toLowerCase()+(node.id?" #"+node.id:"")+(node.classList.length?" · "+[...node.classList].slice(0,2).join(" / "):"");
  property.value=node.tagName==="A"?"href":node.tagName==="IMG"?"src":"text";
  updateField();status.textContent="";node.style.outline="2px solid #7fc0ff";
 };
 const outline=e=>{if(!(e.target instanceof Element)||e.target.closest("#orlongVisualEditor,#orlongBuilderPanel,#orlongElementInspector,[data-orlong-editor-ui]"))return;e.target.dataset.orlongOldOutline=e.target.style.outline;e.target.style.outline="2px solid #42a5ff"};
 const unoutline=e=>{if(!(e.target instanceof Element)||e.target.closest("#orlongVisualEditor,#orlongBuilderPanel,#orlongElementInspector,[data-orlong-editor-ui]"))return;if(e.target!==chosen)e.target.style.outline=e.target.dataset.orlongOldOutline||""};
 const clickHandler=e=>{
  if(!(e.target instanceof Element)||e.target.closest("#orlongVisualEditor,#orlongBuilderPanel,#orlongElementInspector,[data-orlong-editor-ui]"))return;
  const node=e.target.closest("a,img,video,audio,button,h1,h2,h3,h4,h5,h6,p,span,small,strong,em,b,i,li,label,summary,blockquote,figcaption,input,textarea,select");
  if(!node)return;
  const selector=selectorFor(node);if(!selector)return;
  e.preventDefault();e.stopPropagation();openInspector(node,selector);
 };
 property.addEventListener("change",updateField);
 save.addEventListener("click",async()=>{
  if(!chosen||!chosenSelector)return;
  const key=property.value,next=value.value;
  if((key==="href"||key==="src")&&next&&!/^(https?:\/\/|\/|#)/i.test(next)){status.textContent="Use a web address beginning with http:// or https://, or a site path beginning with /.";return}
  save.disabled=true;status.textContent="Saving…";
  try{
   const {error}=await db.rpc("save_moderator_orlong_site_content",{p_page_path:pagePath(),p_selector:chosenSelector,p_property:key,p_content_value:next,p_is_published:true});
   if(error)throw error;setValue(chosen,key,next);status.textContent="Saved. This change is now stored in the website.";
  }catch(err){status.textContent=err.message||"Could not save this change."}finally{save.disabled=false}
 });
 cancel.addEventListener("click",()=>{inspector.style.display="none";if(chosen)chosen.style.outline=chosen.dataset.orlongOldOutline||"";chosen=null;chosenSelector=null});
 document.addEventListener("pointerover",outline,true);document.addEventListener("pointerout",unoutline,true);document.addEventListener("click",clickHandler,true);
 exit.addEventListener("click",()=>{
  document.removeEventListener("pointerover",outline,true);document.removeEventListener("pointerout",unoutline,true);document.removeEventListener("click",clickHandler,true);
  inspector.remove();style.remove();bar.remove();document.body.style.paddingTop="";
  document.querySelectorAll("[data-orlongOldOutline]").forEach(node=>node.style.outline=node.dataset.orlongOldOutline||"");
  location.href=location.pathname+location.search.replace(/([?&])orlong-edit=1(&|$)/,"$1").replace(/[?&]$/,"")+location.hash;
 });
}
async function init(){const db=client();if(!db)return;try{const {data,error}=await db.rpc("get_public_orlong_site_content",{p_page_path:pagePath()});if(!error&&Array.isArray(data))apply(data);await loadBuilder();if(window.OrlongSiteBuilder)await window.OrlongSiteBuilder.render(db,pagePath());if(new URLSearchParams(location.search).get("orlong-edit")==="1"){await visualEditor(db);if(window.OrlongSiteBuilder)await window.OrlongSiteBuilder.start(db,pagePath(),document.getElementById("orlongVisualEditor"))}}catch(err){console.warn("Orlong content manager:",err)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();