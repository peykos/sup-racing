import {Race, COURSE, COLORS, clamp, angleDiff, distance, formatTime} from '../src/core.js';
import {createWorld, COASTS} from './world.js';
import {resolveShoreContact} from './coast.js';
const $=id=>document.getElementById(id);
const names=['LEO','MAYA','NOA'];
const notes=['Καπέλο στον ήλιο. Κουπί στο νερό.','Σταθερό βλέμμα. Δυνατή κουπιά.','Ελεύθερο πνεύμα. Καθαρός ρυθμός.'];
const race=new Race();
let world,selected=0,cameraMode='chase',auto=false,sound=false,ready=false,quality='high',lastState='',shownFinish=false;
let last=performance.now(),mapFrame=0,helpPaused=false,toastUntil=0,animationFrame=0;
const keys=new Set(),pointers=new Map();
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
let audio;
function beep(freq=440,length=.1){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+length);}catch{}}
function toast(text,seconds=2){$('toast').textContent=text;$('toast').style.opacity='1';toastUntil=performance.now()+seconds*1000;}
function clearInput(){keys.clear();pointers.clear();document.querySelectorAll('.hold').forEach(b=>{b.classList.remove('pressed');b.setAttribute('aria-pressed','false')});}
function down(action){return keys.has(action)||[...pointers.values()].includes(action);}
function input(){return {steer:(down('right')?1:0)-(down('left')?1:0),sprint:down('sprint'),auto:auto||down('auto')};}
function stroke(side){if(race.stroke(side)){beep(side<0?180:215,.09);return true}return false;}
function closeDialogs(){for(const d of document.querySelectorAll('dialog[open]'))d.close();helpPaused=false;}
function start(){if(!ready)return;closeDialogs();clearInput();race.reset({laps:Number($('laps').value),difficulty:$('difficulty').value,sea:$('sea').value});race.start();shownFinish=false;lastState='';last=performance.now();world.selectRider(selected);syncState();beep(440,.13);}
function menu(){closeDialogs();clearInput();auto=false;race.reset();shownFinish=false;lastState='';syncState();world.selectRider(selected);}
function pause(){clearInput();if(['racing','countdown'].includes(race.state)){race.pause();$('pausePanel').showModal();syncState();}}
function resume(){if($('pausePanel').open)$('pausePanel').close();race.resume();clearInput();last=performance.now();syncState();}
function showHelp(){helpPaused=['racing','countdown'].includes(race.state);if(helpPaused){race.pause();clearInput();syncState()}$('helpPanel').showModal();}
function closeHelp(){if($('helpPanel').open)$('helpPanel').close();if(helpPaused){race.resume();helpPaused=false;last=performance.now();syncState()}}
function syncState(){const s=race.state;if(s===lastState)return;lastState=s;document.body.dataset.state=ready?s:'loading';
  const game=s!=='menu';$('menu').hidden=game;$('hud').hidden=!game;$('controls').hidden=!game||s==='paused'||s==='finished';$('keyboardHelp').hidden=!game||s==='paused'||s==='finished';$('cameraBtn').hidden=!game;$('pauseBtn').hidden=!['racing','countdown'].includes(s);$('countdown').hidden=s!=='countdown';
  if(s==='finished'&&!shownFinish)finish();
}
function finish(){shownFinish=true;clearInput();beep(660,.35);$('finishTitle').textContent=race.place===1?'Πρώτος στο κύμα!':'Ωραίος αγώνας.';$('finishPlace').innerHTML=`${race.place}<small>${race.place===1?'ος':'η'}</small>`;$('finishTime').textContent=formatTime(race.player.finishedAt);
  const namespace=new URLSearchParams(location.search).has('qa')?'tide:qa:v2':'tide:v2';
  const k=`${namespace}:best:${race.options.laps}:${race.options.difficulty}:${race.options.sea}`;
  const previous=Number(store.get(k));const best=!previous||race.time<previous;if(best)store.set(k,String(race.time));$('bestTime').textContent=best?'Νέο προσωπικό ρεκόρ σε αυτές τις ρυθμίσεις.':`Προσωπικό ρεκόρ · ${formatTime(previous)}`;
  $('ranking').replaceChildren();race.order().forEach((r,i)=>{const li=document.createElement('li');li.className=r.id===0?'you':'';const pos=document.createElement('span');pos.textContent=String(i+1);const dot=document.createElement('i');dot.style.background=COLORS[r.id];const name=document.createElement('span');name.textContent=r.id===0?`${names[selected]} · ΕΣΥ`:r.name;const time=document.createElement('span');time.textContent=r.finishedAt===null?'Στη διαδρομή':formatTime(r.finishedAt);li.append(pos,dot,name,time);$('ranking').append(li);});
  $('strokeSummary').textContent=`${race.strokes} κουπιές · ${race.perfect} σε τέλειο ρυθμό`;$('results').showModal();
}
function hud(){
  $('place').innerHTML=`${race.place}<small>/ 5</small>`;$('lap').textContent=`${race.lap} / ${race.options.laps}`;$('timer').textContent=formatTime(race.time);
  $('speed').textContent=(race.player.speed*3.6).toFixed(1);$('energy').value=race.player.energy;$('energyText').textContent=Math.round(race.player.energy)+'%';$('draft').hidden=!race.player.draft;$('autoBadge').hidden=!(auto||down('auto'));
  $('progressFill').style.width=(race.progress*100)+'%';$('targetLabel').textContent=`${String(race.player.next+1).padStart(2,'0')} · ${Math.round(distance(race.player,race.target))} m`;
  const heading=Math.atan2(race.target.x-race.player.x,race.target.z-race.player.z);$('targetArrow').style.transform=`rotate(${angleDiff(heading,race.player.heading)}rad)`;
  const phase=clamp((race.time-race.player.lastStroke)/1.15,0,1);$('rhythmTick').style.left=`${phase*100}%`;$('rhythmLabel').textContent=race.player.quality==='perfect'?'Τέλεια!':'Εναλλάξ';
  $('countNumber').textContent=String(Math.max(1,Math.ceil(race.countdown)));$('sprintBtn').classList.toggle('boosting',race.player.boosting);$('autoBtn').setAttribute('aria-pressed',String(auto));
  if(mapFrame++%6===0)drawMap();
}
function drawMap(){const c=$('minimap'),ctx=c.getContext('2d');const w=c.width,h=c.height;ctx.clearRect(0,0,w,h);
  const p=(x,z)=>[(x+127)/295*w,(195-z)/305*h];
  ctx.fillStyle='#cfd9bd';for(const island of COASTS){const [x,y]=p(island.x,island.z);ctx.beginPath();ctx.ellipse(x,y,island.s*18/295*w,island.s*12/305*h,0,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#799c9580';ctx.lineWidth=2;ctx.setLineDash([4,5]);ctx.beginPath();COURSE.forEach((r,i)=>{const q=p(r.x,r.z);i?ctx.lineTo(...q):ctx.moveTo(...q)});ctx.closePath();ctx.stroke();ctx.setLineDash([]);
  COURSE.forEach((r,i)=>{const q=p(r.x,r.z);ctx.fillStyle=i===race.player.next?'#278b66':'#baab8c';ctx.beginPath();ctx.arc(...q,i===race.player.next?7:4,0,Math.PI*2);ctx.fill();});
  for(const r of [...race.racers].reverse()){const q=p(r.x,r.z);ctx.save();ctx.translate(...q);ctx.rotate(r.heading);ctx.fillStyle=r.id===0?'#ce553f':'#255754';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(5,6);ctx.lineTo(-5,6);ctx.closePath();ctx.fill();ctx.restore();}
}
function advance(dt,override){race.step(dt,override||input());resolveShoreContact(race);if(race.state==='racing'&&(down('paddleLeft')||down('paddleRight'))&&race.time-race.player.lastStroke>=.82){stroke(down('paddleLeft')&&down('paddleRight')?-race.player.lastSide:down('paddleLeft')?-1:1);}
  for(const event of race.events){if(event.type==='checkpoint')beep(720,.15);if(event.type==='go')beep(880,.22);}race.events.length=0;
  if(race.message&&race.clock<race.messageUntil)toast(race.message,.4);
  syncState();hud();world.update(race,dt,{mode:race.state==='menu'?'menu':'race',camera:cameraMode});
}
function frame(now){try{const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;advance(dt);world.render();if(now>toastUntil)$('toast').style.opacity='0';animationFrame=requestAnimationFrame(frame);}catch(e){window.__SUPReportError(e);}}
const keymap={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyQ:'paddleLeft',KeyE:'paddleRight',ShiftLeft:'sprint',ShiftRight:'sprint',Space:'auto'};
window.addEventListener('keydown',e=>{
  if(['SELECT','INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(keymap[e.code]&&['racing','countdown'].includes(race.state)){e.preventDefault();if(!e.repeat){keys.add(keymap[e.code]);if(e.code==='KeyQ')stroke(-1);if(e.code==='KeyE')stroke(1);}}
  if(!e.repeat){if((e.code==='Escape'||e.code==='KeyP')&&!$('helpPanel').open){e.preventDefault();race.state==='paused'?resume():pause()}if(e.code==='KeyC')$('cameraBtn').click();if(e.code==='KeyM')$('soundBtn').click();}
});
window.addEventListener('keyup',e=>{if(keymap[e.code])keys.delete(keymap[e.code]);});
for(const [id,action] of Object.entries({leftBtn:'left',rightBtn:'right',sprintBtn:'sprint',paddleLeft:'paddleLeft',paddleRight:'paddleRight'})){
  const b=$(id);b.addEventListener('pointerdown',e=>{if(!['racing','countdown'].includes(race.state))return;e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch{}pointers.set(e.pointerId,action);b.classList.add('pressed');b.setAttribute('aria-pressed','true');if(action==='paddleLeft')stroke(-1);if(action==='paddleRight')stroke(1);});
  const release=e=>{pointers.delete(e.pointerId);if(![...pointers.values()].includes(action)){b.classList.remove('pressed');b.setAttribute('aria-pressed','false')}};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
}
$('startBtn').onclick=start;$('resumeBtn').onclick=resume;$('pauseBtn').onclick=pause;$('restartPause').onclick=start;$('replayBtn').onclick=start;$('menuPause').onclick=menu;$('menuResult').onclick=menu;
$('homeLink').onclick=e=>{e.preventDefault();if(ready)menu()};$('autoBtn').onclick=()=>{auto=!auto;hud()};
$('helpBtn').onclick=showHelp;$('pauseHelp').onclick=showHelp;$('closeHelp').onclick=closeHelp;$('gotIt').onclick=closeHelp;
$('helpPanel').addEventListener('cancel',e=>{e.preventDefault();closeHelp()});$('pausePanel').addEventListener('cancel',e=>{e.preventDefault();resume()});$('results').addEventListener('cancel',e=>{e.preventDefault();menu()});
$('cameraBtn').onclick=()=>{cameraMode=cameraMode==='chase'?'wide':'chase';$('cameraBtn').setAttribute('aria-pressed',String(cameraMode==='wide'));};
$('soundBtn').onclick=()=>{sound=!sound;$('soundBtn').setAttribute('aria-pressed',String(sound));$('soundBtn').setAttribute('aria-label',sound?'Απενεργοποίηση ήχου':'Ενεργοποίηση ήχου');beep(550,.1)};
$('qualityBtn').onclick=()=>{if(!world)return;quality=quality==='high'?'low':'high';world.setQuality(quality);setQualityUI()};
function setQualityUI(){$('qualityBtn').textContent=quality==='high'?'HD':'ECO';$('qualityBtn').setAttribute('aria-pressed',String(quality==='high'));$('qualityBtn').setAttribute('aria-label',`Ποιότητα: ${quality==='high'?'υψηλή':'χαμηλή'}. Αλλαγή ποιότητας`)}
for(const b of document.querySelectorAll('[data-rider]'))b.onclick=()=>{selected=Number(b.dataset.rider);for(const c of document.querySelectorAll('[data-rider]')){const active=c===b;c.classList.toggle('selected',active);c.setAttribute('aria-pressed',String(active))}$('riderName').innerHTML=`${names[selected]}<span>0${selected+1}</span>`;$('riderNote').textContent=notes[selected];if(world)world.selectRider(selected);};
window.addEventListener('resize',()=>world?.resize());window.addEventListener('blur',()=>{clearInput();pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pause()}});
async function boot(){try{
  world=await createWorld($('ocean'),text=>{$('status').textContent=text});world.selectRider(selected);quality=world.info().quality;setQualityUI();ready=true;$('startBtn').disabled=false;$('startLabel').textContent='Πάμε για κουπί';$('status').textContent='BLENDER → GLB → BABYLON.JS · ORIGINAL LOW-POLY WORLD';lastState='';syncState();drawMap();
  window.__SUP={ready:true,race,world,start,menu,pause,resume,advance,clearInput,selectRider:i=>document.querySelector(`[data-rider="${i}"]`).click(),snapshot:()=>({race:race.snapshot(),world:world.info(),errors:window.__SUP_ERRORS}),stop:()=>{cancelAnimationFrame(animationFrame);world.dispose()}};
  last=performance.now();animationFrame=requestAnimationFrame(frame);
  if(new URLSearchParams(location.search).get('qa')==='run')import('./qa.js').then(m=>m.runQA(window.__SUP)).catch(window.__SUPReportError);
}catch(e){window.__SUPReportError(e);}}
boot();
