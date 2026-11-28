(()=>{"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co",KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=id=>document.getElementById(id);let client,user,cards=[],categories=[],sets=[],categoryGameTemplates=new Map(),activeTemplateCategory="",cropImage=null,cropUrl=null,cropZoom=1,cropX=0,cropY=0,pointer=null,croppedBlob=null,currentArtworkUrl="";
const say=(message)=>{const t=$("toast");t.textContent=message;t.classList.add("show");window.setTimeout(()=>t.classList.remove("show"),4200)};
const slug=s=>String(s||"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function showTab(name,updateUrl=false){const button=document.querySelector('.mod-tabs button[data-tab="'+name+'"]'),panel=$(name+"Panel");if(!button||!panel)return false;document.querySelectorAll(".mod-tabs button").forEach(b=>{const active=b===button;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active))});document.querySelectorAll(".mod-panel").forEach(p=>p.classList.toggle("active",p===panel));if(updateUrl&&location.hash!=="#tab-"+name)history.pushState(null,"","#tab-"+name);return true}
function fillSelect(el,items,labelKey,valueKey,first){el.replaceChildren();if(first){const o=document.createElement("option");o.value="";o.textContent=first;el.append(o)}items.forEach(item=>{const o=document.createElement("option");o.value=item[valueKey];o.textContent=item[labelKey];el.append(o)})}
async function init(){client=window.supabase.createClient(URL_BASE,KEY);const {data,error}=await client.auth.getSession();if(error||!data.session){$("accessDenied").hidden=false;return}user=data.session.user;const {data:ok,error:roleError}=await client.rpc("is_reader_moderator");if(roleError||ok!==true){$("accessDenied").hidden=false;return}$("moderatorApp").hidden=false;window.updateOrlongAccountLabel?.(user);bind();window.addEventListener("orlongCategoriesUpdated",()=>loadStudio().catch(error=>say(error.message||"Card categories could not refresh.")));try{await loadStudio()}catch(loadError){console.error("Card Studio could not load:",loadError);say("Moderator tools are available, but the Card Studio could not load its catalogue: "+(loadError.message||"database error"));}}
async function loadStudio(){const {data,error}=await client.rpc("get_moderator_card_studio");if(error)throw error;categories=data.categories||[];sets=data.sets||[];cards=data.cards||[];const meta=await client.rpc("get_moderator_card_release_metadata");if(meta.error)throw meta.error;const byId=new Map((meta.data||[]).map(item=>[item.card_id,item]));cards=cards.map(card=>({...card,release_metadata:byId.get(card.id)||null}));fillSelect($("cardCategory"),categories,"label","id");fillSelect($("cardSet"),sets,"title","id","No set");await loadCategoryGameTemplates();renderList()}
function renderList(){
 const root=$("cardList"),query=$("cardSearch").value.trim().toLowerCase();
 root.replaceChildren();
 const shown=cards.filter(c=>(c.name+" "+c.number+" "+c.id).toLowerCase().includes(query));
 if(!shown.length){const p=document.createElement("p");p.className="hint";p.textContent="No cards match your search.";root.append(p);return;}
 const groups=new Map();
 categories.forEach(category=>groups.set(category.id,{label:category.label,cards:[]}));
 shown.forEach(card=>{
  if(!groups.has(card.category_id))groups.set(card.category_id,{label:card.category_id,cards:[]});
  groups.get(card.category_id).cards.push(card);
 });
 [...groups.entries()].forEach(([categoryId,group])=>{
  const details=document.createElement("details");details.className="card-category-group";
  details.open=Boolean(query)||group.cards.length>0;
  const summary=document.createElement("summary");summary.className="card-category-heading";
  const label=document.createElement("strong");label.textContent=group.label;
  const count=document.createElement("span");count.textContent=group.cards.length+" CARD"+(group.cards.length===1?"":"S");
  summary.append(label,count);details.append(summary);
  const list=document.createElement("div");list.className="card-list";
  group.cards.forEach(card=>{
   const row=document.createElement("article");row.className="catalogue-card";
   if(card.artwork_url){const img=document.createElement("img");img.className="catalogue-thumb";img.src=card.artwork_url;img.alt="";row.append(img);}
   else{const thumb=document.createElement("div");thumb.className="catalogue-thumb";row.append(thumb);}
   const info=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("small");
   name.textContent=card.name;meta.textContent=card.number+" · "+card.rarity.toUpperCase()+" · "+String(card.release_metadata?.release_type||"standard").replaceAll("_"," ").toUpperCase()+" · "+(card.active?"ACTIVE":"RETIRED");info.append(name,meta);
   const edit=document.createElement("button");edit.textContent="EDIT";edit.type="button";edit.addEventListener("click",()=>editCard(card));
   row.append(info,edit);list.append(row);
  });
  details.append(list);root.append(details);
 });
}
function editCard(c){$("cardId").value=c.id;$("cardName").value=c.name;$("cardCategory").value=c.category_id;$("cardRarity").value=c.rarity;$("cardSet").value=c.set_id||"";$("cardChapterNumber").value=c.chapter_number??"";$("cardChapter").value=c.unlock_chapter_id||"";$("cardAccessKey").value=c.required_access_key||"";$("cardDescription").value=c.description||"";const m=c.release_metadata||{};$("cardReleaseType").value=m.release_type||"standard";$("cardReleaseLabel").value=m.release_label||"";$("cardAvailableFrom").value=m.available_from?new Date(m.available_from).toISOString().slice(0,16):"";$("cardAvailableUntil").value=m.available_until?new Date(m.available_until).toISOString().slice(0,16):"";$("cardLimitedQuantity").value=m.limited_quantity??"";$("cardAcquisitionSource").value=m.acquisition_source||"";$("gameTemplateCategory").value=c.category_id;activeTemplateCategory=c.category_id;renderGameBuilder(categoryGameTemplates.get(c.category_id)||{});syncReleaseFields();currentArtworkUrl=c.artwork_url||"";croppedBlob=null;$("cardCategory").disabled=true;setPreview();$("saveCardButton").textContent="SAVE CHANGES";$("deleteCardButton").hidden=false;window.scrollTo({top:0,behavior:"smooth"})}
function resetForm(){ $("cardForm").reset();$("cardId").value="";$("cardAccessKey").value="";$("cardReleaseType").value="standard";renderGameBuilder(categoryGameTemplates.get($("cardCategory").value)||{});$("cardCategory").disabled=false;currentArtworkUrl="";croppedBlob=null;$("saveCardButton").textContent="SAVE CARD";$("deleteCardButton").hidden=true;$("cropArtworkButton").disabled=true;syncReleaseFields();setPreview()}

function defaultCategoryGameTemplate(label){
 const n=String(label||"").toLowerCase();
 const base={abilities:[]};
 const ability=(name,type,description)=>({name,type,description});
 if(/character|person|protagonist|antagonist|human/.test(n))return {role:"",species:"Human",faction:"",origin:"",alignment:"",age:null,health:100,stamina:100,strength:10,agility:10,intelligence:10,defence:10,speed:10,rarity_tier:"",abilities:[ability("Signature Ability","active","The character's defining ability."),ability("Passive Trait","passive","A persistent advantage or characteristic."),ability("Ultimate Ability","ultimate","A powerful ability with a significant limitation or cooldown.")]};
 if(/creature|animal|beast|monster|species/.test(n))return {species:"",habitat:"",environment:"",size:"",threat_level:"",temperament:"",health:100,attack:10,defence:10,speed:10,agility:10,intelligence:5,element:"",weaknesses:[],resistances:[],abilities:[ability("Primary Attack","active","The creature's main attack."),ability("Instinct","passive","A natural survival trait."),ability("Special Behaviour","special","A distinctive behaviour or effect.")]};
 if(/location|place|region|city|world|environment/.test(n))return {location_type:"",region:"",environment:"",climate:"",terrain:"",population:null,danger_level:"",resources:[],strategic_value:"",travel_difficulty:"",controlling_faction:"",special_effects:[],abilities:[ability("Environmental Effect","passive","A persistent effect of this location."),ability("Hazard or Opportunity","special","A situational hazard, resource or tactical feature.")]};
 if(/organisation|faction|group|company|house|team/.test(n))return {organisation_type:"",alignment:"",influence:10,membership:null,territory:[],resources:[],technology_level:"",threat_level:"",objectives:[],leader:"",allies:[],rivals:[],abilities:[ability("Organisational Strength","passive","A persistent advantage granted by the organisation."),ability("Special Operation","active","An operation or coordinated action.")]};
 if(/technology|weapon|equipment|item|device|tool|artifact/.test(n))return {item_type:"",power_source:"",energy_cost:0,durability:100,range:0,damage:0,defence:0,utility:"",rarity_tier:"",limitations:[],compatible_users:[],abilities:[ability("Primary Function","active","The item's primary use."),ability("Secondary Function","passive","A secondary benefit or system."),ability("Overload / Special Mode","ultimate","A powerful mode with a cost or limitation.")]};
 if(/event|history|era|historical/.test(n))return {event_type:"",era:"",date_or_period:"",location:"",participants:[],cause:"",outcome:"",significance:"",consequences:[],timeline_order:null,abilities:[ability("Historical Impact","passive","A lasting world or gameplay effect."),ability("Scenario Modifier","special","A rule or condition used in future simulations.")]};
 return {record_type:"",classification:"",origin:"",faction:"",rarity_tier:"",power_level:0,threat_level:"",value:0,notes:"",tags:[],abilities:[ability("Primary Effect","active","The main gameplay effect."),ability("Passive Effect","passive","A persistent trait or modifier.")]};
}
async function loadCategoryGameTemplates(){
 const result=await client.rpc("get_moderator_card_category_game_templates");if(result.error)throw result.error;
 categoryGameTemplates=new Map((result.data||[]).map(row=>[row.category_id,row.game_attributes||{}]));
 for(const category of categories){if(!categoryGameTemplates.has(category.id)){const defaults=defaultCategoryGameTemplate(category.label);const seeded=await client.rpc("save_moderator_card_category_game_template",{p_category_id:category.id,p_game_attributes:defaults});if(seeded.error)throw seeded.error;categoryGameTemplates.set(category.id,defaults);}}
 fillSelect($("gameTemplateCategory"),categories,"label","id");const selected=$("cardCategory").value||categories[0]?.id||"";$("gameTemplateCategory").value=selected;activeTemplateCategory=selected;renderGameBuilder(categoryGameTemplates.get(selected)||{});
}
async function saveCategoryGameTemplate(){
 const categoryId=$("gameTemplateCategory").value;if(!categoryId){$("gameTemplateStatus").textContent="Choose a category first.";return;}
 const button=$("saveCategoryGameTemplate");button.disabled=true;button.textContent="UPDATING EVERY CARD…";$("gameTemplateStatus").textContent="";
 try{const attributes=readGameBuilder();const {data,error}=await client.rpc("save_moderator_card_category_game_template",{p_category_id:categoryId,p_game_attributes:attributes});if(error)throw error;categoryGameTemplates.set(categoryId,attributes);$("gameTemplateStatus").textContent="Saved. "+(data?.updated_cards??"All")+" existing cards in this category now share this template. New cards will inherit it automatically.";say("Category game template updated across the catalogue.");}
 catch(error){$("gameTemplateStatus").textContent=error.message||"The category template could not be saved.";}
 finally{button.disabled=false;button.textContent="SAVE TEMPLATE FOR EVERY CARD IN THIS CATEGORY";}
}
function createGameRow(className,fields,values={}){
 const row=document.createElement("div");row.className=className;
 fields.forEach(field=>{const input=document.createElement(field.multiline?"textarea":"input");if(field.multiline){input.rows=2}else input.type=field.type||"text";input.placeholder=field.placeholder;input.value=values[field.key]??"";input.dataset.gameField=field.key;input.setAttribute("aria-label",field.label);row.append(input);});
 const remove=document.createElement("button");remove.type="button";remove.className="danger small";remove.textContent="REMOVE";remove.addEventListener("click",()=>row.remove());row.append(remove);return row;
}
function addGameAttributeRow(key="",value=""){const row=createGameRow("game-attribute-row",[{key:"key",label:"Attribute name",placeholder:"e.g. power"},{key:"value",label:"Attribute value",placeholder:"e.g. 5"}],{key,value});$("gameAttributeRows").append(row);}
function addGameAbilityRow(ability={}){const row=createGameRow("game-ability-row",[{key:"name",label:"Ability name",placeholder:"e.g. Energy Harnessing"},{key:"type",label:"Ability type",placeholder:"e.g. offensive / passive"},{key:"power",label:"Power value",placeholder:"Optional value",type:"number"},{key:"description",label:"Ability description",placeholder:"What does this ability do?",multiline:true}],ability);$("gameAbilityRows").append(row);}
function readGameBuilder(){
 const attributes={};$("gameAttributeRows").querySelectorAll(".game-attribute-row").forEach(row=>{const key=row.querySelector('[data-game-field="key"]').value.trim();const raw=row.querySelector('[data-game-field="value"]').value.trim();if(!key)return;if(Object.hasOwn(attributes,key))throw new Error("Attribute names must be unique: "+key);let value=raw;try{value=JSON.parse(raw)}catch(_){}attributes[key]=value;});
 const abilities=[...$("gameAbilityRows").querySelectorAll(".game-ability-row")].map(row=>{const get=k=>row.querySelector('[data-game-field="'+k+'"]').value.trim();const ability={name:get("name"),type:get("type")||"special",description:get("description")};const power=get("power");if(power!=="")ability.power=Number(power);return ability;}).filter(a=>a.name);
 if(abilities.length)attributes.abilities=abilities;return attributes;
}
function renderGameBuilder(data={}){
 $("gameAttributeRows").replaceChildren();$("gameAbilityRows").replaceChildren();
 const attributes={...(data||{})};const abilities=Array.isArray(attributes.abilities)?attributes.abilities:[];delete attributes.abilities;
 Object.entries(attributes).forEach(([key,value])=>addGameAttributeRow(key,typeof value==="string"?value:JSON.stringify(value)));
 abilities.forEach(addGameAbilityRow);
 if(!$("gameAttributeRows").children.length)addGameAttributeRow();
 if(!$("gameAbilityRows").children.length)addGameAbilityRow();
}
function syncReleaseFields(){const special=$("cardReleaseType").value!=="standard";$("cardChapterNumber").disabled=special;$("cardChapter").disabled=special;if(special){$("cardChapterNumber").value="";$("cardChapter").value="";}const hint=$("cardChapter").closest("label");if(hint)hint.classList.toggle("is-release-independent",special);}
function setPreview(){const name=$("cardName").value.trim()||"New Collectible",cat=categories.find(c=>c.id===$("cardCategory").value);$("previewName").textContent=name;$("previewDescription").textContent=$("cardDescription").value.trim()||"Your card description will appear here once entered.";$("previewRarity").textContent=$("cardRarity").value.toUpperCase();$("previewCategory").textContent=(cat?.label||"CATEGORY").toUpperCase();$("previewChapter").textContent=$("cardChapterNumber").value?"CH. "+$("cardChapterNumber").value:"CH. —";$("cardPreview").className="card-preview rarity-"+$("cardRarity").value;$("previewNumber").textContent=$("cardId").value?cards.find(c=>c.id===$("cardId").value)?.number||"EDITING":"AUTO NUMBER";const art=$("previewArt");art.replaceChildren();if(croppedBlob){const img=document.createElement("img");img.src=URL.createObjectURL(croppedBlob);art.append(img)}else if(currentArtworkUrl){const img=document.createElement("img");img.src=currentArtworkUrl;art.append(img)}else{const span=document.createElement("span");span.textContent="ARTWORK PREVIEW";art.append(span)}}
function renderCrop(){const canvas=$("cropCanvas"),ctx=canvas.getContext("2d");if(!cropImage)return;const aspect=canvas.width/canvas.height;const sourceRatio=cropImage.naturalWidth/cropImage.naturalHeight;let baseW,baseH;if(sourceRatio>aspect){baseH=cropImage.naturalHeight;baseW=baseH*aspect}else{baseW=cropImage.naturalWidth;baseH=baseW/aspect}const w=baseW/cropZoom,h=baseH/cropZoom;cropX=Math.max(w/2,Math.min(cropImage.naturalWidth-w/2,cropX));cropY=Math.max(h/2,Math.min(cropImage.naturalHeight-h/2,cropY));ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(cropImage,cropX-w/2,cropY-h/2,w,h,0,0,canvas.width,canvas.height)}
function openCrop(){const file=$("cardArtwork").files?.[0];if(!file)return;if(file.size>12*1024*1024){$("uploadStatus").textContent="Please choose an image smaller than 12 MB.";return}if(cropUrl)URL.revokeObjectURL(cropUrl);cropUrl=URL.createObjectURL(file);cropImage=new Image();cropImage.onload=()=>{cropX=cropImage.naturalWidth/2;cropY=cropImage.naturalHeight/2;cropZoom=1;$("cropZoom").value="1";renderCrop();$("cropDialog").showModal()};cropImage.onerror=()=>$("uploadStatus").textContent="That image could not be opened.";cropImage.src=cropUrl}
async function applyCrop(){const canvas=$("cropCanvas");const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",.9));if(!blob){say("The crop could not be prepared. Please try another image.");return}croppedBlob=blob;currentArtworkUrl="";$("cropDialog").close();$("uploadStatus").textContent="Artwork crop ready. It will upload when you save the card.";setPreview()}
async function saveCard(event){event.preventDefault();const name=$("cardName").value.trim();if(!name){$("formMessage").textContent="Enter a card name.";return}if($("cardReleaseType").value==="standard"&&!$("cardChapter").value.trim()){$("formMessage").textContent="Standard cards need a chapter association. Choose a special release type if this card should exist independently of a chapter.";return}if($("cardLimitedQuantity").value&&(!Number.isInteger(Number($("cardLimitedQuantity").value))||Number($("cardLimitedQuantity").value)<1)){$("formMessage").textContent="Limited quantity must be a whole number greater than zero.";return}if($("cardAvailableFrom").value&&$("cardAvailableUntil").value&&new Date($("cardAvailableUntil").value)<=new Date($("cardAvailableFrom").value)){$("formMessage").textContent="The release end must be later than the release start.";return}const button=$("saveCardButton");button.disabled=true;button.textContent="SAVING CARD…";$("formMessage").textContent="";try{let artwork=currentArtworkUrl;if(croppedBlob){const path=slug(name)+"-"+Date.now()+".webp";const {error:uploadError}=await client.storage.from("orlong-card-artwork").upload(path,croppedBlob,{contentType:"image/webp",upsert:false,cacheControl:"31536000"});if(uploadError)throw uploadError;artwork=client.storage.from("orlong-card-artwork").getPublicUrl(path).data.publicUrl}
const {data,error}=await client.rpc("save_moderator_card",{p_card_id:$("cardId").value||null,p_name:name,p_category_id:$("cardCategory").value,p_rarity:$("cardRarity").value,p_set_id:$("cardSet").value||null,p_unlock_chapter_id:$("cardChapter").value.trim()||null,p_chapter_number:$("cardChapterNumber").value?Number($("cardChapterNumber").value):null,p_description:$("cardDescription").value.trim()||null,p_artwork_url:artwork||null,p_active:true});if(error)throw error;const accessResult=await client.rpc("set_moderator_card_access_key",{p_card_id:data.card_id,p_required_access_key:$("cardAccessKey").value.trim()||null});if(accessResult.error)throw accessResult.error;
const rawAttributes=JSON.stringify(readGameBuilder());let gameAttributes;
try{gameAttributes=JSON.parse(rawAttributes)}catch(_){throw new Error("Game attributes must be valid JSON.")}if(!gameAttributes||Array.isArray(gameAttributes)||typeof gameAttributes!=="object")throw new Error("Game attributes must be a JSON object.");if(Object.keys(gameAttributes).length>30)throw new Error("Use no more than 30 top-level game attributes.");
const releaseResult=await client.rpc("save_moderator_card_release_metadata",{p_card_id:data.card_id,p_release_type:$("cardReleaseType").value,p_release_label:$("cardReleaseLabel").value.trim()||null,p_available_from:$("cardAvailableFrom").value?new Date($("cardAvailableFrom").value).toISOString():null,p_available_until:$("cardAvailableUntil").value?new Date($("cardAvailableUntil").value).toISOString():null,p_limited_quantity:$("cardLimitedQuantity").value?Number($("cardLimitedQuantity").value):null,p_acquisition_source:$("cardAcquisitionSource").value.trim()||null,p_game_attributes:categoryGameTemplates.get($("cardCategory").value)||{}});if(releaseResult.error)throw releaseResult.error;
$("formMessage").textContent=(data.created?"Created ":"Updated ")+data.card_number+" successfully.";currentArtworkUrl=artwork;croppedBlob=null;await loadStudio();$("cardId").value=data.card_id;$("saveCardButton").textContent="SAVE CHANGES";$("deleteCardButton").hidden=false;setPreview();say(data.card_number+" saved to the catalogue.");}catch(error){console.error(error);$("formMessage").textContent=error.message||"Could not save this card. Check the database migration."; }finally{button.disabled=false;if(button.textContent==="SAVING CARD…")button.textContent=$("cardId").value?"SAVE CHANGES":"SAVE CARD"}}
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
async function grantReaderXanth(event){
 event.preventDefault();
 const email=$("xanthGrantEmail").value.trim(),amount=Number($("xanthGrantAmount").value),description=$("xanthGrantDescription").value.trim()||"Moderator Xanth grant";
 if(!email||!Number.isFinite(amount)||amount<=0){$("xanthGrantMessage").textContent="Enter a reader email and a positive Xanth amount.";return;}
 const cents=Math.round(amount*100),button=$("xanthGrantButton");button.disabled=true;button.textContent="GRANTING…";
 try{
  const {data,error}=await client.rpc("moderator_grant_xanth_by_email",{p_reader_email:email,p_amount_cents:cents,p_description:description});
  if(error)throw error;
  $("xanthGrantMessage").textContent="Granted XƵ"+(cents/100).toFixed(2)+" to "+email+". Their wallet balance is now XƵ"+(Number(data.balance_cents)/100).toFixed(2)+".";
  $("xanthGrantForm").reset();say("Xanth grant recorded for "+email+".");
 }catch(error){console.error(error);$("xanthGrantMessage").textContent=error.message||"The Xanth grant could not be completed.";}
 finally{button.disabled=false;button.textContent="GRANT XANTH";}
}
function bind(){$("cardReleaseType").addEventListener("change",syncReleaseFields);$("addGameAttribute").addEventListener("click",()=>addGameAttributeRow());$("addGameAbility").addEventListener("click",()=>addGameAbilityRow());renderGameBuilder({});$("xanthGrantForm").addEventListener("submit",grantReaderXanth);document.querySelectorAll(".mod-tabs button").forEach(b=>b.addEventListener("click",()=>{showTab(b.dataset.tab,true);if(b.dataset.tab==="shop"&&!$("shopAdminDate").value)loadXanthShopAdmin().catch(e=>say(e.message));}));const syncTabFromUrl=()=>{const match=location.hash.match(/^#tab-([a-z]+)$/);if(match)showTab(match[1],false)};window.addEventListener("hashchange",syncTabFromUrl);window.addEventListener("popstate",syncTabFromUrl);const initialTab=location.hash.match(/^#tab-([a-z]+)$/);if(initialTab)showTab(initialTab[1],false);$("shopAdminDate").value=brisbaneDate();$("loadShopAdmin").addEventListener("click",()=>loadXanthShopAdmin().catch(e=>say(e.message)));$("shopOverrideForm").addEventListener("submit",saveXanthShopOverride);$("newCardButton").addEventListener("click",()=>{resetForm();window.scrollTo({top:0,behavior:"smooth"})});$("resetCardButton").addEventListener("click",resetForm);$("cardSearch").addEventListener("input",renderList);["cardName","cardDescription","cardCategory","cardRarity","cardChapterNumber"].forEach(id=>$(id).addEventListener("input",setPreview));$("cardCategory").addEventListener("change",setPreview);$("cardRarity").addEventListener("change",setPreview);$("cardArtwork").addEventListener("change",()=>{$("cropArtworkButton").disabled=!$("cardArtwork").files.length;$("uploadStatus").textContent=$("cardArtwork").files.length?"Image selected. Adjust the crop before saving.":"";if($("cardArtwork").files.length)openCrop()});$("cropArtworkButton").addEventListener("click",openCrop);$("closeCrop").addEventListener("click",()=>$("cropDialog").close());$("applyCrop").addEventListener("click",applyCrop);$("cropZoom").addEventListener("input",e=>{cropZoom=Number(e.target.value);renderCrop()});const canvas=$("cropCanvas");canvas.addEventListener("pointerdown",e=>{if(!cropImage)return;pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});canvas.addEventListener("pointermove",e=>{if(!pointer||!cropImage)return;const rect=canvas.getBoundingClientRect(),aspect=canvas.width/canvas.height,sourceRatio=cropImage.naturalWidth/cropImage.naturalHeight;let bw,bh;if(sourceRatio>aspect){bh=cropImage.naturalHeight;bw=bh*aspect}else{bw=cropImage.naturalWidth;bh=bw/aspect}const w=bw/cropZoom,h=bh/cropZoom;cropX-=(e.clientX-pointer.x)*w/rect.width;cropY-=(e.clientY-pointer.y)*h/rect.height;pointer={x:e.clientX,y:e.clientY};renderCrop()});["pointerup","pointercancel","lostpointercapture"].forEach(n=>canvas.addEventListener(n,()=>pointer=null));$("gameTemplateCategory").addEventListener("change",()=>{activeTemplateCategory=$("gameTemplateCategory").value;renderGameBuilder(categoryGameTemplates.get(activeTemplateCategory)||defaultCategoryGameTemplate(categories.find(c=>c.id===activeTemplateCategory)?.label));$("gameTemplateStatus").textContent="Unsaved changes apply to every card in this category when saved.";});$("saveCategoryGameTemplate").addEventListener("click",saveCategoryGameTemplate);$("cardCategory").addEventListener("change",()=>{const id=$("cardCategory").value;$("gameTemplateCategory").value=id;activeTemplateCategory=id;renderGameBuilder(categoryGameTemplates.get(id)||{});});$("cardForm").addEventListener("submit",saveCard);$("deleteCardButton").addEventListener("click",deleteCard);$("readerResetSearchButton").addEventListener("click",()=>searchResetReaders().catch(e=>say(e.message)));$("readerResetSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();searchResetReaders().catch(err=>say(err.message))}});$("refreshResetLog").addEventListener("click",()=>loadReaderResetLog().catch(e=>say(e.message)));loadReaderResetLog().catch(e=>console.warn(e));setPreview()}
document.addEventListener("DOMContentLoaded",()=>init().catch(error=>{console.error(error);$("accessDenied").hidden=false}));
})();