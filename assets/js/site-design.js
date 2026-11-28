(()=>{"use strict";
const URL_BASE="https://kqfwtzrfqsfampqfzoal.supabase.co",KEY="sb_publishable_grlK63Et17pEcH5MtwazYA_awTbcfes";
const palettes={
 blue:{accent:"#398cff",ice:"#a8ceff",glow:"#398cff",deep:"#12233b",surface:"#101a29"},
 red:{accent:"#e34b45",ice:"#ffb0a9",glow:"#d92e38",deep:"#421719",surface:"#281416"},
 orange:{accent:"#f28a32",ice:"#ffd09b",glow:"#ed7a24",deep:"#43230f",surface:"#28190f"},
 purple:{accent:"#a879e8",ice:"#d9c0ff",glow:"#9560df",deep:"#28183f",surface:"#1d172a"},
 yellow:{accent:"#d7b83f",ice:"#f4e6a1",glow:"#c5a52a",deep:"#393116",surface:"#252113"},
 black:{accent:"#b8bec8",ice:"#e3e6eb",glow:"#7c8796",deep:"#111318",surface:"#191b20"}
};
function apply(record){
 const base=palettes[record?.theme]||palettes.blue,custom=record?.design?.colors||{};const theme={accent:custom.accent||base.accent,ice:custom.highlight||base.ice,glow:custom.accent||base.glow,deep:custom.background||base.deep,surface:custom.surface||base.surface,text:custom.text||"#f1f5fb"};
 document.documentElement.dataset.orlongSeriesTheme=record?.theme||"blue";
 Object.entries({"--blue":theme.accent,"--ice":theme.ice,"--orlong-accent":theme.accent,"--orlong-ice":theme.ice,"--orlong-glow":theme.glow,"--orlong-deep":theme.deep,"--orlong-surface":theme.surface,"--bg":theme.deep,"--surface":theme.surface,"--text":theme.text}).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
 if(!document.getElementById("orlongSeriesThemeStyles")){
  const s=document.createElement("style");s.id="orlongSeriesThemeStyles";
  s.textContent=".home-hero{background:radial-gradient(ellipse at 50% 70%,var(--orlong-glow)55,transparent 49%),linear-gradient(145deg,var(--orlong-deep),var(--bg,#080e18) 72%)!important}\\n.home-hero:before,.home-hero:after{border-color:color-mix(in srgb,var(--orlong-ice) 25%,transparent)}\\n.home-hero h1{white-space:pre-line;text-shadow:0 0 38px color-mix(in srgb,var(--orlong-glow) 55%,transparent)!important}\\n.button.primary{background:linear-gradient(120deg,var(--orlong-deep),var(--orlong-accent))!important;border-color:var(--orlong-ice)!important}\\n.button{border-color:color-mix(in srgb,var(--orlong-ice) 55%,transparent)}\\n.hero-kicker,.eyebrow,.section-heading .eyebrow{color:var(--orlong-ice)!important}\\n.book-section,.discover-section{background:linear-gradient(125deg,var(--orlong-surface),var(--orlong-deep))!important}\\n.book-cover{border-color:color-mix(in srgb,var(--orlong-ice) 50%,transparent)!important;background:radial-gradient(ellipse at 50% 42%,var(--orlong-glow)88,transparent 62%),linear-gradient(145deg,var(--orlong-deep),#050a12)!important}\\n.cover-title,.step-number{color:var(--orlong-ice)!important}\\n.step-number{border-color:var(--orlong-accent)!important}\\n#orlongVisualEditor{border-bottom:2px solid var(--orlong-accent)}\n.topbar{border-bottom-color:color-mix(in srgb,var(--orlong-accent) 38%,transparent)!important}\n.topbar-right a:hover,.topbar-right button:hover,.top-actions a:hover,.top-actions button:hover,.nav-dropdown[open]>summary,.nav-dropdown>summary:hover{color:var(--orlong-ice)!important;border-color:color-mix(in srgb,var(--orlong-accent) 65%,transparent)!important;background:color-mix(in srgb,var(--orlong-accent) 12%,transparent)!important}\n.nav-dropdown-menu{border-color:color-mix(in srgb,var(--orlong-ice) 35%,transparent)!important}\n.nav-dropdown-menu a:hover,.nav-dropdown-menu a[aria-current=page]{background:color-mix(in srgb,var(--orlong-accent) 18%,transparent)!important;border-color:color-mix(in srgb,var(--orlong-accent) 55%,transparent)!important}";
  document.head.append(s);
 }
 const d=record?.design||{};
 const set=(id,value)=>{const el=document.getElementById(id);if(el&&typeof value==="string"&&value.trim())el.textContent=value};
 if(location.pathname==="/"){
  set("homeHeroKicker",d.heroKicker);set("homeHeroTitle",d.heroTitle);set("homeHeroFocusButton",d.focusLabel);set("homeHeroSubtitle",d.heroSubtitle);set("homeHeroCopy",d.heroCopy);set("homeHeroNote",d.heroNote);set("homeBookEyebrow",d.bookEyebrow);set("bookIntroTitle",d.bookTitle);set("homeBookCopy1",d.bookCopy1);set("homeBookCopy2",d.bookCopy2);set("firstVisitTitle",d.firstVisitTitle);set("firstVisitIntro",d.firstVisitIntro);set("discoverTitle",d.discoverTitle);set("discoverIntro",d.discoverIntro);set("creatorTitle",d.creatorTitle);set("creatorCopy",d.creatorCopy);
  const primary=document.getElementById("homeHeroPrimary"),secondary=document.getElementById("homeHeroSecondary");
  if(primary){if(d.primaryLabel)primary.textContent=d.primaryLabel;if(d.primaryHref)primary.href=d.primaryHref}
  if(secondary){if(d.secondaryLabel)secondary.textContent=d.secondaryLabel;if(d.secondaryHref)secondary.href=d.secondaryHref}
 }
}
async function init(){
 try{
  const db=window.supabase?.createClient?.(URL_BASE,KEY);if(!db)return;
  const previewId=new URLSearchParams(location.search).get("design-preview");
  if(previewId){
   const {data:session}=await db.auth.getSession();
   if(session?.session){
    const {data:allowed}=await db.rpc("is_reader_moderator");
    if(allowed===true){
     const {data:versions,error}=await db.rpc("get_moderator_orlong_homepage_versions");
     if(!error&&Array.isArray(versions)){
      const preview=versions.find(v=>v.id===previewId);
      if(preview){apply(preview);const banner=document.createElement("div");banner.textContent="PRIVATE DESIGN PREVIEW — "+preview.name+" · NOT LIVE";Object.assign(banner.style,{position:"fixed",zIndex:"2147483647",bottom:"12px",left:"12px",padding:"10px 14px",background:"#152a42",color:"#fff",border:"1px solid #79baff",font:"700 11px Inter,Arial,sans-serif",letterSpacing:"1px"});document.body.append(banner);return}
     }
    }
   }
  }
  const {data,error}=await db.rpc("get_public_orlong_homepage_design");
  if(error){console.warn("Orlong series theme:",error.message);apply(null);return}
  apply(data||null);
  if(data?.nextPublishAt){
   const wait=Math.max(1000,new Date(data.nextPublishAt).getTime()-Date.now()+1200);
   window.setTimeout(()=>init(),Math.min(wait,2147483647));
  }
 }catch(e){console.warn("Orlong series theme could not load:",e);apply(null)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
window.OrlongSiteDesign={apply,palettes};
})();