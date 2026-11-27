/* ORLONG CARD REVEAL — visual-only presentation of a server-awarded card. */
(() => {
  if (window.OrlongCardReveal) return;
  const audioRoot = "/assets/audio/";
  const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rarityMap = {
    common:{label:"COMMON",colour:"#c8d0da"},
    uncommon:{label:"UNCOMMON",colour:"#54d69a"},
    rare:{label:"RARE",colour:"#42a5ff"},
    epic:{label:"EPIC",colour:"#bd72ff"},
    legendary:{label:"LEGENDARY",colour:"#f2c75c"}
  };
  let active = false, audio = null, timers = [];
  function sound(file, volume=0.72) {
    try {
      if (audio) { audio.pause(); audio.currentTime = 0; }
      audio = new Audio(audioRoot + file);
      audio.volume = volume;
      const promise = audio.play();
      if (promise?.catch) promise.catch(()=>{});
    } catch (_) {}
  }
  function clearTimers(){timers.forEach(clearTimeout);timers=[];}
  function close(overlay) {
    clearTimers();
    if(audio){audio.pause();audio.currentTime=0;audio=null;}
    overlay?.classList.remove("orlong-reveal-active");
    window.setTimeout(()=>overlay?.remove(),650);
    document.body.classList.remove("orlong-reveal-lock");
    active=false;
  }
  function stage(overlay,name){overlay.dataset.stage=name;}
  function makeOverlay(card) {
    const overlay=document.createElement("div");
    overlay.className="orlong-reveal-overlay";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-label","New collectible card reveal");
    const rarity=rarityMap[String(card.rarity||"common").toLowerCase()]||rarityMap.common;
    overlay.style.setProperty("--reveal-rarity",rarity.colour);
    const panel=document.createElement("div");panel.className="orlong-reveal-scene";
    const energy=document.createElement("div");energy.className="orlong-reveal-energy";
    for(let i=0;i<34;i++){const p=document.createElement("i");p.style.setProperty("--particle-index",i);energy.append(p);}
    const crystal=document.createElement("div");crystal.className="orlong-reveal-crystal";crystal.setAttribute("aria-hidden","true");
    const cardWrap=document.createElement("div");cardWrap.className="orlong-reveal-card-wrap";
    const cardFace=document.createElement("div");cardFace.className="orlong-reveal-card";
    const back=document.createElement("div");back.className="orlong-reveal-card-back";
    const front=document.createElement("div");front.className="orlong-reveal-card-front";
    const img=document.createElement("img");img.className="orlong-reveal-art";img.alt=card.name+" collectible card";img.src=card.artwork||"";
    if(!card.artwork)img.hidden=true;
    const meta=document.createElement("div");meta.className="orlong-reveal-meta";
    const badge=document.createElement("span");badge.className="orlong-reveal-rarity";badge.textContent=rarity.label;
    const number=document.createElement("span");number.className="orlong-reveal-number";number.textContent=card.number||"ORLONG ARCHIVE";
    const name=document.createElement("h2");name.className="orlong-reveal-name";name.textContent=card.name||"UNKNOWN DISCOVERY";
    const description=document.createElement("p");description.className="orlong-reveal-description";description.textContent=card.description||"A new discovery has entered your collection.";
    const collection=document.createElement("span");collection.className="orlong-reveal-collection";collection.textContent="ADDED TO YOUR COLLECTION";
    meta.append(badge,number,name,description,collection);front.append(img,meta);cardFace.append(back,front);cardWrap.append(cardFace);
    const caption=document.createElement("p");caption.className="orlong-reveal-caption";caption.textContent="SOMETHING ANCIENT IS AWAKENING";
    const controls=document.createElement("div");controls.className="orlong-reveal-controls";
    const skip=document.createElement("button");skip.type="button";skip.className="orlong-reveal-skip";skip.textContent="SKIP REVEAL";
    const closeButton=document.createElement("button");closeButton.type="button";closeButton.className="orlong-reveal-close";closeButton.textContent="CONTINUE";
    closeButton.hidden=true;
    controls.append(skip,closeButton);
    panel.append(energy,crystal,cardWrap,caption,controls);overlay.append(panel);
    skip.addEventListener("click",()=>{if(audio){audio.pause();audio=null;}stage(overlay,"complete");overlay.classList.add("orlong-reveal-complete");closeButton.hidden=false;skip.hidden=true;});
    closeButton.addEventListener("click",()=>close(overlay));
    overlay.addEventListener("keydown",e=>{if(e.key==="Escape")close(overlay);});
    return overlay;
  }
  async function play(card) {
    if(active || !card || !card.name) return;
    active=true;
    const overlay=makeOverlay(card);
    document.body.append(overlay);document.body.classList.add("orlong-reveal-lock");
    requestAnimationFrame(()=>overlay.classList.add("orlong-reveal-active"));
    const caption=overlay.querySelector(".orlong-reveal-caption");
    const skip=overlay.querySelector(".orlong-reveal-skip");
    const closeButton=overlay.querySelector(".orlong-reveal-close");
    const finish=()=>{stage(overlay,"complete");overlay.classList.add("orlong-reveal-complete");caption.textContent="A NEW DISCOVERY ENTERS YOUR COLLECTION";skip.hidden=true;closeButton.hidden=false;};
    if(reducedMotion()){finish();return;}
    try {
      stage(overlay,"awakening");sound("awakening.mp3",0.78);caption.textContent="THE ORLONG FIELD STIRS";await wait(2300);
      if(!overlay.isConnected)return;
      stage(overlay,"energy");sound("energy.mp3",0.64);caption.textContent="ENERGY GATHERS";await wait(1900);
      stage(overlay,"materialising");sound("materialisation.mp3",0.78);caption.textContent="A FORM TAKES SHAPE";await wait(1700);
      stage(overlay,"flipping");sound("card-flip.mp3",0.8);caption.textContent="A DISCOVERY AWAITS";await wait(1150);
      if(!overlay.isConnected)return;
      stage(overlay,"rarity");sound("rarity-reveal.mp3",0.86);caption.textContent=String(card.rarity||"COMMON").toUpperCase()+" — ITS POWER IS REVEALED";await wait(1600);
      if(!overlay.isConnected)return;
      stage(overlay,"revealed");sound("final-impact.mp3",0.92);caption.textContent=card.name.toUpperCase();await wait(1150);
      finish();
    } catch(error){console.warn("Card reveal ended early:",error);finish();}
  }
  window.OrlongCardReveal={play,closeActive:()=>{const overlay=document.querySelector(".orlong-reveal-overlay");if(overlay)close(overlay);}};
})();