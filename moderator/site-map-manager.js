(()=>{"use strict";
const $=id=>document.getElementById(id);
let db,config={pages:[],links:[]},dirty=false,dragged=null;
const defaults=[
{id:"home",label:"Homepage",path:"/",kind:"main"},{id:"reading",label:"Reading Room",path:"/books/trials-of-eden/",kind:"book"},{id:"contents",label:"Chapter Contents",path:"/books/trials-of-eden/contents.html",kind:"book"},{id:"account",label:"Reader Account",path:"/books/trials-of-eden/account.html",kind:"account"},{id:"explore",label:"Explore Eden",path:"/explore-eden/",kind:"discover"},{id:"events",label:"Events",path:"/events.html",kind:"discover"},{id:"archive",label:"Eden Archive",path:"/eden-archive/",kind:"discover"},{id:"early",label:"Early Access",path:"/early-access/",kind:"discover"},{id:"founding",label:"Founding Readers",path:"/founding-readers/",kind:"discover"},{id:"guide",label:"Reader Guide",path:"/getting-started.html",kind:"guide"},{id:"moderator",label:"Moderator HQ",path:"/moderator/",kind:"admin"}
];
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function status(t){$("siteMapStatus").textContent=t}
function mark(){dirty=true;$("siteMapSave").disabled=false;status("You have unsaved changes. Select SAVE CHANGES when you are ready to update the live website menu.")}
function field(label,value,placeholder){const wrap=node("label","site-map-field",label),el=node("input");el.value=value||"";el.placeholder=placeholder||"";wrap.append(el);return {wrap,el}}
function action(label,cls,fn){const b=node("button",cls||"secondary",label);b.type="button";b.addEventListener("click",fn);return b}
function renderFlow(){const host=$("siteMapFlow");if(!host)return;host.replaceChildren();const normalise=value=>{let p=String(value||"").split("?")[0].split("#")[0];if(p.length>1&&p.endsWith("/"))p=p.slice(0,-1);return p||"/"};const pages=config.pages||[];const groups=[["primary","MAIN MENU"],["book","THE BOOK MENU"],["discover","DISCOVER MENU"]];groups.forEach(([group,label])=>{const links=(config.links||[]).filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));if(!links.length)return;const section=node("div","site-map-flow-group");section.append(node("h4","",label));links.forEach(link=>{const match=pages.find(p=>normalise(p.path)===normalise(link.href));const row=node("div","site-map-flow-row"),source=node("span","site-map-flow-node site-map-flow-source",label),arrow1=node("span","site-map-flow-arrow","→"),middle=node("span","site-map-flow-node",link.label||"Untitled link"),arrow2=node("span","site-map-flow-arrow","→"),target=node("span","site-map-flow-node site-map-flow-target",match?match.label:"Page not listed");row.append(source,arrow1,middle,arrow2,target);if(link.enabled===false){row.classList.add("is-hidden");middle.append(node("small","site-map-flow-hidden","HIDDEN"))}if(!match)target.title="No page with this address is listed in the directory.";section.append(row)});host.append(section)})}
function move(arr,id,delta){const i=arr.findIndex(x=>x.id===id),j=i+delta;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];arr.forEach((x,n)=>x.order=n);mark();render()}
function movePage(id,delta){const pages=[...config.pages].sort((a,b)=>(a.order??0)-(b.order??0));const i=pages.findIndex(x=>x.id===id),j=i+delta;if(j<0||j>=pages.length)return;[pages[i],pages[j]]=[pages[j],pages[i]];pages.forEach((x,n)=>x.order=n);config.pages=pages;mark();render();}
function pageForm(page){
 const form=node("div","site-map-inline-form"),name=field("PAGE NAME",page?.label||"","e.g. About the Author"),path=field("PAGE ADDRESS",page?.path||"","e.g. /about/");
 form.append(name.wrap,path.wrap,node("p","site-map-help","Use the address of a page that already exists. This tool does not create the page itself."));
 form.append(action("SAVE PAGE","primary",()=>{const label=name.el.value.trim(),href=path.el.value.trim();if(!label||!href.startsWith("/")){status("Please enter a page name and an address beginning with /.");return}if(page){page.label=label;page.path=href}else config.pages.push({id:"page-"+Date.now(),label,path:href,kind:"custom",order:config.pages.length});mark();render()}),action("CANCEL","secondary",render));
 return form
}
function render(){
 const directory=$("siteMapDirectory"),routes=$("siteMapRoutes");directory.replaceChildren();routes.replaceChildren();
 const pages=[...config.pages].sort((a,b)=>(a.order??0)-(b.order??0));
 pages.forEach((p,i)=>{
  const card=node("article","site-map-page"),top=node("div","site-map-page-main"),details=node("div","site-map-page-details");
  top.append(node("strong","",p.label||"Unnamed page"),node("code","",p.path||"/"));
  details.append(node("span","site-map-page-kind",String(p.kind||"page").toUpperCase()));
  const actions=node("div","site-map-actions");
  actions.append(action("MOVE UP","secondary",()=>movePage(p.id,-1)),action("MOVE DOWN","secondary",()=>movePage(p.id,1)),action("EDIT","secondary",()=>{card.querySelectorAll(".site-map-inline-form").forEach(x=>x.remove());card.append(pageForm(p));}));
  actions.children[0].disabled=i===0;actions.children[1].disabled=i===pages.length-1;
  actions.append(action("REMOVE","danger",()=>{if(!confirm("Remove this page from the directory? This will not delete the actual website page or its menu links."))return;config.pages=config.pages.filter(x=>x.id!==p.id);mark();render()}));
  card.append(top,details,actions);directory.append(card)
 });
 const addPage=action("＋ ADD A PAGE","primary",()=>{const form=pageForm(null);directory.prepend(form);form.querySelector("input").focus()});directory.append(addPage);
 const groups=[["primary","MAIN MENU","These links appear along the top of the website."],["book","THE BOOK MENU","These links appear inside the Book dropdown."],["discover","DISCOVER MENU","These links appear inside the Discover dropdown."]];
 groups.forEach(([group,title,description])=>{
  const items=config.links.filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));
  const section=node("section","site-map-route-group"),heading=node("div","site-map-route-heading");
  heading.append(node("h3","",title),node("p","site-map-hint",description));section.append(heading);
  const list=node("div","site-map-route-list");
  items.forEach((item,i)=>{
   const row=node("article","site-map-route"),fields=node("div","site-map-route-fields"),label=field("WHAT READERS SEE",item.label),href=field("WHERE IT TAKES THEM",item.href);
   const enabled=node("label","site-map-enabled"),check=node("input");check.type="checkbox";check.checked=item.enabled!==false;enabled.append(check,node("span","","Show this link in the menu"));
   label.el.addEventListener("change",()=>{item.label=label.el.value.trim();mark();renderFlow()});href.el.addEventListener("change",()=>{item.href=href.el.value.trim();mark();renderFlow()});check.addEventListener("change",()=>{item.enabled=check.checked;mark()});
   fields.append(label.wrap,href.wrap,enabled);
   const actions=node("div","site-map-actions");actions.append(action("MOVE UP","secondary",()=>moveLink(item.id,-1,group)),action("MOVE DOWN","secondary",()=>moveLink(item.id,1,group)),action("REMOVE","danger",()=>{if(!confirm("Remove this link from the website menu?"))return;config.links=config.links.filter(x=>x.id!==item.id);mark();render()}));
   actions.children[0].disabled=i===0;actions.children[1].disabled=i===items.length-1;
   row.append(fields,actions);list.append(row)
  });
  section.append(list,action("＋ ADD A MENU LINK","secondary",()=>{const id="nav-"+Math.random().toString(36).slice(2,9);config.links.push({id,label:"New link",href:"/",group,order:items.length,enabled:true});mark();render()}));routes.append(section)
 });
 renderFlow();
 $("siteMapSave").disabled=!dirty;
}
function moveLink(id,delta,group){const arr=config.links.filter(x=>x.group===group).sort((a,b)=>(a.order??0)-(b.order??0));move(arr,id,delta);arr.forEach((x,n)=>x.order=n);render()}
async function load(){status("Loading your website pages and menu…");const {data,error}=await db.rpc("get_moderator_orlong_site_map");if(error)throw error;config=data||{pages:defaults,links:[]};config.pages=(config.pages||defaults).map((x,i)=>({...x,order:x.order??i}));config.links=(config.links||[]).map((x,i)=>({...x,order:x.order??i}));dirty=false;render();status("Your website map is ready. Edit the menu below, then save when you are happy.");}
async function save(){const btn=$("siteMapSave");btn.disabled=true;status("Saving your changes…");try{const payload={pages:config.pages.map((x,i)=>({...x,order:i})),links:config.links.map(x=>({...x}))};const {error}=await db.rpc("save_moderator_orlong_site_map",{p_config:payload});if(error)throw error;config=payload;dirty=false;render();status("All saved! Your website's shared navigation will now use these menu links.");}catch(e){status(e.message||"Could not save. Please try again.");btn.disabled=false}}
async function init(){if(!$("siteMapDirectory"))return;db=window.supabase.createClient("https://kqfwtzrfqsfampqfzoal.supabase.co","sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes");const {data}=await db.auth.getSession();if(!data.session)return;const {data:ok}=await db.rpc("is_reader_moderator");if(ok!==true)return;$("siteMapSave").addEventListener("click",save);$("siteMapRefresh").addEventListener("click",()=>load().catch(e=>status(e.message)));await load()}
document.addEventListener("DOMContentLoaded",()=>init().catch(e=>status(e.message||"Website map could not load.")));
})();