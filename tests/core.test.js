import test from 'node:test';
import assert from 'node:assert/strict';
import {Race,COURSE,angleDiff,distance,waveAt,formatTime,courseLength} from '../src/core.js';
const advance=(race,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*60);i++)race.step(1/60,input);};
const racing=(options={})=>{const r=new Race(options);r.start();advance(r,3.05);assert.equal(r.state,'racing');return r;};
const pilot=(r,seconds=480)=>{
  for(let i=0;i<seconds*60&&r.state!=='finished';i++){
    const p=r.player,t=r.target,desired=Math.atan2(t.x-p.x,t.z-p.z);
    const steer=Math.max(-1,Math.min(1,angleDiff(desired,p.heading)*2.4));
    r.step(1/60,{auto:true,steer});
    if(i%300===0)assert.ok(r.racers.every(q=>Number.isFinite(q.x+q.z+q.speed+q.heading)));
  }
};
test('five racers, six ordered checkpoints and deterministic configuration',()=>{
  const a=new Race(),b=new Race();assert.deepEqual(a.snapshot(),b.snapshot());assert.equal(a.racers.length,5);assert.equal(COURSE.length,6);assert.ok(courseLength()>500);assert.equal(a.state,'menu');
});
test('settings reject invalid values',()=>{const r=new Race({laps:99,sea:'storm',difficulty:'impossible'});assert.deepEqual(r.options,{laps:2,sea:'calm',difficulty:'race'});});
test('countdown prevents paddling and then begins racing',()=>{const r=new Race();r.start();assert.equal(r.stroke(-1),false);advance(r,1);assert.equal(r.state,'countdown');assert.equal(r.player.speed,0);advance(r,2.1);assert.equal(r.state,'racing');});
test('individual paddle impulse, cooldown and finite speed',()=>{const r=racing();assert.ok(r.stroke(-1));assert.ok(r.player.speed>0);assert.equal(r.stroke(1),false);advance(r,.84);assert.ok(r.stroke(1));assert.equal(r.perfect,1);assert.equal(r.strokes,2);});
test('rapid spam does not receive perfect rhythm bonus',()=>{const r=racing();r.stroke(-1);advance(r,.4);r.stroke(1);assert.equal(r.perfect,0);});
test('automatic alternating strokes move the player without energy underflow',()=>{const r=racing();advance(r,15,{auto:true});assert.ok(r.player.z>-60);assert.ok(r.player.speed>3);assert.ok(r.strokes>10);assert.ok(r.player.energy>=0&&r.player.energy<=100);assert.equal(r.perfect,0);});
test('left and right steering produce opposite headings',()=>{const l=racing(),r=racing();advance(l,1,{steer:-1});advance(r,1,{steer:1});assert.ok(l.player.heading<0);assert.ok(r.player.heading>0);});
test('pausing freezes clock, race timer, position and countdown',()=>{for(const state of ['countdown','racing']){const r=state==='racing'?racing():new Race();if(state==='countdown')r.start();r.pause();const snap=r.snapshot(),clock=r.clock;advance(r,4,{auto:true});assert.deepEqual(r.snapshot(),snap);assert.equal(r.clock,clock);r.resume();assert.equal(r.state,state);}});
test('later checkpoints cannot be taken out of order',()=>{const r=racing();r.player.x=COURSE[3].x+4;r.player.z=COURSE[3].z;r.step(.01);assert.equal(r.player.passed,0);r.player.x=COURSE[0].x+4;r.player.z=COURSE[0].z;r.step(.01);assert.equal(r.player.passed,1);assert.equal(r.player.next,1);});
test('checkpoints advance once and finish requires all laps',()=>{const r=racing({laps:2});for(let lap=0;lap<2;lap++)for(let i=0;i<COURSE.length;i++){r.player.x=COURSE[i].x+4;r.player.z=COURSE[i].z;r.step(.01);assert.equal(r.player.passed,lap*6+i+1);}assert.equal(r.state,'finished');assert.equal(r.progress,1);assert.equal(r.lap,2);assert.ok(r.player.finishedAt>0);assert.equal(r.events.filter(e=>e.type==='finish').length,1);const time=r.time;advance(r,1);assert.equal(r.time,time);});
test('coasting loses speed and sprint depletes energy',()=>{const a=racing(),b=racing();advance(a,5,{auto:true});advance(b,5,{auto:true});const speed=a.player.speed;advance(a,3);assert.ok(a.player.speed<speed);advance(b,3,{auto:true,sprint:true});assert.ok(b.player.energy<90);assert.ok(b.player.speed>speed);advance(b,60,{auto:true,sprint:true});assert.ok(b.player.energy>=0&&b.player.speed<=8.8);});
test('drafting is detected behind a racer, not in front',()=>{const r=racing();Object.assign(r.player,{x:0,z:-50,heading:0});Object.assign(r.racers[1],{x:0,z:-43,heading:0});r.step(.01);assert.equal(r.player.draft,true);Object.assign(r.racers[1],{x:0,z:-65});r.step(.01);assert.equal(r.player.draft,false);});
test('buoy collision slows but never generates NaN at exact center',()=>{const r=racing();Object.assign(r.player,{x:COURSE[2].x,z:COURSE[2].z,speed:0});r.step(.01);assert.ok(Number.isFinite(r.player.x+r.player.z));assert.ok(distance(r.player,COURSE[2])>=1.5);});
test('boundary guard keeps the race inside the water domain',()=>{const r=racing();Object.assign(r.player,{x:220,z:400,speed:5});r.step(.01);assert.ok(r.player.x<=180&&r.player.z<=200);});
test('restart clears every result, stroke, checkpoint and input-independent state',()=>{const r=racing();advance(r,10,{auto:true});r.start();assert.equal(r.state,'countdown');assert.equal(r.time,0);assert.equal(r.strokes,0);assert.equal(r.player.passed,0);assert.equal(r.player.energy,100);assert.ok(r.racers.every(q=>q.finishedAt===null));});
test('invalid deltas cannot corrupt simulation',()=>{const r=racing();const state=r.snapshot();for(const dt of [NaN,Infinity,-1,0])r.step(dt,{auto:true});assert.deepEqual(r.snapshot(),state);});
test('AI completes the entire course at every difficulty without teleporting',()=>{for(const difficulty of ['cruise','race','pro']){const r=racing({laps:1,difficulty});advance(r,260);for(const a of r.racers.slice(1)){assert.ok(a.finishedAt!==null,`${difficulty}: ${a.name} stalled at checkpoint ${a.next}`);assert.equal(a.passed,6);}}});
test('complete two-lap races are drivable using the same steering/paddle inputs, on both seas',()=>{for(const sea of ['calm','swell']){const r=racing({laps:2,sea});pilot(r,480);assert.equal(r.state,'finished',`${sea}: checkpoint ${r.player.next}`);assert.equal(r.player.passed,12);assert.ok(r.time>60);assert.ok(r.time<480);}});
test('ranking prioritizes completed checkpoints and then target distance',()=>{const r=racing();r.racers[1].passed=1;r.racers[1].next=1;assert.equal(r.order()[0].id,1);r.player.finishedAt=100;r.racers[2].finishedAt=99;assert.equal(r.order()[0].id,2);assert.equal(r.place,2);});
test('time formatting and wave function are bounded and repeatable',()=>{assert.equal(formatTime(125.25),'02:05.2');assert.equal(formatTime(Infinity),'—');assert.equal(waveAt(1,2,3),waveAt(1,2,3));for(let i=0;i<100;i++)assert.ok(Math.abs(waveAt(i,i*2,i*.1,1.8))<1);});
