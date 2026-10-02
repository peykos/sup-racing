// Opt-in QA runs only at ?qa=run; works in native Android Chrome without DevTools.
import {angleDiff} from '../src/core.js';
import {resolveShoreContact} from './coast.js';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function report(data){const r=await fetch('/__qa',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw Error('QA report HTTP '+r.status);}
function load(src){return new Promise((yes,no)=>{const s=document.createElement('script');s.src=src;s.onload=yes;s.onerror=no;document.head.append(s)})}
function rects(doc,ids){return ids.map(id=>{const r=doc.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}})}
const inside=(r,w,h)=>r.w>0&&r.h>0&&r.x>=-1&&r.y>=-1&&r.right<=w+1&&r.bottom<=h+1;
async function shot(api,name,doc=document){api.advance(.016);api.world.render();await report({name:'v2-'+name+'-canvas',image:doc.getElementById('ocean').toDataURL(),diagnostics:api.world.info()});
 const c=await window.html2canvas(doc.body,{scale:1,logging:false,backgroundColor:null,windowWidth:doc.defaultView.innerWidth,windowHeight:doc.defaultView.innerHeight});
 await report({name:'v2-'+name,image:c.toDataURL(),viewport:[doc.defaultView.innerWidth,doc.defaultView.innerHeight]});}
export async function runQA(api){const checks=[];const check=(name,pass,detail={})=>checks.push({name,pass:!!pass,detail});const $=id=>document.getElementById(id);const {race,world}=api;
 try{
 await report({name:'v2-started',ua:navigator.userAgent,info:world.info()});await load('vendor/html2canvas.min.js');await wait(1200);
 check('Real WebGL and water shader render',world.info().webGL>=1&&world.info().frames>5&&world.info().waterReady,world.info());
 check('Ready menu and five GLB racers',!$('startBtn').disabled&&world.info().instances===5);
 for(let i=0;i<3;i++){document.querySelector(`[data-rider="${i}"]`).click();await wait(250);check('Select '+['leo','maya','noa'][i],world.info().selected===['leo','maya','noa'][i]);await shot(api,'character-'+['leo','maya','noa'][i]);}
 api.selectRider(0);$('laps').value='1';$('startBtn').click();check('Start countdown via UI',race.state==='countdown');await wait(3400);
 check('Countdown advances in animation loop',race.state==='racing',{state:race.state,countdown:race.countdown});
 const key=(code,type='keydown')=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true,cancelable:true}));
 const before={z:race.player.z,strokes:race.strokes,frames:world.info().frames};key('Space');await wait(1900);key('Space','keyup');
 check('Keyboard auto paddles move the board',race.strokes>before.strokes&&race.player.z>before.z,{before,after:race.snapshot()});
 check('Real frames continue rendering',world.info().frames-before.frames>10,{deltaFrames:world.info().frames-before.frames});
 const h=race.player.heading;key('KeyD');await wait(350);key('KeyD','keyup');check('Steering key changes heading',angleDiff(race.player.heading,h)>0);
 const n=race.strokes;const paddle=$('paddleLeft');paddle.dispatchEvent(new PointerEvent('pointerdown',{pointerId:91,pointerType:'touch',bubbles:true,cancelable:true}));await wait(1500);paddle.dispatchEvent(new PointerEvent('pointerup',{pointerId:91,pointerType:'touch',bubbles:true}));
 check('Pointer hold repeats paddles and releases',race.strokes>n&&!paddle.classList.contains('pressed'));
 $('pauseBtn').click();const frozen=race.time;await wait(200);check('Pause stops simulation and shows dialog',race.state==='paused'&&frozen===race.time&&$('pausePanel').open);
 $('resumeBtn').click();check('Resume works',race.state==='racing'&&!$('pausePanel').open);
 $('cameraBtn').click();check('Wide camera toggles',$('cameraBtn').getAttribute('aria-pressed')==='true');$('cameraBtn').click();
 await shot(api,'native-race');
 let loops=0;while(race.state==='racing'&&loops<36000){for(let j=0;j<100&&race.state==='racing';j++,loops++){const p=race.player,t=race.target;race.step(1/60,{steer:Math.max(-1,Math.min(1,angleDiff(Math.atan2(t.x-p.x,t.z-p.z),p.heading)*2.4)),auto:true});resolveShoreContact(race);}if(loops%1000===0)await wait(1);}
 api.advance(.016);check('Full one-lap race via normal steering and paddling inputs',race.state==='finished'&&race.player.passed===6,{loops,finish:race.player.finishedAt});
 check('Results and ranking displayed',$('results').open&&$('ranking').children.length===5);await shot(api,'results');
 $('replayBtn').click();check('Replay resets state',race.state==='countdown'&&race.time===0&&race.strokes===0);api.menu();
 for(const [label,width,height] of [['portrait',390,780],['landscape',844,390],['desktop',1280,800]]){
  const iframe=document.createElement('iframe');iframe.style.cssText=`position:fixed;z-index:9999;left:0;top:0;width:${width}px;height:${height}px;transform:scale(.28);transform-origin:top left;border:0`;
  iframe.src='v2/?qa=frame&viewport='+label;document.body.append(iframe);let child;
  for(let i=0;i<150;i++){await wait(100);child=iframe.contentWindow?.__SUP;if(child?.ready)break;}
  if(!child){check(label+' loads',false);iframe.remove();continue;}
  const doc=iframe.contentDocument;await wait(450);
  const menuRects=rects(doc,['startBtn','laps','difficulty','sea']);check(label+' menu fits',menuRects.every(r=>inside(r,width,height)),{rects:menuRects});await shot(child,label+'-menu',doc);
  child.start();for(let i=0;i<205;i++)child.race.step(1/60,{});for(let i=0;i<500;i++)child.race.step(1/60,{auto:true});child.advance(.016);for(let i=0;i<30;i++){child.world.update(child.race,.03,{mode:'race'});child.world.render();}
  const r=rects(doc,['leftBtn','rightBtn','paddleLeft','paddleRight','sprintBtn']);const overlap=r.some((a,i)=>r.some((b,j)=>i<j&&a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y));
  check(label+' touch controls fit without overlaps',r.every(v=>inside(v,width,height))&&!overlap,{rects:r});await shot(child,label+'-race',doc);
  child.world.setQuality('low');child.world.render();check(label+' ECO mode works',child.world.info().quality==='low'&&child.world.info().waterReady);
  check(label+' no runtime errors',iframe.contentWindow.__SUP_ERRORS.length===0,{errors:iframe.contentWindow.__SUP_ERRORS});child.stop();iframe.remove();
 }
 api.menu();check('No JavaScript errors',window.__SUP_ERRORS.length===0,{errors:window.__SUP_ERRORS});
 }catch(e){check('QA runner exception',false,{error:String(e),stack:e.stack});}
 const summary={name:'v2-summary',url:location.href,timestamp:new Date().toISOString(),pass:checks.every(c=>c.pass),checks,info:world.info(),errors:window.__SUP_ERRORS};await report(summary);window.__SUP_QA=summary;return summary;
}
