import test from 'node:test';import assert from 'node:assert/strict';
import {Race,angleDiff,clamp} from '../src/core.js';
import {COASTS,resolveShoreContact} from '../v2/coast.js';
test('Shore contact remains finite even at exact island centre',()=>{const r=new Race();r.state='racing';const c=COASTS[0];Object.assign(r.player,{x:c.x,z:c.z,speed:5});resolveShoreContact(r);assert.ok(Number.isFinite(r.player.x)&&Number.isFinite(r.player.z));assert.ok(Math.hypot((r.player.x-c.x)/(c.s*16.5),(r.player.z-c.z)/(c.s*10.7))>=1);assert.ok(r.player.speed<5);});
test('Coastline guards preserve open water and paused simulation',()=>{const r=new Race();r.state='racing';const before=JSON.stringify(r.racers);resolveShoreContact(r);assert.equal(JSON.stringify(r.racers),before);r.state='paused';Object.assign(r.player,{x:COASTS[0].x,z:COASTS[0].z});const p=JSON.stringify(r.racers);resolveShoreContact(r);assert.equal(JSON.stringify(r.racers),p)});
for(const sea of ['calm','swell'])test('Full two-lap course is drivable with all island guards: '+sea,()=>{const r=new Race({laps:2,sea});r.start();let loops=0;
 while(!['finished'].includes(r.state)&&loops++<60000){const p=r.player,t=r.target;const desired=Math.atan2(t.x-p.x,t.z-p.z);r.step(1/60,{auto:true,steer:clamp(angleDiff(desired,p.heading)*2.4,-1,1)});resolveShoreContact(r)}
 assert.equal(r.state,'finished');assert.equal(r.player.passed,12);assert.ok(r.racers.slice(1).every(p=>p.passed>=6));
});
