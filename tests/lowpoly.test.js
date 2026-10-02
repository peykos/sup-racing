import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Race} from '../src/core.js';
import {createWorld,RIDERS} from '../v2/world.js';
const root=new URL('../',import.meta.url);
const read=name=>fs.readFileSync(new URL('assets/lowpoly/'+name,root));
const names=['rider-leo.glb','rider-maya.glb','rider-noa.glb','coastal-kit.glb'];
for(const name of names)test('Low-poly GLB valid structure and mobile budget: '+name,()=>{
 const buf=read(name),d=JSON.parse(buf.subarray(20,20+buf.readUInt32LE(12)));
 assert.equal(buf.toString('ascii',0,4),'glTF');assert.equal(buf.readUInt32LE(4),2);assert.equal(buf.readUInt32LE(8),buf.length);
 assert.equal(d.asset.version,'2.0');assert.match(d.asset.generator,/Blender/);assert.ok(buf.length<500000);
 assert.equal((d.images||[]).length,0);assert.ok(d.buffers.every(b=>!b.uri));assert.ok(d.meshes.every(m=>m.primitives.every(p=>p.attributes.COLOR_0!==undefined)));
 const tris=d.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+d.accessors[p.indices].count/3,0);assert.ok(tris<3000);
 if(name.startsWith('rider')){
  assert.deepEqual(d.animations.map(a=>a.name).sort(),['Celebrate','Idle','Paddle_Left','Paddle_Right']);
  assert.ok(d.nodes.find(n=>n.name==='hips').translation[1]>.9);
  assert.ok(d.nodes.find(n=>n.name==='leftFoot').translation[1]>.3);
 }else assert.equal(d.meshes.length,15);
});
test('Three characters are genuinely different geometries',()=>{assert.equal(new Set(RIDERS.map(n=>read('rider-'+n+'.glb').toString('base64'))).size,3)});
test('Actual Babylon world imports, selects, independently samples and renders GLB scene',async t=>{
 const ctx=vm.createContext({console,setTimeout,clearTimeout,setInterval,clearInterval,TextDecoder,TextEncoder,URL,ArrayBuffer,Uint8Array,Float32Array,Blob,performance,atob,btoa});ctx.window=ctx;ctx.addEventListener=()=>{};ctx.removeEventListener=()=>{};
 vm.runInContext(fs.readFileSync(new URL('vendor/babylon.js',root),'utf8'),ctx);vm.runInContext(fs.readFileSync(new URL('vendor/babylonjs.loaders.min.js',root),'utf8'),ctx);
 const B=ctx.BABYLON;const previous=globalThis.BABYLON;globalThis.BABYLON=B;const engine=new B.NullEngine({renderWidth:1280,renderHeight:800});let world;
 t.after(()=>{world?.dispose();engine.dispose();globalThis.BABYLON=previous});
 const loaded=[];world=await createWorld(null,()=>{},{engine,load:async(name,scene)=>{loaded.push(name);return B.SceneLoader.LoadAssetContainerAsync('','data:;base64,'+read(name).toString('base64'),scene,undefined,'.glb')}});
 assert.equal(loaded.length,4);assert.equal(world.racers.length,5);assert.equal(world.containers.length,4);
 const race=new Race();world.update(race,.016,{mode:'menu'});world.render();
 for(let i=0;i<3;i++){
  world.selectRider(i);world.update(race,.016,{mode:'menu'});world.render();assert.equal(world.info().selected,RIDERS[i]);
  const m=world.racers[0].model;
  assert.ok(Object.values(m.groups).filter(Boolean).length>=4);
  const node=name=>m.entry.rootNodes.flatMap(r=>r.getDescendants(false)).find(n=>n.name.endsWith('-'+name));
  const blade=node('blade'),lf=node('leftFoot'),rf=node('rightFoot');
  world.racers[0].root.scaling.setAll(1);world.racers[0].root.rotation.setAll(0);world.racers[0].root.position.setAll(0);
  world.pose(m,'Paddle_Left',.38);world.scene.render();let left=blade.getAbsolutePosition().clone();
  world.pose(m,'Paddle_Right',.38);world.scene.render();let right=blade.getAbsolutePosition().clone();
  assert.ok(left.x<-.5&&right.x>.5,JSON.stringify({left:left.asArray(),right:right.asArray()}));
  assert.ok(lf.getAbsolutePosition().x<0&&rf.getAbsolutePosition().x>0);
  world.pose(m,'Celebrate',.5);world.scene.render();assert.ok(blade.getAbsolutePosition().y>2);
 }
 world.selectRider(0);race.start();for(let i=0;i<200;i++)race.step(1/60);race.stroke(-1);world.update(race,.016,{mode:'race'});world.render();
 assert.equal(world.racers[0].model.clip,'Paddle_Left');assert.notEqual(world.racers[0].model.entry.rootNodes[0],world.racers[3].model.entry.rootNodes[0]);
 assert.equal(world.info().prefabs,15);assert.ok(world.scene.meshes.length>100);world.setQuality('low');world.render();assert.equal(world.info().quality,'low');
 console.log('LOWPOLY_WORLD_OK',JSON.stringify(world.info()));
});
