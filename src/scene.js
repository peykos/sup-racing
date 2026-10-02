import {COURSE,COLORS,waveAt,clamp} from './core.js';
import {loadRiderModels} from './rider-model.js?v=1.1.0';
const B=window.BABYLON;
const vertex=`precision highp float;
attribute vec3 position; uniform mat4 world; uniform mat4 worldViewProjection;
uniform float time; uniform float rough; varying vec3 vPos;
float wave(vec2 p){return rough*(.21*sin(p.x*.085+p.y*.052+time*1.2)+.12*sin(p.y*.16-p.x*.035-time*1.55)+.065*sin(p.x*.3+p.y*.22+time*2.1));}
void main(){vec3 p=position;p.y=wave(p.xz);vPos=(world*vec4(p,1.)).xyz;gl_Position=worldViewProjection*vec4(p,1.);}`;
const fragment=`precision highp float;
varying vec3 vPos;uniform vec3 cameraPosition;uniform float time;uniform float rough;uniform float sunset;
vec3 sky(vec3 d){vec3 horizon=mix(vec3(.72,.87,.88),vec3(.97,.70,.49),sunset);vec3 zenith=mix(vec3(.18,.51,.73),vec3(.32,.48,.63),sunset);return mix(horizon,zenith,pow(max(d.y,0.),.6));}
void main(){
 float a=vPos.x*.085+vPos.z*.052+time*1.2,b=vPos.z*.16-vPos.x*.035-time*1.55,c=vPos.x*.3+vPos.z*.22+time*2.1;
 vec2 grad=rough*vec2(.21*.085*cos(a)-.12*.035*cos(b)+.065*.3*cos(c),.21*.052*cos(a)+.12*.16*cos(b)+.065*.22*cos(c));
 grad+=vec2(sin(vPos.x*1.8+vPos.z*1.3+time*1.6),cos(vPos.z*2.1-vPos.x*.9-time*1.4))*.024;
 vec3 n=normalize(vec3(-grad.x,1.,-grad.y));vec3 v=normalize(cameraPosition-vPos);vec3 r=reflect(-v,n);
 float fres=.035+.965*pow(1.-max(dot(n,v),0.),4.);
 vec3 sea=mix(vec3(.016,.29,.34),vec3(.025,.48,.48),.5+.5*sin(vPos.x*.003+vPos.z*.008));
 vec3 color=mix(sea,sky(r),fres*.83);
 vec3 sun=normalize(vec3(-.55,mix(.7,.24,sunset),.8));
 float glitter=pow(max(dot(reflect(-sun,n),v),0.),150.);
 color+=mix(vec3(1.,.94,.72),vec3(1.,.64,.31),sunset)*(glitter*1.25+pow(max(dot(reflect(-sun,n),v),0.),25.)*.13);
 float foam=smoothstep(.28*rough,.4*rough,vPos.y)*.13;
 color=mix(color,vec3(.8,.97,.94),foam);
 float dist=length(cameraPosition-vPos);color=mix(color,sky(vec3(0.,.02,1.)),1.-exp(-dist*.00125));
 gl_FragColor=vec4(color,1.);}`;
const skyVertex=`precision highp float;attribute vec3 position;uniform mat4 world;uniform mat4 worldViewProjection;varying vec3 vWorld;void main(){vWorld=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`;
const skyFragment=`precision highp float;varying vec3 vWorld;uniform vec3 cameraPosition;uniform float sunset;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){vec3 d=normalize(vWorld-cameraPosition);vec3 h=mix(vec3(.74,.88,.89),vec3(.98,.70,.51),sunset);vec3 z=mix(vec3(.18,.51,.76),vec3(.31,.48,.65),sunset);vec3 col=mix(h,z,pow(max(d.y,0.),.55));vec3 sun=normalize(vec3(-.55,mix(.7,.24,sunset),.8));float s=max(dot(d,sun),0.);col+=vec3(1.,.85,.60)*pow(s,700.)+vec3(.36,.22,.12)*pow(s,12.);vec2 p=d.xz/max(d.y+.16,.06)*2.5;float clouds=noise(p)*.6+noise(p*2.1)*.3+noise(p*4.2)*.1;float cloud=smoothstep(.60,.8,clouds)*smoothstep(.04,.20,d.y)*.6;col=mix(col,vec3(.98,.98,.94),cloud);gl_FragColor=vec4(col,1.);}`;
export class OceanView {
  constructor(canvas,race,{qa=false}={}){
    if(!B)throw new Error('Δεν φορτώθηκε το τοπικό Babylon.js.');
    this.race=race;this.canvas=canvas;this.mode=0;this.frames=0;this.qa=qa;
    this.engine=new B.Engine(canvas,true,{preserveDrawingBuffer:qa,stencil:false,powerPreference:'high-performance'},false);
    this.engine.setHardwareScalingLevel(1/Math.min(window.devicePixelRatio||1,1.35));
    this.scene=new B.Scene(this.engine);this.scene.clearColor=new B.Color4(.48,.73,.82,1);
    this.scene.fogMode=B.Scene.FOGMODE_EXP2;this.scene.fogDensity=.0017;this.scene.fogColor=new B.Color3(.70,.82,.84);
    this.scene.skipPointerMovePicking=true;
    this.camera=new B.FreeCamera('chase',new B.Vector3(14,8,-114),this.scene);
    this.camera.minZ=.15;this.camera.maxZ=1500;this.camera.fov=.9;this.camera.setTarget(new B.Vector3(0,1,-85));
    this.scene.activeCamera=this.camera;
    this.hemi=new B.HemisphericLight('skyLight',new B.Vector3(0,1,0),this.scene);this.hemi.intensity=1.1;
    this.hemi.groundColor=new B.Color3(.19,.36,.36);
    this.sun=new B.DirectionalLight('sun',new B.Vector3(.55,-.7,-.8),this.scene);this.sun.intensity=1.35;
    this.materials=new Map();this.batches=new Map();
    this.water();this.landscape();this.markers();this.riders=race.racers.map(r=>this.rider(r));
    this.lastCamera=null;this.lastSea='';this.resize=()=>this.engine.resize();window.addEventListener('resize',this.resize);
  }
  mat(hex,name=hex,alpha=1){
    if(this.materials.has(name))return this.materials.get(name);
    const m=new B.StandardMaterial(name,this.scene);m.diffuseColor=B.Color3.FromHexString(hex);m.specularColor=new B.Color3(.07,.10,.10);m.alpha=alpha;
    this.materials.set(name,m);return m;
  }
  box(name,size,pos,material,parent=null,batch=false){
    const m=B.MeshBuilder.CreateBox(name,{width:size[0],height:size[1],depth:size[2]},this.scene);
    m.position.set(...pos);m.material=material;m.parent=parent;
    if(batch){if(!this.batches.has(material))this.batches.set(material,[]);this.batches.get(material).push(m);}return m;
  }
  ellipsoid(name,size,pos,mat,parent=null,segments=10){const m=B.MeshBuilder.CreateSphere(name,{diameter:1,segments},this.scene);m.scaling.set(...size);m.position.set(...pos);m.material=mat;m.parent=parent;return m;}
  tube(name,height,diameter,pos,mat,parent=null){const m=B.MeshBuilder.CreateCylinder(name,{height,diameter,tessellation:10},this.scene);m.position.set(...pos);m.material=mat;m.parent=parent;return m;}
  water(){
    B.Effect.ShadersStore.tideVertexShader=vertex;B.Effect.ShadersStore.tideFragmentShader=fragment;
    this.ocean=B.MeshBuilder.CreateGround('ocean',{width:1700,height:1700,subdivisions:160},this.scene);
    this.oceanMat=new B.ShaderMaterial('tide-water',this.scene,{vertex:'tide',fragment:'tide'},{attributes:['position'],uniforms:['world','worldViewProjection','time','rough','cameraPosition','sunset']});
    this.oceanMat.backFaceCulling=false;this.ocean.material=this.oceanMat;this.ocean.alwaysSelectAsActiveMesh=true;
    B.Effect.ShadersStore.tideSkyVertexShader=skyVertex;B.Effect.ShadersStore.tideSkyFragmentShader=skyFragment;
    this.sky=B.MeshBuilder.CreateSphere('sky',{diameter:1800,segments:16},this.scene);
    this.skyMat=new B.ShaderMaterial('tide-sky',this.scene,{vertex:'tideSky',fragment:'tideSky'},{attributes:['position'],uniforms:['world','worldViewProjection','cameraPosition','sunset']});
    this.skyMat.backFaceCulling=false;this.skyMat.disableDepthWrite=true;this.sky.material=this.skyMat;this.sky.isPickable=false;this.sky.infiniteDistance=true;
    for(const m of [this.oceanMat,this.skyMat])m.onError=(_effect,error)=>{const msg='Shader: '+error;window.__tideErrors.push(msg);document.getElementById('error').hidden=false;document.getElementById('error').textContent=msg;};
  }
  landscape(){
    const sand=this.mat('#e0cf9f'),green=this.mat('#72978a'),cliff=this.mat('#99adb0'),dark=this.mat('#3a626e'),palm=this.mat('#397971'),wood=this.mat('#a48662'),white=this.mat('#f3eedb');
    this.box('beach',[670,3,95],[0,.25,277],sand,null,true);
    this.box('coast',[690,7,90],[0,1,330],green,null,true);
    for(let i=0;i<13;i++){
      const m=B.MeshBuilder.CreateCylinder('ridge',{diameterBottom:110+i%3*25,diameterTop:9,height:45+i%4*14,tessellation:5},this.scene);
      m.position.set(-345+i*58,16,380+(i%3)*20);m.rotation.y=i*.73;m.scaling.z=.65;m.material=cliff;
    }
    const buildings=['#f3ead5','#cbdde1','#dcbcb0','#d3d5c8'].map(c=>this.mat(c));
    for(let i=0;i<26;i++){
      const x=-280+i*22,h=12+((i*7)%6)*5,dep=12+(i%3)*4,z=264+(i%4)*9;
      this.box('hotel',[11+(i%3)*3,h,dep],[x,h/2+2,z],buildings[i%4],null,true);
      this.box('roof',[12+(i%3)*3,1,dep+1],[x,h+2,z],white,null,true);
      for(let j=0;j<Math.floor(h/5);j++)this.box('balcony',[12+(i%3)*3,.7,1.6],[x,6+j*5,z-dep/2-.4],white,null,true);
      for(let k=0;k<3;k++)this.box('glass',[1.9,h-4,.15],[x+(k-1)*3,h/2+2,z-dep/2-.05],dark,null,true);
    }
    for(let i=0;i<22;i++){
      const x=-265+i*25,z=235+(i%3)*4;
      this.box('palm-trunk',[.65,8,.65],[x,5,z],wood,null,true);
      for(let j=0;j<5;j++){
        const leaf=this.box('palm-leaf',[.8,.14,6],[x,9,z],palm,null,true);leaf.rotation.set(.19,Math.PI*2*j/5,0);leaf.position.x+=Math.sin(j*Math.PI*2/5)*1.5;leaf.position.z+=Math.cos(j*Math.PI*2/5)*1.5;
      }
    }
    // Small, non-colliding islands outside the race corridor.
    for(const [x,z,s] of [[-140,75,1],[145,185,.8],[-260,-20,1.4]]){
      this.ellipsoid('island',[45*s,12,32*s],[x,-3,z],sand,null,10);
      this.ellipsoid('island-top',[34*s,8,25*s],[x,0,z],green,null,8);
      this.box('palm-trunk',[.8,10,.8],[x,7,z],wood,null,true);
      for(let k=0;k<6;k++){const l=this.box('island-palm',[1.5,.2,9],[x+Math.sin(k)*2,12,z+Math.cos(k)*2],palm,null,true);l.rotation.set(.22,k,0);}
    }
    // Spectator pier, outside the starting grid.
    for(let i=0;i<15;i++)this.box('pier-plank',[12,.35,1.4],[-42,.7,-119+i*1.5],wood,null,true);
    for(let i=0;i<4;i++)this.tube('pier-piling',2,.5,[-48,.2,-117+i*6],wood);
    for(let i=0;i<4;i++){
      const col=this.mat(['#ff8268','#f4e8bd','#76c8cc','#acc6dd'][i]);
      const umbrella=B.MeshBuilder.CreateCylinder('umbrella',{diameterTop:0,diameterBottom:4,height:1,tessellation:8},this.scene);umbrella.position.set(-43,4.5,-115+i*5);umbrella.material=col;
      this.tube('umbrella-pole',3.5,.12,[-43,2.2,-115+i*5],white);
    }
    // Static batches keep mobile draw calls down.
    for(const [mat,meshes] of this.batches){if(meshes.length>1){const merged=B.Mesh.MergeMeshes(meshes,true,true,undefined,false,false);if(merged){merged.material=mat;merged.isPickable=false;merged.freezeWorldMatrix();}}}
    this.batches.clear();
  }
  textPlane(name,text,width,height,parent,pos,bg='#092f3b',fg='#f3f6e7'){
    const tex=new B.DynamicTexture(name+'-text',{width:512,height:128},this.scene,false);tex.hasAlpha=false;
    const ctx=tex.getContext();ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 64px Arial';ctx.fillText(text,256,70);tex.update();
    const mat=new B.StandardMaterial(name+'-ink',this.scene);mat.diffuseTexture=tex;mat.emissiveColor=new B.Color3(.65,.65,.65);mat.specularColor=B.Color3.Black();mat.backFaceCulling=false;
    const p=B.MeshBuilder.CreatePlane(name,{width,height,sideOrientation:B.Mesh.DOUBLESIDE},this.scene);p.material=mat;p.parent=parent;p.position.set(...pos);return p;
  }
  markers(){
    const orange=this.mat('#ff805f'),white=this.mat('#fff5d6'),dark=this.mat('#0c4349'),mint=this.mat('#adffce');
    const glow=this.mat('#adffce','checkpoint-glow',.42);glow.emissiveColor=new B.Color3(.27,.6,.4);
    this.buoys=COURSE.map((p,i)=>{
      const node=new B.TransformNode('buoy-'+i,this.scene);node.position.set(p.x,0,p.z);
      const cone=B.MeshBuilder.CreateCylinder('race-buoy',{height:1.8,diameterTop:1.2,diameterBottom:1.85,tessellation:16},this.scene);cone.parent=node;cone.position.y=.6;cone.material=orange;
      this.tube('buoy-band',.34,1.48,[0,.91,0],white,node);this.tube('buoy-cap',.17,1.22,[0,1.57,0],dark,node);
      this.tube('flag-mast',1.6,.06,[0,2.25,0],white,node);
      const flag=this.textPlane('marker-label',String(i+1).padStart(2,'0'),1.45,.38,node,[.65,2.7,0],'#ff805f','#0b343e');flag.billboardMode=B.Mesh.BILLBOARDMODE_Y;
      const ring=B.MeshBuilder.CreateTorus('checkpoint-ring',{diameter:20,thickness:.12,tessellation:64},this.scene);ring.position.set(p.x,.1,p.z);ring.material=glow;
      const beacon=this.textPlane('active-marker','↓',2.4,.6,node,[0,6,0],'#adffce','#092f3b');beacon.billboardMode=B.Mesh.BILLBOARDMODE_ALL;
      return {node,ring,beacon};
    });
    const arch=new B.TransformNode('finish-arch',this.scene);arch.position.set(0,0,-97);
    for(const x of [-13,13]){
      this.tube('start-float',.45,3.6,[x,.05,0],orange,arch);
      this.tube('arch-side',5.7,.8,[x,2.8,0],dark,arch);
      this.tube('arch-stripe',1,.85,[x,1.7,0],mint,arch);
    }
    this.box('arch-top',[26.5,1.3,.85],[0,5.6,0],dark,arch);
    this.textPlane('start-banner','T I D E  /  S U P',15,.92,arch,[0,5.62,-.45]);
    const line=this.mat('#e6ffe2','start-line',.3);
    for(let i=0;i<13;i++)this.box('start-dashes',[1.1,.03,.15],[-12+i*2,.15,-97],line);
  }
  hull(name,mat,parent,width=1,y=0){
    const rings=[[-2.16,.18,.065],[-1.85,.32,.10],[-.8,.38,.13],[.55,.36,.14],[1.45,.25,.16],[2.12,.055,.18],[2.3,.006,.18]];
    const positions=[],indices=[];const points=10;
    rings.forEach(([z,w,h])=>{for(let j=0;j<points;j++){const a=j*Math.PI*2/points;positions.push(Math.cos(a)*w*width,y+Math.sin(a)*.105+h,z);}});
    for(let i=0;i<rings.length-1;i++)for(let j=0;j<points;j++){const a=i*points+j,b=i*points+(j+1)%points,c=(i+1)*points+j,d=(i+1)*points+(j+1)%points;indices.push(a,c,b,b,c,d);}
    for(let j=1;j<points-1;j++){indices.push(0,j,j+1);const a=(rings.length-1)*points;indices.push(a,a+j+1,a+j);}
    const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);const vd=new B.VertexData();vd.positions=positions;vd.indices=indices;vd.normals=normals;
    const mesh=new B.Mesh(name,this.scene);vd.applyToMesh(mesh);mesh.material=mat;mesh.parent=parent;return mesh;
  }
  async loadAssets(){this.riderAsset=await loadRiderModels(this.scene,this.riders,COLORS);return this.riderAsset;}
  rider(r){
    const root=new B.TransformNode('racer-'+r.id,this.scene);const color=this.mat(COLORS[r.id]);const dark=this.mat('#18373e');const white=this.mat('#f2f3db');
    this.hull('board-rail',color,root);const deck=this.hull('deck',white,root,.86,.045);deck.scaling.y=.7;deck.position.y=.13;
    this.box('deck-pad',[.51,.035,1.52],[0,.26,-.45],dark,root);
    this.box('nose-stripe',[.09,.025,1.35],[0,.33,1],color,root);
    this.textPlane('board-number',String(r.id+1).padStart(2,'0'),.39,.095,root,[0,.29,.45],'#f2f3db','#163a42').rotation.x=Math.PI/2;
    // The athlete and paddle come from the original Blender GLB; boards stay procedural.
    const foam=this.mat('#e3fffa','wake-foam',.26);foam.emissiveColor=new B.Color3(.10,.20,.2);
    const wakes=[];for(let i=0;i<4;i++){const m=B.MeshBuilder.CreateTorus('wake',{diameter:1,thickness:.033,tessellation:20},this.scene);m.material=foam;m.parent=root;wakes.push(m);}
    return {root,wakes,model:null};
  }
  animateRider(actor,r,t){
    const rough=this.race.roughness,y=waveAt(r.x,r.z,t,rough);
    actor.root.position.set(r.x,y+.035,r.z);actor.root.rotation.set(.024*Math.sin(t*1.4+r.z*.1)*rough,r.heading,.032*Math.sin(t*1.7+r.x)*rough);
    const elapsed=this.race.time-r.lastStroke,active=this.race.state==='racing'&&elapsed>=0&&elapsed<.86;
    actor.model?.update(active,clamp(elapsed/.86,0,1),r.lastSide,t);
    actor.wakes.forEach((w,i)=>{const cycle=(t*1.5+i*.25)%1;w.position.set(0,.015-y*.08,-1.6-cycle*(2+r.speed*.55));w.scaling.set(.6+cycle*1.9,.17,.9+cycle*3);w.visibility=clamp(r.speed/5,0,1)*(1-cycle)*.72;});
  }
  render(dt){
    const race=this.race,t=race.clock,p=race.player;const sunset=race.options.sea==='swell'?1:0;
    this.oceanMat.setFloat('time',t);this.oceanMat.setFloat('rough',race.roughness);this.oceanMat.setFloat('sunset',sunset);this.oceanMat.setVector3('cameraPosition',this.camera.position);
    this.skyMat.setFloat('sunset',sunset);this.skyMat.setVector3('cameraPosition',this.camera.position);
    this.riders.forEach((a,i)=>this.animateRider(a,race.racers[i],t));
    this.buoys.forEach((b,i)=>{b.node.position.y=waveAt(COURSE[i].x,COURSE[i].z,t,race.roughness);b.node.rotation.z=Math.sin(t+i)*.05;b.ring.position.y=b.node.position.y+.09;b.ring.visibility=i===p.next?1:.08;b.beacon.setEnabled(i===p.next&&race.state!=='menu');b.beacon.position.y=5.2+Math.sin(t*2)*.3;});
    const inMenu=race.state==='menu';const sx=Math.sin(p.heading),sz=Math.cos(p.heading);
    const distance=this.mode?17:11.5,height=this.mode?10:5.8;
    const targetPos=inMenu?new B.Vector3(12+Math.sin(t*.06)*3,7.5,-112):new B.Vector3(p.x-sx*distance,p.y||height+waveAt(p.x,p.z,t,race.roughness)*.4,p.z-sz*distance);
    if(!inMenu)targetPos.y=height+waveAt(p.x,p.z,t,race.roughness)*.35;
    const target=inMenu?new B.Vector3(-4,1.4,-77):new B.Vector3(p.x+sx*6,1.4,p.z+sz*6);
    const smooth=1-Math.exp(-Math.min(dt,.05)*4.8);this.camera.position=B.Vector3.Lerp(this.camera.position,targetPos,smooth);
    this.lastCamera=this.lastCamera?B.Vector3.Lerp(this.lastCamera,target,smooth):target;this.camera.setTarget(this.lastCamera);
    this.scene.render();this.frames++;
  }
  diagnostics(){return {riderAsset:this.riderAsset||null,renderer:'Babylon.js '+B.Engine.Version,webGL:this.engine.webGLVersion,frames:this.frames,fps:this.engine.getFps(),meshes:this.scene.meshes.length,activeMeshes:this.scene.getActiveMeshes().length,width:this.engine.getRenderWidth(),height:this.engine.getRenderHeight(),waterReady:this.oceanMat.isReady(this.ocean),skyReady:this.skyMat.isReady(this.sky),drawCalls:this.engine._drawCalls?.current||0};}
  capture(){this.scene.render();return this.canvas.toDataURL('image/png');}
  dispose(){window.removeEventListener('resize',this.resize);this.scene.dispose();this.engine.dispose();}
}
