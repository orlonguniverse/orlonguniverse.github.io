(()=>{"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co",KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const $=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const safeUrl=value=>{try{const u=new URL(value,location.origin);return ["https:","http:"].includes(u.protocol)?u.href:(u.origin===location.origin?u.href:null)}catch(_){return null}};
function block(b){
 const wrap=$("div","managed-block");
 if(b.type==="heading"){wrap.append($("h2","",b.text||""));return wrap}
 if(b.type==="text"){wrap.append($("p","",b.text||""));return wrap}
 if(b.type==="callout"){wrap.append($("div","managed-callout",b.text||""));return wrap}
 if(b.type==="divider"){wrap.append($("hr"));return wrap}
 if(b.type==="image"){const url=safeUrl(b.url||"");if(!url)return wrap;const img=$("img");img.src=url;img.alt=b.alt||"";wrap.append(img);if(b.caption)wrap.append($("small","",b.caption));return wrap}
 if(b.type==="button"){const url=safeUrl(b.url||"");if(!url)return wrap;const a=$("a","managed-button",b.text||"LEARN MORE");a.href=url;if(new URL(url).origin!==location.origin)a.rel="noopener noreferrer";wrap.append(a);return wrap}
 if(b.type==="accordion"){if(b.title)wrap.append($("h2","",b.title));(b.items||[]).forEach(item=>{const d=$("details"),s=$("summary","",item.title||"More information"),p=$("p","",item.text||"");d.append(s,p);wrap.append(d)});return wrap}
 return wrap
}
async function init(){
 const slug=new URLSearchParams(location.search).get("slug");
 if(!slug){document.getElementById("pageTitle").textContent="PAGE NOT FOUND";return}
 const db=window.supabase?.createClient?.(URL_BASE,KEY);
 if(!db){document.getElementById("pageBody").textContent="The page could not be loaded. Please refresh and try again.";return}
 const {data,error}=await db.rpc("get_public_orlong_managed_page",{p_slug:slug});
 if(error||!data){document.getElementById("pageTitle").textContent="PAGE NOT AVAILABLE";document.getElementById("pageDescription").textContent="This page may be unpublished or the address may be incorrect.";return}
 document.title=data.title+" | Orlong Universe";
 document.getElementById("pageTitle").textContent=data.title;
 document.getElementById("pageDescription").textContent=data.description||"";
 const body=document.getElementById("pageBody");
 (data.content?.blocks||[]).forEach(b=>body.append(block(b)));
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();