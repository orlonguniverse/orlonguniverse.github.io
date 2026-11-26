// Shared navigation theme helper. Page-specific account controls remain managed by their existing auth scripts.
window.toggleSiteTheme=function(){
 const light=document.body.classList.toggle("light");
 document.body.classList.toggle("dark",!light);
 localStorage.setItem("orlongSiteTheme",light?"light":"dark");
 const button=document.getElementById("themeButton")||document.getElementById("contentsThemeButton");
 if(button)button.textContent=light?"DARK MODE":"LIGHT MODE";
};
document.addEventListener("DOMContentLoaded",()=>{
 const saved=localStorage.getItem("orlongSiteTheme");
 if(saved==="light"||saved==="dark"){
  document.body.classList.toggle("light",saved==="light");
  document.body.classList.toggle("dark",saved==="dark");
 }
 const button=document.getElementById("themeButton")||document.getElementById("contentsThemeButton");
 if(button)button.textContent=document.body.classList.contains("light")?"DARK MODE":"LIGHT MODE";
});