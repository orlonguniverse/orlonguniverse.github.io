(()=>{"use strict";
const $=id=>document.getElementById(id);
let db,config={pages:[],links:[]},managedPages=[],dirty=false,dragged=null,savedConfig=null;
const defaults=[
{id:"home",label:"Homepage",path:"/",kind:"main"},{id:"reading",label:"Reading Room",path:"/books/trials-of-eden/",kind:"book"},{id:"contents",label:"Chapter Contents",path:"/books/trials-of-eden/contents.html",kind:"book"},{id:"account",label:"Reader Account",path:"/books/trials-of-eden/account.html",kind:"account"},{id:"explore",label:"Explore Eden",path:"/explore-eden/",kind:"discover"},{id:"events",label:"Events",path:"/events.html",kind:"discover"},{id:"archive",label:"Eden Archive",path:"/eden-archive/",kind:"discover"},{id:"early",label:"Early Access",path:"/early-access/",kind:"discover"},{id:"founding",label:"Founding Readers",path:"/founding-readers/",kind:"discover"},{id:"guide",label:"Reader Guide",path:"/getting-started.html",kind:"guide"},{id:"moderator",label:"Moderator HQ",path:"/moderator/",kind:"admin"}
];
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function status(t){$("siteMapStatus").textContent=t}
function mark(){dirty=true;$("siteMapSave").disabled=false;status("You have unsaved changes. Select SAVE CHANGES when you are ready to update the live website menu.")}
function field(label,value,placeholder){const wrap=node("label","site-map-field",label),el=node("input");el.value=value||"";el.placeholder=placeholder||"";wrap.append(el);return {wrap,el}}
function action(label,cls,fn){const b=node("button",cls||"secondary",label);b.type="button";b.addEventListener("click",fn);return b}
function renderFlow(){
 const host=$("siteMapFlow");if(!host)return;host.replaceChildren();
 const normalise=value=>{let p=String(value||"").split("?")[0].split("#")[0];if(p.length>1&&p.endsWith("/"))p=p.slice(0,-1);return p||"/"};
 const pages=config.pages||[];
 [["primary","TOP-LEVEL LINKS"],["discover",(config.menus||[]).find(x=>x.id==="discover")?.label||"DISCOVER"]].forEach(([group,label])=>{
  const menuSetting=(config.menus||[]).find(x=>x.id===group);if(group!=="primary"&&menuSetting?.enabled===false)return;
  const links=(config.links||[]).filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));if(!links.length)return;
  const section=node("div","site-map-flow-group");section.append(node("h4","",label));let subsection="";
  links.forEach(link=>{
   if(group==="discover"&&link.section&&link.section!==subsection){subsection=link.section;section.append(node("h5","site-map-flow-subsection",subsection.toUpperCase()))}
   const match=pages.find(p=>normalise(p.path)===normalise(link.href));
   const row=node("div","site-map-flow-row"),source=node("span","site-map-flow-node site-map-flow-source",group==="discover"?(link.section||"DISCOVER"):label),arrow1=node("span","site-map-flow-arrow","→"),middle=node("span","site-map-flow-node",link.label||"Untitled link"),arrow2=node("span","site-map-flow-arrow","→"),target=node("span","site-map-flow-node site-map-flow-target",match?match.label:"Page not listed");
   row.append(source,arrow1,middle,arrow2,target);if(link.enabled===false){row.classList.add("is-hidden");middle.append(node("small","site-map-flow-hidden","HIDDEN"))}
   if(!match)target.title="No page with this address is listed in the directory.";section.append(row);
  });host.append(section);
 });
}
function move(arr,id,delta){const i=arr.findIndex(x=>x.id===id),j=i+delta;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];arr.forEach((x,n)=>x.order=n);mark();render()}
function movePage(id,delta){const pages=[...config.pages].sort((a,b)=>(a.order??0)-(b.order??0));const i=pages.findIndex(x=>x.id===id),j=i+delta;if(j<0||j>=pages.length)return;[pages[i],pages[j]]=[pages[j],pages[i]];pages.forEach((x,n)=>x.order=n);config.pages=pages;mark();render();}
function pageForm(page){
 const form=node("div","site-map-inline-form"),name=field("PAGE NAME",page?.label||"","e.g. About the Author"),path=field("PAGE ADDRESS",page?.path||"","e.g. /about/");
 form.append(name.wrap,path.wrap,node("p","site-map-help","Use the address of a page that already exists. This tool does not create the page itself."));
 form.append(action("SAVE PAGE","primary",()=>{const label=name.el.value.trim(),href=path.el.value.trim();if(!label||!href.startsWith("/")){status("Please enter a page name and an address beginning with /.");return}if(page){page.label=label;page.path=href}else config.pages.push({id:"page-"+Date.now(),label,path:href,kind:"custom",order:config.pages.length});mark();render()}),action("CANCEL","secondary",render));
 return form
}
function moveMenu(id,delta){const menus=[...config.menus].sort((a,b)=>(a.order??0)-(b.order??0));const i=menus.findIndex(x=>x.id===id),j=i+delta;if(j<0||j>=menus.length)return;[menus[i],menus[j]]=[menus[j],menus[i]];menus.forEach((x,n)=>x.order=n);config.menus=menus;mark();render()}
function topLevelItems(){
 const main=config.mainMenu||{};
 return [
  {id:"main-menu",label:main.label||"MAIN MENU",kind:"Main Menu"},
  {id:"book-collection",label:"BOOK COLLECTION",kind:"Featured link"},
  ...config.links.filter(x=>x.group==="primary").map(x=>({id:"link:"+x.id,label:x.label||"Untitled link",kind:"Top-level link"})),
  ...config.menus.map(x=>({id:"menu:"+x.id,label:x.label||x.id,kind:"Dropdown menu"}))
 ];
}
function normaliseTopLevelOrder(){
 const valid=topLevelItems().map(x=>x.id),saved=Array.isArray(config.navigationOrder)?config.navigationOrder:[];
 config.navigationOrder=[...saved.filter((id,i)=>valid.includes(id)&&saved.indexOf(id)===i),...valid.filter(id=>!saved.includes(id))];
}
function renderTopLevelOrder(host){
 normaliseTopLevelOrder();
 const section=node("section","site-map-route-group site-map-top-order");
 section.append(node("h3","","TOP-LEVEL NAVIGATION ORDER"),node("p","site-map-hint","Drag MAIN MENU, BOOK COLLECTION, your top-level links and dropdown menus into the order you want them to appear. The first item sits closest to the Orlong logo. Account, the moderator shortcut and Instagram stay at the right-hand end."));
 const list=node("div","site-map-top-order-list");
 const items=topLevelItems(),byId=new Map(items.map(x=>[x.id,x]));
 const moveTop=(sourceId,targetId)=>{
  if(sourceId===targetId)return;
  const order=[...config.navigationOrder],from=order.indexOf(sourceId),to=order.indexOf(targetId);
  if(from<0||to<0)return;
  order.splice(from,1);order.splice(to,0,sourceId);config.navigationOrder=order;mark();render();
 };
 config.navigationOrder.forEach((id,index)=>{
  const item=byId.get(id);if(!item)return;
  const row=node("article","site-map-menu-setting site-map-top-order-item"),grip=node("span","site-map-drag-handle","⠿"),label=node("div","site-map-top-order-label");
  label.append(node("strong","",item.label),node("small","",item.kind));
  row.draggable=true;row.setAttribute("aria-label","Drag "+item.label+" to change its position in the top navigation");
  row.addEventListener("dragstart",event=>{dragged={topId:id};row.classList.add("dragging");event.dataTransfer?.setData("text/plain","top:"+id);if(event.dataTransfer)event.dataTransfer.effectAllowed="move"});
  row.addEventListener("dragend",()=>{dragged=null;row.classList.remove("dragging");document.querySelectorAll(".drag-over").forEach(x=>x.classList.remove("drag-over"))});
  row.addEventListener("dragover",event=>{if(dragged?.topId){event.preventDefault();row.classList.add("drag-over");if(event.dataTransfer)event.dataTransfer.dropEffect="move"}});
  row.addEventListener("dragleave",()=>row.classList.remove("drag-over"));
  row.addEventListener("drop",event=>{if(!dragged?.topId)return;event.preventDefault();event.stopPropagation();row.classList.remove("drag-over");moveTop(dragged.topId,id)});
  const controls=node("div","site-map-actions");
  controls.append(action("MOVE UP","secondary",()=>{if(index>0)moveTop(id,config.navigationOrder[index-1])}),action("MOVE DOWN","secondary",()=>{if(index<config.navigationOrder.length-1)moveTop(id,config.navigationOrder[index+1])}));
  controls.children[0].disabled=index===0;controls.children[1].disabled=index===config.navigationOrder.length-1;
  row.append(grip,label,controls);list.append(row);
 });
 section.append(list);host.append(section);
}
function renderMenuControls(host){
 const menus=config.menus||[],mainMenu=config.mainMenu||(config.mainMenu={label:"MAIN MENU",enabled:true,showGuide:true,showTheme:true,showBookOnly:true,showStatistics:true,showSoundtrack:true});
 const section=node("section","site-map-route-group site-map-config-group");
 section.append(node("h3","","DROPDOWN MENU SETTINGS"),node("p","site-map-hint","Rename or hide a dropdown. Hiding it removes the dropdown from the website menu without deleting its links."));
 menus.forEach(menu=>{
  const row=node("div","site-map-menu-setting"),grip=node("span","site-map-drag-handle","⠿"),name=field("DISCOVER DROPDOWN NAME",menu.label);
  row.draggable=true;row.addEventListener("dragstart",event=>{dragged={menuId:menu.id};event.dataTransfer?.setData("text/plain","menu:"+menu.id);if(event.dataTransfer)event.dataTransfer.effectAllowed="move"});row.addEventListener("dragend",()=>{dragged=null;row.classList.remove("dragging")});
  row.addEventListener("dragover",event=>{if(dragged?.menuId){event.preventDefault();row.classList.add("drag-over")}});row.addEventListener("dragleave",()=>row.classList.remove("drag-over"));row.addEventListener("drop",event=>{if(!dragged?.menuId)return;event.preventDefault();event.stopPropagation();const from=config.menus.findIndex(x=>x.id===dragged.menuId),to=config.menus.findIndex(x=>x.id===menu.id);if(from>=0&&to>=0&&from!==to){const [picked]=config.menus.splice(from,1);config.menus.splice(to,0,picked);config.menus.forEach((x,n)=>x.order=n);mark();render()}});
  const visible=node("label","site-map-enabled"),check=node("input");check.type="checkbox";check.checked=menu.enabled!==false;visible.append(check,node("span","","Show this dropdown on the website"));
  name.el.addEventListener("change",()=>{menu.label=name.el.value.trim();mark();renderFlow()});
  check.addEventListener("change",()=>{menu.enabled=check.checked;mark();renderFlow()});
  const actions=node("div","site-map-actions");actions.append(action("MOVE LEFT","secondary",()=>moveMenu(menu.id,-1)),action("MOVE RIGHT","secondary",()=>moveMenu(menu.id,1)));
  row.append(grip,name.wrap,visible,actions);section.append(row);
 });
 const mainSection=node("section","site-map-route-group site-map-main-settings");
 mainSection.append(node("h3","","MAIN MENU SETTINGS"),node("p","site-map-hint","Change the Main Menu button and choose which tools appear inside it."));
 const mainName=field("MAIN MENU BUTTON NAME",mainMenu.label||"MAIN MENU","e.g. SETTINGS");
 mainName.el.addEventListener("change",()=>{mainMenu.label=mainName.el.value.trim();mark()});
 const mainVisible=node("label","site-map-enabled"),mainCheck=node("input");mainCheck.type="checkbox";mainCheck.checked=mainMenu.enabled!==false;mainVisible.append(mainCheck,node("span","","Show the Main Menu button"));
 mainCheck.addEventListener("change",()=>{mainMenu.enabled=mainCheck.checked;mark()});
 mainSection.append(mainName.wrap,mainVisible);
 const options=node("div","site-map-main-options");
 [["showGuide","Reader Guide"],["showTheme","Light / Dark Theme"],["showBookOnly","Book-Only Mode"],["showStatistics","My Statistics"],["showSoundtrack","Website Soundtrack"]].forEach(([key,label])=>{
  const wrap=node("label","site-map-enabled"),box=node("input");box.type="checkbox";box.checked=mainMenu[key]!==false;wrap.append(box,node("span","",label));box.addEventListener("change",()=>{mainMenu[key]=box.checked;mark()});options.append(wrap);
 });
 mainSection.append(node("p","site-map-hint","Choose which built-in features readers can access from the Main Menu."),options);
 const customHeading=node("h4","","YOUR OWN MAIN MENU LINKS");
 mainSection.append(customHeading,node("p","site-map-hint","Add extra shortcuts to any existing page or external website. These appear alongside the built-in Main Menu tools."));
 mainMenu.links=Array.isArray(mainMenu.links)?mainMenu.links:[];
 const customList=node("div","site-map-custom-links");
 mainMenu.links.forEach((link,index)=>{
  const row=node("div","site-map-custom-link"),name=field("LINK NAME",link.label),href=field("DESTINATION",link.href);
  name.el.addEventListener("change",()=>{link.label=name.el.value.trim();mark()});
  href.el.addEventListener("change",()=>{link.href=href.el.value.trim();mark()});
  row.append(name.wrap,href.wrap,action("REMOVE","danger",()=>{mainMenu.links.splice(index,1);mark();render()}));
  customList.append(row);
 });
 mainSection.append(customList,action("＋ ADD A MAIN MENU LINK","secondary",()=>{mainMenu.links.push({label:"New link",href:"/"});mark();render()}));
 host.append(section,mainSection);
}
function render(){
 const directory=$("siteMapDirectory"),routes=$("siteMapRoutes");directory.replaceChildren();routes.replaceChildren();renderMenuControls(routes);renderTopLevelOrder(routes);
 const pages=[...config.pages].sort((a,b)=>(a.order??0)-(b.order??0));
 pages.forEach((p,i)=>{
  const card=node("article","site-map-page"),top=node("div","site-map-page-main"),details=node("div","site-map-page-details");
  top.append(node("strong","",p.label||"Unnamed page"),node("code","",p.path||"/"));
  details.append(node("span","site-map-page-kind",String(p.kind||"page").toUpperCase()));
  const actions=node("div","site-map-actions");
  actions.append(action("MOVE UP","secondary",()=>movePage(p.id,-1)),action("MOVE DOWN","secondary",()=>movePage(p.id,1)),action("EDIT","secondary",()=>{card.querySelectorAll(".site-map-inline-form").forEach(x=>x.remove());card.append(pageForm(p));}));
  actions.children[0].disabled=i===0;actions.children[1].disabled=i===pages.length-1;
  actions.append(action("EDIT PAGE CONTENT ↗","primary",()=>{const href=(p.path||"/")+(String(p.path||"/").includes("?")?"&":"?")+"orlong-edit=1";window.open(href,"_blank","noopener")}));
  actions.append(action("MANAGE ALL SECTIONS ↗","secondary",()=>{const base=p.path||"/",sep=base.includes("?")?"&":"?";window.open(base+sep+"orlong-edit=1&orlong-sections=1","_blank","noopener")}));
  actions.append(action("REMOVE","danger",()=>{if(!confirm("Remove this page from the directory? This will not delete the actual website page or its menu links."))return;config.pages=config.pages.filter(x=>x.id!==p.id);mark();render()}));
  card.append(top,details,actions);directory.append(card)
 });
 if(managedPages.length){
  const heading=node("h3","site-map-managed-heading","CUSTOM PAGES CREATED IN WEBSITE CONTENT");
  directory.append(heading);
  managedPages.forEach(page=>{
   const card=node("article","site-map-page"),top=node("div","site-map-page-main"),details=node("div","site-map-page-details"),actions=node("div","site-map-actions");
   top.append(node("strong","",page.title||page.slug),node("code","","/managed-page.html?slug="+page.slug));
   details.append(node("span","site-map-page-kind",page.published?"PUBLISHED CUSTOM PAGE":"DRAFT CUSTOM PAGE"));
   const href="/managed-page.html?slug="+encodeURIComponent(page.slug);
   actions.append(action("OPEN PAGE ↗","secondary",()=>window.open(href+(page.published?"":"&preview=1"),"_blank","noopener")));
   actions.append(action("EDIT PAGE & SECTIONS ↗","primary",()=>window.open(href+"&preview=1&orlong-edit=1&orlong-sections=1","_blank","noopener")));
   card.append(top,details,actions);directory.append(card);
  });
 }
 const addPage=action("＋ ADD A PAGE","primary",()=>{const form=pageForm(null);directory.prepend(form);form.querySelector("input").focus()});directory.append(addPage);
 const groups=[["primary","TOP-LEVEL LINKS","These links appear directly along the top of the website."],["discover","DISCOVER MENU LINKS","These links appear inside Discover. Add an optional subsection name to group related links under a small heading. Reuse a subsection name to add another link to that group; clear it from every link to remove the subsection."]];
 groups.forEach(([group,title,description])=>{
  const items=config.links.filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));
  const section=node("section","site-map-route-group"),heading=node("div","site-map-route-heading");
  heading.append(node("h3","",title),node("p","site-map-hint",description));section.append(heading);
  const list=node("div","site-map-route-list");
  items.forEach((item,i)=>{
   const row=node("article","site-map-route"),grip=node("span","site-map-drag-handle","⠿"),fields=node("div","site-map-route-fields"),label=field("WHAT READERS SEE",item.label),href=field("WHERE IT TAKES THEM",item.href),sectionField=group==="discover"?field("SUBSECTION (OPTIONAL)",item.section||"","e.g. EXPLORE, COMMUNITY"):null;
   if(sectionField)sectionField.el.addEventListener("change",()=>{item.section=sectionField.el.value.trim();mark();renderFlow()});
   row.draggable=true;row.dataset.navigationId=item.id;row.setAttribute("aria-label","Drag "+(item.label||"menu link")+" to rearrange it or move it to another menu area");
   row.addEventListener("dragstart",event=>{dragged={id:item.id,fromGroup:group};row.classList.add("dragging");event.dataTransfer?.setData("text/plain",item.id);if(event.dataTransfer)event.dataTransfer.effectAllowed="move"});
   row.addEventListener("dragend",()=>{dragged=null;row.classList.remove("dragging");document.querySelectorAll(".drag-over").forEach(x=>x.classList.remove("drag-over"))});
   wireDropTarget(row,group,item.id);
   const enabled=node("label","site-map-enabled"),check=node("input");check.type="checkbox";check.checked=item.enabled!==false;enabled.append(check,node("span","","Show this link in the menu"));
   label.el.addEventListener("change",()=>{item.label=label.el.value.trim();mark();renderFlow()});href.el.addEventListener("change",()=>{item.href=href.el.value.trim();mark();renderFlow()});check.addEventListener("change",()=>{item.enabled=check.checked;mark()});
   fields.append(label.wrap,href.wrap,...(sectionField?[sectionField.wrap]:[]),enabled);
   const actions=node("div","site-map-actions");actions.append(action("MOVE UP","secondary",()=>moveLink(item.id,-1,group)),action("MOVE DOWN","secondary",()=>moveLink(item.id,1,group)),action("REMOVE","danger",()=>{if(!confirm("Remove this link from the website menu?"))return;config.links=config.links.filter(x=>x.id!==item.id);mark();render()}));
   actions.children[0].disabled=i===0;actions.children[1].disabled=i===items.length-1;
   row.append(grip,fields,actions);list.append(row)
  });
  wireDropTarget(list,group);
  section.append(list,action("＋ ADD A MENU LINK","secondary",()=>{const id="nav-"+Math.random().toString(36).slice(2,9);config.links.push({id,label:"New link",href:"/",group,order:items.length,enabled:true,...(group==="discover"?{section:"OTHER"}:{})});mark();render()}));routes.append(section)
 });
 renderFlow();
 $("siteMapSave").disabled=!dirty;
}
function normaliseGroup(group){const arr=config.links.filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));arr.forEach((x,n)=>x.order=n)}
function moveLink(id,delta,group){const arr=config.links.filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));move(arr,id,delta);arr.forEach((x,n)=>x.order=n);render()}
function moveLinkByDrop(sourceId,targetId,targetGroup,append=false){
 const source=config.links.find(x=>x.id===sourceId);if(!source)return;
 const target=targetId?config.links.find(x=>x.id===targetId):null;
 if(target&&target.id===sourceId)return;
 config.links=config.links.filter(x=>x.id!==sourceId);
 source.group=targetGroup;
 const destination=config.links.filter(x=>x.group===targetGroup).sort((a,b)=>(a.order??0)-(b.order??0));
 const at=target?destination.findIndex(x=>x.id===target.id):destination.length;
 destination.splice(at<0?destination.length:at,0,source);
 destination.forEach((x,n)=>x.order=n);
 ["primary","book","discover"].forEach(normaliseGroup);
 mark();render();
}
function wireDropTarget(element,group,targetId=null){
 element.addEventListener("dragover",event=>{event.preventDefault();element.classList.add("drag-over");if(event.dataTransfer)event.dataTransfer.dropEffect="move"});
 element.addEventListener("dragleave",()=>element.classList.remove("drag-over"));
 element.addEventListener("drop",event=>{event.preventDefault();event.stopPropagation();element.classList.remove("drag-over");const id=event.dataTransfer?.getData("text/plain")||dragged?.id;if(id)moveLinkByDrop(id,targetId,group,!targetId)});
}
async function load(){status("Loading your website pages and menu…");const {data,error}=await db.rpc("get_moderator_orlong_site_map");if(error)throw error;config=data||{pages:defaults,links:[]};config.pages=(config.pages||defaults).map((x,i)=>({...x,order:x.order??i}));config.links=(config.links||[]).map((x,i)=>({...x,order:x.order??i}));config.menus=Array.isArray(config.menus)?config.menus:[{id:"discover",label:"DISCOVER",enabled:true,order:0}];config.mainMenu=config.mainMenu||{label:"MAIN MENU",enabled:true,showGuide:true,showTheme:true,showBookOnly:true,showStatistics:true,showSoundtrack:true,links:[]};normaliseTopLevelOrder();const managed=await db.rpc("get_moderator_orlong_managed_pages");managedPages=!managed.error&&Array.isArray(managed.data)?managed.data:[];dirty=false;savedConfig=JSON.parse(JSON.stringify(config));render();status("Your website map is ready. All standard pages and custom pages are listed below.");}
async function save(){const btn=$("siteMapSave");btn.disabled=true;status("Saving your changes…");try{const payload={pages:config.pages.map((x,i)=>({...x,order:i})),links:config.links.map(x=>({...x})),menus:config.menus.map((x,i)=>({...x,order:i})),mainMenu:{...config.mainMenu},navigationOrder:[...config.navigationOrder]};const {error}=await db.rpc("save_moderator_orlong_site_map",{p_config:payload});if(error)throw error;config=payload;dirty=false;savedConfig=JSON.parse(JSON.stringify(config));render();status("All saved! Your website's shared navigation will now use these menu links.");}catch(e){status(e.message||"Could not save. Please try again.");btn.disabled=false}}
async function init(){if(!$("siteMapDirectory"))return;db=window.supabase.createClient("https://kqfwtzrfqsfampqfzoal.supabase.co","sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes");const {data}=await db.auth.getSession();if(!data.session)return;const {data:ok}=await db.rpc("is_reader_moderator");if(ok!==true)return;$("siteMapSave").addEventListener("click",save);$("siteMapRefresh").addEventListener("click",()=>{if(dirty&&!confirm("Discard unsaved changes and reload?"))return;load().catch(e=>status(e.message))});window.addEventListener("beforeunload",event=>{if(dirty){event.preventDefault();event.returnValue=""}});await load()}
document.addEventListener("DOMContentLoaded",()=>init().catch(e=>status(e.message||"Website map could not load.")));
})();