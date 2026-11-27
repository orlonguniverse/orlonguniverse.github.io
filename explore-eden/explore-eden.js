(function(){
"use strict";
const SUPABASE_URL="https://kqfwtzrfqsfampqfzoal.supabase.co";
const SUPABASE_KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);
let client=null,catalogue=[],owned=[],activeCollectionCategory="all",activeCatalogueCategory="all",mysteryPacks=[];
const text=(tag,className,value)=>{const el=document.createElement(tag);if(className)el.className=className;el.textContent=value??"";return el;};
function imageFor(card){return card.artworkUrl||card.artwork_url||"";}
function cardElement(card,isOwned,showUnownedArtwork=true,showSaleControls=false){
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
 if(isOwned&&showSaleControls&&Number(card.copy_count||1)>1){
  const count=Number(card.copy_count||1),unitValue=duplicateSaleValue(card.rarity);
  const controls=document.createElement("div");controls.className="duplicate-card-controls";
  controls.append(text("small","duplicate-card-value","SELL VALUE · "+formatXanth(unitValue)+" EACH"));
  const actions=document.createElement("div");actions.className="duplicate-card-actions";
  const select=document.createElement("select");select.className="duplicate-sale-quantity";select.setAttribute("aria-label","Number of duplicate copies to sell");
  for(let n=1;n<count;n++){const option=document.createElement("option");option.value=String(n);option.textContent="Sell "+n+" cop"+(n===1?"y":"ies");select.append(option);}
  const button=text("button","duplicate-sell-button","SELL");button.type="button";
  button.addEventListener("click",()=>sellDuplicateCopies(card.id||card.card_id,Number(select.value),button));
  actions.append(select,button);controls.append(actions);article.append(controls);
 }
 return article;
}
function makeFilters(container,categories,selected,onSelect){
 container.replaceChildren();
 [{id:"all",label:"ALL"},...categories.map(c=>({id:c.id,label:c.label.toUpperCase()}))].forEach(opt=>{
  const b=text("button","eden-filter"+(selected===opt.id?" is-active":""),opt.label);b.type="button";b.setAttribute("aria-pressed",String(selected===opt.id));b.addEventListener("click",()=>onSelect(opt.id));container.append(b);
 });
}
function duplicateSaleValue(rarity){
 const values={common:500,uncommon:1750,rare:6250,epic:22500,legendary:90000};
 return values[String(rarity||"common").toLowerCase()]||500;
}
async function loadDuplicateSaleSettings(){
 const {data,error}=await client.rpc("get_my_duplicate_sale_settings");
 if(error){$("duplicateSettingsStatus").textContent="Duplicate selling is waiting for the Stage 7E Supabase migration.";console.warn(error);return;}
 $("autoSellDuplicates").checked=Boolean(data?.auto_sell_duplicates);
 const keep=String(data?.keep_copies||1);
 $("duplicateKeepCopies").value=[...$("duplicateKeepCopies").options].some(o=>o.value===keep)?keep:"1";
 $("duplicateSettingsStatus").textContent=$("autoSellDuplicates").checked
  ?"Automatic selling is ON. Extra copies above your keep limit will be sold when acquired."
  :"Automatic selling is OFF. You can sell duplicates manually at any time.";
}
async function saveDuplicateSaleSettings(){
 const button=$("saveDuplicateSettings");button.disabled=true;button.textContent="SAVING…";
 try{
  const {data,error}=await client.rpc("set_my_duplicate_sale_settings",{
   p_auto_sell:$("autoSellDuplicates").checked,
   p_keep_copies:Number($("duplicateKeepCopies").value)
  });
  if(error)throw error;
  if(data.auto_sell_duplicates){
   const sold=Number(data.existing_copies_sold||0);
   $("duplicateSettingsStatus").textContent="Saved. Your collection has been brought down to your limit of "+data.keep_copies+" wherever copies were available to sell. "+(sold? sold+" existing duplicate cop"+(sold===1?"y was":"ies were")+" sold for 50% of rarity value.":"No existing excess copies needed selling.")+" Future acquisitions will also be checked automatically.";
   const result=await client.rpc("get_my_card_collection");
   if(!result.error){owned=result.data||[];renderCollection();}
   await Promise.all([loadMarketplace(),loadXanthTransactions()]);
  }else{
   $("duplicateSettingsStatus").textContent="Saved. Automatic selling is OFF; you can still sell duplicates manually.";
  }
 }catch(error){console.error(error);$("duplicateSettingsStatus").textContent=error.message||"Could not save duplicate preferences.";}
 finally{button.disabled=false;button.textContent="SAVE PREFERENCES";}
}
async function sellDuplicateCopies(cardId,quantity,button){
 button.disabled=true;button.textContent="SELLING…";
 try{
  const {data,error}=await client.rpc("sell_my_duplicate_cards",{p_card_id:cardId,p_quantity:quantity});
  if(error)throw error;
  const result=await client.rpc("get_my_card_collection");
  if(result.error)throw result.error;
  owned=result.data||[];renderCollection();
  await Promise.all([loadMarketplace(),loadXanthTransactions()]);
  $("duplicateSettingsStatus").textContent="Sold "+data.copies_sold+" duplicate "+(data.card_name||"card")+(data.copies_sold===1?"":"s")+" for "+formatXanth(data.total_value_cents)+".";
 }catch(error){console.error(error);button.disabled=false;button.textContent="TRY AGAIN";$("duplicateSettingsStatus").textContent=error.message||"The duplicate sale could not be completed.";}
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
  grid.append(cardElement({...card,copy_count:copy.copy_count},true,true,true));
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

function closeMysteryPackOverlay(overlay){
 if(overlay?.isConnected)overlay.remove();
 document.body.classList.remove("orlong-reveal-lock");
}
function showMysteryPackTear(pack){
 const overlay=document.createElement("div");overlay.className="mystery-pack-open-overlay";overlay.style.setProperty("--pack-accent",pack.accent||"#d6b86f");
 const scene=document.createElement("div");scene.className="mystery-pack-opening-scene";
 const art=document.createElement("div");art.className="mystery-pack-opening-art";
 const shell=document.createElement("div");shell.className="mystery-pack-opening-shell";
 const left=document.createElement("span");left.className="pack-half";
 const right=document.createElement("span");right.className="pack-half";
 const line=document.createElement("span");line.className="mystery-pack-tear-line";
 shell.append(left,right,line);art.append(shell);
 const caption=text("p","","BREAKING THE SEAL");
 scene.append(art,caption);overlay.append(scene);document.body.append(overlay);document.body.classList.add("orlong-reveal-lock");
 requestAnimationFrame(()=>{overlay.classList.add("is-active");window.setTimeout(()=>overlay.classList.add("is-tearing"),120);});
 return overlay;
}
function renderMysteryPacks(){
 const grid=$("mysteryPackGrid");if(!grid)return;
 const search=String($("mysteryPackSearch")?.value||"").trim().toLowerCase();
 const type=$("mysteryPackType")?.value||"all",sort=$("mysteryPackSort")?.value||"recommended";
 let visible=mysteryPacks.filter(pack=>{
  const haystack=[pack.title,pack.description,pack.theme_label,pack.theme_type].join(" ").toLowerCase();
  return (!search||haystack.includes(search))&&(type==="all"||pack.theme_type===type);
 });
 if(sort==="price-low")visible.sort((x,y)=>Number(x.price_cents)-Number(y.price_cents));
 else if(sort==="price-high")visible.sort((x,y)=>Number(y.price_cents)-Number(x.price_cents));
 else if(sort==="cards-high")visible.sort((x,y)=>Number(y.card_count)-Number(x.card_count)||Number(x.price_cents)-Number(y.price_cents));
 else if(sort==="options-high")visible.sort((x,y)=>Number(y.eligible_count)-Number(x.eligible_count));
 else if(sort==="name")visible.sort((x,y)=>x.title.localeCompare(y.title));
 const count=$("mysteryPackCount");if(count)count.textContent="SHOWING "+visible.length+" OF "+mysteryPacks.length+" AVAILABLE PACKS";
 grid.replaceChildren();
 visible.forEach(pack=>{
  const article=document.createElement("article");article.className="mystery-pack-card theme-"+pack.theme_type;
  if(pack.accent)article.style.setProperty("--pack-accent",pack.accent);
  article.append(text("span","mystery-pack-kicker",pack.theme_label||"SEALED DISCOVERY"));
  const art=document.createElement("div");art.className="mystery-pack-art";
  const envelope=document.createElement("div");envelope.className="mystery-pack-envelope";
  const glyph=pack.theme_type==="chapter"?"⌁":pack.theme_type==="category"?"✧":pack.theme_type==="rarity"?"◇":pack.theme_type==="targeted"?"✣":"✦";
  envelope.append(text("span","mystery-pack-glyph",glyph),text("span","mystery-pack-ribbon",""));art.append(envelope);
  article.append(art,text("h4","mystery-pack-title",pack.title),text("p","mystery-pack-description",pack.description));
  const meta=document.createElement("div");meta.className="mystery-pack-meta";
  meta.append(text("span","",pack.card_count+" CARDS INSIDE"),text("span","",pack.eligible_count+" POSSIBLE"));
  article.append(meta,text("p","mystery-pack-price",formatXanth(pack.price_cents)));
  const button=text("button","mystery-pack-buy","OPEN PACK");button.type="button";button.addEventListener("click",()=>purchaseMysteryPack(pack,button));
  article.append(button);grid.append(article);
 });
 if(!visible.length)grid.append(text("div","eden-empty",mysteryPacks.length?"No packs match those filters. Try another search or clear the filters.":"The vault is quiet. More released cards are needed to form eligible packs."));
}
async function loadMysteryPacks(){
 const grid=$("mysteryPackGrid");if(!grid)return;
 grid.replaceChildren(text("div","eden-empty","Opening the Mystery Vault…"));
 const {data,error}=await client.rpc("get_xanth_mystery_packs");
 if(error){console.error("Mystery Vault unavailable:",error);grid.replaceChildren(text("div","eden-empty","The Mystery Vault is waiting for the Stage 7C/7D Supabase migration."));return;}
 mysteryPacks=data||[];renderMysteryPacks();
}
["mysteryPackSearch","mysteryPackType","mysteryPackSort"].forEach(id=>{
 const control=$(id);if(control){control.addEventListener(id==="mysteryPackSearch"?"input":"change",renderMysteryPacks);}
});
$("mysteryPackClear")?.addEventListener("click",()=>{
 if($("mysteryPackSearch"))$("mysteryPackSearch").value="";
 if($("mysteryPackType"))$("mysteryPackType").value="all";
 if($("mysteryPackSort"))$("mysteryPackSort").value="recommended";
 renderMysteryPacks();
});
async function purchaseMysteryPack(pack,button){
 button.disabled=true;button.textContent="SEAL BREAKING…";
 $("mysteryPackStatus").textContent="";
 const overlay=showMysteryPackTear(pack);
 await new Promise(resolve=>window.setTimeout(resolve,1650));
 const {data,error}=await client.rpc("purchase_xanth_mystery_pack",{p_pack_id:pack.pack_id});
 closeMysteryPackOverlay(overlay);
 if(error){
  console.error("Mystery pack purchase failed:",error);
  button.disabled=false;button.textContent=String(error.message||"").toLowerCase().includes("not enough xanth")?"NOT ENOUGH XANTH":"TRY AGAIN";
  $("mysteryPackStatus").textContent=error.message||"The pack could not be opened. Your wallet has not been charged.";
  return;
 }
 button.textContent="PACK OPENED";
 $("mysteryPackStatus").textContent=pack.title+" opened — "+data.card_count+" card"+(data.card_count===1?"":"s")+" added to your collection. Your discoveries are being revealed.";
 const collectionResult=await client.rpc("get_my_card_collection");
 if(!collectionResult.error){owned=collectionResult.data||[];renderCollection();}
 await Promise.all([loadMarketplace(),loadXanthTransactions()]);
 // The reveal watcher groups all cards from this pack into one simultaneous reveal.
 window.OrlongCardRevealWatcher?.poll?.();
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
 await loadMysteryPacks();
}
function renderMarketplace(){
 const grid=$("marketplaceGrid");grid.replaceChildren();
 catalogue.forEach(card=>{const item=cardElement(card,owned.some(c=>c.card_id===card.id));grid.append(item);});
}
async function renderReaders(readers){
 const root=$("readerDirectory");root.replaceChildren();
 if(!readers.length){root.append(text("div","eden-empty","No readers have made their collections public yet. You can change your binder visibility in My Account."));return;}
 readers.forEach(reader=>{
  const item=document.createElement("article");item.className="reader-card market-reader-card";
  const top=document.createElement("div");top.className="reader-card-top";
  const identity=document.createElement("div");identity.className="reader-identity";
  let avatar;
  if(reader.avatar_url){avatar=document.createElement("img");avatar.src=reader.avatar_url;avatar.alt="";avatar.className="reader-avatar";avatar.loading="lazy";}
  else avatar=text("span","reader-avatar reader-avatar-fallback",(reader.display_name||"R").trim().charAt(0).toUpperCase());
  const details=document.createElement("div");details.append(text("div","reader-name",reader.display_name||"Reader"),text("div","reader-count",Number(reader.unique_cards||0)+" UNIQUE CARDS · "+Number(reader.total_copies||0)+" COPIES"));
  identity.append(avatar,details);
  const view=text("button","reader-open","BUILD AN OFFER");view.type="button";
  const holder=document.createElement("div");holder.hidden=true;holder.className="market-reader-offer-builder";
  view.addEventListener("click",async()=>{
   if(!holder.hidden){holder.hidden=true;view.textContent="BUILD AN OFFER";return;}
   view.disabled=true;view.textContent="LOADING…";
   const [mine,theirs]=await Promise.all([client.rpc("get_my_market_tradeable_copies"),client.rpc("get_public_market_tradeable_copies",{p_reader_id:reader.reader_id})]);
   view.disabled=false;
   if(mine.error||theirs.error){holder.replaceChildren(text("p","marketplace-status","Could not load available cards. Please refresh and try again."));holder.hidden=false;view.textContent="HIDE OFFER BUILDER";return;}
   holder.replaceChildren();
   const form=document.createElement("div");form.className="market-offer-builder";
   form.append(text("h4","","YOUR OFFER"));
   const myChecks=document.createElement("div");myChecks.className="market-card-check-grid";
   (mine.data||[]).forEach(copy=>{const label=document.createElement("label");label.className="market-card-check";const box=document.createElement("input");box.type="checkbox";box.value=copy.copy_id;label.append(box,text("span","",copy.card_number+" · "+copy.card_name+" ("+copy.rarity+")"));myChecks.append(label);});
   form.append(myChecks,text("h4","","CARDS YOU WOULD LIKE"));
   const theirChecks=document.createElement("div");theirChecks.className="market-card-check-grid";
   (theirs.data||[]).forEach(copy=>{const label=document.createElement("label");label.className="market-card-check";const box=document.createElement("input");box.type="checkbox";box.value=copy.copy_id;label.append(box,text("span","",copy.card_number+" · "+copy.card_name+" ("+copy.rarity+")"));theirChecks.append(label);});
   form.append(theirChecks);
   const cash=document.createElement("label");cash.className="market-offer-cash";cash.append(text("span","","Xanth you will pay"),Object.assign(document.createElement("input"),{type:"number",min:"0",step:"0.01",value:"0"}));
   form.append(cash);
   const message=document.createElement("input");message.type="text";message.maxLength=500;message.placeholder="Add a message (optional)";message.className="market-offer-message";form.append(message);
   const status=text("p","marketplace-status","");
   const send=text("button","reader-open","SEND MULTI-CARD OFFER");send.type="button";
   send.addEventListener("click",async()=>{
    const offered=[...myChecks.querySelectorAll("input:checked")].map(x=>x.value),requested=[...theirChecks.querySelectorAll("input:checked")].map(x=>x.value),amount=Math.round(Number(cash.querySelector("input").value||0)*100);
    if(!offered.length&&!requested.length&&amount<=0){status.textContent="Choose at least one card or enter a Xanth amount.";return;}
    send.disabled=true;send.textContent="SENDING…";
    const result=await client.rpc("create_reader_market_offer",{p_recipient_id:reader.reader_id,p_listing_id:null,p_proposer_copy_ids:offered,p_recipient_copy_ids:requested,p_proposer_pays_cents:amount,p_recipient_pays_cents:0,p_message:message.value.trim()||null});
    if(result.error){status.textContent=result.error.message||"We couldn't send that offer.";send.disabled=false;send.textContent="TRY AGAIN";return;}
    status.textContent="Offer sent! The selected cards are now reserved while the offer is open.";send.textContent="OFFER SENT";
    await loadTradingMarket();
   });
   form.append(send,status);holder.append(form);holder.hidden=false;view.textContent="HIDE OFFER BUILDER";
  });
  top.append(identity,view);item.append(top,holder);root.append(item);
 });
}
function marketButton(label,handler,secondary=false){
 const b=text("button",secondary?"reader-open market-secondary":"reader-open",label);b.type="button";b.addEventListener("click",handler);return b;
}
async function loadTradingMarket(){
 const list=$("marketListCopy"),mine=$("myMarketListings"),publicGrid=$("readerMarketListings"),offersRoot=$("myReaderMarketOffers");
 if(!list||!mine||!publicGrid||!offersRoot)return;
 const [copies,ownListings,publicListings,offers]=await Promise.all([
  client.rpc("get_my_market_tradeable_copies"),client.rpc("get_my_market_listings"),
  client.rpc("get_reader_card_market"),client.rpc("get_my_reader_market_offers")
 ]);
 list.replaceChildren();const available=copies.data||[];
 if(copies.error){list.append(new Option("Available cards could not be loaded",""));}
 else if(!available.length){list.append(new Option("No unreserved cards available",""));}
 else{list.append(new Option("Choose a physical card copy",""));available.forEach(copy=>list.append(new Option(copy.card_number+" · "+copy.card_name+" · "+copy.rarity,copy.copy_id)));}
 $("marketCreateListing").disabled=!!copies.error||!available.length;
 mine.replaceChildren();const own=ownListings.data||[];$("myMarketListingCount").textContent=own.length+" LISTED";
 if(ownListings.error)mine.append(text("div","eden-empty","Your listings could not be loaded."));
 else if(!own.length)mine.append(text("div","eden-empty","You have no active listings."));
 own.forEach(item=>{
  const row=document.createElement("article");row.className="market-listing-row";
  row.append(text("strong","",item.card_number+" · "+item.card_name),text("span","market-listing-price",formatXanth(item.price_cents)));
  row.append(marketButton("CANCEL LISTING",async()=>{const result=await client.rpc("cancel_market_card_listing",{p_listing_id:item.listing_id});$("marketListingStatus").textContent=result.error?.message||"Listing cancelled.";await loadTradingMarket();},true));mine.append(row);
 });
 publicGrid.replaceChildren();
 if(publicListings.error)publicGrid.append(text("div","eden-empty","Reader listings are temporarily unavailable."));
 else if(!publicListings.data?.length)publicGrid.append(text("div","eden-empty","No reader listings are available yet. Be the first to list a card!"));
 (publicListings.data||[]).forEach(item=>{
  const row=document.createElement("article");row.className="market-listing-row";
  const details=document.createElement("div");details.className="market-listing-details";
  if(item.artwork_url){const img=document.createElement("img");img.src=item.artwork_url;img.alt="";img.loading="lazy";details.append(img);}
  const info=document.createElement("div");info.append(text("strong","",item.card_number+" · "+item.card_name),text("small","",item.rarity+" · Listed by "+item.seller_name));details.append(info);
  row.append(details,text("strong","market-listing-price",formatXanth(item.price_cents)));
  const actions=document.createElement("div");actions.className="market-listing-actions";
  actions.append(marketButton("BUY NOW",async()=>{if(!confirm("Buy "+item.card_name+" for "+formatXanth(item.price_cents)+"?"))return;const b=actions.querySelector("button");b.disabled=true;b.textContent="PROCESSING…";const result=await client.rpc("buy_market_card_listing",{p_listing_id:item.listing_id});if(result.error){$("marketListingStatus").textContent=result.error.message;b.disabled=false;b.textContent="TRY AGAIN";return;}$("marketListingStatus").textContent="Purchase complete! "+item.card_name+" is now in your collection.";const collection=await client.rpc("get_my_card_collection");if(!collection.error){owned=collection.data||[];renderCollection();}await Promise.all([loadTradingMarket(),loadMarketplace()]);}));
  actions.append(marketButton("MAKE OFFER",async()=>{
   const builder=document.createElement("div");builder.className="market-offer-builder";
   const mineResult=await client.rpc("get_my_market_tradeable_copies");
   if(mineResult.error){builder.append(text("p","marketplace-status","Your available cards could not be loaded."));row.append(builder);return;}
   builder.append(text("h4","","ADD CARDS TO YOUR OFFER"));
   const checks=document.createElement("div");checks.className="market-card-check-grid";
   (mineResult.data||[]).forEach(copy=>{const label=document.createElement("label");label.className="market-card-check";const box=document.createElement("input");box.type="checkbox";box.value=copy.copy_id;label.append(box,text("span","",copy.card_number+" · "+copy.card_name));checks.append(label);});
   const cash=document.createElement("input");cash.type="number";cash.min="0";cash.step="0.01";cash.value=String((Number(item.price_cents)/100).toFixed(2));cash.className="market-offer-message";
   const send=marketButton("SEND OFFER",async()=>{const selected=[...checks.querySelectorAll("input:checked")].map(x=>x.value);const amount=Math.round(Number(cash.value||0)*100);if(!selected.length&&amount<=0){status.textContent="Add cards or Xanth to your offer.";return;}send.disabled=true;const result=await client.rpc("create_reader_market_offer",{p_recipient_id:item.seller_user_id,p_listing_id:item.listing_id,p_proposer_copy_ids:selected,p_recipient_copy_ids:[],p_proposer_pays_cents:amount,p_recipient_pays_cents:0,p_message:null});status.textContent=result.error?.message||"Offer sent.";if(!result.error)await loadTradingMarket();else send.disabled=false;});
   const status=text("p","marketplace-status","");
   builder.append(checks,text("label","market-offer-cash","Xanth offered"),cash,send,status);row.append(builder);
  },true));
  row.append(actions);publicGrid.append(row);
 });
 offersRoot.replaceChildren();
 if(offers.error)offersRoot.append(text("div","eden-empty","Your offers could not be loaded."));
 else if(!offers.data?.length)offersRoot.append(text("div","eden-empty","No offers yet. Make an offer on a listing or in a public reader's binder."));
 (offers.data||[]).forEach(offer=>{
  const card=document.createElement("article");card.className="market-offer-card";
  const title=text("strong","",offer.trade_role==="proposer"?"Your offer to "+offer.other_reader_name:offer.other_reader_name+" sent you an offer");
  const status=text("span","market-offer-status",String(offer.status).toUpperCase()+" · REVISION "+offer.current_revision);
  card.append(title,status);
  const terms=text("p","marketplace-trading-copy","Proposer pays "+formatXanth(offer.proposer_pays_cents)+" · Recipient pays "+formatXanth(offer.recipient_pays_cents));
  card.append(terms);
  const itemSummary=(offer.items||[]).map(x=>(x.owner_side==="proposer"?"Proposer gives: ":"Recipient gives: ")+x.card_number+" · "+x.card_name).join(" | ");
  card.append(text("p","market-offer-items",itemSummary||"Xanth-only offer"));
  const history=offer.history||[];
  if(history.length){const hist=document.createElement("details");const summary=text("summary","","OFFER HISTORY ("+history.length+")");hist.append(summary);history.forEach(h=>{const p=text("p","market-offer-history-line","Revision "+h.revision+" · "+(h.sender_user_id===offer.other_reader_id?offer.other_reader_name:"You")+" · "+formatXanth(h.proposer_pays_cents)+" from proposer / "+formatXanth(h.recipient_pays_cents)+" from recipient"+(h.message?" · "+h.message:""));hist.append(p);});card.append(hist);}
  if(offer.status==="pending"){
   const myTurn=(offer.current_revision%2===1&&offer.trade_role==="recipient")||(offer.current_revision%2===0&&offer.trade_role==="proposer");
   const actions=document.createElement("div");actions.className="market-offer-actions";
   if(myTurn){
    actions.append(marketButton("ACCEPT",async()=>{const result=await client.rpc("respond_to_reader_market_offer",{p_offer_id:offer.offer_id,p_accept:true});$("marketListingStatus").textContent=result.error?.message||"Offer accepted. Cards and Xanth have been transferred.";await loadTradingMarket();},false));
    actions.append(marketButton("DECLINE",async()=>{const result=await client.rpc("respond_to_reader_market_offer",{p_offer_id:offer.offer_id,p_accept:false});$("marketListingStatus").textContent=result.error?.message||"Offer declined.";await loadTradingMarket();},true));
    const counter=document.createElement("div");counter.className="market-counter-form";
    const proposerCash=document.createElement("input");proposerCash.type="number";proposerCash.min="0";proposerCash.step="0.01";proposerCash.value=(Number(offer.proposer_pays_cents)/100).toFixed(2);
    const recipientCash=document.createElement("input");recipientCash.type="number";recipientCash.min="0";recipientCash.step="0.01";recipientCash.value=(Number(offer.recipient_pays_cents)/100).toFixed(2);
    counter.append(text("label","","Proposer pays Xanth"),proposerCash,text("label","","Recipient pays Xanth"),recipientCash);
    const counterButton=marketButton("COUNTER-OFFER",async()=>{counterButton.disabled=true;const proposerIds=(offer.items||[]).filter(x=>x.owner_side==="proposer").map(x=>x.copy_id),recipientIds=(offer.items||[]).filter(x=>x.owner_side==="recipient").map(x=>x.copy_id);const result=await client.rpc("counter_reader_market_offer",{p_offer_id:offer.offer_id,p_proposer_copy_ids:proposerIds,p_recipient_copy_ids:recipientIds,p_proposer_pays_cents:Math.round(Number(proposerCash.value||0)*100),p_recipient_pays_cents:Math.round(Number(recipientCash.value||0)*100),p_message:null});$("marketListingStatus").textContent=result.error?.message||"Counter-offer sent.";await loadTradingMarket();});counter.append(counterButton);actions.append(counter);
   }else if(offer.trade_role==="proposer")actions.append(marketButton("CANCEL OFFER",async()=>{const result=await client.rpc("cancel_reader_market_offer",{p_offer_id:offer.offer_id});$("marketListingStatus").textContent=result.error?.message||"Offer cancelled.";await loadTradingMarket();},true));
   card.append(actions);
  }
  offersRoot.append(card);
 });
}
async function createMarketListing(){
 const copyId=$("marketListCopy")?.value,price=Math.round(Number($("marketListPrice")?.value||0)*100),status=$("marketListingStatus");
 if(!copyId){status.textContent="Choose a card copy to list.";return;}
 if(!Number.isSafeInteger(price)||price<1){status.textContent="Enter a valid price greater than zero.";return;}
 const button=$("marketCreateListing");button.disabled=true;button.textContent="CREATING LISTING…";
 const result=await client.rpc("create_market_card_listing",{p_copy_id:copyId,p_price_cents:price});
 status.textContent=result.error?.message||"Your card is now listed for sale.";
 button.textContent="LIST CARD FOR SALE";button.disabled=false;
 if(!result.error){$("marketListPrice").value="";await loadTradingMarket();const collection=await client.rpc("get_my_card_collection");if(!collection.error){owned=collection.data||[];renderCollection();}}
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
 if(!session){$("sessionMessage").textContent="Sign in to view your personal collection and browse the Trading Post.";const sign=text("a","eden-primary-link","SIGN IN TO EXPLORE");sign.href="../books/trials-of-eden/account.html";$("sessionMessage").append(" ",sign);$("collectionGrid").replaceChildren(text("div","eden-empty","Your collection will appear here once you sign in."));$("collectionSummary").textContent="SIGN IN REQUIRED";$("readerDirectory").replaceChildren(text("div","eden-empty","Sign in to browse public reader collections."));$("dailyShopGrid").replaceChildren(text("div","eden-empty","Sign in to view today’s Xanth exchange."));$("xanthBalance").textContent="SIGN IN REQUIRED";}
 else{
  $("sessionMessage").textContent="Welcome to your archive. Your collection and reader directory are ready.";
  await loadDuplicateSaleSettings();
  const [collectionResult,readerResult]=await Promise.all([client.rpc("get_my_card_collection"),client.rpc("get_public_card_collections")]);
  if(collectionResult.error){$("collectionGrid").replaceChildren(text("div","eden-empty","Your collection is temporarily unavailable. Please check that the Stage 3 binder migration has been installed."));$("collectionSummary").textContent="COLLECTION UNAVAILABLE";}
  else{owned=collectionResult.data||[];renderCollection();}
  if(readerResult.error){console.error(readerResult.error);$("readerDirectory").replaceChildren(text("div","eden-empty","The reader directory is unavailable. Please check the Trading Post database setup."));}
  else await renderReaders(readerResult.data||[]);
  await Promise.all([loadMarketplace(),loadTradingMarket()]);
 }
}
document.addEventListener("DOMContentLoaded",async()=>{
 $("saveDuplicateSettings")?.addEventListener("click",()=>saveDuplicateSaleSettings());
 $("marketCreateListing")?.addEventListener("click",createMarketListing);
 $("refreshReaderMarket")?.addEventListener("click",loadTradingMarket);
 $("refreshMarketOffers")?.addEventListener("click",loadTradingMarket);
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