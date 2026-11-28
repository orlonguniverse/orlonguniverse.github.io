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
 const globalTheme=record?.theme||"blue";
 const readerThemes={"/books/trials-of-eden/":"blue","/books/trials-of-eden/index.html":"blue","/books/arcanet/":"red","/books/bitsy/":"orange","/books/varex/":"purple","/books/evalon/":"yellow"};
 const isReader=location.pathname.startsWith("/books/")&&!location.pathname.includes("contents.html")&&!location.pathname.includes("account.html");
 const registeredBook=(window.OrlongBooks||[]).find(b=>b.readerUrl&&(location.pathname===b.readerUrl||location.pathname===b.readerUrl+"index.html"||location.pathname.replace(/index\\.html$/,"")===b.readerUrl));
 const activeTheme=isReader?(registeredBook?.theme||readerThemes[location.pathname]||document.body?.dataset.seriesTheme||"blue"):globalTheme;
 const base=palettes[activeTheme]||palettes.blue,custom=isReader?{}:(record?.design?.colors||{});
 const theme={accent:custom.accent||base.accent,ice:custom.highlight||base.ice,glow:custom.accent||base.glow,deep:custom.background||base.deep,surface:custom.surface||base.surface,text:custom.text||"#f1f5fb"};
 document.documentElement.dataset.orlongSeriesTheme=activeTheme;
 document.documentElement.dataset.orlongGlobalTheme=globalTheme;if(document.body)document.body.classList.toggle("orlong-reading-room",isReader);
 const luminance=hex=>{const h=String(hex||"#000").replace("#","");const full=h.length===3?h.split("").map(x=>x+x).join(""):h;const rgb=[0,2,4].map(i=>parseInt(full.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]};
 const onAccent=luminance(theme.accent)>.179?"#111722":"#ffffff";
 const onIce=luminance(theme.ice)>.48?"#111722":"#ffffff";
 const themeVars={"--blue":theme.accent,"--blue-light":theme.ice,"--ice":theme.ice,"--orlong-accent":theme.accent,"--orlong-ice":theme.ice,"--orlong-glow":theme.glow,"--orlong-deep":theme.deep,"--orlong-surface":theme.surface,"--bg":theme.deep,"--surface":theme.surface,"--text":theme.text,"--orlong-text":theme.text,"--orlong-on-accent":onAccent,"--orlong-on-ice":onIce,"--orlong-muted":theme.ice};
 Object.entries(themeVars).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));
 if(document.body){Object.entries(themeVars).forEach(([k,v])=>document.body.style.setProperty(k,v));if(!isReader){document.body.style.setProperty("--background",theme.deep);document.body.style.setProperty("--surface-2",theme.surface);document.body.style.setProperty("--muted",theme.ice);}}
 if(isReader&&registeredBook){
  const heading=document.querySelector(".book-header h1"),label=document.querySelector(".book-header .book-label"),subtitle=document.querySelector(".book-header>p");
  if(heading)heading.textContent=registeredBook.title;
  if(label&&registeredBook.house)label.textContent=registeredBook.house;
  if(subtitle&&registeredBook.bookLabel)subtitle.textContent=registeredBook.bookLabel;
 }
 if(!document.getElementById("orlongThemeContrastStyles")){
  const contrast=document.createElement("style");contrast.id="orlongThemeContrastStyles";
  contrast.textContent=`
  .topbar,.topbar .nav-dropdown-menu,.nav-dropdown-menu{background:color-mix(in srgb,var(--orlong-deep) 88%,var(--orlong-surface))!important;border-color:color-mix(in srgb,var(--orlong-accent) 52%,transparent)!important}
  .topbar .logo,.topbar-right>a,.topbar-right>button,.topbar-right .nav-dropdown>summary,.top-actions>a,.top-actions>button,.top-actions .nav-dropdown>summary,.nav-menu-action{color:var(--orlong-text)!important}
  .topbar-right>a:hover,.topbar-right>button:hover,.topbar-right .nav-dropdown>summary:hover,.topbar-right .nav-dropdown[open]>summary,.top-actions>a:hover,.top-actions>button:hover,.top-actions .nav-dropdown>summary:hover,.nav-dropdown-menu a:hover,.nav-dropdown-menu a[aria-current=page]{color:var(--orlong-on-accent)!important;background:var(--orlong-accent)!important;border-color:var(--orlong-ice)!important}
  .topbar .nav-start-reading,.button.primary,.primary-button,button.primary,.primary-button,.reader-first-callout a,.events-reader-link a{background:var(--orlong-accent)!important;color:var(--orlong-on-accent)!important;border:1px solid var(--orlong-ice)!important;text-shadow:none!important;box-shadow:0 5px 18px color-mix(in srgb,var(--orlong-accent) 25%,transparent)!important}
  .topbar .nav-account-button,.topbar #openAccountButton,.topbar #mainAccountButton{color:var(--orlong-ice)!important;background:color-mix(in srgb,var(--orlong-accent) 16%,var(--orlong-deep))!important;border-color:color-mix(in srgb,var(--orlong-ice) 65%,transparent)!important}
  .nav-dropdown-menu a{color:var(--orlong-text)!important}
  a:hover,.topbar a:hover{color:var(--orlong-ice)!important}
  .hero-kicker,.eyebrow,.section-heading .eyebrow,.book-label,.chapter-number,.chapter-heading .chapter-number,.reader-top span,.contents-chapter-number,.contents-chapter.is-available .contents-chapter-status{color:var(--orlong-ice)!important}
  .book-header,.hero{background:radial-gradient(ellipse at 50% 0%,color-mix(in srgb,var(--orlong-accent) 24%,transparent),transparent 68%),var(--background,var(--orlong-deep))!important}
  .book-header h1,.book-header p,.book-label{ text-shadow:0 2px 18px color-mix(in srgb,var(--orlong-glow) 28%,transparent)}
  .chapter-item:hover,.chapter-item.active,.contents-chapter.is-available:hover{border-color:var(--orlong-accent)!important}
  .chapter-item.active,.contents-chapter.is-available:hover{background:color-mix(in srgb,var(--orlong-accent) 13%,var(--surface-2))!important}
  .chapter-text .placeholder{border-left-color:var(--orlong-accent)!important}
  .reader-first-callout,.contents-account-note{background:color-mix(in srgb,var(--orlong-accent) 12%,var(--orlong-surface))!important;border-color:color-mix(in srgb,var(--orlong-accent) 48%,transparent)!important}
  .reader-first-callout strong,.reader-first-callout a,.contents-account-note{color:var(--orlong-text)!important}
  .step-number{color:var(--orlong-on-accent)!important;background:var(--orlong-accent)!important;border-color:var(--orlong-ice)!important}
  button:not(.secondary):not(.danger):not(.discussion-chip):not(.mod-tab),input[type=submit]{accent-color:var(--orlong-accent)}
  button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--orlong-ice)!important;outline-offset:3px}
  .orlong-book-catalogue{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr));gap:24px;margin-top:28px}
  .orlong-book-card{display:grid;grid-template-columns:minmax(105px,.65fr) minmax(0,1.35fr);gap:20px;align-items:center;padding:20px;background:linear-gradient(145deg,var(--orlong-surface),var(--orlong-deep));border:1px solid color-mix(in srgb,var(--orlong-accent) 42%,transparent);border-radius:5px}
  .orlong-book-cover{min-height:190px;display:flex;align-items:center;justify-content:center;text-align:center;padding:14px;background:radial-gradient(ellipse at 50% 38%,color-mix(in srgb,var(--orlong-accent) 78%,transparent),transparent 68%),linear-gradient(145deg,var(--orlong-deep),#080b10);border:1px solid var(--orlong-ice);color:var(--orlong-text);font-family:Cinzel,Georgia,serif;letter-spacing:1.5px}
  .orlong-book-cover strong{font-size:15px;line-height:1.5}.orlong-book-copy h3{margin:7px 0 10px;font-family:Cinzel,Georgia,serif}.orlong-book-copy p{color:var(--orlong-text);opacity:.82;font-size:12px;line-height:1.8}
  .orlong-book-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:14px}.orlong-book-actions a{display:inline-flex;padding:10px 12px;background:var(--orlong-accent);color:var(--orlong-on-accent)!important;border:1px solid var(--orlong-ice);font-size:9px;letter-spacing:1px}
  .orlong-book-switcher{display:flex;justify-content:center;align-items:center;gap:10px;flex-wrap:wrap;margin:18px auto 0;padding:12px 16px;max-width:560px;background:color-mix(in srgb,var(--orlong-accent) 10%,var(--orlong-surface));border:1px solid color-mix(in srgb,var(--orlong-accent) 45%,transparent)}
  .orlong-book-switcher label{color:var(--orlong-ice);font-size:10px;letter-spacing:1.5px}.orlong-book-switcher select{min-width:220px;padding:10px;background:var(--orlong-deep);color:var(--orlong-text);border:1px solid var(--orlong-accent)}
  @media(max-width:560px){.orlong-book-card{grid-template-columns:1fr}.orlong-book-cover{min-height:145px}}
  `;
  document.head.append(contrast);
 }
 
 if(!document.getElementById("orlongSeriesThemeStyles")){
  const s=document.createElement("style");s.id="orlongSeriesThemeStyles";
  s.textContent=".home-hero{background:radial-gradient(ellipse at 50% 70%,var(--orlong-glow)55,transparent 49%),linear-gradient(145deg,var(--orlong-deep),var(--bg,#080e18) 72%)!important}\\n.home-hero:before,.home-hero:after{border-color:color-mix(in srgb,var(--orlong-ice) 25%,transparent)}\\n.home-hero .hero-inner{width:min(100%,850px);margin-inline:auto!important;text-align:center}.home-hero .hero-copy{margin-inline:auto!important}.home-hero .actions{justify-content:center!important}.home-hero h1{white-space:pre-line;text-shadow:0 0 38px color-mix(in srgb,var(--orlong-glow) 55%,transparent)!important}\\n.button.primary{background:linear-gradient(120deg,var(--orlong-deep),var(--orlong-accent))!important;border-color:var(--orlong-ice)!important}\\n.button{border-color:color-mix(in srgb,var(--orlong-ice) 55%,transparent)}\\n.hero-kicker,.eyebrow,.section-heading .eyebrow{color:var(--orlong-ice)!important}\\n.book-section,.discover-section{background:linear-gradient(125deg,var(--orlong-surface),var(--orlong-deep))!important}\\n.book-cover{border-color:color-mix(in srgb,var(--orlong-ice) 50%,transparent)!important;background:radial-gradient(ellipse at 50% 42%,var(--orlong-glow)88,transparent 62%),linear-gradient(145deg,var(--orlong-deep),#050a12)!important}\\n.cover-title,.step-number{color:var(--orlong-ice)!important}\\n.step-number{border-color:var(--orlong-accent)!important}\\n#orlongVisualEditor{border-bottom:2px solid var(--orlong-accent)}\n.topbar,.nav-dropdown-menu{background:color-mix(in srgb,var(--orlong-deep) 82%,var(--orlong-surface))!important;border-bottom-color:color-mix(in srgb,var(--orlong-accent) 38%,transparent)!important}\n body{accent-color:var(--orlong-accent)}\n a:hover{color:var(--orlong-ice)}\n button.primary,.primary-button,.button.primary,[type=submit].primary{background:linear-gradient(120deg,var(--orlong-deep),var(--orlong-accent))!important;border-color:var(--orlong-ice)!important;color:#fff!important}\n .mod-tabs button.active,.tab-button.active,[aria-selected=true]{border-color:var(--orlong-accent)!important;color:var(--orlong-ice)!important}\n .mod-panel,.site-content-card,.settings-card,.profile-card,.archive-entry,.event-card,.discover-card,.step,.card-panel{border-color:color-mix(in srgb,var(--orlong-accent) 35%,transparent)!important}\n .mod-panel h2,.mod-panel h3,.section-heading h2,.page-title{ text-shadow:0 0 22px color-mix(in srgb,var(--orlong-glow) 20%,transparent)}\n input:focus,textarea:focus,select:focus,button:focus-visible,a:focus-visible{outline-color:var(--orlong-ice)!important;border-color:var(--orlong-accent)!important}\n.topbar-right a:hover,.topbar-right button:hover,.top-actions a:hover,.top-actions button:hover,.nav-dropdown[open]>summary,.nav-dropdown>summary:hover{color:var(--orlong-ice)!important;border-color:color-mix(in srgb,var(--orlong-accent) 65%,transparent)!important;background:color-mix(in srgb,var(--orlong-accent) 12%,transparent)!important}\n.nav-dropdown-menu{border-color:color-mix(in srgb,var(--orlong-ice) 35%,transparent)!important}\n .topbar,.topbar a,.topbar button,.nav-dropdown>summary,.nav-menu-action{color:var(--orlong-ice)}\n .topbar a:hover,.topbar button:hover,.nav-dropdown>summary:hover,.nav-menu-action:hover{color:var(--orlong-accent)!important}\n body.orlong-reading-room .book-header{background:radial-gradient(ellipse at 50% 0%,color-mix(in srgb,var(--orlong-accent) 28%,transparent),transparent 65%),var(--background)!important}\n body.orlong-reading-room .chapter-item:hover,body.orlong-reading-room .chapter-item.active{border-color:var(--orlong-accent)!important}\n body.orlong-reading-room .chapter-item.active{background:color-mix(in srgb,var(--orlong-accent) 12%,var(--surface-2))!important}\n body.orlong-reading-room .chapter-number,body.orlong-reading-room .book-label,body.orlong-reading-room .reader-top span{color:var(--orlong-ice)!important}\n body.orlong-reading-room .reader-controls button,body.orlong-reading-room button:hover{border-color:color-mix(in srgb,var(--orlong-accent) 65%,transparent)}\n .reader .reader,.reader .chapter-directory,.reader .sidebar{border-color:color-mix(in srgb,var(--orlong-accent) 25%,transparent)}\n body.orlong-reading-room .topbar{border-bottom-color:color-mix(in srgb,var(--orlong-accent) 38%,transparent)!important}\n.nav-dropdown-menu a:hover,.nav-dropdown-menu a[aria-current=page]{background:color-mix(in srgb,var(--orlong-accent) 18%,transparent)!important;border-color:color-mix(in srgb,var(--orlong-accent) 55%,transparent)!important}";
  document.head.append(s);
 }
 const d=record?.design||{};
 const set=(id,value)=>{const el=document.getElementById(id);if(el&&typeof value==="string"&&value.trim())el.textContent=value};
 if(location.pathname==="/"){
  const hero=document.querySelector(".home-hero");
  if(hero){
   hero.classList.remove("orlong-hero-left");hero.style.textAlign="center";
   hero.style.minHeight=d.heroHeight==="compact"?"420px":d.heroHeight==="cinematic"?"760px":"590px";
   const inner=hero.querySelector(".hero-inner");if(inner){inner.style.marginLeft="auto";inner.style.marginRight="auto";inner.style.textAlign="center";}const copy=hero.querySelector(".hero-copy");if(copy){copy.style.marginLeft="auto";copy.style.marginRight="auto";}const actions=hero.querySelector(".actions");if(actions)actions.style.justifyContent="center";
   if(d.heroBackgroundImage){
    try{const u=new URL(d.heroBackgroundImage,location.origin);if(["http:","https:"].includes(u.protocol))hero.style.backgroundImage="linear-gradient(145deg, color-mix(in srgb, var(--orlong-deep) 82%, transparent), color-mix(in srgb, var(--bg) 88%, transparent)), url("+JSON.stringify(u.href)+")";}catch(_){}
    hero.style.backgroundSize="cover";hero.style.backgroundPosition="center";
   }else{hero.style.backgroundImage="";}
  }
  [[".book-section",d.showBookSection],[".steps-section",d.showFirstVisit],[".discover-section",d.showDiscover],[".creator",d.showCreator]].forEach(([selector,show])=>{const el=document.querySelector(selector);if(el)el.hidden=show===false;});
  set("homeHeroKicker",d.heroKicker);set("homeHeroTitle",d.heroTitle);set("homeHeroFocusButton",d.focusLabel);set("homeHeroSubtitle",d.heroSubtitle);set("homeHeroCopy",d.heroCopy);set("homeHeroNote",d.heroNote);set("homeBookEyebrow",d.bookEyebrow);set("bookIntroTitle",d.bookTitle);set("homeBookCopy1",d.bookCopy1);set("homeBookCopy2",d.bookCopy2);set("firstVisitTitle",d.firstVisitTitle);set("firstVisitIntro",d.firstVisitIntro);set("discoverTitle",d.discoverTitle);set("discoverIntro",d.discoverIntro);set("creatorTitle",d.creatorTitle);set("creatorCopy",d.creatorCopy);
  const primary=document.getElementById("homeHeroPrimary"),secondary=document.getElementById("homeHeroSecondary");
  if(primary){if(d.primaryLabel)primary.textContent=d.primaryLabel;if(d.primaryHref)primary.href=d.primaryHref}
  if(secondary){if(d.secondaryLabel)secondary.textContent=d.secondaryLabel;if(d.secondaryHref)secondary.href=d.secondaryHref}
 }
}

function renderBookCatalogue(books){
 const section=document.querySelector(".book-section");if(!section||!Array.isArray(books)||!books.length)return;
 const root=document.createElement("div");root.className="orlong-book-catalogue";
 books.forEach(book=>{
  const card=document.createElement("article");card.className="orlong-book-card";card.dataset.bookTheme=book.theme||"blue";
  const cover=document.createElement("div");cover.className="orlong-book-cover";const coverText=document.createElement("strong");coverText.textContent=book.title;cover.append(coverText);
  const copy=document.createElement("div");copy.className="orlong-book-copy";const eyebrow=document.createElement("p");eyebrow.className="eyebrow";eyebrow.textContent=book.bookLabel||book.seriesName||"ORLONG UNIVERSE";
  const title=document.createElement("h3");title.textContent=book.title;const desc=document.createElement("p");desc.textContent=book.description||"Discover this story in the Orlong Universe.";
  const actions=document.createElement("div");actions.className="orlong-book-actions";const read=document.createElement("a");read.href=book.readerUrl;read.textContent="ENTER READING ROOM";actions.append(read);
  if(book.contentsUrl){const contents=document.createElement("a");contents.href=book.contentsUrl;contents.textContent="BOOK CONTENTS";actions.append(contents)}
  copy.append(eyebrow,title,desc,actions);card.append(cover,copy);root.append(card);
 });
 const feature=section.querySelector(".book-feature");if(feature)feature.replaceWith(root);else section.append(root);
}
function renderBookNavigation(books){
 const menu=[...document.querySelectorAll(".nav-dropdown")].find(d=>[...d.querySelectorAll(".nav-dropdown-menu a")].some(a=>(a.getAttribute("href")||"").includes("/books/trials-of-eden/")));
 const panel=menu?.querySelector(".nav-dropdown-menu");if(!panel)return;
 books.filter(b=>b.id!=="trials-of-eden").forEach(book=>{
  if(panel.querySelector('[data-orlong-book-link="'+CSS.escape(book.id)+'"]'))return;
  const a=document.createElement("a");a.href=book.readerUrl;a.textContent=book.title;a.dataset.orlongBookLink=book.id;panel.append(a);
 });
}
function renderReaderBookSwitcher(books){
 const header=document.querySelector(".book-header");if(!header)return;
 const choices=books.filter(b=>b.showInReaderSwitcher&&b.readerUrl);
 const current=choices.find(b=>location.pathname===b.readerUrl||location.pathname===b.readerUrl+"index.html"||location.pathname.replace(/index\\.html$/,"")===b.readerUrl);
 if(choices.length<2||!current)return;
 const wrap=document.createElement("div");wrap.className="orlong-book-switcher";const label=document.createElement("label");label.textContent="EXPLORE ANOTHER BOOK";
 const select=document.createElement("select");select.setAttribute("aria-label","Choose a book in the Reading Room");
 choices.forEach(book=>{const option=document.createElement("option");option.value=book.readerUrl;option.textContent=book.title;option.selected=book.id===current.id;select.append(option)});
 select.addEventListener("change",()=>{if(select.value)location.href=select.value});
 wrap.append(label,select);header.append(wrap);
}

async function init(){
 try{
  const db=window.supabase?.createClient?.(URL_BASE,KEY);if(!db)return;
  const {data:booksData,error:booksError}=await db.rpc("get_public_orlong_books");
  const books=(!booksError&&Array.isArray(booksData))?booksData:[];
  window.OrlongBooks=books;
  if(location.pathname==="/")renderBookCatalogue(books);
  renderBookNavigation(books);
  if(location.pathname.startsWith("/books/")&&!location.pathname.includes("contents.html")&&!location.pathname.includes("account.html"))renderReaderBookSwitcher(books);
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