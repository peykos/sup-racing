// CPU integration checks: real Babylon 9 engine/GLTF loader, no WebGL mock.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const glb=fs.readFileSync(new URL('assets/rider/sup-rider.glb',root));
const json=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());

test('Blender GLB is self-contained and within mobile geometry budget',()=>{
  assert.equal(glb.toString('ascii',0,4),'glTF');assert.equal(glb.readUInt32LE(4),2);
  assert.equal(glb.readUInt32LE(8),glb.length);
  assert.equal(json.asset.version,'2.0');
  assert.ok(json.asset.generator.includes('Blender'));
  assert.ok(glb.length<1_500_000);
  assert.equal((json.images||[]).length,0);
  assert.ok(json.buffers.every(b=>!b.uri));
  assert.deepEqual(json.animations.map(a=>a.name).sort(),['Idle','Paddle_Left','Paddle_Right']);
  const triangles=json.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+json.accessors[p.indices].count/3,0);
  assert.ok(triangles<12000,`triangles: ${triangles}`);
  assert.ok(json.materials.some(m=>m.name==='TeamColor'));
  const hips=json.nodes.find(n=>n.name==='hips'),foot=json.nodes.find(n=>n.name==='leftFoot');
  assert.ok(hips.translation?.[1]>.9&&foot.translation?.[1]>.25,'valid default pose before animations start');
});

test('Real Babylon GLB import, independent instances, team colours, stroke sides and sampling',async t=>{
  const ctx=vm.createContext({console,setTimeout,clearTimeout,setInterval,clearInterval,TextDecoder,TextEncoder,URL,ArrayBuffer,Uint8Array,Float32Array,Blob,performance,atob,btoa});
  ctx.window=ctx;ctx.addEventListener=()=>{};ctx.removeEventListener=()=>{};
  vm.runInContext(fs.readFileSync(new URL('vendor/babylon.js',root),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(new URL('vendor/babylonjs.loaders.min.js',root),'utf8'),ctx);
  const B=ctx.BABYLON;assert.equal(B.Engine.Version,'9.14.0');
  const savedWindow=globalThis.window,savedFetch=globalThis.fetch;globalThis.window={BABYLON:B};
  let fetches=0;
  globalThis.fetch=async url=>{assert.equal(url,new URL('assets/rider/sup-rider.glb',root).href);fetches++;return new Response(glb);};
  const engine=new B.NullEngine(),scene=new B.Scene(engine);
  t.after(()=>{scene.dispose();engine.dispose();globalThis.window=savedWindow;globalThis.fetch=savedFetch;});
  const {loadRiderModels}=await import('../src/rider-model.js');
  const actors=Array.from({length:5},(_,i)=>({root:new B.TransformNode('racer-'+i,scene)}));
  const colors=['#89f0c1','#ffbe7a','#8cc7f2','#d5a4f1','#f18f92'];
  const result=await loadRiderModels(scene,actors,colors);
  assert.equal(fetches,1);assert.equal(result.instances,5);assert.equal(result.bytes,glb.length);
  const node=(i,name)=>scene.transformNodes.find(n=>n.name===`athlete-${i}-${name}`);
  const world=(i,name)=>{const n=node(i,name);assert.ok(n,name);n.computeWorldMatrix(true);return n.getAbsolutePosition().clone();};
  const leftFoot=world(0,'leftFoot'),rightFoot=world(0,'rightFoot');
  assert.ok(leftFoot.x<rightFoot.x,`left/right feet preserve Babylon handedness: ${leftFoot.asArray()} / ${rightFoot.asArray()}`);
  assert.ok(leftFoot.y>.25&&leftFoot.y<.4,'feet sit on original board deck');
  actors[0].model.update(true,.4,-1,0);const leftBlade=world(0,'blade');
  actors[0].model.update(true,.4,1,0);const rightBlade=world(0,'blade');
  assert.ok(leftBlade.x<-.3&&rightBlade.x>.3,`correct paddle sides ${leftBlade.x} / ${rightBlade.x}`);
  actors[1].model.update(false,0,1,0);const before=world(1,'blade');
  for(let p=0;p<=1;p+=.05)actors[0].model.update(true,p,-1,0);
  assert.ok(world(1,'blade').subtract(before).length()<1e-6,'animation targets not shared');
  const materials=actors.map(a=>a.model.meshes.flatMap(m=>m.material?.subMaterials||[m.material]).find(m=>m?.name.includes('TeamColor')));
  assert.equal(new Set(materials).size,5,'each vest has independent material');
  for(let i=0;i<5;i++)assert.ok(materials[i].albedoColor.equalsWithEpsilon(B.Color3.FromHexString(colors[i]).toLinearSpace(),1e-6));
  for(const actor of actors){
    for(const side of [-1,1])for(let frame=0;frame<=30;frame++){
      actor.model.update(true,frame/30,side,0);
      for(const mesh of actor.model.meshes){const m=mesh.computeWorldMatrix(true);assert.ok(Array.from(m.m).every(Number.isFinite));}
    }
    actor.model.update(false,0,1,.5);
  }
  console.log('GLB_RUNTIME_OK',JSON.stringify({instances:result.instances,clips:result.clips,bytes:result.bytes,leftBlade:leftBlade.asArray(),rightBlade:rightBlade.asArray()}));
});
