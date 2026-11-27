(function(){
"use strict";
const SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
let client=null,catalogue=[],owned=[],activeCollectionCategory="all",activeCatalogueCategory="all";
const text=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;el.textContent=value??"";return el;};
function imageFor(card){return card.artworkUrl||card.artwork_url||"";}
function cardElement(card,isOwned,showUnownedArtwork=true){
 const article=document.createElement("article");article.className="eden-card"+(isOwned?" owned":"");
 const front=document.createElement("div");front.className="eden-card-front rarity-"+String(card.rarity||"common").toLowerCase();
 const artwork=imageFor(card);
 if(isOwned||(showUnownedArtwork&&artwork)){
  const img=document.createElement("img");img.className="eden-card-art";img.src=new URL(artwork,location.origin).href;img.alt=(card.name||card.card_name)+" collectible artwork";img.loading="lazy";img.onerror=()=>{img.hidden=true;};front.append(img);
 }else{
  const shadow=document.createElement("div");shadow.className="eden-card-shadow";shadow.append(text("span","shadow-symbol","?"),text("small","","UNDISCOVERED"));front.append(shadow);
 }
 const frame=document.createElement("div");frame.className="eden-card-frame";
 const top=document.createElement("div");top.className="eden-card-topline";
 top.append(text("span","eden-card-number",card.cardNumber||card.card_number||"CARD"),text("span","eden-card-rarity",String(card.rarity||"COMMON").toUpperCase()));
 const details=document.createElement("div");details.className="eden-card-front-details";
 const name=text("h3","eden-card-name",isOwned?(card.name||card.card_name):"Undiscovered Card");
 const description=text("p","eden-card-description",card.spoilerSafeDescription||card.spoiler_safe_description||"");
 const footer=document.createElement("div");footer.className="eden-card-footer";
 footer.append(text("span","eden-card-category",card.categoryLabel||card.category_label||card.categoryId||"COLLECTIBLE"),text("span","eden-card-chapter",card.chapterNumber||card.chapter_number?"CH. "+(card.chapterNumber||card.chapter_number):"CH. —"),text("span","eden-card-book","THE TRIALS OF EDEN"));
 details.append(name,description,footer);frame.append(top,details);
 const cardId=card.id||card.card_id||"";
 if(card.setId==="early-access-special-edition"||card.set_id==="early-access-special-edition"||cardId.startsWith("special-"))frame.append(text("span","eden-card-edition","SPECIAL EDITION"));
 front.append(frame);article.append(front);
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
 const ownedMap=new Map(owned.map(copy=>[copy.card_id,copy]));
 const discovered=catalogue.filter(card=>ownedMap.has(card.id));
 const categories=[...new Map(discovered.map(c=>[c.categoryId,{id:c.categoryId,label:c.categoryLabel}])).values()];
 makeFilters(filters,categories,activeCollectionCategory,id=>{activeCollectionCategory=id;renderCollection();});
 const visible=activeCollectionCategory==="all"?discovered:discovered.filter(c=>c.categoryId===activeCollectionCategory);
 visible.forEach(card=>{
  const copy=ownedMap.get(card.id);
  grid.append(cardElement({...card,copy_count:copy.copy_count},true));
 });
 const copies=owned.reduce((sum,c)=>sum+Number(c.copy_count||0),0);
 $("collectionSummary").textContent=copies+" COPIES · "+discovered.length+" UNIQUE CARDS";
 if(!visible.length)grid.append(text("div","eden-empty",discovered.length?"You haven't discovered any cards in this category yet.":"Your binder is empty. Complete Reading Room activities and Early Access missions to discover your first card."));
}
function renderCatalogue(){
 const grid=$("catalogueGrid"),filters=$("catalogueFilters");grid.replaceChildren();
 const categories=[...new Map(catalogue.map(c=>[c.categoryId,{id:c.categoryId,label:c.categoryLabel}])).values()];
 makeFilters(filters,categories,activeCatalogueCategory,id=>{activeCatalogueCategory=id;renderCatalogue();});
 const ownedMap=new Map(owned.map(copy=>[copy.card_id,copy]));
 const visible=activeCatalogueCategory==="all"?catalogue:catalogue.filter(c=>c.categoryId===activeCatalogueCategory);
 visible.forEach(card=>{
  const copy=ownedMap.get(card.id);
  grid.append(cardElement(copy?{...card,copy_count:copy.copy_count}:card,Boolean(copy),false));
 });
 $("catalogueSummary").textContent=ownedMap.size+" / "+catalogue.length+" DISCOVERED";
 if(!visible.length)grid.append(text("div","eden-empty","No cards are available in this category yet."));
}
function formatXanth(cents){return "XƵ"+(Number(cents||0)/100).toLocaleString("en-AU",{minimumFractionDigits:2,maximumFractionDigits:2});}
async function loadXanthTransactions(){
 const root=$("xanthTransactions");if(!root)return;
 root.replaceChildren(text("div","eden-empty","Loading your transaction history…"));
 const {data,error}=await client.rpc("get_my_xanth_transactions",{p_limit:30});
 if(error){console.error(error);root.replaceChildren(text("div","eden-empty","Your transaction history is temporarily unavailable."));return;}
 const rows=data||[];root.replaceChildren();
 if(!rows.length){root.append(text("div","eden-empty","No transactions yet. Your purchases and future Xanth rewards will appear here."));return;}
 rows.forEach(row=>{
  const item=document.createElement("article");item.className="xanth-transaction";
  const details=document.createElement("div");
  details.append(text("strong","xanth-transaction-title",row.description||row.transaction_type||"Xanth transaction"),
    text("small","xanth-transaction-date",new Date(row.created_at).toLocaleString("en-AU",{dateStyle:"medium",timeStyle:"short"})));
  const amount=Number(row.amount_cents||0);
  const value=text("strong","xanth-transaction-amount"+(amount>0?" is-credit":" is-debit"),(amount>0?"+":"−")+formatXanth(Math.abs(amount)));
  item.append(details,value);root.append(item);
 });
}
async function purchaseShopCard(slotNumber,button){
 button.disabled=true;button.textContent="PROCESSING…";
 const {data,error}=await client.rpc("purchase_xanth_shop_card",{p_slot_number:slotNumber});
 if(error){
  console.error("Xanth purchase failed:",error);
  const message=String(error.message||"").toLowerCase();
  button.textContent=message.includes("not enough xanth")?"NOT ENOUGH XANTH":"TRY AGAIN";
  button.disabled=false;
  $("shopPurchaseStatus").textContent=error.message||"The purchase could not be completed.";
  return;
 }
 button.textContent="PURCHASED";
 $("shopPurchaseStatus").textContent="Purchase successful! "+(data.card_number||"Your card")+" has been added to your collection. Your card reveal is ready.";
 const collectionResult=await client.rpc("get_my_card_collection");
 if(!collectionResult.error){owned=collectionResult.data||[];renderCollection();}
 await Promise.all([loadMarketplace(),loadXanthTransactions()]);
}
async function loadMarketplace(){
 const grid=$("dailyShopGrid");
 const [walletResult,shopResult]=await Promise.all([client.rpc("get_my_xanth_wallet"),client.rpc("get_xanth_daily_shop")]);
 if(walletResult.error){$("xanthBalance").textContent="WALLET UNAVAILABLE";console.error(walletResult.error);}
 else{const account=Array.isArray(walletResult.data)?walletResult.data[0]:walletResult.data;$("xanthBalance").textContent=formatXanth(account?.balance_cents);}
 if(shopResult.error){grid.replaceChildren(text("div","eden-empty","The daily exchange could not load. Please check that the Stage 7A Xanth migration has been installed."));console.error(shopResult.error);return;}
 const slots=shopResult.data||[];
 $("shopDate").textContent=slots[0]?.shop_date?new Date(slots[0].shop_date+"T12:00:00+10:00").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"}):"NO CARDS AVAILABLE";
 grid.replaceChildren();
 slots.forEach(slot=>{
  const card=catalogue.find(c=>c.id===slot.card_id)||{id:slot.card_id,card_id:slot.card_id,cardNumber:slot.card_number,name:slot.card_name,rarity:slot.rarity,categoryId:slot.category_id,categoryLabel:slot.category_label,chapterNumber:slot.chapter_number,artworkUrl:slot.artwork_url,spoilerSafeDescription:slot.description};
  const isOwned=owned.some(c=>c.card_id===card.id);
  const item=cardElement(card,isOwned);
  if(!isOwned){const spacer=text("span","eden-card-count shop-owned-count-empty"," ");spacer.setAttribute("aria-hidden","true");item.append(spacer);}
  else item.querySelector(".eden-card-count")?.classList.add("shop-owned-count");
  const label=text("small","shop-slot-label","FEATURED CARD · "+String(slot.selection_mode||"automatic").toUpperCase());
  const price=text("div","shop-price",formatXanth(slot.price_cents));
  const button=text("button","shop-purchase-button","PURCHASE CARD");button.type="button";
  button.addEventListener("click",()=>purchaseShopCard(Number(slot.slot_number),button));
  item.append(label,price,button);grid.append(item);
 });
 if(!slots.length)grid.append(text("div","eden-empty","No released cards are currently eligible for the daily exchange."));
 await loadXanthTransactions();
}
function renderMarketplace(){
 const grid=$("marketplaceGrid");grid.replaceChildren();
 catalogue.forEach(card=>{const item=cardElement(card,owned.some(c=>c.card_id===card.id));grid.append(item);});
}
async function renderReaders(readers){
 const root=$("readerDirectory");root.replaceChildren();
 if(!readers.length){root.append(text("div","eden-empty","No readers have made their collections public yet. You can change your binder visibility in My Account."));return;}
 const copiesResult=await client.rpc("get_my_tradeable_card_copies");
 const myCopies=copiesResult.error?[]:(copiesResult.data||[]);
 readers.forEach(reader=>{
  const item=document.createElement("article");item.className="reader-card";item.style.display="block";
  const top=document.createElement("div");top.className="reader-card-top";top.style.display="flex";top.style.justifyContent="space-between";top.style.alignItems="center";top.style.gap="12px";
  const identity=document.createElement("div");identity.className="reader-identity";
  let avatar;
  if(reader.avatar_url){avatar=document.createElement("img");avatar.src=reader.avatar_url;avatar.alt="";avatar.className="reader-avatar";avatar.loading="lazy";}
  else{avatar=text("span","reader-avatar reader-avatar-fallback",(reader.display_name||"R").trim().charAt(0).toUpperCase());}
  const details=document.createElement("div");details.append(text("div","reader-name",reader.display_name||"Reader"),text("div","reader-count",Number(reader.unique_cards||0)+" UNIQUE CARDS · "+Number(reader.total_copies||0)+" COPIES"));
  identity.append(avatar,details);
  const view=text("button","reader-open","VIEW COLLECTION");view.type="button";
  const holder=document.createElement("div");holder.hidden=true;holder.style.marginTop="14px";
  view.addEventListener("click",async()=>{
   if(!holder.hidden){holder.hidden=true;view.textContent="VIEW COLLECTION";return;}
   view.disabled=true;view.textContent="LOADING…";
   const {data,error}=await client.rpc("get_public_card_collection",{target_reader_id:reader.reader_id});
   view.disabled=false;
   if(error){console.error(error);view.textContent="TRY AGAIN";return;}
   holder.replaceChildren();
   if(!data?.length){holder.append(text("p","reader-count","This public binder is currently empty."));}
   (data||[]).forEach(card=>{
    const row=document.createElement("div");row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid rgba(135,174,220,.16)";
    const info=document.createElement("div");info.append(text("strong","reader-name",(card.card_number||"CARD")+" · "+card.card_name),text("div","reader-count",card.category_label+" · "+card.rarity+" · "+card.copy_count+" owned"));
    row.append(info);
    if(myCopies.length){
     const controls=document.createElement("div");controls.style.cssText="display:flex;gap:6px;align-items:center;flex-wrap:wrap";
     const select=document.createElement("select");select.setAttribute("aria-label","Choose a card to offer for "+card.card_name);select.style.cssText="max-width:210px;padding:8px;background:#091321;color:#dceaff;border:1px solid rgba(135,174,220,.35);font-size:10px";
     const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="Choose your offer card";select.append(placeholder);
     myCopies.forEach(copy=>{const opt=document.createElement("option");opt.value=copy.copy_id;opt.textContent=copy.card_number+" · "+copy.card_name;select.append(opt);});
     const send=text("button","reader-open","MAKE OFFER");send.type="button";send.disabled=true;select.addEventListener("change",()=>send.disabled=!select.value);
     send.addEventListener("click",async()=>{send.disabled=true;send.textContent="SENDING…";const result=await client.rpc("create_card_trade_offer",{target_recipient_id:reader.reader_id,offered_copy:select.value,requested_card:card.card_id});if(result.error){console.error(result.error);send.disabled=false;send.textContent="TRY AGAIN";return;}send.textContent="OFFER SENT";select.disabled=true;});
     controls.append(select,send);row.append(controls);
    }else row.append(text("span","reader-count","You have no available copies to offer."));
    holder.append(row);
   });
   holder.hidden=false;view.textContent="HIDE COLLECTION";
  });
  top.append(identity,view);
  item.append(top,holder);root.append(item);
 });
 if(copiesResult.error){const note=text("p","reader-count","Your tradeable cards could not be loaded. You can still browse collections; check the Stage 6 Trading Post migration to make offers.");root.prepend(note);}
}function setTab(button){
 document.querySelectorAll(".eden-tab").forEach(tab=>{const active=tab===button;tab.classList.toggle("is-active",active);tab.setAttribute("aria-selected",String(active));});
 document.querySelectorAll(".eden-panel").forEach(panel=>{const active=panel.id===button.dataset.panel;panel.hidden=!active;panel.classList.toggle("is-active",active);});
}
async function initialise(){
 document.querySelectorAll(".eden-tab").forEach(button=>button.addEventListener("click",()=>setTab(button)));
 document.querySelector(".eden-tabs").addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight"].includes(event.key))return;const tabs=[...document.querySelectorAll(".eden-tab")],index=tabs.indexOf(document.activeElement),next=tabs[(index+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length];next.focus();setTab(next);});
 const {data,error}=await client.auth.getSession();
 const session=data?.session;
 if(!session){$("sessionMessage").textContent="Sign in to view your personal collection and browse the Trading Post.";const sign=text("a","eden-primary-link","SIGN IN TO EXPLORE");sign.href="../books/trials-of-eden/account.html";$("sessionMessage").append(" ",sign);$("collectionGrid").replaceChildren(text("div","eden-empty","Your collection will appear here once you sign in."));$("collectionSummary").textContent="SIGN IN REQUIRED";$("readerDirectory").replaceChildren(text("div","eden-empty","Sign in to browse public reader collections."));$("dailyShopGrid").replaceChildren(text("div","eden-empty","Sign in to view today’s Xanth exchange."));$("xanthBalance").textContent="SIGN IN REQUIRED";}
 else{
  $("sessionMessage").textContent="Welcome to your archive. Your collection and reader directory are ready.";
  const [collectionResult,readerResult]=await Promise.all([client.rpc("get_my_card_collection"),client.rpc("get_public_card_collections")]);
  if(collectionResult.error){$("collectionGrid").replaceChildren(text("div","eden-empty","Your collection is temporarily unavailable. Please check that the Stage 3 binder migration has been installed."));$("collectionSummary").textContent="COLLECTION UNAVAILABLE";}
  else{owned=collectionResult.data||[];renderCollection();}
  if(readerResult.error){console.error(readerResult.error);$("readerDirectory").replaceChildren(text("div","eden-empty","The reader directory is unavailable. Please check the Trading Post database setup."));}
  else renderReaders(readerResult.data||[]);
  await loadMarketplace();
 }
}
document.addEventListener("DOMContentLoaded",async()=>{
 if(!window.supabase?.createClient){$("sessionMessage").textContent="The sign-in service is unavailable. Please refresh and try again.";return;}
 client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
 try{
  const response=await fetch("card-catalogue.json",{cache:"no-cache"});
  if(!response.ok)throw new Error("Catalogue request failed");
  const raw=await response.json();
  const {data:databaseCards,error:catalogueError}=await client.rpc("get_public_card_catalogue");
  if(catalogueError)throw catalogueError;
  catalogue=(databaseCards||[]).map(c=>({id:c.card_id,card_id:c.card_id,cardNumber:c.card_number,card_number:c.card_number,name:c.name,card_name:c.name,rarity:c.rarity,categoryId:c.category_id,categoryLabel:c.category_label,category_label:c.category_label,setId:c.set_id,unlockChapterId:c.unlock_chapter_id,chapterNumber:c.chapter_number,chapter_number:c.chapter_number,spoilerSafeDescription:c.spoiler_safe_description,artworkUrl:c.artwork_url,artwork_url:c.artwork_url,active:true}));
  $("catalogueSummary").textContent=catalogue.length+" TOTAL CARDS";
  await initialise();
  renderCatalogue();renderMarketplace();
 }catch(error){console.error("Explore Eden failed to initialise:",error);$("catalogueGrid").replaceChildren(text("div","eden-empty","The catalogue could not be loaded. Please refresh the page."));$("marketplaceGrid").replaceChildren(text("div","eden-empty","The marketplace catalogue is temporarily unavailable."));}
 // Do not reload on Supabase's INITIAL_SESSION event: it fires during page startup
 // and would create a continuous reload loop. The shared navigation handles
 // account-label updates independently.
});
})();