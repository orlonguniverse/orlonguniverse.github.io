/* Stage 8G — Moderator Expression Library */
(()=>{
"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co";
const KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const client=window.supabase.createClient(URL_BASE,KEY);
const $=id=>document.getElementById(id);
const say=(value)=>{const el=$("expressionAdminStatus");if(el)el.textContent=value;};
const slug=value=>String(value||"expression").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,90);
let activeId=null;
async function ensureModerator(){
 const {data:{session}}=await client.auth.getSession();
 if(!session)return false;
 const {data,error}=await client.from("reader_moderators").select("user_id").eq("user_id",session.user.id).maybeSingle();
 return !error&&!!data;
}
function buildPanel(){
 const root=$("expressionAdminRoot");if(!root)return;
 root.innerHTML=`
 <div class="expression-admin-grid">
  <section class="expression-admin-card">
   <p class="eyebrow">LIBRARY MANAGEMENT</p><h3>CREATE OR EDIT AN EXPRESSION</h3>
   <form id="expressionAssetForm">
    <label>NAME<input id="expressionTitle" required maxlength="120" placeholder="e.g. Maya's shocked reaction"></label>
    <div class="field-grid">
     <label>TYPE<select id="expressionType"><option value="emoji">Emoji</option><option value="sticker">Sticker</option><option value="gif">GIF</option><option value="meme">Meme</option></select></label>
     <label>CATEGORY<input id="expressionCategory" value="Orlong" maxlength="60"></label>
    </div>
    <label>EMOJI CHARACTER <input id="expressionEmoji" maxlength="16" placeholder="Only for emoji items"></label>
    <label>IMAGE / GIF FILE <input id="expressionFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>Upload a sticker, GIF or meme directly to the Orlong library. Maximum 12 MB.</small></label>
    <label>OR IMAGE URL <input id="expressionUrl" type="url" placeholder="Optional hosted image or GIF URL"></label>
    <label>ALT TEXT <input id="expressionAlt" maxlength="180" placeholder="Describe the image for accessibility"></label>
    <div class="field-grid">
     <label>ASSET KEY <input id="expressionKey" required maxlength="100" placeholder="maya-shocked-reaction"></label>
     <label>SORT ORDER <input id="expressionSort" type="number" value="100"></label>
    </div>
    <label>UNLOCK AFTER CHAPTERS <input id="expressionUnlockChapters" placeholder="chapter-02, chapter-05"><small>Leave blank to make it available to everyone. Separate chapter IDs with commas.</small></label>
    <label>UNLOCK WHEN READER OWNS CARD IDS <textarea id="expressionUnlockCards" rows="2" placeholder="Paste card UUIDs, separated by commas"></textarea></label>
    <label class="expression-admin-check"><input type="checkbox" id="expressionPublic" checked> Available to everyone</label>
    <label class="expression-admin-check"><input type="checkbox" id="expressionFeatured"> Feature in the library</label>
    <div class="form-actions"><button class="primary" type="submit" id="saveExpressionAsset">SAVE TO LIBRARY</button><button class="secondary" type="button" id="resetExpressionAsset">NEW ITEM</button></div>
    <p id="expressionAdminStatus" role="status"></p>
   </form>
  </section>
  <section class="expression-admin-card">
   <p class="eyebrow">GIF DISCOVERY</p><h3>CONNECT GIPHY</h3>
   <p>Connect a GIPHY API key to give readers trending GIFs, sticker search and broad access to the GIPHY catalogue from inside the Reading Room. Register a Web key for Orlong and restrict it to your website domain.</p><p><a href="https://developers.giphy.com/docs/api/quick-start-guide/" target="_blank" rel="noopener noreferrer">GIPHY API setup guide ↗</a></p>
   <label>GIPHY API KEY <input id="expressionGiphyKey" type="password" autocomplete="off" placeholder="Paste your GIPHY API key"></label>
   <label class="expression-admin-check"><input type="checkbox" id="expressionGiphyEnabled"> Enable GIF search for signed-in readers</label>
   <button class="primary" type="button" id="saveExpressionGiphy">SAVE GIF CONNECTION</button><p id="expressionGiphyStatus" role="status"></p>
   <hr><p class="eyebrow">READER SUGGESTIONS</p><h3>REQUEST QUEUE</h3>
   <div id="expressionRequestQueue"><p class="hint">Loading requests…</p></div>
  </section>
 </div>
 <section class="expression-admin-card"><div class="catalogue-heading"><div><p class="eyebrow">YOUR COLLECTION</p><h3>MANAGE EXPRESSION ITEMS</h3></div><button type="button" class="secondary" id="refreshExpressionAssets">REFRESH</button></div><div id="expressionAssetList"></div></section>`;
 $("expressionAssetForm").addEventListener("submit",saveAsset);
 $("resetExpressionAsset").addEventListener("click",resetForm);
 $("refreshExpressionAssets").addEventListener("click",loadAssets);
 $("saveExpressionGiphy").addEventListener("click",saveGiphy);
 loadAssets();loadRequests();loadGiphySettings();
}
function resetForm(){
 activeId=null;$("expressionAssetForm").reset();$("expressionCategory").value="Orlong";$("expressionSort").value="100";$("expressionPublic").checked=true;$("saveExpressionAsset").textContent="SAVE TO LIBRARY";say("Ready to create a new library item.");
}
function parseList(id){return $(id).value.split(",").map(x=>x.trim()).filter(Boolean);}
async function saveAsset(event){
 event.preventDefault();const button=$("saveExpressionAsset");button.disabled=true;button.textContent="SAVING…";
 try{
  let url=$("expressionUrl").value.trim(),source=url?"external":"orlong";
  const file=$("expressionFile").files[0];
  if(file){
   if(file.size>12*1024*1024)throw new Error("Choose an image or GIF smaller than 12 MB.");
   const ext=(file.name.split(".").pop()||"png").toLowerCase(),path=crypto.randomUUID()+"."+ext;
   const {error:uploadError}=await client.storage.from("orlong-expressions").upload(path,file,{upsert:false,contentType:file.type});
   if(uploadError)throw uploadError;
   url=client.storage.from("orlong-expressions").getPublicUrl(path).data.publicUrl;source="orlong-storage";
  }
  const args={
   p_asset_id:activeId,p_asset_key:slug($("expressionKey").value),p_title:$("expressionTitle").value.trim(),
   p_type:$("expressionType").value,p_category:$("expressionCategory").value.trim(),
   p_asset_url:url,p_preview_url:url,p_emoji_text:$("expressionEmoji").value.trim(),p_alt_text:$("expressionAlt").value.trim(),
   p_source:source,p_provider_id:null,p_is_public:$("expressionPublic").checked,p_is_featured:$("expressionFeatured").checked,
   p_unlock_chapters:parseList("expressionUnlockChapters"),p_unlock_cards:parseList("expressionUnlockCards"),p_sort_order:Number($("expressionSort").value||100)
  };
  const {data,error}=await client.rpc("moderator_save_expression_asset",args);if(error)throw error;
  activeId=data;say("Saved! This item is now in the Orlong Expression Library.");
  await loadAssets();await loadRequests();
 }catch(error){console.error(error);say(error.message||"Could not save this expression item.");}
 finally{button.disabled=false;button.textContent=activeId?"UPDATE LIBRARY ITEM":"SAVE TO LIBRARY";}
}
async function loadAssets(){
 const root=$("expressionAssetList");if(!root)return;root.textContent="Loading expression items…";
 const {data,error}=await client.from("expression_assets").select("*").order("sort_order").order("title");
 if(error){root.textContent=error.message;return;}root.replaceChildren();
 (data||[]).forEach(item=>{
  const row=document.createElement("article");row.className="expression-admin-row";
  const info=document.createElement("div");
  if(item.emoji_text)info.append(text("span","expression-admin-preview",item.emoji_text));
  else if(item.preview_url||item.asset_url){const img=document.createElement("img");img.src=item.preview_url||item.asset_url;img.alt="";info.append(img);}
  const details=document.createElement("div");details.append(text("strong","",item.title),text("small","",item.asset_type.toUpperCase()+" · "+item.category+" · "+(item.is_public?"PUBLIC":"UNLOCKED ONLY")));
  info.append(details);row.append(info);
  const actions=document.createElement("div");const edit=text("button","secondary","EDIT");edit.type="button";edit.addEventListener("click",()=>editAsset(item));
  const remove=text("button","danger","ARCHIVE");remove.type="button";remove.addEventListener("click",async()=>{if(!confirm("Archive "+item.title+" from the reader library?"))return;const result=await client.rpc("moderator_delete_expression_asset",{p_asset_id:item.id});if(result.error)say(result.error.message);else{say("Item archived.");loadAssets();}});
  actions.append(edit,remove);row.append(actions);root.append(row);
 });
 if(!data?.length)root.textContent="No expression items yet. Create your first one above.";
}
function editAsset(item){
 activeId=item.id;$("expressionTitle").value=item.title;$("expressionType").value=item.asset_type;$("expressionCategory").value=item.category;
 $("expressionEmoji").value=item.emoji_text||"";$("expressionUrl").value=item.asset_url||"";$("expressionAlt").value=item.alt_text||"";
 $("expressionKey").value=item.asset_key;$("expressionSort").value=item.sort_order;$("expressionUnlockChapters").value=(item.unlock_chapter_ids||[]).join(", ");
 $("expressionUnlockCards").value=(item.unlock_card_ids||[]).join(", ");$("expressionPublic").checked=item.is_public;$("expressionFeatured").checked=item.is_featured;
 $("saveExpressionAsset").textContent="UPDATE LIBRARY ITEM";say("Editing "+item.title+".");$("expressionAssetForm").scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadRequests(){
 const root=$("expressionRequestQueue");if(!root)return;root.textContent="Loading requests…";
 const {data,error}=await client.from("expression_asset_requests").select("*").order("created_at",{ascending:false}).limit(100);
 if(error){root.textContent=error.message;return;}root.replaceChildren();
 (data||[]).forEach(item=>{
  const row=document.createElement("article");row.className="expression-request-row";
  row.append(text("strong","",item.title+" · "+item.requested_type.toUpperCase()),text("p","",item.description),text("small","",item.status.toUpperCase()+" · "+new Date(item.created_at).toLocaleDateString()));
  const actions=document.createElement("div");
  const use=text("button","secondary","CREATE FROM REQUEST");use.type="button";use.addEventListener("click",()=>{$("expressionTitle").value=item.title;$("expressionType").value=item.requested_type;$("expressionAlt").value=item.description;$("expressionKey").value=slug(item.title);say("Request loaded into the editor. Add an image or emoji, then save it.");$("expressionAssetForm").scrollIntoView({behavior:"smooth"});});
  const approve=text("button","secondary","APPROVE");approve.type="button";approve.addEventListener("click",()=>reviewRequest(item.id,"approved"));
  const decline=text("button","danger","DECLINE");decline.type="button";decline.addEventListener("click",()=>reviewRequest(item.id,"declined"));
  const added=text("button","secondary","MARK ADDED");added.type="button";added.addEventListener("click",()=>reviewRequest(item.id,"added"));
  actions.append(use,approve,decline,added);row.append(actions);root.append(row);
 });
 if(!data?.length)root.textContent="No reader requests yet.";
}
async function reviewRequest(id,status){
 const note=prompt(status==="approved"?"Optional note for the reader:":"Optional reason for declining:");
 const {error}=await client.rpc("moderator_review_expression_request",{p_request_id:id,p_status:status,p_note:note||null});
 if(error)say(error.message);else{say("Request updated.");loadRequests();}
}
async function loadGiphySettings(){
 const {data,error}=await client.from("expression_provider_settings").select("enabled").eq("provider","giphy").maybeSingle();
 if(!error&&data)$("expressionGiphyEnabled").checked=data.enabled;
}
async function saveGiphy(){
 const key=$("expressionGiphyKey").value.trim(),enabled=$("expressionGiphyEnabled").checked;
 if(enabled&&!key){$("expressionGiphyStatus").textContent="Paste your GIPHY API key before enabling GIF search.";return;}
 const {error}=await client.rpc("moderator_set_giphy_api_key",{p_api_key:key,p_enabled:enabled});
 $("expressionGiphyStatus").textContent=error?error.message:"GIF connection settings saved.";
 if(!error)$("expressionGiphyKey").value="";
}
function text(tag,cls,value){const el=document.createElement(tag);if(cls)el.className=cls;el.textContent=value;return el;}
document.addEventListener("DOMContentLoaded",async()=>{
 const tab=document.querySelector('.mod-tabs button[data-tab="expressions"]');if(!tab)return;
 if(!await ensureModerator())return;
 buildPanel();
});
})();