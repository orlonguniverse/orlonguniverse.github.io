(function(){
"use strict";
const SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
let client=null,catalogue=[],owned=[],activeCollectionCategory="all",activeCatalogueCategory="all";
const text=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;el.textContent=value??"";return el;};
function imageFor(card){return card.artworkUrl||card.artwork_url||"";}
function cardElement(card,isOwned){
 const article=document.createElement("article");article.className="eden-card"+(isOwned?" owned":"");
 const artwork=imageFor(card);
 if(isOwned||artwork){
  const img=document.createElement("img");img.className="eden-card-art";img.src=new URL(artwork,location.origin).href;img.alt=(card.name||card.card_name)+" collectible card";img.loading="lazy";img.onerror=()=>{img.hidden=true;};article.append(img);
 }else{
  const shadow=document.createElement("div");shadow.className="eden-card-shadow";shadow.append(text("span","shadow-symbol","?"),text("small","","UNDISCOVERED"));article.append(shadow);
 }
 article.append(text("p","eden-card-number",card.cardNumber||card.card_number||"CARD"));
 article.append(text("h3","eden-card-name",isOwned?(card.name||card.card_name):"Undiscovered Card"));
 article.append(text("p","eden-card-meta",[(card.categoryLabel||card.category_label||card.categoryId||"Collectible"),card.rarity||"Unknown"].filter(Boolean).join(" · ")));
 if(isOwned)article.append(text("span","eden-card-count",Number(card.copy_count||1)+" "+(Number(card.copy_count||1)===1?"COPY":"COPIES")));
 return article;
}
function makeFilters(container,categories,selected,onSelect){
 container.replaceChildren();
 [{id:"all",label:"ALL"},...categories.map(c=>({id:c.id,label:c.label.toUpperCase()}))].forEach(opt=>{
  const b=text("button","eden-filter"+(selected===opt.id?" is-active":""),opt.label);b.type="button";b.setAttribute("aria-pressed",String(selected===opt.id));b.addEventListener("click",()=>onSelect(opt.id));container.append(b);
 });
}
function renderCollection(){
 const grid=$("collectionGrid"),filters=$("collectionFilters");grid.replaceChildren();
 const categoryMap=new Map(catalogue.map(c=>[c.id,c.categoryId]));
 const categories=[...new Map(catalogue.map(c=>[c.categoryId,{id:c.categoryId,label:c.categoryLabel}])).values()];
 makeFilters(filters,categories,activeCollectionCategory,id=>{activeCollectionCategory=id;renderCollection();});
 const visible=activeCollectionCategory==="all"?catalogue:catalogue.filter(c=>c.categoryId===activeCollectionCategory);
 const ownedMap=new Map(owned.map(c=>[c.card_id,c]));
 visible.forEach(card=>{
  const copy=ownedMap.get(card.id);
  grid.append(cardElement(copy?{...card,copy_count:copy.copy_count}:card,Boolean(copy)));
 });
 const copies=owned.reduce((sum,c)=>sum+Number(c.copy_count||0),0);
 $("collectionSummary").textContent=copies+" COPIES · "+owned.length+" / "+catalogue.length+" DISCOVERED";
 if(!visible.length)grid.append(text("div","eden-empty","No cards are available in this category yet."));
}
function renderCatalogue(){
 const grid=$("catalogueGrid"),filters=$("catalogueFilters");grid.replaceChildren();
 const categories=[...new Map(catalogue.map(c=>[c.categoryId,{id:c.categoryId,label:c.categoryLabel}])).values()];
 makeFilters(filters,categories,activeCatalogueCategory,id=>{activeCatalogueCategory=id;renderCatalogue();});
 const visible=activeCatalogueCategory==="all"?catalogue:catalogue.filter(c=>c.categoryId===activeCatalogueCategory);
 visible.forEach(card=>grid.append(cardElement(card,owned.some(c=>c.card_id===card.id))));
 $("catalogueSummary").textContent=catalogue.length+" RELEASED CARDS";
}
function renderMarketplace(){
 const grid=$("marketplaceGrid");grid.replaceChildren();
 catalogue.forEach(card=>{const item=cardElement(card,owned.some(c=>c.card_id===card.id));const button=text("button","eden-filter","PURCHASE · COMING IN STAGE 7");button.type="button";button.disabled=true;button.title="Purchasing will be introduced with the Stage 7 collector economy.";button.style.marginTop="10px";button.style.width="100%";button.style.opacity=".55";item.append(button);grid.append(item);});
}
function renderReaders(readers){
 const root=$("readerDirectory");root.replaceChildren();
 if(!readers.length){root.append(text("div","eden-empty","No readers have made their collections public yet. You can change your binder visibility in My Account."));return;}
 readers.forEach(reader=>{
  const item=document.createElement("article");item.className="reader-card";
  const identity=document.createElement("div");identity.className="reader-identity";
  let avatar;
  if(reader.avatar_url){avatar=document.createElement("img");avatar.src=reader.avatar_url;avatar.alt="";avatar.className="reader-avatar";avatar.loading="lazy";}
  else{avatar=text("span","reader-avatar reader-avatar-fallback",(reader.display_name||"R").trim().charAt(0).toUpperCase());}
  const details=document.createElement("div");details.append(text("div","reader-name",reader.display_name||"Reader"),text("div","reader-count",Number(reader.unique_cards||0)+" UNIQUE CARDS · "+Number(reader.total_copies||0)+" COPIES"));
  identity.append(avatar,details);
  const link=text("a","reader-open","OPEN TRADING POST");link.href="../books/trials-of-eden/account.html#collectionSection";
  item.append(identity,link);root.append(item);
 });
}
function setTab(button){
 document.querySelectorAll(".eden-tab").forEach(tab=>{const active=tab===button;tab.classList.toggle("is-active",active);tab.setAttribute("aria-selected",String(active));});
 document.querySelectorAll(".eden-panel").forEach(panel=>{const active=panel.id===button.dataset.panel;panel.hidden=!active;panel.classList.toggle("is-active",active);});
}
async function initialise(){
 document.querySelectorAll(".eden-tab").forEach(button=>button.addEventListener("click",()=>setTab(button)));
 document.querySelector(".eden-tabs").addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight"].includes(event.key))return;const tabs=[...document.querySelectorAll(".eden-tab")],index=tabs.indexOf(document.activeElement),next=tabs[(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length];next.focus();setTab(next);});
 const {data,error}=await client.auth.getSession();
 const session=data?.session;
 if(!session){$("sessionMessage").textContent="Sign in to view your personal collection and browse the Trading Post.";const sign=text("a","eden-primary-link","SIGN IN TO EXPLORE");sign.href="../books/trials-of-eden/account.html";$("sessionMessage").append(" ",sign);$("collectionGrid").replaceChildren(text("div","eden-empty","Your collection will appear here once you sign in."));$("collectionSummary").textContent="SIGN IN REQUIRED";$("readerDirectory").replaceChildren(text("div","eden-empty","Sign in to browse public reader collections."));}
 else{
  $("sessionMessage").textContent="Welcome to your archive. Your collection and reader directory are ready.";
  const [collectionResult,readerResult]=await Promise.all([client.rpc("get_my_card_collection"),client.rpc("get_public_card_collections")]);
  if(collectionResult.error){$("collectionGrid").replaceChildren(text("div","eden-empty","Your collection is temporarily unavailable. Please check that the Stage 3 binder migration has been installed."));$("collectionSummary").textContent="COLLECTION UNAVAILABLE";}
  else{owned=collectionResult.data||[];renderCollection();}
  if(readerResult.error){console.error(readerResult.error);$("readerDirectory").replaceChildren(text("div","eden-empty","The reader directory is unavailable. Please check the Trading Post database setup."));}
  else renderReaders(readerResult.data||[]);
 }
}
document.addEventListener("DOMContentLoaded",async()=>{
 if(!window.supabase?.createClient){$("sessionMessage").textContent="The sign-in service is unavailable. Please refresh and try again.";return;}
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 try{
  const response=await fetch("card-catalogue.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("Catalogue request failed");
  const raw=await response.json();
  catalogue=(raw.cards||[]).filter(c=>c.active!==false).map(c=>({...c,categoryLabel:raw.categories.find(cat=>cat.id===c.categoryId)?.label||"Collectibles"}));
  $("catalogueSummary").textContent=catalogue.length+" RELEASED CARDS";
  await initialise();
  renderCatalogue();renderMarketplace();
 }catch(error){console.error("Explore Eden failed to initialise:",error);$("catalogueGrid").replaceChildren(text("div","eden-empty","The catalogue could not be loaded. Please refresh the page."));$("marketplaceGrid").replaceChildren(text("div","eden-empty","The marketplace catalogue is temporarily unavailable."));}
 client.auth.onAuthStateChange(()=>{window.setTimeout(()=>location.reload(),0);});
});
})();