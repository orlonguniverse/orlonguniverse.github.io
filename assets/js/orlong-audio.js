/* Optional, user-controlled Orlong background music. */
(() => {
  if (window.OrlongMusic) return;
  const source="/assets/audio/background-music.mp3";
  const storageKey="orlongMusicEnabled";
  let player=null,button=null,panel=null,slider=null;
  const enabled=()=>localStorage.getItem(storageKey)==="true";
  function setButton(){if(button){button.textContent=player&&!player.paused?"♫ MUSIC ON":"♫ MUSIC";button.setAttribute("aria-pressed",String(!!player&&!player.paused));}}
  function ensurePlayer(){if(player)return player;player=new Audio(source);player.loop=true;player.preload="none";player.volume=Number(localStorage.getItem("orlongMusicVolume")||"0.28");player.addEventListener("play",setButton);player.addEventListener("pause",setButton);return player;}
  async function start(){const p=ensurePlayer();try{await p.play();localStorage.setItem(storageKey,"true");setButton();}catch(error){localStorage.setItem(storageKey,"false");setButton();if(panel){const note=panel.querySelector(".orlong-music-note");if(note)note.textContent="Playback was blocked. Press play again to start music.";}}}
  function stop(){if(player)player.pause();localStorage.setItem(storageKey,"false");setButton();}
  function mount(){
    if(document.getElementById("orlongMusicControl"))return;
    const style=document.createElement("link");style.rel="stylesheet";style.href="/assets/css/orlong-audio.css?v=stage-6a";document.head.append(style);
    const wrap=document.createElement("div");wrap.className="orlong-music-widget";wrap.id="orlongMusicControl";
    const controls=document.createElement("div");controls.className="orlong-music-controls";
    button=document.createElement("button");button.type="button";button.className="orlong-music-toggle";button.setAttribute("aria-label","Toggle background music");button.addEventListener("click",()=>{if(player&&!player.paused)stop();else start();});
    const settings=document.createElement("button");settings.type="button";settings.className="orlong-music-settings";settings.textContent="⚙";settings.setAttribute("aria-label","Music settings");settings.addEventListener("click",()=>{panel.hidden=!panel.hidden;});
    panel=document.createElement("div");panel.className="orlong-music-panel";panel.hidden=true;
    const heading=document.createElement("strong");heading.textContent="ORLONG SOUNDTRACK";
    const note=document.createElement("p");note.className="orlong-music-note";note.textContent="Background music is optional. Your choice is remembered on this device.";
    const volumeLabel=document.createElement("label");volumeLabel.textContent="VOLUME";
    slider=document.createElement("input");slider.type="range";slider.min="0";slider.max="1";slider.step=".01";slider.value=String(Number(localStorage.getItem("orlongMusicVolume")||"0.28"));slider.setAttribute("aria-label","Background music volume");
    slider.addEventListener("input",()=>{const value=Number(slider.value);localStorage.setItem("orlongMusicVolume",String(value));if(player)player.volume=value;});
    const close=document.createElement("button");close.type="button";close.className="orlong-music-close";close.textContent="CLOSE";close.addEventListener("click",()=>panel.hidden=true);
    volumeLabel.append(slider);panel.append(heading,note,volumeLabel,close);controls.append(button,settings);wrap.append(controls,panel);document.body.append(wrap);
    setButton();
    if(enabled())start();
  }
  window.OrlongMusic={play:start,pause:stop,toggle:()=>player&&!player.paused?stop():start(),setVolume:value=>{const v=Math.max(0,Math.min(1,Number(value)));localStorage.setItem("orlongMusicVolume",String(v));if(player)player.volume=v;if(slider)slider.value=String(v);}};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();