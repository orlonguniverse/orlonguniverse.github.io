(()=>{"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co",KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);let client,user,cards=[],categories=[],sets=[],cropImage=null,cropUrl=null,cropZoom=1,cropX=0,cropY=0,pointer=null,croppedBlob=null,currentArtworkUrl="";
const say=(message)=>{const t=$("toast");t.textContent=message;t.classList.add("show");window.setTimeout(()=>t.classList.remove("show"),4200)};
const slug=s=>String(s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function showTab(name){document.querySelectorAll(".mod-tabs button").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));document.querySelectorAll(".mod-panel").forEach(p=>p.classList.toggle("active",p.id===name+"Panel"))}
function fillSelect(el,items,labelKey,valueKey,first){el.replaceChildren();if(first){const o=document.createElement("option");o.value="";o.textContent=first;el.append(o)}items.forEach(item=>{const o=document.createElement("option");o.value=item[valueKey];o.textContent=item[labelKey];el.append(o)})}
async function init(){client=window.supabase.createClient(URL_BASE,KEY);const {data,error}=await client.auth.getSession();if(error||!data.session){$("accessDenied").hidden=false;return}user=data.session.user;const {data:ok,error:roleError}=await client.rpc("is_reader_moderator");if(roleError||ok!==true){$("accessDenied").hidden=false;return}$("moderatorApp").hidden=false;window.updateOrlongAccountLabel?.(user);await loadStudio();bind()}
async function loadStudio(){const {data,error}=await client.rpc("get_moderator_card_studio");if(error)throw error;categories=data.categories||[];sets=data.sets||[];cards=data.cards||[];fillSelect($("cardCategory"),categories,"label","id");fillSelect($("cardSet"),sets,"title","id","No set");renderList()}
function renderList(){const root=$("cardList"),query=$("cardSearch").value.trim().toLowerCase();root.replaceChildren();const shown=cards.filter(c=>(c.name+" "+c.number+" "+c.id).toLowerCase().includes(query));if(!shown.length){const p=document.createElement("p");p.className="hint";p.textContent="No cards match your search.";root.append(p);return}shown.forEach(c=>{const row=document.createElement("article");row.className="catalogue-card";if(c.artwork_url){const img=document.createElement("img");img.className="catalogue-thumb";img.src=c.artwork_url;img.alt="";row.append(img)}else{const thumb=document.createElement("div");thumb.className="catalogue-thumb";row.append(thumb)}const info=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("small");name.textContent=c.name;meta.textContent=c.number+" · "+c.rarity.toUpperCase()+" · "+(c.active?"ACTIVE":"RETIRED");info.append(name,meta);const edit=document.createElement("button");edit.textContent="EDIT";edit.type="button";edit.addEventListener("click",()=>editCard(c));row.append(info,edit);root.append(row)})}
function editCard(c){$("cardId").value=c.id;$("cardName").value=c.name;$("cardCategory").value=c.category_id;$("cardRarity").value=c.rarity;$("cardSet").value=c.set_id||"";$("cardChapterNumber").value=c.chapter_number??"";$("cardChapter").value=c.unlock_chapter_id||"";$("cardDescription").value=c.description||"";currentArtworkUrl=c.artwork_url||"";croppedBlob=null;$("cardCategory").disabled=true;setPreview();$("saveCardButton").textContent="SAVE CHANGES";$("deleteCardButton").hidden=false;window.scrollTo({top:0,behavior:"smooth"})}
function resetForm(){ $("cardForm").reset();$("cardId").value="";$("cardCategory").disabled=false;currentArtworkUrl="";croppedBlob=null;$("saveCardButton").textContent="SAVE CARD";$("deleteCardButton").hidden=true;$("cropArtworkButton").disabled=true;setPreview()}
function setPreview(){const name=$("cardName").value.trim()||"New Collectible",cat=categories.find(c=>c.id===$("cardCategory").value);$("previewName").textContent=name;$("previewDescription").textContent=$("cardDescription").value.trim()||"Your card description will appear here once entered.";$("previewRarity").textContent=$("cardRarity").value.toUpperCase();$("previewCategory").textContent=(cat?.label||"CATEGORY").toUpperCase();$("previewChapter").textContent=$("cardChapterNumber").value?"CH. "+$("cardChapterNumber").value:"CH. —";$("cardPreview").className="card-preview rarity-"+$("cardRarity").value;$("previewNumber").textContent=$("cardId").value?cards.find(c=>c.id===$("cardId").value)?.number||"EDITING":"AUTO NUMBER";const art=$("previewArt");art.replaceChildren();if(croppedBlob){const img=document.createElement("img");img.src=URL.createObjectURL(croppedBlob);art.append(img)}else if(currentArtworkUrl){const img=document.createElement("img");img.src=currentArtworkUrl;art.append(img)}else{const span=document.createElement("span");span.textContent="ARTWORK PREVIEW";art.append(span)}}
function renderCrop(){const canvas=$("cropCanvas"),ctx=canvas.getContext("2d");if(!cropImage)return;const aspect=canvas.width/canvas.height;const sourceRatio=cropImage.naturalWidth/cropImage.naturalHeight;let baseW,baseH;if(sourceRatio>aspect){baseH=cropImage.naturalHeight;baseW=baseH*aspect}else{baseW=cropImage.naturalWidth;baseH=baseW/aspect}const w=baseW/cropZoom,h=baseH/cropZoom;cropX=Math.max(w/2,Math.min(cropImage.naturalWidth-w/2,cropX));cropY=Math.max(h/2,Math.min(cropImage.naturalHeight-h/2,cropY));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(cropImage,cropX-w/2,cropY-h/2,w,h,0,0,canvas.width,canvas.height)}
function openCrop(){const file=$("cardArtwork").files?.[0];if(!file)return;if(file.size>12*1024*1024){$("uploadStatus").textContent="Please choose an image smaller than 12 MB.";return}if(cropUrl)URL.revokeObjectURL(cropUrl);cropUrl=URL.createObjectURL(file);cropImage=new Image();cropImage.onload=()=>{cropX=cropImage.naturalWidth/2;cropY=cropImage.naturalHeight/2;cropZoom=1;$("cropZoom").value="1";renderCrop();$("cropDialog").showModal()};cropImage.onerror=()=>$("uploadStatus").textContent="That image could not be opened.";cropImage.src=cropUrl}
async function applyCrop(){const canvas=$("cropCanvas");const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.9));if(!blob){say("The crop could not be prepared. Please try another image.");return}croppedBlob=blob;currentArtworkUrl="";$("cropDialog").close();$("uploadStatus").textContent="Artwork crop ready. It will upload when you save the card.";setPreview()}
async function saveCard(event){event.preventDefault();const name=$("cardName").value.trim();if(!name){$("formMessage").textContent="Enter a card name.";return}const button=$("saveCardButton");button.disabled=true;button.textContent="SAVING CARD…";$("formMessage").textContent="";try{let artwork=currentArtworkUrl;if(croppedBlob){const path=slug(name)+"-"+Date.now()+".webp";const {error:uploadError}=await client.storage.from("orlong-card-artwork").upload(path,croppedBlob,{contentType:"image/webp",upsert:false,cacheControl:"31536000"});if(uploadError)throw uploadError;artwork=client.storage.from("orlong-card-artwork").getPublicUrl(path).data.publicUrl}
const {data,error}=await client.rpc("save_moderator_card",{p_card_id:$("cardId").value||null,p_name:name,p_category_id:$("cardCategory").value,p_rarity:$("cardRarity").value,p_set_id:$("cardSet").value||null,p_unlock_chapter_id:$("cardChapter").value.trim()||null,p_chapter_number:$("cardChapterNumber").value?Number($("cardChapterNumber").value):null,p_description:$("cardDescription").value.trim()||null,p_artwork_url:artwork||null,p_active:true});if(error)throw error;$("formMessage").textContent=(data.created?"Created ":"Updated ")+data.card_number+" successfully.";currentArtworkUrl=artwork;croppedBlob=null;await loadStudio();$("cardId").value=data.card_id;$("saveCardButton").textContent="SAVE CHANGES";$("deleteCardButton").hidden=false;setPreview();say(data.card_number+" saved to the catalogue.");}catch(error){console.error(error);$("formMessage").textContent=error.message||"Could not save this card. Check the database migration."; }finally{button.disabled=false;if(button.textContent==="SAVING CARD…")button.textContent=$("cardId").value?"SAVE CHANGES":"SAVE CARD"}}
async function deleteCard(){const id=$("cardId").value;if(!id)return;const card=cards.find(c=>c.id===id);const label=card?.number||id;if(!window.confirm("Permanently delete "+label+"? This removes the card from the catalogue, every reader's binder, reward records and related trade offers. This cannot be undone."))return;const button=$("deleteCardButton");button.disabled=true;button.textContent="DELETING…";try{const {data,error}=await client.rpc("delete_moderator_card",{p_card_id:id});if(error)throw error;let artworkCleanupFailed=false;const url=data?.artwork_url;if(url){try{const marker="/storage/v1/object/public/orlong-card-artwork/";const path=decodeURIComponent(new URL(url).pathname.split(marker)[1]||"");if(path){const {error:storageError}=await client.storage.from("orlong-card-artwork").remove([path]);if(storageError)artworkCleanupFailed=true;}}catch(_){artworkCleanupFailed=true;}}resetForm();await loadStudio();$("formMessage").textContent=label+" permanently deleted.";say(artworkCleanupFailed?label+" deleted; its unused artwork file may need manual cleanup.":label+" deleted from the catalogue.");}catch(error){console.error(error);$("formMessage").textContent=error.message||"Could not delete this card.";say("Card deletion failed.");}finally{button.disabled=false;button.textContent="DELETE CARD"}}

async function searchResetReaders(){
 const query=$("readerResetSearch").value.trim(),root=$("readerResetResults");
 if(query.length<2){root.textContent="Enter at least two characters to search.";return}
 root.textContent="Searching…";
 const {data,error}=await client.rpc("moderator_search_reader_accounts",{search_text:query});
 if(error){root.textContent=error.message;return}
 root.replaceChildren();
 if(!data?.length){root.textContent="No matching reader accounts found.";return}
 data.forEach(reader=>{
  const card=document.createElement("article");card.className="reader-reset-card";
  if(reader.avatar_url){const img=document.createElement("img");img.src=reader.avatar_url;img.alt="";img.className="reader-reset-avatar";img.onerror=()=>img.remove();card.append(img)}
  const info=document.createElement("div");info.className="reader-reset-info";
  const name=document.createElement("strong");name.textContent=reader.display_name||"Reader";
  const email=document.createElement("span");email.textContent=reader.email||"No email available";
  const meta=document.createElement("small");meta.textContent="Joined "+new Date(reader.created_at).toLocaleDateString()+" · "+(reader.is_moderator?"MODERATOR":"READER");
  info.append(name,email,meta);
  const actions=document.createElement("div");actions.className="reader-reset-actions";
  const collection=document.createElement("button");collection.type="button";collection.className="secondary";collection.textContent="RESET COLLECTION";collection.addEventListener("click",()=>performReaderReset(reader,"collection"));
  const factory=document.createElement("button");factory.type="button";factory.className="danger";factory.textContent="FACTORY RESET";factory.addEventListener("click",()=>performReaderReset(reader,"factory"));
  actions.append(collection,factory);card.append(info,actions);root.append(card);
 });
}
async function performReaderReset(reader,mode){
 if(reader.user_id===user.id){say("You cannot reset your own moderator account.");return}
 const label=reader.email||reader.display_name||reader.user_id;
 if(mode==="collection"){
  if(!window.confirm("RESET COLLECTION for "+label+"?\n\nAll cards, reward claims and outstanding trade offers will be removed. Reading progress and account access will remain."))return;
 }else{
  const typed=window.prompt("FACTORY RESET "+label+"?\n\nThis permanently removes the reader's activity, comments, quiz attempts, achievements, cards, Early Access progress, Founding Reader status and access grants. Moderator privileges are revoked. Login and profile picture are preserved.\n\nType FACTORY RESET to continue.");
  if(typed!=="FACTORY RESET")return;
 }
 const buttons=$("readerResetResults").querySelectorAll("button");buttons.forEach(b=>b.disabled=true);
 try{
  const {data,error}=await client.rpc("moderator_reset_reader_account",{target_user_id:reader.user_id,reset_mode:mode});
  if(error)throw error;
  say((mode==="factory"?"Factory reset":"Collection reset")+" completed for "+label+".");
  $("readerResetResults").replaceChildren();
  const message=document.createElement("p");message.className="hint";message.textContent="Reset completed successfully. Search again to verify the account's new state."; $("readerResetResults").append(message);
  await loadReaderResetLog();
 }catch(error){console.error(error);say("Reset failed: "+(error.message||"Please check the reset migration."));buttons.forEach(b=>b.disabled=false)}
}
async function loadReaderResetLog(){
 const root=$("readerResetLog");root.textContent="Loading reset history…";
 const {data,error}=await client.rpc("moderator_get_reader_reset_log");
 if(error){root.textContent=error.message;return}
 root.replaceChildren();
 if(!data?.length){root.textContent="No reader resets have been performed yet.";return}
 data.forEach(entry=>{
  const row=document.createElement("article");row.className="reset-log-row";
  const title=document.createElement("strong");title.textContent=(entry.reset_mode==="factory"?"FACTORY RESET":"COLLECTION RESET")+" · "+(entry.target_email||entry.target_display_name||"Reader");
  const meta=document.createElement("small");meta.textContent=new Date(entry.performed_at).toLocaleString()+" · Moderator: "+(entry.moderator_email||"Unavailable");
  const counts=document.createElement("p");counts.textContent=Object.entries(entry.deleted_records||{}).map(([k,v])=>k.replaceAll("_"," ")+": "+v).join(" · ");
  row.append(title,meta,counts);root.append(row);
 });
}

function brisbaneDate(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Australia/Brisbane",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
async function loadXanthShopAdmin(){
 const date=$("shopAdminDate").value||brisbaneDate();$("shopAdminDate").value=date;
 const root=$("shopAdminSlots");root.textContent="Loading shop rotation…";
 const {data,error}=await client.rpc("moderator_get_xanth_shop",{p_shop_date:date});
 if(error){root.textContent=error.message;$("shopAdminMessage").textContent="Could not load the Xanth shop. Check the Stage 7A migration.";return}
 const slots=data?.slots||[],eligible=data?.eligible_cards||[];
 fillSelect($("shopCardSelect"),eligible.map(card=>({id:card.card_id,label:card.card_number+" · "+card.name+" · "+card.rarity.toUpperCase()})),"label","id","Choose a card");
 root.replaceChildren();
 if(!slots.length){root.append(textNode("No featured cards are available for this date."));}
 slots.forEach(slot=>{
  const row=document.createElement("article");row.className="shop-admin-slot";
  const heading=document.createElement("strong");heading.textContent="SLOT "+slot.slot_number+" · "+slot.card_number+" — "+slot.name;
  const meta=document.createElement("small");meta.textContent=slot.rarity.toUpperCase()+" · XƵ"+(Number(slot.price_cents)/100).toFixed(2)+" · "+slot.selection_mode.toUpperCase();
  row.append(heading,meta);root.append(row);
 });
 $("shopAdminMessage").textContent=eligible.length+" eligible released cards available for manual selection.";
}
function textNode(value){const p=document.createElement("p");p.className="hint";p.textContent=value;return p}
async function saveXanthShopOverride(event){
 event.preventDefault();
 const date=$("shopAdminDate").value||brisbaneDate(),slot=Number($("shopSlotNumber").value),card=$("shopCardSelect").value,raw=$("shopCardPrice").value.trim();
 if(!card){$("shopAdminMessage").textContent="Choose a replacement card.";return}
 let price=null;
 if(raw!==""){const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>100000000){$("shopAdminMessage").textContent="Enter a valid price greater than zero.";return}price=Math.round(amount*100);}
 const button=$("saveShopOverride");button.disabled=true;button.textContent="SAVING…";
 try{
  const {error}=await client.rpc("moderator_set_xanth_shop_slot",{p_shop_date:date,p_slot_number:slot,p_card_id:card,p_price_cents:price});
  if(error)throw error;
  $("shopCardPrice").value="";
  $("shopAdminMessage").textContent="Slot "+slot+" updated. The manual selection is locked for this shop date.";
  await loadXanthShopAdmin();
  say("Xanth daily shop override saved.");
 }catch(error){console.error(error);$("shopAdminMessage").textContent=error.message||"Could not save the shop override.";}
 finally{button.disabled=false;button.textContent="SAVE SLOT OVERRIDE";}
}
function bind(){document.querySelectorAll(".mod-tabs button").forEach(b=>b.addEventListener("click",()=>{showTab(b.dataset.tab);if(b.dataset.tab==="shop"&&!$("shopAdminDate").value)loadXanthShopAdmin().catch(e=>say(e.message));}));$("shopAdminDate").value=brisbaneDate();$("loadShopAdmin").addEventListener("click",()=>loadXanthShopAdmin().catch(e=>say(e.message)));$("shopOverrideForm").addEventListener("submit",saveXanthShopOverride);$("newCardButton").addEventListener("click",()=>{resetForm();window.scrollTo({top:0,behavior:"smooth"})});$("resetCardButton").addEventListener("click",resetForm);$("cardSearch").addEventListener("input",renderList);["cardName","cardDescription","cardCategory","cardRarity","cardChapterNumber"].forEach(id=>$(id).addEventListener("input",setPreview));$("cardCategory").addEventListener("change",setPreview);$("cardRarity").addEventListener("change",setPreview);$("cardArtwork").addEventListener("change",()=>{$("cropArtworkButton").disabled=!$("cardArtwork").files.length;$("uploadStatus").textContent=$("cardArtwork").files.length?"Image selected. Adjust the crop before saving.":"";if($("cardArtwork").files.length)openCrop()});$("cropArtworkButton").addEventListener("click",openCrop);$("closeCrop").addEventListener("click",()=>$("cropDialog").close());$("applyCrop").addEventListener("click",applyCrop);$("cropZoom").addEventListener("input",e=>{cropZoom=Number(e.target.value);renderCrop()});const canvas=$("cropCanvas");canvas.addEventListener("pointerdown",e=>{if(!cropImage)return;pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener("pointermove",e=>{if(!pointer||!cropImage)return;const rect=canvas.getBoundingClientRect(),aspect=canvas.width/canvas.height,sourceRatio=cropImage.naturalWidth/cropImage.naturalHeight;let bw,bh;if(sourceRatio>aspect){bh=cropImage.naturalHeight;bw=bh*aspect}else{bw=cropImage.naturalWidth;bh=bw/aspect}const w=bw/cropZoom,h=bh/cropZoom;cropX-=(e.clientX-pointer.x)*w/rect.width;cropY-=(e.clientY-pointer.y)*h/rect.height;pointer={x:e.clientX,y:e.clientY};renderCrop()});["pointerup","pointercancel","lostpointercapture"].forEach(n=>canvas.addEventListener(n,()=>pointer=null));$("cardForm").addEventListener("submit",saveCard);$("deleteCardButton").addEventListener("click",deleteCard);$("readerResetSearchButton").addEventListener("click",()=>searchResetReaders().catch(e=>say(e.message)));$("readerResetSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchResetReaders().catch(err=>say(err.message))}});$("refreshResetLog").addEventListener("click",()=>loadReaderResetLog().catch(e=>say(e.message)));loadReaderResetLog().catch(e=>console.warn(e));setPreview()}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error(error);$("accessDenied").hidden=false}));
})();