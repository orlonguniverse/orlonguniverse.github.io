/* ORLONG CARD REVEAL — one continuous score; no stitched sound-effect sequence. */
(() => {
 if(window.OrlongCardReveal)return;
 const wait=ms=>new Promise(resolve=>window.setTimeout(resolve,ms));
 const reduced=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 const rarities={common:{label:"COMMON",colour:"#c8d0da"},uncommon:{label:"UNCOMMON",colour:"#54d69a"},rare:{label:"RARE",colour:"#42a5ff"},epic:{label:"EPIC",colour:"#bd72ff"},legendary:{label:"LEGENDARY",colour:"#f2c75c"}};
 let active=false,score=null,queuedCards=[],activeResolver=null;
 function stopScore(){if(score){score.pause();score.currentTime=0;score=null;}}
 function close(overlay){
  if(!overlay||overlay.dataset.closing==="true")return;
  overlay.dataset.closing="true";stopScore();overlay.classList.remove("orlong-reveal-active");
  window.setTimeout(()=>{
   overlay.remove();document.body.classList.remove("orlong-reveal-lock");active=false;
   const resolve=activeResolver;activeResolver=null;if(resolve)resolve();
   startNext();
  },650);
 }
 function makeOverlay(card){
  const overlay=document.createElement("div");overlay.className="orlong-reveal-overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label","New collectible card reveal");
  const rarity=rarities[String(card.rarity||"common").toLowerCase()]||rarities.common;overlay.style.setProperty("--reveal-rarity",rarity.colour);
  const scene=document.createElement("div");scene.className="orlong-reveal-scene";
  const energy=document.createElement("div");energy.className="orlong-reveal-energy";
  for(let i=0;i<95;i++){const particle=document.createElement("i");particle.style.setProperty("--particle-index",i);energy.append(particle);}
  const beams=document.createElement("div");beams.className="orlong-reveal-beams";
  const shock=document.createElement("div");shock.className="orlong-reveal-shockwave";
  const eel=document.createElement("div");eel.className="orlong-reveal-eel";eel.setAttribute("aria-hidden","true");
  eel.innerHTML='<svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="orlongEelGlow" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d5f7ff"/><stop offset=".45" stop-color="#39aaff"/><stop offset="1" stop-color="#1762ff"/></linearGradient></defs><path class="eel-halo" d="M55 500 C115 90 310 70 390 290 S565 660 665 405 S805 100 930 180"/><path class="eel-body" d="M55 500 C115 90 310 70 390 290 S565 660 665 405 S805 100 930 180"/><path class="eel-spine" d="M55 500 C115 90 310 70 390 290 S565 660 665 405 S805 100 930 180"/><path class="eel-fin" d="M180 180 l-38 -75 65 53 M325 205 l12 -83 33 90 M480 490 l55 72 8 -103 M760 260 l60 -68 8 93"/><path class="eel-tail" d="M55 500 l-46 -40 7 69z"/><path class="eel-head" d="M900 150 Q945 135 970 180 Q950 220 915 211z"/><circle class="eel-eye" cx="945" cy="172" r="6"/><path class="eel-mouth" d="M929 204 q20 10 35 -1"/></svg>';
  const crystal=document.createElement("div");crystal.className="orlong-reveal-crystal";
  const wrap=document.createElement("div");wrap.className="orlong-reveal-card-wrap";
  const cardFace=document.createElement("div");cardFace.className="orlong-reveal-card";
  const back=document.createElement("div");back.className="orlong-reveal-card-back";
  const front=document.createElement("div");front.className="orlong-reveal-card-front";front.dataset.rarity=String(card.rarity||"common").toLowerCase();
  const art=document.createElement("img");art.className="orlong-reveal-art";art.alt=(card.name||"Collectible")+" artwork";art.loading="eager";art.decoding="async";
  if(card.artwork){art.src=card.artwork;}else{art.hidden=true;}
  const frame=document.createElement("div");frame.className="orlong-reveal-frame";
  const top=document.createElement("div");top.className="orlong-reveal-topline";
  const number=document.createElement("span");number.className="orlong-reveal-number";number.textContent=card.number||"ORLONG ARCHIVE";
  const rarityBadge=document.createElement("span");rarityBadge.className="orlong-reveal-rarity";rarityBadge.textContent=rarity.label;
  top.append(number,rarityBadge);
  const details=document.createElement("div");details.className="orlong-reveal-details";
  const name=document.createElement("h2");name.className="orlong-reveal-name";name.textContent=card.name||"UNKNOWN DISCOVERY";
  const description=document.createElement("p");description.className="orlong-reveal-description";description.textContent=card.description||"A new discovery has entered your collection.";
  const footer=document.createElement("div");footer.className="orlong-reveal-footer";
  const category=document.createElement("span");category.textContent=card.category||"CHARACTER";
  const chapter=document.createElement("span");chapter.textContent=card.chapterNumber?"CH. "+card.chapterNumber:"CH. —";
  const book=document.createElement("span");book.textContent=(card.bookLabel||"THE TRIALS OF EDEN").toUpperCase();
  footer.append(category,chapter,book);details.append(name,description,footer);
  frame.append(top,details);
  if(card.setId==="early-access-special-edition"||String(card.id||"").startsWith("special-")){
   const edition=document.createElement("span");edition.className="orlong-reveal-edition";edition.textContent="SPECIAL EDITION";frame.append(edition);
  }
  front.append(art,frame);cardFace.append(back,front);wrap.append(cardFace);
  const caption=document.createElement("p");caption.className="orlong-reveal-caption";caption.textContent="THE ORLONG FIELD STIRS";
  const source=document.createElement("div");source.className="orlong-reveal-source";
  const sourceTitle=document.createElement("span");sourceTitle.className="orlong-reveal-source-title";sourceTitle.textContent=card.sourceLabel||"NEW COLLECTIBLE REWARD";
  const sourceDetail=document.createElement("span");sourceDetail.className="orlong-reveal-source-detail";sourceDetail.textContent=card.sourceDetail||"A new card has been added to your collection.";
  source.append(sourceTitle,sourceDetail);
  const controls=document.createElement("div");controls.className="orlong-reveal-controls";
  const skip=document.createElement("button");skip.type="button";skip.className="orlong-reveal-skip";skip.textContent="SKIP REVEAL";
  const closeButton=document.createElement("button");closeButton.type="button";closeButton.className="orlong-reveal-close";closeButton.textContent="CONTINUE";closeButton.hidden=true;
  controls.append(skip,closeButton);scene.append(energy,beams,shock,eel,crystal,wrap,caption,source,controls);overlay.append(scene);
  skip.addEventListener("click",()=>{stopScore();finish(overlay,caption,skip,closeButton);});
  closeButton.addEventListener("click",()=>close(overlay));
  overlay.addEventListener("keydown",event=>{if(event.key==="Escape")close(overlay);});
  return overlay;
 }
 function finish(overlay,caption,skip,closeButton){overlay.dataset.stage="complete";overlay.classList.add("orlong-reveal-complete");caption.textContent="A NEW DISCOVERY ENTERS YOUR COLLECTION";skip.hidden=true;closeButton.hidden=false;}
 function play(card){
  return new Promise(resolve=>{
   if(!card||!card.name){resolve();return;}
   queuedCards.push({type:"single",card,resolve});startNext();
  });
 }
 function playBatch(cards){
  return new Promise(resolve=>{
   const valid=(cards||[]).filter(card=>card&&card.name);
   if(!valid.length){resolve();return;}
   queuedCards.push({type:"batch",cards:valid,resolve});startNext();
  });
 }
 function startNext(){
  if(active||!queuedCards.length)return;
  const next=queuedCards.shift();active=true;activeResolver=next.resolve;
  if(next.type==="batch")startBatch(next.cards);else startCard(next.card);
 }
 async function startCard(card){const overlay=makeOverlay(card);document.body.append(overlay);document.body.classList.add("orlong-reveal-lock");requestAnimationFrame(()=>overlay.classList.add("orlong-reveal-active"));
  const art=overlay.querySelector(".orlong-reveal-art");
  if(art&&!art.hidden&&art.src&&!art.complete){
   await Promise.race([new Promise(resolve=>{art.addEventListener("load",resolve,{once:true});art.addEventListener("error",resolve,{once:true});}),wait(5000)]);
  }
  if(art&&!art.hidden&&art.complete&&art.naturalWidth===0){
   art.hidden=true;const missing=document.createElement("div");missing.className="orlong-reveal-art-missing";missing.textContent="CARD ARTWORK COULD NOT LOAD";overlay.querySelector(".orlong-reveal-card-front")?.prepend(missing);
  }
  const caption=overlay.querySelector(".orlong-reveal-caption"),skip=overlay.querySelector(".orlong-reveal-skip"),closeButton=overlay.querySelector(".orlong-reveal-close");
  if(card.series==="eden"||card.book==="trials-of-eden"||card.id?.startsWith("special-")||!card.series)overlay.classList.add("series-eden");
  const finishNow=()=>finish(overlay,caption,skip,closeButton);
  if(reduced()){finishNow();return;}
  // One full-length score plays continuously from beginning to end.
  try{score=new Audio("/assets/audio/reveal-soundtrack.mp3");score.volume=.9;score.preload="auto";const p=score.play();if(p?.catch)p.catch(()=>{});}catch(_){}
  const sequence=[
   ["awakening","THE ORLONG FIELD STIRS",1600],
   ["surge","ENERGY FLOWS THROUGH THE CRYSTALS",1900],
   ["eel","THE TRIALS OF EDEN AWAKEN",2100],
   ["materialising","A NEW FORM TAKES SHAPE",1500],
   ["flipping","REVEALING YOUR DISCOVERY",1350],
   ["rarity",rarityLabel(card)+" — ITS POWER IS REVEALED",1800],
   ["revealed",String(card.name).toUpperCase(),1700]
  ];
  for(const [stage,label,duration] of sequence){if(!overlay.isConnected||overlay.dataset.closing==="true")return;overlay.dataset.stage=stage;caption.textContent=label;await wait(duration);}
  finishNow();
 }
 function rarityLabel(card){return (rarities[String(card.rarity||"common").toLowerCase()]||rarities.common).label;}
 async function startBatch(cards){
  const overlay=document.createElement("div");overlay.className="orlong-batch-reveal-overlay";overlay.setAttribute("role","dialog");overlay.setAttribute("aria-modal","true");overlay.setAttribute("aria-label",cards.length+" mystery pack cards revealed");
  const panel=document.createElement("section");panel.className="orlong-batch-reveal-panel";
  const eyebrow=document.createElement("p");eyebrow.className="orlong-batch-eyebrow";eyebrow.textContent="THE XANTHEON MYSTERY VAULT";
  const title=document.createElement("h2");title.className="orlong-batch-title";title.textContent="YOUR DISCOVERIES";
  const subtitle=document.createElement("p");subtitle.className="orlong-batch-subtitle";subtitle.textContent=cards.length+" cards revealed together";
  const grid=document.createElement("div");grid.className="orlong-batch-card-grid";if(cards.length===2)grid.classList.add("batch-count-2");if(cards.length===3)grid.classList.add("batch-count-3");
  cards.forEach((card,index)=>{
   const tile=document.createElement("article");tile.className="orlong-batch-card";tile.style.setProperty("--batch-index",index);
   const art=document.createElement("div");art.className="orlong-batch-art";
   if(card.artwork){const img=document.createElement("img");img.src=card.artwork;img.alt=card.name+" artwork";img.loading="eager";img.onerror=()=>{img.hidden=true;};art.append(img);}
   const rarity=document.createElement("span");rarity.className="orlong-batch-rarity";rarity.textContent=rarityLabel(card);
   const name=document.createElement("h3");name.textContent=card.name;
   const meta=document.createElement("p");meta.textContent=[card.number,card.category,card.chapterNumber?"CH. "+card.chapterNumber:null].filter(Boolean).join(" · ");
   tile.append(art,rarity,name,meta);grid.append(tile);
  });
  const source=document.createElement("p");source.className="orlong-batch-source";source.textContent="Every card from this pack has been added to your collection.";
  const controls=document.createElement("div");controls.className="orlong-batch-controls";
  const skip=document.createElement("button");skip.type="button";skip.textContent="SKIP ANIMATION";
  const closeButton=document.createElement("button");closeButton.type="button";closeButton.textContent="CONTINUE";closeButton.hidden=true;
  controls.append(skip,closeButton);panel.append(eyebrow,title,subtitle,grid,source,controls);overlay.append(panel);document.body.append(overlay);document.body.classList.add("orlong-reveal-lock");
  let finished=false;
  const finishBatch=()=>{if(finished)return;finished=true;overlay.classList.add("is-revealed");skip.hidden=true;closeButton.hidden=false;subtitle.textContent=cards.length+" discoveries are now yours";};
  const closeBatch=()=>{if(!overlay.isConnected)return;stopScore();overlay.classList.remove("is-active");window.setTimeout(()=>{overlay.remove();document.body.classList.remove("orlong-reveal-lock");active=false;const resolve=activeResolver;activeResolver=null;if(resolve)resolve();startNext();},250);};
  skip.addEventListener("click",finishBatch);closeButton.addEventListener("click",closeBatch);
  overlay.addEventListener("keydown",event=>{if(event.key==="Escape"&&finished)closeBatch();});
  requestAnimationFrame(()=>overlay.classList.add("is-active"));
  if(!reduced()){try{score=new Audio("/assets/audio/reveal-soundtrack.mp3");score.volume=.9;score.preload="auto";const p=score.play();if(p?.catch)p.catch(()=>{});}catch(_){}}
  await wait(reduced()?80:1250);finishBatch();
 }
 window.OrlongCardReveal={play,playBatch,closeActive:()=>{const overlay=document.querySelector(".orlong-reveal-overlay");if(overlay)close(overlay);}};
})();