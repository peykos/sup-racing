// Original Blender asset, loaded once; geometry is shared by all five athletes.
const B=window.BABYLON;
export const RIDER_URL=new URL('../assets/rider/sup-rider.glb',import.meta.url).href;
export async function loadRiderModels(scene,actors,colors){
  if(!B.SceneLoader.IsPluginForExtensionAvailable('.glb'))throw new Error('Λείπει ο τοπικός glTF loader.');
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
  let bytes;
  try{
    const response=await fetch(RIDER_URL,{signal:abort.signal});
    if(!response.ok)throw new Error('Κωπηλάτης GLB: HTTP '+response.status);
    bytes=new Uint8Array(await response.arrayBuffer());
  }finally{clearTimeout(timer);}
  const asset=await B.SceneLoader.LoadAssetContainerAsync('',bytes,scene,undefined,'.glb');
  if(scene.isDisposed){asset.dispose();throw new Error('Η σκηνή έκλεισε κατά τη φόρτωση του κωπηλάτη.');}
  const instances=[];
  try{
    for(let i=0;i<actors.length;i++){
      const instance=asset.instantiateModelsToScene(name=>`athlete-${i}-${name}`,true,{doNotInstantiate:true});
      instances.push(instance);
      for(const node of instance.rootNodes)node.parent=actors[i].root;
      const clips=Object.fromEntries(['Idle','Paddle_Left','Paddle_Right'].map(name=>{
        const group=instance.animationGroups.find(g=>g.name.endsWith(name));
        if(!group||group.to<=group.from)throw new Error('Λείπει η κίνηση '+name+' από το GLB.');
        return [name,group];
      }));
      const meshes=instance.rootNodes.flatMap(n=>n.getChildMeshes());
      for(const mesh of meshes){
        mesh.isPickable=false;
        if(mesh.material?.name.includes('TeamColor'))mesh.material.albedoColor=B.Color3.FromHexString(colors[i]).toLinearSpace();
      }
      // Some meshes use a MultiMaterial; tint only the vest, never skin/eyewear.
      for(const mat of new Set(meshes.flatMap(m=>m.material?.subMaterials||[m.material]))){
        if(mat?.name.includes('TeamColor'))mat.albedoColor=B.Color3.FromHexString(colors[i]).toLinearSpace();
      }
      let current=null;
      actors[i].model={instance,clips,meshes,update(active,phase,side,time){
        const name=active?(side<0?'Paddle_Left':'Paddle_Right'):'Idle';
        const clip=clips[name];
        if(current!==clip){current?.stop();clip.start(true);clip.pause();current=clip;}
        // Pose sampling, not an independent timer: pause/sprint/input remain in sync.
        const fraction=active?Math.max(0,Math.min(1,phase)):((time+i*.23)%2)/2;
        clip.goToFrame(clip.from+(clip.to-clip.from)*fraction);
      }};
      actors[i].model.update(false,0,1,0);
    }
  }catch(error){for(const instance of instances)instance.dispose();asset.dispose();throw error;}
  // The scene owns cloned instances; retain the container for their shared geometry.
  scene.onDisposeObservable.addOnce(()=>asset.dispose());
  return {asset:'sup-rider.glb',bytes:bytes.byteLength,instances:instances.length,clips:['Idle','Paddle_Left','Paddle_Right']};
}
