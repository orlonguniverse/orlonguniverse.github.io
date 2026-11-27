/* Optional Orlong soundtrack: resumes at the previous position after page navigation. */
(() => {
 if(window.OrlongMusic)return;
 if(!document.querySelector("link[data-orlong-audio-css]")){const style=document.createElement("link");style.rel="stylesheet";style.href="/assets/css/orlong-audio.css?v=stage-6e";style.dataset.orlongAudioCss="true";document.head.append(style);}
 const source="/assets/audio/background-music.mp3",enabledKey="orlongMusicEnabled",positionKey="orlongMusicPosition";
 let player=null,button=null,slider=null,note=null;
 const enabled=()=>localStorage.getItem(enabledKey)==="true";
 function setButton(){if(button){button.textContent=player&&!player.paused?"♫ SOUNDTRACK: ON":"♫ SOUNDTRACK: OFF";button.setAttribute("aria-pressed",String(!!player&&!player.paused));}}
 function ensurePlayer(){
  if(player)return player;
  player=new Audio(source);player.loop=true;player.preload="auto";player.volume=Number(localStorage.getItem("orlongMusicVolume")??"0.28");
  player.addEventListener("play",setButton);player.addEventListener("pause",setButton);
  player.addEventListener("timeupdate",()=>{if(!player.seeking)sessionStorage.setItem(positionKey,String(player.currentTime));});
  player.addEventListener("ended",()=>sessionStorage.setItem(positionKey,"0"));
  return player;
 }
 async function start(){
  const p=ensurePlayer();
  if(p.dataset.positionRestored!=="true"){
   const saved=Number(sessionStorage.getItem(positionKey)||"0");
   if(saved>0){await new Promise(resolve=>{const done=()=>{p.removeEventListener("loadedmetadata",done);resolve();};p.addEventListener("loadedmetadata",done,{once:true});if(p.readyState>=1)resolve();});try{p.currentTime=Math.min(saved,Math.max(0,(p.duration||saved)-1));}catch(_){}}
   p.dataset.positionRestored="true";
  }
  try{await p.play();localStorage.setItem(enabledKey,"true");if(note)note.textContent="Your soundtrack preference is saved on this device.";setButton();}
  catch(error){localStorage.setItem(enabledKey,"true");if(note)note.textContent="Your browser needs one more interaction before music can start. Press the soundtrack button again.";setButton();}
 }
 function stop(){if(player){sessionStorage.setItem(positionKey,String(player.currentTime||0));player.pause();}localStorage.setItem(enabledKey,"false");setButton();}
 function mount(){
  const slot=document.getElementById("orlongMenuMusicSlot");if(!slot||slot.dataset.mounted)return;
  slot.dataset.mounted="true";slot.classList.add("orlong-menu-music");
  const heading=document.createElement("span");heading.className="orlong-menu-section-label";heading.textContent="SOUNDTRACK";
  button=document.createElement("button");button.type="button";button.className="orlong-menu-music-toggle";button.addEventListener("click",()=>{if(player&&!player.paused)stop();else start();});
  note=document.createElement("p");note.className="orlong-menu-music-note";note.textContent="Optional background music. Playback resumes from where you left off as you navigate.";
  const label=document.createElement("label");label.className="orlong-menu-volume-label";label.textContent="VOLUME";
  slider=document.createElement("input");slider.type="range";slider.min="0";slider.max="1";slider.step=".01";slider.value=String(Number(localStorage.getItem("orlongMusicVolume")??"0.28"));slider.setAttribute("aria-label","Background music volume");
  slider.addEventListener("input",()=>{const value=Number(slider.value);localStorage.setItem("orlongMusicVolume",String(value));if(player)player.volume=value;});
  label.append(slider);slot.append(heading,button,label,note);setButton();
  if(enabled())start();
 }
 window.OrlongMusic={play:start,pause:stop,toggle:()=>player&&!player.paused?stop():start(),setVolume:value=>{const v=Math.max(0,Math.min(1,Number(value)));localStorage.setItem("orlongMusicVolume",String(v));if(player)player.volume=v;if(slider)slider.value=String(v);}};
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();