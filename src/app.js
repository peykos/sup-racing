import {Race,COURSE,COLORS,clamp,angleDiff,distance,formatTime} from './core.js';
import {OceanView} from './scene.js';
const $=id=>document.getElementById(id);
const qa=false; // Public static build: local QA uploader is intentionally disabled.
const race=new Race();let view;
const keys=new Set(),touch={left:new Set(),right:new Set(),paddleLeft:new Set(),paddleRight:new Set(),sprint:new Set()};
let audio=null,audioOn=false,lastState='',lastStatus=0;
function clearInput(){keys.clear();Object.values(touch).forEach(s=>s.clear());document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));}
function options(){return {laps:Number($('laps').value),difficulty:$('difficulty').value,sea:$('sea').value};}
function start(){clearInput();race.reset(options());race.start();lastState='';syncUI();}
function toMenu(){clearInput();race.reset(options());lastState='';syncUI();}
function pause(){if(race.state==='paused')race.resume();else race.pause();clearInput();syncUI();}
function beep(freq=.5,kind='stroke'){
  if(!audioOn||!audio)return;
  if(audio.state==='suspended')audio.resume().catch(()=>{});
  const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();
  o.type=kind==='stroke'?'sine':'triangle';o.frequency.setValueAtTime(kind==='stroke'?165:500+freq*150,t);o.frequency.exponentialRampToValueAtTime(kind==='stroke'?70:650+freq*100,t+.11);
  g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.035,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+.2);
}
function sound(){try{if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();audioOn=!audioOn;$('soundBtn').setAttribute('aria-pressed',String(audioOn));$('soundBtn').setAttribute('aria-label',audioOn?'Απενεργοποίηση ήχου':'Ενεργοποίηση ήχου');$('soundBtn').querySelector('.offmark').hidden=audioOn;if(audioOn){audio.resume().catch(()=>{});beep(1,'bell');}}catch{race.say('Ο browser δεν υποστηρίζει ήχο.');}}
async function full(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{race.say('Η πλήρης οθόνη δεν υποστηρίζεται εδώ.');}}
function setCamera(){view.mode=(view.mode+1)%2;race.say(view.mode?'ΠΑΝΟΡΑΜΙΚΗ ΚΑΜΕΡΑ':'ΚΑΜΕΡΑ ΚΑΤΑΔΙΩΞΗΣ');}
function readInput(){
  const left=keys.has('KeyA')||keys.has('ArrowLeft')||touch.left.size;
  const right=keys.has('KeyD')||keys.has('ArrowRight')||touch.right.size;
  const l=keys.has('KeyQ')||touch.paddleLeft.size,r=keys.has('KeyE')||touch.paddleRight.size;
  if(race.state==='racing'&&race.time-race.player.lastStroke>=.89&&(l||r))race.stroke(l&&r?-race.player.lastSide:l?-1:1,race.player,true);
  return {steer:Number(!!right)-Number(!!left),auto:keys.has('Space')||keys.has('KeyW')||keys.has('ArrowUp'),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')||!!touch.sprint.size};
}
function bindHold(id,channel,strokeSide){
  const b=$(id),held=touch[channel];
  b.addEventListener('pointerdown',e=>{if(race.state!=='racing'&&race.state!=='countdown')return;e.preventDefault();held.add(e.pointerId);b.classList.add('pressed');try{b.setPointerCapture(e.pointerId);}catch{}if(strokeSide)race.stroke(strokeSide);});
  const release=e=>{held.delete(e.pointerId);if(!held.size)b.classList.remove('pressed');};
  for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,release);
  b.addEventListener('contextmenu',e=>e.preventDefault());
}
bindHold('leftBtn','left');bindHold('rightBtn','right');bindHold('sprintBtn','sprint');bindHold('paddleLeft','paddleLeft',-1);bindHold('paddleRight','paddleRight',1);
const gameKeys=new Set(['Space','ArrowLeft','ArrowRight','ArrowUp','KeyW','KeyA','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight','KeyP','Escape','KeyR','KeyC','KeyM','KeyF']);
window.addEventListener('keydown',e=>{
  if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(!gameKeys.has(e.code))return;e.preventDefault();keys.add(e.code);if(e.repeat)return;
  if(e.code==='KeyQ')race.stroke(-1);if(e.code==='KeyE')race.stroke(1);
  if(e.code==='KeyP'||e.code==='Escape')pause();
  if(e.code==='KeyR'&&race.state!=='menu')start();if(e.code==='KeyC')setCamera();if(e.code==='KeyM')sound();if(e.code==='KeyF')full();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInput();race.pause();syncUI();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();race.pause();syncUI();}});
$('startBtn').addEventListener('click',start);$('pauseBtn').addEventListener('click',pause);$('resumeBtn').addEventListener('click',pause);
$('restartPause').addEventListener('click',start);$('menuPause').addEventListener('click',toMenu);$('replayBtn').addEventListener('click',start);$('menuResult').addEventListener('click',toMenu);
$('soundBtn').addEventListener('click',sound);$('viewBtn').addEventListener('click',setCamera);$('fullBtn').addEventListener('click',full);
for(const id of ['laps','difficulty','sea'])$(id).addEventListener('change',()=>{if(race.state==='menu')race.reset(options());});
const map=$('minimap').getContext('2d');
function minimap(){
  const c=map,w=180,h=180;c.clearRect(0,0,w,h);
  const point=p=>({x:90+p.x*.52,y:142-(p.z+95)*.52});
  c.strokeStyle='#dce9dd40';c.lineWidth=1.5;c.setLineDash([3,4]);c.beginPath();
  COURSE.forEach((p,i)=>{const q=point(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.closePath();c.stroke();c.setLineDash([]);
  COURSE.forEach((p,i)=>{const q=point(p);c.beginPath();c.arc(q.x,q.y,i===race.player.next?5:3,0,Math.PI*2);c.fillStyle=i===race.player.next?'#adffce':'#ffc1a1';c.fill();if(i===race.player.next){c.beginPath();c.arc(q.x,q.y,9,0,Math.PI*2);c.strokeStyle='#adffce50';c.stroke();}});
  for(const r of [...race.racers].reverse()){
    const q=point(r);c.save();c.translate(q.x,q.y);c.rotate(r.heading);c.fillStyle=COLORS[r.id];c.strokeStyle='#063445';c.lineWidth=1.5;
    c.beginPath();c.moveTo(0,-6);c.lineTo(4,4);c.lineTo(0,2);c.lineTo(-4,4);c.closePath();c.fill();c.stroke();c.restore();
  }
}
function results(){
  $('finishTitle').textContent=race.place===1?'Το κύμα είναι δικό σου.':'Ωραίος αγώνας.';
  $('finishPlace').innerHTML=race.place+'<small>ος</small>';$('finishTime').textContent=formatTime(race.time);
  const key=`tide.best.v1.${race.options.laps}.${race.options.difficulty}.${race.options.sea}`;
  let best=0,isBest=false;
  try{best=Number(localStorage.getItem(key))||0;if(!Number.isFinite(best)||best<0)best=0;if(!best||race.time<best){isBest=true;best=race.time;if(!qa)localStorage.setItem(key,String(best));}}catch{}
  $('bestTime').textContent=isBest?'Νέο προσωπικό ρεκόρ!':'Καλύτερος: '+formatTime(best);
  $('ranking').replaceChildren();
  race.order().forEach((r,i)=>{const row=document.createElement('div');row.className=r.id===0?'you':'';const pos=document.createElement('b');pos.textContent=String(i+1);const dot=document.createElement('i');dot.style.background=COLORS[r.id];const name=document.createElement('span');name.textContent=r.name;const score=document.createElement('span');score.textContent=r.finishedAt!==null?formatTime(r.finishedAt):Math.floor(r.passed/(COURSE.length*race.options.laps)*100)+'% διαδρομής';row.append(pos,dot,name,score);$('ranking').append(row);});
  $('strokeSummary').textContent=`${race.strokes} κουπιές · ${race.perfect} σε τέλειο ρυθμό · ${Math.round(race.totalDistance)} m διαδρομή`;
}
function syncUI(){
  const state=race.state;
  if(state!==lastState){
    $('menu').hidden=state!=='menu';$('hud').hidden=state==='menu'||state==='finished';
    $('controls').hidden=!['racing','countdown'].includes(state);
    $('pausePanel').hidden=state!=='paused';$('results').hidden=state!=='finished';
    $('pauseBtn').hidden=!['racing','countdown'].includes(state);
    document.body.classList.toggle('playing',state!=='menu');
    if(state==='finished'){clearInput();results();}
    lastState=state;
  }
  const p=race.player;
  $('countdown').hidden=state!=='countdown';$('countdown').textContent=Math.max(1,Math.ceil(race.countdown));
  $('place').innerHTML=race.place+'<span>/5</span>';$('lap').textContent=race.lap+' / '+race.options.laps;$('timer').textContent=formatTime(race.time);
  $('speed').textContent=(p.speed*3.6).toFixed(1);$('energyText').textContent=Math.round(p.energy)+'%';$('energyFill').style.width=p.energy+'%';$('energyFill').style.background=p.energy<25?'#ff9474':'#adffce';
  $('draft').classList.toggle('active',p.draft);$('sprintBtn').classList.toggle('pressed',p.boosting);
  $('targetLabel').textContent=String(p.next+1).padStart(2,'0')+' · '+Math.round(distance(p,race.target))+' m';
  const a=angleDiff(Math.atan2(race.target.x-p.x,race.target.z-p.z),p.heading);$('targetArrow').style.transform=`rotate(${a}rad)`;
  $('rhythmTick').style.left=clamp((race.time-p.lastStroke)/1.2,0,1)*100+'%';
  $('toast').textContent=race.message;$('toast').style.opacity=race.clock<race.messageUntil?'1':'0';$('progressFill').style.width=race.progress*100+'%';
  minimap();
}
async function boot(){
  try{
    $('status').textContent='Κατασκευή ακτογραμμής…';view=new OceanView($('ocean'),race,{qa});
    let previous=performance.now();
    view.engine.runRenderLoop(()=>{
      const now=performance.now(),dt=Math.min((now-previous)/1000,.15);previous=now;
      const input=readInput();let remain=dt;while(remain>0){const step=Math.min(remain,.03);race.step(step,input);remain-=step;}
      for(const event of race.events.splice(0)){if(event.type==='stroke')beep(.4,'stroke');else if(['checkpoint','go','finish'].includes(event.type))beep(1,'bell');}
      syncUI();view.render(dt);
      if(now-lastStatus>1500){$('status').textContent=`BABYLON.JS · ${Math.round(view.engine.getFps())} FPS · SUP RACING`;lastStatus=now;}
    });
    await view.scene.whenReadyAsync();
    $('startBtn').disabled=false;$('startBtn').querySelector('span').textContent='ΜΠΕΣ ΣΤΟΝ ΑΓΩΝΑ';
  }catch(error){$('status').textContent='Ο renderer δεν ξεκίνησε.';$('error').hidden=false;$('error').textContent='Το παιχνίδι χρειάζεται WebGL. Άνοιξέ το σε ενημερωμένο Chrome ή Edge (όχι file://).\n'+error;window.__tideErrors.push(String(error));}
}
boot();
