"""TIDE / ISLAND SPRINT: original flat-shaded Blender geometry + baked node animation.
Blender 4.3: --background --factory-startup --python build_lowpoly.py -- --out-dir /work/assets/lowpoly
Units metres. Authoring uses Blender Z-up; G() accepts Babylon LH (X,Y,Z).
No downloads, textures, runtime modelling libraries, or external assets needed.
"""
import argparse
import json
import math
import random
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--out-dir', required=True)
parser.add_argument('--render', action='store_true')
opt = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out = Path(opt.out_dir).resolve()
out.mkdir(parents=True, exist_ok=True)
rng = random.Random(82)
manifest = {'title':'TIDE — Island Sprint', 'blender':bpy.app.version_string,
            'style':'Original flat-shaded, vertex-colour, texture-free low-poly', 'units':'metres', 'assets':[]}


def G(p):
    return Vector((-p[0], -p[2], p[1]))


def rgba(h):
    v = [int(h[i:i+2],16)/255 for i in (1,3,5)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in v)+(1,)


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    sc = bpy.context.scene
    sc.unit_settings.system='METRIC'
    sc.render.fps=30
    sc.frame_start=1
    sc.frame_end=61
    mat=bpy.data.materials.new('Flat_Palette')
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=.92
    attr=mat.node_tree.nodes.new('ShaderNodeVertexColor')
    attr.layer_name='Color'
    mat.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color'])
    return sc,mat


scene,palette=reset()
cream='#fff1cf'; ink='#233c4b'; sand='#efc783'; white='#fff8e8'
coral='#f47759'; teal='#168f93'; blue='#448eac'; leaf='#4caa79'; leaf2='#76c48a'
parts={}


def empty(name,parent=None):
    o=bpy.data.objects.new(name,None)
    scene.collection.objects.link(o)
    o.parent=parent
    return o


def paint(ob,color):
    ob.data.materials.clear()
    ob.data.materials.append(palette)
    attr=ob.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    value=rgba(color)
    for x in attr.data:x.color=value
    for poly in ob.data.polygons:poly.use_smooth=False
    return ob


def keep(o,group,color):
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    paint(o,color)
    o.parent=group
    parts.setdefault(group,[]).append(o)
    return o


def mesh(group,name,vertices,faces,color):
    m=bpy.data.meshes.new(name)
    m.from_pydata(vertices,[],faces)
    m.update()
    o=bpy.data.objects.new(name,m)
    scene.collection.objects.link(o)
    return keep(o,group,color)


def box(group,name,p,size,color,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=p)
    o=bpy.context.object;o.name=name;o.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Single chamfer','BEVEL');mod.width=bevel;mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return keep(o,group,color)


def ico(group,name,p,size,color,sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=p)
    o=bpy.context.object;o.name=name;o.scale=tuple(v/2 for v in size)
    return keep(o,group,color)


def loft(group,name,rings,color,n=8):
    vertices=[(rx*math.cos(i*math.tau/n),ry*math.sin(i*math.tau/n),z) for z,rx,ry in rings for i in range(n)]
    faces=[tuple(reversed(range(n)))]
    for j in range(len(rings)-1):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n
            faces.append((a,b,b+n,a+n))
    faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
    return mesh(group,name,vertices,faces,color)


def rod(group,name,a,b,r,color,n=6):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r*.84,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.name=name
    o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((0,0,1)).rotation_difference((b-a).normalized())
    return keep(o,group,color)


def join(group,name):
    objects=parts[group]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1:bpy.ops.object.join()
    o=objects[0];o.name=name
    # One palette, origin at local zero for deterministic prefabs/control transforms.
    mw=o.matrix_world.copy()
    world_vertices=[mw@v.co for v in o.data.vertices]
    o.parent=None;o.matrix_world.identity()
    for v,co in zip(o.data.vertices,world_vertices):v.co=co
    o.parent=group
    o.data.materials.clear();o.data.materials.append(palette)
    for p in o.data.polygons:p.material_index=0
    return o


def fix_rest(path):
    blob=path.read_bytes();n=struct.unpack_from('<I',blob,12)[0]
    doc=json.loads(blob[20:20+n]);bh=20+n;bs=bh+8
    idle=next((a for a in doc.get('animations',[]) if a['name']=='Idle'),None)
    if idle:
        for c in idle['channels']:
            s=idle['samplers'][c['sampler']];a=doc['accessors'][s['output']];v=doc['bufferViews'][a['bufferView']]
            count={'VEC3':3,'VEC4':4}[a['type']]
            values=struct.unpack_from('<'+'f'*count,blob,bs+v.get('byteOffset',0)+a.get('byteOffset',0))
            doc['nodes'][c['target']['node']][c['target']['path']]=list(values)
        j=json.dumps(doc,separators=(',',':'),allow_nan=False).encode();j+=b' '*((-len(j))%4)
        chunks=struct.pack('<II',len(j),0x4e4f534a)+j+blob[bh:]
        path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(chunks))+chunks)
    return doc


def export(stem,animated=False):
    bpy.context.view_layer.update()
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(stem+'.blend')))
    result=bpy.ops.export_scene.gltf(filepath=str(out/(stem+'.glb')),export_format='GLB',
        export_yup=True,export_apply=False,export_extras=True,export_animations=animated,
        export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,
        export_optimize_animation_size=True,export_optimize_animation_keep_anim_object=True,
        export_anim_slide_to_zero=True,export_texcoords=False,export_materials='EXPORT',
        export_cameras=False,export_lights=False)
    assert result=={'FINISHED'}
    d=fix_rest(out/(stem+'.glb'))
    triangles=0
    for o in scene.objects:
        if o.type=='MESH':o.data.calc_loop_triangles();triangles+=len(o.data.loop_triangles)
    record={'file':stem+'.glb','source':stem+'.blend','triangles':triangles,
            'meshes':len(d.get('meshes',[])), 'bytes':(out/(stem+'.glb')).stat().st_size,
            'animations':[a['name'] for a in d.get('animations',[])], 'textures':len(d.get('textures',[]))}
    manifest['assets'].append(record)
    print('LOWPOLY_EXPORT_OK '+json.dumps(record),flush=True)


def build_character(slug,skin,hair,vest,style):
    global scene,palette,parts
    scene,palette=reset();parts={}
    root=empty('Rider_'+slug)
    names=['hips','torso','head','leftFoot','rightFoot','leftThigh','rightThigh','leftShin','rightShin',
           'leftUpper','rightUpper','leftFore','rightFore','leftHand','rightHand','shaft','blade','grip']
    controls={n:empty(n,root) for n in names}
    c=controls
    loft(c['hips'],'Shorts',[(-.20,.26,.18),(.16,.21,.15)],ink)
    for s in [-1,1]:
        o=loft(c['hips'],'Shorts leg',[(-.28,.148,.18),(.07,.15,.18)],ink);o.location=(s*.155,-.035,0)
        box(c['hips'],'Stripe',(s*.29,-.04,-.08),(.023,.10,.27),vest)
    loft(c['torso'],'PFD',[(-.30,.19,.14),(-.23,.23,.17),(.19,.28,.19),(.31,.19,.14)],vest)
    box(c['torso'],'Back label',(0,.185,-.025),(.25,.025,.18),cream,.01)
    for z in [-.03,.025]:
        for i in range(4):box(c['torso'],'Wave logo',((i-1.5)*.048,.205,z+(i%2)*.012),(.048,.012,.023),teal)
    box(c['torso'],'Zip',(0,-.188,-.015),(.028,.035,.45),ink)
    box(c['torso'],'Belt',(0,-.185,-.235),(.4,.028,.06),ink)
    for s in [-1,1]:box(c['torso'],'Shoulder strap',(s*.185,-.01,.265),(.085,.30,.06),cream)
    ico(c['torso'],'Neck',(0,0,.36),(.16,.15,.22),skin)
    loft(c['head'],'Face',[(-.22,.075,.095),(-.15,.155,.145),(.08,.20,.167),(.22,.15,.14),(.24,.07,.06)],skin,10)
    ico(c['head'],'Nose',(0,-.172,-.025),(.095,.093,.115),skin)
    for s in [-1,1]:
        ico(c['head'],'Ear',(s*.192,0,-.01),(.072,.07,.11),skin)
        box(c['head'],'Eye',(s*.075,-.164,.032),(.032,.020,.042),ink,.004)
        box(c['head'],'Eyebrow',(s*.08,-.157,.085),(.074,.026,.020),hair)
    box(c['head'],'Smile',(0,-.132,-.133),(.079,.022,.012),white)
    if style=='cap':
        loft(c['head'],'Cream cap',[(.13,.206,.18),(.22,.185,.162),(.30,.105,.10),(.315,.01,.01)],cream,10)
        box(c['head'],'Cap brim',(0,-.22,.15),(.40,.25,.025),cream,.035)
        box(c['head'],'Cap badge',(0,-.174,.222),(.068,.018,.05),coral)
        for s in [-1,1]:box(c['head'],'Sunglasses',(s*.092,-.175,.037),(.16,.032,.08),teal,.014)
    elif style=='ponytail':
        loft(c['head'],'Hair',[ (.08,.198,.173),(.23,.185,.164),(.32,.08,.10)],hair,10)
        box(c['head'],'Headband',(0,-.169,.125),(.34,.028,.055),cream)
        ico(c['head'],'Ponytail',(0,.24,.09),(.21,.34,.42),hair)
        ico(c['head'],'Hair tie',(0,.187,.17),(.24,.085,.11),coral)
    else:
        for i in range(9):
            a=i*math.tau/9
            ico(c['head'],'Curl',(math.cos(a)*.145,math.sin(a)*.135,.205),(.22,.21,.23),hair)
        ico(c['head'],'Top curls',(0,0,.32),(.31,.29,.18),hair)
        box(c['head'],'Sport band',(0,-.174,.13),(.34,.033,.038),vest)
    for n in names:
        if any(q in n for q in ['Thigh','Shin','Upper','Fore']):
            radius=.089 if 'Thigh' in n else .068 if 'Shin' in n else .077 if 'Upper' in n else .056
            loft(c[n],n,[(-.5,radius,radius*.9),(-.20,radius*1.06,radius),(.5,radius*.76,radius*.76)],skin,7)
    for prefix in ['left','right']:
        box(c[prefix+'Foot'],'Water shoe',(0,-.035,0),(.175,.34,.085),cream,.024)
        box(c[prefix+'Foot'],'Shoe strap',(0,-.008,.045),(.178,.095,.02),vest)
        ico(c[prefix+'Hand'],'Hand',(0,0,0),(.115,.105,.15),skin,1)
    loft(c['shaft'],'Paddle shaft',[(-.5,.018,.018),(.5,.018,.018)],ink,6)
    loft(c['blade'],'Paddle blade',[(-.25,.025,.018),(-.18,.13,.025),(.03,.11,.024),(.22,.019,.018)],vest,8)
    box(c['blade'],'Blade stripe',(0,-.027,-.08),(.18,.008,.045),cream)
    box(c['grip'],'T grip',(0,0,0),(.16,.04,.048),ink,.012)
    for n in names:join(c[n],n+'_mesh')

    def position(n,p):c[n].location=G(p)
    def segment(n,a,b):
        a,b=G(a),G(b);d=b-a;o=c[n]
        o.location=(a+b)/2;o.rotation_mode='QUATERNION'
        o.rotation_quaternion=Vector((0,0,1)).rotation_difference(d.normalized());o.scale=(1,1,d.length)
    def pose(phase,side,clip):
        active=clip.startswith('Paddle');celebrate=clip=='Celebrate'
        lean=.10+.27*math.sin(phase*math.pi) if active else .07+.012*math.sin(phase*math.tau)
        bounce=.075*math.sin(phase*math.tau)**2 if celebrate else 0
        position('hips',(0,1+bounce,-.32));position('torso',(0,1.39-lean*.15+bounce,-.23+lean*.5))
        c['torso'].rotation_euler.x=lean
        position('head',(0,1.94-lean*.28+bounce,-.18+lean))
        c['head'].rotation_euler.z=.11*math.sin(phase*math.tau) if celebrate else 0
        for s,prefix in [(-1,'left'),(1,'right')]:
            foot=(s*.195,.315,-.35);position(prefix+'Foot',foot)
            knee=(s*.205,.65,-.17+lean*.16)
            segment(prefix+'Thigh',(s*.16,1.02+bounce,-.34),knee);segment(prefix+'Shin',knee,foot)
        bz=(1.28-phase*3.1 if phase<.64 else -.70+(phase-.64)*5.3) if active else .55
        by=(-.17 if phase<.64 else .35+math.sin((phase-.64)/.36*math.pi)*.3) if active else .4
        bottom=(side*.74,by,bz);top=(-side*.16,1.96-lean*.12,.2+lean)
        if celebrate:bottom=(-1.05,2.30+bounce,.12);top=(1.05,2.48+bounce,.12)
        segment('shaft',bottom,top);position('blade',bottom);position('grip',top)
        for n in ['blade','grip']:
            c[n].rotation_mode='QUATERNION';c[n].rotation_quaternion=c['shaft'].rotation_quaternion.copy()
        lower=[a*.52+b*.48 for a,b in zip(bottom,top)]
        for s,prefix in [(-1,'left'),(1,'right')]:
            hand=lower if s==side else top
            if celebrate:hand=(s*.7,2.38+bounce,.12)
            shoulder=(s*.27,1.56-lean*.22+bounce,-.25+lean)
            elbow=[(a+b)*.5 for a,b in zip(shoulder,hand)];elbow[0]+=s*.13;elbow[2]-=.13
            segment(prefix+'Upper',shoulder,elbow);segment(prefix+'Fore',elbow,hand);position(prefix+'Hand',hand)
    for clip,side,frames in [('Idle',1,61),('Paddle_Left',-1,27),('Paddle_Right',1,27),('Celebrate',1,61)]:
        for o in c.values():o.animation_data_create();o.animation_data.action=bpy.data.actions.new(o.name+'|'+clip)
        for frame in range(1,frames+1):
            pose((frame-1)/(frames-1),side,clip)
            for o in c.values():
                for path in ['location','rotation_quaternion' if o.rotation_mode=='QUATERNION' else 'rotation_euler','scale']:
                    o.keyframe_insert(data_path=path,frame=frame)
        for o in c.values():
            action=o.animation_data.action
            for fc in action.fcurves:
                for k in fc.keyframe_points:k.interpolation='LINEAR'
            o.animation_data.action=None;t=o.animation_data.nla_tracks.new();t.name=clip
            st=t.strips.new(clip,1,action);st.blend_type='REPLACE';st.extrapolation='NOTHING';t.mute=True
    pose(0,1,'Idle');bpy.context.view_layer.update()
    root['character']=slug;root['rig']='18 articulated node controls, baked transforms, no skeletal skinning'
    root['clips']='Idle, Paddle_Left, Paddle_Right, Celebrate'
    for o in c.values():
        for t in o.animation_data.nla_tracks:t.mute=False
    scene.frame_set(1)
    export('rider-'+slug,True)


for spec in [('leo','#cf9367','#493329',coral,'cap'),('maya','#a66d4e','#392d35','#e8b544','ponytail'),('noa','#82523c','#292c36',teal,'curls')]:
    build_character(*spec)

scene,palette=reset();parts={};prefabs=[]

def prefab(name,fn):
    group=empty(name+'_authoring');fn(group)
    o=join(group,name);o.parent=None
    bpy.data.objects.remove(group,do_unlink=True);prefabs.append(o)
    o['prefab']=name;o['origin']='local ground/water origin'
    return o


def board(g,color):
    # Main silhouette runs down Blender -Y = game forward.
    vertices=[];sections=[(-2.35,.02,.27),(-1.95,.32,.24),(-1.05,.48,.21),(.85,.46,.21),(1.80,.27,.20),(1.95,.17,.20)]
    for y,w,z in sections:vertices.extend([(-w,y,z),(w,y,z),(w,y,z-.16),(-w,y,z-.16)])
    faces=[(3,2,1,0)]
    for i in range(len(sections)-1):
        for j in range(4):faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    faces.append(tuple(range((len(sections)-1)*4,len(sections)*4)))
    mesh(g,'SUP hull',vertices,faces,color)
    box(g,'EVA deck',(0,.25,.223),(.69,1.68,.03),cream,.08)
    for y in [-.4,-.2,0,.2,.4,.6,.8]:box(g,'Deck groove',(0,y,.243),(.60,.019,.012),'#d5b989')
    box(g,'Centre stripe',(0,-1.45,.254),(.13,.94,.02),cream)
    box(g,'Fin',(0,1.3,.015),(.035,.35,.29),ink)
    for s in [-1,1]:rod(g,'Cargo bungee',(s*.27,-.79,.247),(-s*.23,-1.18,.26),.009,ink)

for name,color in [('Board_Coral',coral),('Board_Sun','#e8b544'),('Board_Teal',teal)]:prefab(name,lambda g,c=color:board(g,c))


def island(g):
    n=16;vertices=[]
    for z,r in [(-2.5,.91),(-.15,1),(.6,.91),(1.5,.72),(2.2,.52)]:
        for i in range(n):
            a=math.tau*i/n;f=1+.09*math.sin(i*4.3)
            vertices.append((math.cos(a)*r*18*f,math.sin(a)*r*13*f,z))
    for j,color in enumerate(['#b4a68b',sand,sand,'#9db773']):
        faces=[]
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n
            faces.extend([(a,b,a+n),(b,b+n,a+n)])
        mesh(g,'Faceted island rim',vertices,faces,color)
    mesh(g,'Island top',vertices,[tuple(range(4*n,5*n))],'#baca8c')
prefab('Island',island)


def palm(g):
    pts=[(0,0,0),(.25,0,1.7),(.52,.1,3.6),(.62,.12,5.4),(.43,.15,6.5)]
    for i in range(4):rod(g,'Palm trunk',pts[i],pts[i+1],.24-i*.034,'#9a7952',7)
    for i in range(8):
        a=i*math.tau/8
        def p(r,z,side=0):return (.43+math.cos(a)*r-math.sin(a)*side,.15+math.sin(a)*r+math.cos(a)*side,z)
        mesh(g,'Palm frond',[p(0,6.5),p(.9,6.9,.35),p(1.3,7.0),p(.9,6.9,-.35),p(2.2,6.65,.30),p(2.6,6.1),p(2.2,6.65,-.30)],[(0,1,2),(0,2,3),(1,4,2),(2,4,5),(2,5,6),(2,6,3)],leaf if i%2 else leaf2)
    for i in range(3):ico(g,'Coconut',(.35+i*.14,.11,6.25),(.34,.34,.42),'#6c573e')
prefab('Palm',palm)
prefab('Rock',lambda g:ico(g,'Faceted rock',(0,0,1.1),(4,3,3),'#c1bba5',1))


def house(g):
    box(g,'Whitewashed walls',(0,0,2.0),(5,4,4),white,.12)
    box(g,'Roof parapet',(0,0,4.08),(5.25,4.2,.22),cream)
    box(g,'Blue door',(0,-2.025,1.1),(1.1,.07,2.2),blue)
    for x in [-1.6,1.6]:
        box(g,'Blue shutter',(x,-2.065,2.6),(.8,.1,1.1),blue)
        box(g,'Window sill',(x,-2.15,2.03),(1,.29,.12),cream)
    box(g,'Terracotta chimney',(1.5,1.1,4.7),(.6,.6,1.2),coral)
prefab('House',house)


def lighthouse(g):
    loft(g,'Tower',[ (0,2,2),(.4,2,2),(8,1.25,1.25),(8.2,1.45,1.45)],white,10)
    loft(g,'Coral band',[(5.5,1.49,1.49),(6.4,1.41,1.41)],coral,10)
    loft(g,'Lantern balcony',[(8.15,1.8,1.8),(8.45,1.8,1.8)],ink,10)
    loft(g,'Lantern',[(8.45,1.13,1.13),(10,1.13,1.13)],'#9ae2d9',8)
    loft(g,'Lantern roof',[(10,1.6,1.6),(11,.02,.02)],coral,8)
    for i in range(8):
        a=i*math.tau/8;rod(g,'Lantern frame',(1.15*math.cos(a),1.15*math.sin(a),8.4),(1.15*math.cos(a),1.15*math.sin(a),10),.05,ink)
prefab('Lighthouse',lighthouse)


def pier(g):
    for i in range(15):box(g,'Timber deck',(0,i*.42,1.0),(3,.38,.20),'#b98759')
    for x in [-1.22,1.22]:
        for y in [.2,2.8,5.8]:rod(g,'Pier post',(x,y,-1.5),(x,y,1.5),.13,'#84624b')
prefab('Pier',pier)


def umbrella(g):
    rod(g,'Pole',(0,0,0),(0,0,2.8),.065,cream)
    n=10
    for i in range(n):
        a,b=i*math.tau/n,(i+1)*math.tau/n
        mesh(g,'Canopy',[(0,0,3.05),(math.cos(a)*1.65,math.sin(a)*1.65,2.55),(math.cos(b)*1.65,math.sin(b)*1.65,2.55)],[(0,1,2)],coral if i%2 else cream)
    box(g,'Beach towel',(1.25,0,.03),(.9,2,.035),teal)
prefab('Umbrella',umbrella)


def buoy(g):
    loft(g,'Float',[(0,.9,.9),(.25,1,1),(.46,.8,.8),(2.1,.25,.25)],coral,8)
    loft(g,'Buoy stripe',[(.95,.61,.61),(1.28,.50,.50)],cream,8)
    rod(g,'Flag pole',(0,0,1.7),(0,0,3.1),.027,ink)
    mesh(g,'Pennant',[(0,0,3.05),(.95,0,2.88),(0,0,2.64)],[(0,1,2),(2,1,0)],cream)
prefab('Buoy',buoy)


def gate(g):
    for x in [-7.5,7.5]:
        box(g,'Start pylon',(x,0,2.65),(.65,.75,5.3),coral,.08)
        box(g,'Float base',(x,0,.1),(2,2,.5),cream,.1)
    box(g,'Start lintel',(0,0,5.5),(15.65,.65,.9),cream,.06)
    for i in range(15):box(g,'Checkers',(-7+i, -.337,5.5+(i%2)*.2-.1),(.5,.025,.4),ink)
prefab('Gate',gate)


def boat(g):
    mesh(g,'Boat hull',[(-.9,-2,0),(.9,-2,0),(1.05,1.6,0),(0,2.9,0),(-1.05,1.6,0),(-.6,-1.8,-.55),(.6,-1.8,-.55),(0,2.4,-.45)],[(0,1,6,5),(1,2,7,6),(2,3,7),(3,4,7),(4,0,5,7),(0,4,3,2,1)],cream)
    rod(g,'Mast',(0,.3,0),(0,.3,5.9),.06,ink)
    mesh(g,'Mainsail',[(0,.3,5.8),(0,.3,.8),(0,-2.1,1.1)],[(0,1,2),(2,1,0)],coral)
    mesh(g,'Jib',[(0,.5,5.1),(0,2.4,.9),(0,.5,.9)],[(0,1,2),(2,1,0)],cream)
prefab('Sailboat',boat)


def cloud(g):
    for p,s in [((0,0,0),(9,4,3)),((-3,0,.4),(5,4,4)),((2,0,1.1),(5,4,4.8))]:ico(g,'Cloud puff',p,s,white,1)
prefab('Cloud',cloud)

def gull(g):
    ico(g,'Body',(0,0,0),(.3,.75,.25),white)
    mesh(g,'Wings',[(0,0,0),(-.6,0,.2),(-1.2,.2,.12),(0,-.2,0),(.6,0,.2),(1.2,.2,.12)],[(0,1,2,3),(0,3,5,4)],white)
prefab('Gull',gull)
export('coastal-kit')
manifest['prefabs']=[o.name for o in prefabs]
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')

if opt.render:
    # A real asset contact sheet, kept separate from browser QA evidence.
    for i,o in enumerate(prefabs):o.location=((i%5)*11, (i//5)*15,0)
    scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=False
    scene.render.resolution_x=1200;scene.render.resolution_y=850;scene.render.resolution_percentage=100
    scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.68,.79,.81,1);bg.inputs[1].default_value=.8
    bpy.ops.mesh.primitive_plane_add(size=250,location=(15,15,-3))
    floor=bpy.context.object;paint(floor,'#c6e6db')
    data=bpy.data.lights.new('Sun','AREA');data.energy=5000;data.shape='DISK';data.size=40
    light=bpy.data.objects.new('Sun',data);scene.collection.objects.link(light);light.location=(5,-15,55)
    camdata=bpy.data.cameras.new('Asset camera');cam=bpy.data.objects.new('Asset camera',camdata);scene.collection.objects.link(cam)
    target=Vector((20,19,1));cam.location=(73,-52,65);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO';camdata.ortho_scale=81;scene.camera=cam;scene.view_settings.view_transform='Standard'
    scene.render.filepath=str(out/'coastal-kit-preview.png');bpy.ops.render.render(write_still=True)
    print('LOWPOLY_RENDER_OK',flush=True)
print('LOWPOLY_PACK_OK',json.dumps(manifest),flush=True)
