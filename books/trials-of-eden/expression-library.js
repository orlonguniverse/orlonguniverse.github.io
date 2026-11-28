/* Stage 8G — Orlong Expression Library */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const make=(tag,cls,label)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(label!==undefined)el.textContent=label;return el;};
let cachedItems=[],giphyKey="",gifTimer=null,gifOffset=0;
function renderExpressionPreview(){
 const preview=$("commentExpressionPreview");if(!preview||preview.hidden)return;preview.replaceChildren();
 const body=$("commentBody")?.value||"";preview.append(make("p","",body||"Media-only comment"));
 selectedExpressionAssets.forEach(item=>{if(item.emoji){preview.append(make("span","comment-expression-emoji",item.emoji));return;}if(item.preview||item.url){const img=document.createElement("img");img.src=item.preview||item.url;img.alt=item.alt||item.title;img.loading="lazy";preview.append(img);}});
 if($("commentSpoiler")?.checked)preview.prepend(make("strong","","SPOILER WARNING"));
}
function renderSelectedExpressions(){
 const root=$("selectedExpressionItems");if(!root)return;root.replaceChildren();
 selectedExpressionAssets.forEach((item,index)=>{
  const chip=make("div","expression-selected-chip");
  if(item.emoji)chip.append(make("span","",item.emoji));
  else if(item.preview||item.url){const img=document.createElement("img");img.src=item.preview||item.url;img.alt="";chip.append(img);}
  chip.append(make("span","",item.title));
  const remove=make("button","expression-remove","×");remove.type="button";remove.setAttribute("aria-label","Remove "+item.title);
  remove.addEventListener("click",()=>{selectedExpressionAssets.splice(index,1);renderSelectedExpressions();});chip.append(remove);root.append(chip);
 });
 const status=$("expressionSelectionStatus");if(status)status.textContent=selectedExpressionAssets.length+"/4 selected";renderExpressionPreview();
}
function addSelection(item){
 if(selectedExpressionAssets.length>=4){setMessage("commentMessage","You can add up to four expression items to one comment.");return;}
 if(selectedExpressionAssets.some(x=>(x.id&&x.id===item.id)||(x.url&&x.url===item.url&&x.emoji===item.emoji)))return;
 selectedExpressionAssets.push(item);renderSelectedExpressions();
}
function makeAssetButton(item,root){
 const button=make("button","expression-picker-item");button.type="button";
 if(item.asset_type==="emoji"&&item.emoji_text)button.append(make("span","expression-picker-emoji",item.emoji_text));
 else{const img=document.createElement("img");img.src=item.preview_url||item.asset_url;img.alt=item.alt_text||item.title;img.loading="lazy";button.append(img);}
 button.append(make("span","expression-picker-title",item.title));
 if(!item.is_unlocked){button.disabled=true;button.classList.add("is-locked");button.append(make("small","","LOCKED — "+(item.unlock_chapter_ids?.length?"Complete a chapter":"Unlock a collectible")));}
 else button.addEventListener("click",()=>addSelection({id:item.asset_id,key:item.asset_key,title:item.title,type:item.asset_type,url:item.asset_url,preview:item.preview_url,emoji:item.emoji_text,alt:item.alt_text,source:item.source||"orlong"}));
 root.append(button);
}
function renderLibrary(){
 const root=$("expressionPickerGrid");if(!root)return;root.replaceChildren();
 const type=$("expressionPickerType")?.value||"all",query=($("expressionPickerSearch")?.value||"").trim().toLowerCase();
 const items=cachedItems.filter(x=>(type==="all"||x.asset_type===type)&&(!query||x.title.toLowerCase().includes(query)||x.category.toLowerCase().includes(query)));
 items.forEach(item=>makeAssetButton(item,root));
 if(!items.length)root.append(make("p","engagement-muted","No matching items yet. Try GIF discovery or request something new."));
}
async function loadGiphy(query,append=false){
 const root=$("giphyExpressionGrid");if(!root)return;
 if(!giphyKey){root.replaceChildren(make("p","engagement-muted","GIF search will be available once the Orlong administrator connects the GIF library. The built-in collection is ready now."));return;}
 if(!append){gifOffset=0;root.replaceChildren(make("p","engagement-muted","Finding GIFs…"));}else{root.querySelector(".expression-load-more")?.remove();root.querySelector(".giphy-attribution")?.remove();}
 try{
  const contentType=$("giphyExpressionType")?.value||"gifs";
  const mode=query?"search":"trending";
  const url="https://api.giphy.com/v1/"+contentType+"/"+mode+"?api_key="+encodeURIComponent(giphyKey)+"&limit=30&offset="+gifOffset+"&rating=pg-13&bundle=messaging_non_clips"+(query?"&q="+encodeURIComponent(query):"");
  const response=await fetch(url);if(!response.ok)throw new Error("GIF search unavailable");
  const data=await response.json();if(!append)root.replaceChildren();
  (data.data||[]).forEach(gif=>{
   const still=gif.images?.fixed_height_small||gif.images?.fixed_height||gif.images?.original;if(!still?.url)return;
   const button=make("button","expression-picker-item");button.type="button";
   const img=document.createElement("img");img.src=still.webp||still.url;img.alt=gif.title||"GIF";img.loading="lazy";
   button.append(img,make("span","expression-picker-title",gif.title||"GIF"));
   button.addEventListener("click",()=>addSelection({title:gif.title||"GIF",type:contentType==="stickers"?"sticker":"gif",url:gif.images?.fixed_height?.url||gif.images?.original?.url||still.url,preview:still.webp||still.url,alt:gif.title||"GIF",source:"giphy"}));
   root.append(button);
  });
  if(!data.data?.length&&!append)root.append(make("p","engagement-muted","No GIFs found. Try a different search."));
  gifOffset+=data.data?.length||0;
  if((data.data||[]).length===30){const more=make("button","expression-load-more","LOAD MORE");more.type="button";more.addEventListener("click",()=>loadGiphy(query,true));root.append(more);}
  if(!root.querySelector(".giphy-attribution"))root.append(make("p","giphy-attribution","Powered By GIPHY"));
 }catch(error){console.error(error);root.replaceChildren(make("p","engagement-muted","GIF search could not connect. The Orlong library is still available."));}
}
async function loadLibrary(){
 const root=$("expressionPickerGrid");root.replaceChildren(make("p","engagement-muted","Loading your library…"));
 const result=await engagementClient.rpc("get_my_expression_library");
 if(result.error){root.replaceChildren(make("p","engagement-muted","The expression library is unavailable. Run the Stage 8G database migration."));return;}
 cachedItems=result.data||[];renderLibrary();loadMyExpressionRequests();
 const config=await engagementClient.rpc("get_expression_giphy_config");giphyKey=config.data||"";
 loadGiphy("");
}
async function loadMyExpressionRequests(){
 const root=$("myExpressionRequests");if(!root||!engagementUser)return;
 const {data,error}=await engagementClient.from("expression_asset_requests").select("title,requested_type,status,moderator_note,created_at").eq("user_id",engagementUser.id).order("created_at",{ascending:false}).limit(12);
 root.replaceChildren();
 if(error){root.append(make("p","engagement-muted","Your requests could not be loaded."));return;}
 if(!data?.length){root.append(make("p","engagement-muted","Your expression requests will appear here."));return;}
 data.forEach(item=>{const row=make("div","expression-request-history-row");row.append(make("strong","",item.title),make("span","",item.requested_type.toUpperCase()+" · "+item.status.toUpperCase()));if(item.moderator_note)row.append(make("small","",item.moderator_note));root.append(row);});
}
function buildPicker(){
 const dialog=make("dialog","expression-picker-dialog");dialog.id="expressionPickerDialog";
 const head=make("div","expression-picker-head");head.append(make("div","","ORLONG EXPRESSION LIBRARY"));
 const close=make("button","expression-close","×");close.type="button";close.addEventListener("click",()=>dialog.close());head.append(close);
 const controls=make("div","expression-picker-controls");
 const search=document.createElement("input");search.type="search";search.id="expressionPickerSearch";search.placeholder="Search the Orlong library…";search.addEventListener("input",renderLibrary);
 const type=document.createElement("select");type.id="expressionPickerType";
 [["all","Everything"],["emoji","Emojis"],["sticker","Stickers"],["meme","Memes"],["gif","GIFs"]].forEach(pair=>{const option=document.createElement("option");option.value=pair[0];option.textContent=pair[1];type.append(option);});type.addEventListener("change",renderLibrary);
 controls.append(search,type);
 const library=make("section","expression-picker-section");library.append(make("h4","","THE ORLONG COLLECTION"));
 const grid=make("div","expression-picker-grid");grid.id="expressionPickerGrid";library.append(grid);
 const giphy=make("section","expression-picker-section");giphy.append(make("h4","","GIF DISCOVERY"));
 const giphyControls=make("div","giphy-expression-controls");const gifType=document.createElement("select");gifType.id="giphyExpressionType";[["gifs","GIFs"],["stickers","Stickers"]].forEach(pair=>{const option=document.createElement("option");option.value=pair[0];option.textContent=pair[1];gifType.append(option);});gifType.addEventListener("change",()=>loadGiphy(gifSearch.value.trim()));const gifSearch=document.createElement("input");gifSearch.type="search";gifSearch.placeholder="Search GIFs and stickers…";
 gifSearch.addEventListener("input",()=>{window.clearTimeout(gifTimer);gifTimer=window.setTimeout(()=>loadGiphy(gifSearch.value.trim()),300);});
 const gifGrid=make("div","expression-picker-grid");gifGrid.id="giphyExpressionGrid";giphyControls.append(gifSearch,gifType);giphy.append(giphyControls,gifGrid);
 const request=make("details","expression-request-panel");request.append(make("summary","","REQUEST A NEW EXPRESSION"));
 const form=document.createElement("form");form.id="expressionRequestForm";
 const requestType=document.createElement("select");requestType.id="expressionRequestType";
 ["sticker","gif","meme","emoji"].forEach(value=>{const o=document.createElement("option");o.value=value;o.textContent=value.toUpperCase();requestType.append(o);});
 const title=document.createElement("input");title.required=true;title.maxLength=120;title.placeholder="What should we add?";
 const description=document.createElement("textarea");description.required=true;description.maxLength=1000;description.placeholder="Describe the character, reaction, joke or image you have in mind…";
 const send=make("button","","SEND REQUEST");send.type="submit";const requestMessage=make("p","engagement-small","");requestMessage.id="expressionRequestMessage";const requestHistory=make("div","expression-request-history");requestHistory.id="myExpressionRequests";
 form.append(requestType,title,description,send,requestMessage,requestHistory);
 form.addEventListener("submit",async event=>{
  event.preventDefault();if(!engagementUser){setMessage("commentMessage","Sign in to request a new expression.");return;}
  const result=await engagementClient.rpc("request_expression_asset",{p_type:requestType.value,p_title:title.value.trim(),p_description:description.value.trim()});
  $("expressionRequestMessage").textContent=result.error?result.error.message:"Thanks! Your request has been sent. You can track its status below.";
  if(!result.error){form.reset();loadMyExpressionRequests();}
 });
 request.append(form);dialog.append(head,controls,library,giphy,request);document.body.append(dialog);
 dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
}
function initialise(){
 const form=$("commentForm"),body=$("commentBody");if(!form||!body)return;body.removeAttribute("required");
 const tools=make("div","expression-composer-tools");
 const add=make("button","expression-open-button","＋ ADD EMOJIS, STICKERS, GIFS & MEMES");add.type="button";
 add.addEventListener("click",()=>{if(!engagementUser){setMessage("commentMessage","Sign in to use the Expression Library.");openAccountDialog();return;}if(!$("expressionPickerDialog"))buildPicker();const dialog=$("expressionPickerDialog");if(!dialog.open)dialog.showModal();loadLibrary();});
 const selected=make("div","expression-selected-items");selected.id="selectedExpressionItems";
 const status=make("span","expression-selection-status","0/4 selected");status.id="expressionSelectionStatus";
 const previewButton=make("button","expression-preview-button","PREVIEW COMMENT");previewButton.type="button";
 const preview=make("div","expression-comment-preview");preview.id="commentExpressionPreview";preview.hidden=true;
 previewButton.addEventListener("click",()=>{preview.hidden=!preview.hidden;previewButton.textContent=preview.hidden?"PREVIEW COMMENT":"HIDE PREVIEW";renderExpressionPreview();});
 body.addEventListener("input",renderExpressionPreview);$("commentSpoiler")?.addEventListener("change",renderExpressionPreview);
 tools.append(add,previewButton,status,selected,preview);body.insertAdjacentElement("afterend",tools);
}
document.addEventListener("DOMContentLoaded",initialise);
window.renderSelectedExpressions=renderSelectedExpressions;
})();
