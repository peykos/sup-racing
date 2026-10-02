import {COURSE, waveAt, clamp} from '../src/core.js';

export const RIDERS = ['leo','maya','noa'];
export const ASSET_ROOT = new URL('../assets/lowpoly/', import.meta.url).href;
import {COASTS} from './coast.js';
export {COASTS} from './coast.js';
const WATER_VERTEX = `precision highp float;
attribute vec3 position;attribute vec4 color;varying float vFacet; uniform mat4 worldViewProjection;uniform mat4 world;
uniform float time;uniform float rough; varying vec3 vWorld;
void main(){vec3 p=position;vFacet=color.r;p.y=rough*(.21*sin(p.x*.085+p.z*.052+time*1.2)+.12*sin(p.z*.16-p.x*.035-time*1.55)+.065*sin(p.x*.3+p.z*.22+time*2.1));vWorld=(world*vec4(p,1.)).xyz;gl_Position=worldViewProjection*vec4(p,1.);}`;
const WATER_FRAGMENT = `#extension GL_OES_standard_derivatives : enable
precision highp float;varying vec3 vWorld;varying float vFacet;uniform float time;uniform vec3 cameraPosition;
uniform vec4 shores[7];
void main(){
vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));if(n.y<0.)n=-n;
float light=dot(n,normalize(vec3(-.4,1.,-.5)));
float coast=1000.;for(int i=0;i<7;i++){vec2 d=(vWorld.xz-shores[i].xy)/shores[i].zw;coast=min(coast,length(d));}
float shallow=1.-smoothstep(1.0,1.8,coast);
vec3 deep=vec3(.14,.61,.64);vec3 shoal=vec3(.38,.79,.71);
vec3 color=mix(deep,shoal,shallow);color*=.79+light*.25;
float fac=sin(floor(vWorld.x/4.)*.31+floor(vWorld.z/4.)*.51)*.012;
color+=(vFacet-.5)*.055+dot(n.xz,vec2(.8,.65))*.23+fac;
float rim=(1.-smoothstep(.015,.055,abs(coast-(1.03+.015*sin(time+vWorld.x*.2)))))*.55;
color=mix(color,vec3(.86,.95,.84),rim);
vec3 eye=normalize(cameraPosition-vWorld);float spark=pow(max(0.,dot(reflect(-normalize(vec3(-.4,1.,-.5)),n),eye)),90.);
color+=vec3(.65,.65,.45)*spark*.22;
float haze=smoothstep(160.,500.,length(vWorld.xz-cameraPosition.xz));color=mix(color,vec3(.68,.84,.83),haze);
gl_FragColor=vec4(color,1.);}`;

/** GLB containers remain immutable. Clones share vertex buffers, not transforms/animation state. */
export async function createWorld(canvas, onProgress=()=>{}, options={}) {
  const B=globalThis.BABYLON;
  if(!B?.Engine)throw Error('Δεν φορτώθηκε το Babylon.js.');
  const engine=options.engine||new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,antialias:true,powerPreference:'high-performance'},false);
  const scene=new B.Scene(engine);
  scene.clearColor=new B.Color4(.68,.84,.83,1);
  scene.fogMode=B.Scene.FOGMODE_LINEAR;scene.fogStart=165;scene.fogEnd=480;scene.fogColor=new B.Color3(.68,.84,.83);
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.12;
  const camera=new B.FreeCamera('TIDE camera',new B.Vector3(7,5,-77),scene);
  camera.minZ=.12;camera.maxZ=750;camera.fov=.7;
  const hemi=new B.HemisphericLight('Warm sky',new B.Vector3(0,1,0),scene);
  hemi.intensity=.95;hemi.groundColor=B.Color3.FromHexString('#bbc2a2');
  const sun=new B.DirectionalLight('Aegean sun',new B.Vector3(.45,-1,.35),scene);
  sun.position=new B.Vector3(-45,75,-35);sun.intensity=2.15;
  const shadow=new B.ShadowGenerator(1024,sun);shadow.usePercentageCloserFiltering=true;shadow.bias=.002;shadow.normalBias=.025;
  sun.autoCalcShadowZBounds=true;sun.shadowFrustumSize=55;
  const load=options.load||((name)=>B.SceneLoader.LoadAssetContainerAsync(ASSET_ROOT,name,scene,undefined,'.glb'));
  onProgress('Blender · φόρτωση νησιών και σανίδων…');
  const kit=await load('coastal-kit.glb',scene);
  const characters=[];
  for(const [i,name] of RIDERS.entries()){
    onProgress(`Blender · ${name.toUpperCase()} (${i+1}/3)…`);
    characters.push(await load(`rider-${name}.glb`,scene));
  }
  const containers=[kit,...characters];
  for(const asset of containers)for(const m of asset.materials){
    m.backFaceCulling=false;
    if('environmentIntensity' in m)m.environmentIntensity=0;
    m.freeze();
  }
  let serial=0,elapsed=0,currentMode='',selected=0,frames=0,quality='high',lastRace=null;
  const rootTemplate=kit.meshes.find(m=>m.name==='__root__');
  function prefab(name,x=0,y=0,z=0,scale=1,yaw=0,parent=null,casts=false){
    const template=kit.meshes.find(m=>m.name===name);
    if(!template)throw Error(`Missing Blender prefab: ${name}`);
    const anchor=new B.TransformNode(`${name}-${serial++}`,scene);anchor.parent=parent;
    anchor.position.set(x,y,z);anchor.scaling.setAll(scale);anchor.rotation.y=yaw;
    const basis=new B.TransformNode(`${anchor.name}-gltf`,scene);basis.parent=anchor;
    if(rootTemplate){basis.position.copyFrom(rootTemplate.position);basis.scaling.copyFrom(rootTemplate.scaling);basis.rotationQuaternion=rootTemplate.rotationQuaternion?.clone()||null;basis.rotation.copyFrom(rootTemplate.rotation);}
    const mesh=template.clone(`${anchor.name}-mesh`,basis,true);mesh.setEnabled(true);mesh.isPickable=false;mesh.receiveShadows=true;
    if(casts)shadow.addShadowCaster(mesh);
    anchor.metadata={prefab:name};return anchor;
  }
  // Faceted water is the only large procedural surface. Boats, shores and props are Blender GLBs.
  B.Effect.ShadersStore.tideSeaVertexShader=WATER_VERTEX;B.Effect.ShadersStore.tideSeaFragmentShader=WATER_FRAGMENT;
  const water=B.MeshBuilder.CreateGround('Faceted Aegean',{width:1000,height:1000,subdivisions:120},scene);
  water.convertToFlatShadedMesh();water.isPickable=false;
  const facets=new Float32Array(water.getTotalVertices()*4);
  for(let i=0;i<water.getTotalVertices();i++){const value=(Math.sin(Math.floor(i/3)*78.233)*43758.5453)%1;facets[i*4]=Math.abs(value);facets[i*4+3]=1;}
  water.setVerticesData(B.VertexBuffer.ColorKind,facets);
  const sea=new B.ShaderMaterial('Shallows and sunlight',scene,'tideSea',{attributes:['position','color'],uniforms:['world','worldViewProjection','time','rough','cameraPosition','shores']});
  sea.backFaceCulling=false;sea.setFloat('time',0);sea.setFloat('rough',.75);
  sea.setArray4('shores',COASTS.flatMap(p=>[p.x,p.z,18*p.s,12*p.s]));water.material=sea;
  const islands=[];
  for(const [i,p] of COASTS.entries()){
    const island=prefab('Island',p.x,-.4,p.z,p.s,p.yaw);islands.push(island);
    const at=(name,x,y,z,s=1,r=0)=>prefab(name,x,y,z,s,r,island);
    at('Lighthouse',-5,1.3,1,.7,i*.7);
    at('House',3,1.3,-1,.72,.1);at('House',7,1.3,2,.56,-.25);
    at('Palm',-1,1.3,4,.9,.5);at('Palm',8,1.2,-4,.65,-.7);at('Palm',-9,1.1,-2,.7,1.2);
    at('Umbrella',4,.8,-8,.75,i*.2);at('Umbrella',0,.8,-8,.65,1.2);
    at('Rock',-12,.6,3,1.4,.3);at('Rock',10,.4,6,.9,.8);
    at('Pier',0,.05,-13,.9,0);
    at('Board_Teal',3,.88,-8,.7,.5);
  }
  const floating=[];
  for(const p of [[-73,-91,.4],[127,-33,-.8],[-80,151,1.2]])floating.push({node:prefab('Sailboat',p[0],0,p[1],1.4,p[2]),x:p[0],z:p[1]});
  const clouds=[];
  for(let i=0;i<18;i++){
    const a=i*2.39996;const radius=160+(i%4)*42;
    clouds.push(prefab('Cloud',Math.cos(a)*radius,47+i%5*6,Math.sin(a)*radius,1.6+(i%3)*.45,i*.7));
  }
  const gulls=[];
  for(let i=0;i<7;i++)gulls.push(prefab('Gull',0,10+i,0,.7+i%3*.25));
  const buoys=COURSE.map(p=>prefab('Buoy',p.x,0,p.z,1));
  prefab('Gate',0,0,-102,1.45,0);
  const targetMat=new B.StandardMaterial('Mint checkpoint',scene);targetMat.diffuseColor=B.Color3.FromHexString('#c8f1a4');targetMat.emissiveColor=new B.Color3(.25,.45,.15);targetMat.specularColor=B.Color3.Black();
  const ring=B.MeshBuilder.CreateTorus('Next checkpoint ring',{diameter:20,thickness:.16,tessellation:64},scene);ring.material=targetMat;
  const marker=B.MeshBuilder.CreateCylinder('Next checkpoint arrow',{height:1.3,diameterTop:0,diameterBottom:1.4,tessellation:3},scene);marker.rotation.z=Math.PI;marker.material=targetMat;
  const foamMat=new B.StandardMaterial('Foam',scene);foamMat.diffuseColor=B.Color3.FromHexString('#e3fff2');foamMat.emissiveColor=new B.Color3(.22,.3,.24);foamMat.specularColor=B.Color3.Black();foamMat.alpha=.30;foamMat.backFaceCulling=false;foamMat.disableDepthWrite=true;
  const racers=[];
  function actor(index,variant,parent){
    const entry=characters[variant].instantiateModelsToScene(n=>`r${index}-${variant}-${n}`,false,{doNotInstantiate:true});
    for(const n of entry.rootNodes){n.parent=parent;n.setEnabled(true);}
    const groups=Object.fromEntries(entry.animationGroups.map(g=>[g.name.split('-').pop(),g]));
    // Names may be prefixed by Babylon; identify via suffix, never insertion order.
    for(const name of ['Idle','Paddle_Left','Paddle_Right','Celebrate'])groups[name]=entry.animationGroups.find(g=>g.name.endsWith(name));
    for(const g of entry.animationGroups)g.stop();
    for(const root of entry.rootNodes)for(const m of root.getChildMeshes()){m.isPickable=false;m.receiveShadows=true;shadow.addShadowCaster(m);}
    return {entry,groups,clip:'',variant};
  }
  function pose(model,name,phase){
    const g=model.groups[name];if(!g)throw Error(`Missing clip ${name}`);
    if(model.clip!==name){for(const group of model.entry.animationGroups)group.stop();g.start(true);g.pause();model.clip=name;}
    g.goToFrame(g.from+(g.to-g.from)*clamp(phase,0,1));
  }
  for(let i=0;i<5;i++){
    const root=new B.TransformNode(`Racer ${i}`,scene);
    const board=prefab(['Board_Coral','Board_Sun','Board_Teal'][i%3],0,0,0,1,0,root,true);
    const choices=i===0?[0,1,2].map(v=>actor(i,v,root)):[actor(i,i%3,root)];
    for(const [j,m] of choices.entries())for(const n of m.entry.rootNodes)n.setEnabled(j===0);
    const wakes=[-1,1].map(side=>{
      const wake=B.MeshBuilder.CreatePlane(`Wake ${i}:${side}`,{width:.22,height:3.6},scene);
      wake.parent=root;wake.rotation.x=Math.PI/2;wake.position.set(side*.5,.06,-2.45);wake.rotation.z=side*.18;wake.material=foamMat;wake.isPickable=false;return wake;
    });
    racers.push({root,board,choices,model:choices[0],wakes,stroke:-1});
  }
  const spray=[];
  for(let i=0;i<36;i++){
    const m=B.MeshBuilder.CreateIcoSphere(`Spray ${i}`,{radius:.075,subdivisions:1,flat:true},scene);m.material=foamMat;m.isPickable=false;m.setEnabled(false);
    spray.push({m,life:0,v:new B.Vector3()});
  }
  let sprayIndex=0;
  function splash(r){
    const sx=Math.sin(r.heading),sz=Math.cos(r.heading);
    for(let j=0;j<4;j++){
      const q=spray[sprayIndex++%spray.length];q.life=.45+j*.045;q.m.setEnabled(true);
      q.m.position.set(r.x+r.lastSide*.78*sz+sx*.35,.1+waveAt(r.x,r.z,elapsed,lastRace?.roughness||.75),r.z-r.lastSide*.78*sx+sz*.35);
      q.v.set(r.lastSide*.5*sz+(j-1.5)*.2,1.5+j*.21,-sz*.6);q.m.scaling.setAll(1+j*.22);
    }
  }
  const focus=new B.Vector3(),desired=new B.Vector3();
  const isPortrait=()=>engine.getRenderHeight()>engine.getRenderWidth();
  function viewport(mode){
    camera.viewport=mode==='menu'?(isPortrait()?new B.Viewport(0,.44,1,.56):new B.Viewport(.26,0,.74,1)):new B.Viewport(0,0,1,1);
    camera.fov=mode==='menu'?.64:.85;
  }
  function selectRider(index){
    selected=clamp(Math.trunc(index)||0,0,2);const r=racers[0];r.model=r.choices[selected];
    r.choices.forEach((m,i)=>{for(const n of m.entry.rootNodes)n.setEnabled(i===selected);});
    r.board.dispose();r.board=prefab(['Board_Coral','Board_Sun','Board_Teal'][selected],0,0,0,1,0,r.root,true);
  }
  function update(race,delta,settings={}){
    lastRace=race;const dt=clamp(delta||0,0,.08);if(race.state!=='paused')elapsed+=dt;
    const mode=settings.mode==='menu'||race.state==='menu'?'menu':'race';
    const changed=mode!==currentMode;if(changed){viewport(mode);currentMode=mode;}
    sea.setFloat('time',elapsed);sea.setFloat('rough',race.roughness);sea.setVector3('cameraPosition',camera.position);
    for(const [i,r] of race.racers.entries()){
      const v=racers[i],rx=mode==='menu'&&i===0?-29:r.x,rz=mode==='menu'&&i===0?-108:r.z;v.root.position.set(rx,waveAt(rx,rz,elapsed,race.roughness),rz);
      v.root.rotation.set(.018*Math.sin(elapsed*1.4+i),r.heading,.024*Math.sin(elapsed*1.8+i));
      v.root.scaling.setAll(mode==='menu'&&i===0?1.55:1);
      v.root.setEnabled(mode!=='menu'||i===0);
      const since=race.time-r.lastStroke;
      if(mode!=='menu'&&r.finishedAt!==null)pose(v.model,'Celebrate',(elapsed%2)/2);
      else if(mode!=='menu'&&since>=0&&since<.80)pose(v.model,r.lastSide<0?'Paddle_Left':'Paddle_Right',since/.80);
      else pose(v.model,'Idle',((elapsed+i*.41)%2)/2);
      v.wakes.forEach(m=>{m.setEnabled(mode!=='menu'&&r.speed>.4);m.scaling.y=.5+Math.min(r.speed,8)*.13;});
      if(r.strokeCount!==v.stroke){if(r.strokeCount>0)splash(r);v.stroke=r.strokeCount;}
    }
    for(const [i,b] of buoys.entries()){const p=COURSE[i];b.position.y=waveAt(p.x,p.z,elapsed,race.roughness)*.6;b.rotation.z=Math.sin(elapsed+i)*.025;}
    const next=COURSE[race.player.next];ring.position.set(next.x,.12+waveAt(next.x,next.z,elapsed,race.roughness),next.z);
    ring.scaling.setAll(1+Math.sin(elapsed*2)*.02);marker.position.set(next.x,5.4+Math.sin(elapsed*2)*.3,next.z);marker.rotation.y=elapsed*.3;
    for(const {node,x,z} of floating){node.position.y=waveAt(x,z,elapsed,race.roughness)*.8;node.rotation.z=.03*Math.sin(elapsed+x);}
    for(const [i,g] of gulls.entries()){const a=elapsed*.09+i*.9;g.position.set(-50+Math.cos(a)*(17+i*4),12+i+Math.sin(a*2),-115+Math.sin(a)*(12+i*2));g.rotation.y=-a;g.rotation.z=Math.sin(elapsed*2+i)*.12;}
    if(race.state!=='paused')for(const q of spray){if(q.life>0){q.life-=dt;q.v.y-=dt*6;q.m.position.addInPlace(q.v.scale(dt));if(q.life<=0)q.m.setEnabled(false);}}
    const p=mode==='menu'?{x:-29,z:-108,heading:0}:race.player;
    if(mode==='menu'){
      const a=.6+Math.sin(elapsed*.08)*.10;desired.set(p.x+Math.sin(a)*12.7,5.2,p.z+Math.cos(a)*12.7);
      focus.set(p.x,1.15,p.z);
    }else{
      const wide=settings.camera==='wide';const back=wide?20:9.6;
      desired.set(p.x-Math.sin(p.heading)*back,wide?13:5.4,p.z-Math.cos(p.heading)*back);
      focus.set(p.x+Math.sin(p.heading)*3.0,1.0,p.z+Math.cos(p.heading)*3.0);
    }
    if(changed||!frames)camera.position.copyFrom(desired);else B.Vector3.LerpToRef(camera.position,desired,1-Math.exp(-dt*4),camera.position);
    camera.setTarget(focus);sun.position.set(p.x-35,65,p.z-25);
  }
  function setQuality(value){quality=value==='low'?'low':'high';
    const dpr=globalThis.devicePixelRatio||1;engine.setHardwareScalingLevel(quality==='low'?1.35:1/Math.min(dpr,1.35));
    scene.shadowsEnabled=quality==='high';gulls.forEach(g=>g.setEnabled(quality==='high'));
  }
  setQuality('high');
  function info(){return {renderer:`Babylon.js ${B.Engine.Version}`,version:'2.0.0',webGL:engine.webGLVersion,frames,
    fps:engine.getFps(),meshes:scene.meshes.length,activeMeshes:scene.getActiveMeshes().length,
    width:engine.getRenderWidth(),height:engine.getRenderHeight(),waterReady:sea.isReady(water),
    characters:RIDERS,selected:RIDERS[selected],instances:5,clips:['Idle','Paddle_Left','Paddle_Right','Celebrate'],prefabs:kit.meshes.filter(m=>m.getTotalVertices()>0).length,quality};}
  onProgress('Το νησί είναι έτοιμο.');
  return {engine,scene,camera,racers,water,sea,containers,prefab,pose,selectRider,update,setQuality,
    render(){scene.render();frames++;},resize(){engine.resize();viewport(currentMode);},info,
    dispose(){containers.forEach(c=>c.dispose());scene.dispose();if(!options.engine)engine.dispose();}};
}
