"""TIDE original SUP athlete. Run with Blender 4.3+, not system Python.
blender -b --factory-startup --python create_rider.py -- --out-dir assets/rider
Original geometry, vertex-colour PBR, articulated node rig, three baked clips.
Game uses metres, +Y up, +Z forward. Blender uses +Z up, -Y forward.
The X reflection in game_point compensates Babylon's default LH glTF root.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--out-dir', required=True)
args.add_argument('--render', action='store_true')
opt = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(opt.out_dir).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 30
scene.world.color = (.17, .22, .25)


def linear(hex_color):
    vals = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in vals) + (1,)


def material(name, hex_color=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = .78
    bsdf.inputs['Metallic'].default_value = 0
    if hex_color:
        bsdf.inputs['Base Color'].default_value = linear(hex_color)
        mat.diffuse_color = linear(hex_color)
    else:
        vcol = mat.node_tree.nodes.new('ShaderNodeVertexColor')
        vcol.layer_name = 'Color'
        mat.node_tree.links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


palette = material('Athlete_Palette')
team = material('TeamColor', '#adffce')
skin = '#c88e67'
light_skin = '#d79e75'
navy = '#173c49'
cream = '#f3eed9'
trim = '#284c56'
root = bpy.data.objects.new('SUP_Rider', None)
scene.collection.objects.link(root)
controls = {}
parts = {}


def control(name):
    ob = bpy.data.objects.new(name, None)
    scene.collection.objects.link(ob)
    ob.parent = root
    controls[name] = ob
    parts[name] = []
    return ob


for name in ['hips', 'torso', 'head', 'leftFoot', 'rightFoot', 'leftThigh', 'rightThigh',
             'leftShin', 'rightShin', 'leftUpper', 'rightUpper', 'leftFore', 'rightFore',
             'leftHand', 'rightHand', 'shaft', 'blade', 'grip']:
    control(name)


def paint(ob, color, team_color=False):
    ob.data.materials.clear()
    ob.data.materials.append(team if team_color else palette)
    if not team_color:
        col = ob.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
        value = linear(color)
        for data in col.data:
            data.color = value
    return ob


def keep(ob, group, color, team_color=False):
    # Bake primitive dimensions but keep points in the control's local coordinates.
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    paint(ob, color, team_color)
    ob.parent = controls[group]
    parts[group].append(ob)
    return ob


def sphere(group, name, loc, size, color, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = tuple(v / 2 for v in size)
    for face in ob.data.polygons:
        face.use_smooth = True
    return keep(ob, group, color)


def box(group, name, loc, size, color, bevel=.015, team_color=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = ob.modifiers.new('Tailored round edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return keep(ob, group, color, team_color)


def loft(group, name, rings, color, segments=12, team_color=False):
    # Each ring: local Z, X radius, Y radius. Closed, positive-winding mesh.
    verts = [(rx * math.cos(i * math.tau / segments), ry * math.sin(i * math.tau / segments), z)
             for z, rx, ry in rings for i in range(segments)]
    faces = [tuple(reversed(range(segments)))]
    for j in range(len(rings)-1):
        for i in range(segments):
            a = j*segments+i
            b = j*segments+(i+1)%segments
            faces.append((a, b, b+segments, a+segments))
    faces.append(tuple((len(rings)-1)*segments+i for i in range(segments)))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(ob)
    for f in mesh.polygons:
        f.use_smooth = len(f.vertices) == 4
    return keep(ob, group, color, team_color)


# Fitted board shorts, waistband and colour piping.
loft('hips', 'Boardshorts', [(-.16,.255,.18),(-.10,.255,.185),(.12,.225,.15),(.18,.19,.125)], navy)
loft('hips', 'Waistband', [(.13,.227,.151),(.18,.196,.13)], trim)
for s in [-1,1]:
    cuff = loft('hips', 'Shorts leg', [(-.255,.148,.19),(.09,.15,.19)], navy)
    cuff.location.x = s*.16
    cuff.location.y = -.045
    box('hips', 'Shorts piping', (s*.307,-.045,-.08), (.009,.066,.23), '#ff9b65', .003)
box('hips', 'Drawstring', (0,-.151,.08), (.018,.012,.09), cream, .005)

# Sculpted racing PFD: tapered foam vest, shoulders, zip, straps and reflective back panel.
loft('torso', 'PFD shell', [(-.30,.17,.128),(-.26,.21,.155),(.12,.255,.173),(.25,.225,.14),(.29,.16,.12)], '#adffce', team_color=True)
loft('torso', 'Vest lower belt', [(-.285,.191,.145),(-.23,.215,.16)], navy)
for s in [-1,1]:
    box('torso', 'Vest shoulder strap', (s*.16,0,.26), (.078,.275,.065), navy)
    box('torso', 'Front padded panel', (s*.122,-.143,.005), (.19,.077,.37), '#adffce', .025, True)
    box('torso', 'Reflective shoulder', (s*.159,-.155,.19), (.043,.012,.052), cream, .003)
box('torso', 'Zip channel', (0,-.192,.007), (.036,.022,.49), navy, .008)
box('torso', 'Zip pull', (0,-.21,.1), (.023,.011,.046), cream, .004)
box('torso', 'Belt buckle', (0,-.163,-.253), (.095,.022,.062), '#68808a', .008)
box('torso', 'Buckle opening', (0,-.178,-.253), (.065,.01,.032), navy, .004)
box('torso', 'Back reflective yoke', (0,.167,.14), (.34,.018,.042), cream, .005)
box('torso', 'Back race patch', (0,.171,-.035), (.225,.016,.19), navy, .012)
# Geometric twin wave insignia, readable from the chase camera.
for z in [-.045,.005]:
    for i in range(5):
        ob = box('torso', 'TIDE insignia', ((i-2)*.034,.184,z+(.01 if i%2 else 0)), (.035,.009,.014), cream, .003)
# Neck originates on the vest, hidden inside head at the top.
sphere('torso', 'Neck', (0,0,.35), (.145,.135,.19), skin)

# Face: cheekbones, jaw, nose, ears. Front in Blender is -Y.
loft('head', 'Face', [(-.18,.065,.074),(-.15,.102,.106),(-.055,.14,.126),(.07,.151,.134),(.14,.137,.123),(.19,.085,.087)], skin, 16)
sphere('head', 'Nose', (0,-.136,-.011), (.058,.07,.085), light_skin)
for s in [-1,1]:
    sphere('head', 'Ear', (s*.146,.001,-.019), (.047,.051,.078), skin)
    # Wraparound sports sunglasses: frame, blue lenses, fine sun glint.
    box('head', 'Eyewear frame', (s*.075,-.122,.034), (.142,.046,.076), navy, .017)
    box('head', 'Polarized lens', (s*.075,-.149,.035), (.119,.013,.05), '#357c87', .009)
    glint = box('head', 'Lens highlight', (s*.081,-.157,.044), (.068,.005,.008), '#a7e8df', .002)
    glint.rotation_euler[1] = -.15
    box('head', 'Glasses arm', (s*.144,-.025,.036), (.018,.19,.018), navy, .004)
box('head', 'Glasses bridge', (0,-.15,.042), (.035,.018,.018), navy, .005)
box('head', 'Mouth', (0,-.108,-.108), (.051,.007,.009), '#91563e', .004)
# Low-profile running cap and curved bill.
loft('head', 'Cap crown', [(.106,.154,.139),(.15,.151,.137),(.208,.115,.106),(.242,.025,.025)], cream, 16)
loft('head', 'Cap sweatband', [(.10,.155,.14),(.123,.156,.141)], navy, 16)
sphere('head', 'Cap peak', (0,-.176,.124), (.342,.224,.032), cream, 16, 6)
box('head', 'Cap centre flash', (0,-.137,.166), (.055,.009,.041), '#ff9b65', .006)

# Athletic limbs, tapered profiles along unit local Z, flexible lengths at runtime.
for name in ['leftThigh','rightThigh','leftShin','rightShin','leftUpper','rightUpper','leftFore','rightFore']:
    if 'Thigh' in name:
        radii = [(-.5,.066),(-.38,.084),(.2,.095),(.5,.081)]
    elif 'Shin' in name:
        radii = [(-.5,.046),(-.18,.064),(.19,.073),(.5,.065)]
    elif 'Upper' in name:
        radii = [(-.5,.047),(-.15,.065),(.2,.071),(.5,.061)]
    else:
        radii = [(-.5,.037),(-.32,.041),(.23,.058),(.5,.048)]
    # The endpoint toward a is -Z; toward b is +Z. Reverse for upper -> lower taper.
    radii = [(-z, r) for z,r in reversed(radii)]
    loft(name, name+' muscle', [(z,r,r*.9) for z,r in radii], skin, 10)
    sphere(name, name+' joint', (0,0,-.45), (radii[0][1]*1.92,radii[0][1]*1.75,.13), skin, 10, 6)
for prefix in ['left','right']:
    sphere(prefix+'Foot', 'Neoprene sole', (0,-.025,-.018), (.16,.31,.063), cream)
    sphere(prefix+'Foot', 'Water shoe', (0,-.02,.018), (.145,.29,.085), navy)
    box(prefix+'Foot', 'Shoe flash', (0,-.085,.053), (.097,.044,.011), '#ff9b65', .005)
    sphere(prefix+'Hand', 'Grip palm', (0,0,0), (.103,.085,.12), skin)
    sphere(prefix+'Hand', 'Grip thumb', (.046,-.014,.015), (.04,.06,.065), light_skin, 10, 6)
    for j in range(3):
        box(prefix+'Hand', 'Finger crease', (-.022+j*.023,-.04,-.012), (.005,.006,.047), '#a86e4f', .002)
# Sports watch on the left wrist.
loft('leftFore', 'Watch strap', [(.28,.045,.044),(.41,.042,.041)], navy, 10)
box('leftFore', 'Watch face', (0,-.044,.344), (.046,.017,.08), '#77b1ae', .009)

# Carbon paddle with a teardrop blade and T-grip. Local +Z is the shaft direction.
loft('shaft', 'Carbon shaft', [(-.5,.0165,.0165),(.5,.0165,.0165)], navy, 10)
loft('shaft', 'Shaft collar', [(.22,.019,.019),(.265,.019,.019)], cream, 10)
loft('blade', 'Carbon teardrop', [(-.24,.014,.015),(-.19,.09,.021),(-.10,.105,.023),(.06,.074,.019),(.18,.019,.014),(.23,.016,.016)], navy, 12)
box('blade', 'Blade flash', (0,-.023,-.03), (.087,.006,.115), '#ff9b65', .012)
box('blade', 'Blade spine', (0,-.028,-.025), (.017,.008,.26), trim, .007)
sphere('grip', 'Paddle T grip', (0,0,0), (.145,.042,.055), navy, 12, 6)

# Consolidate geometry per moving part: no textures, one shared palette + team material.
for name, objects in parts.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    ob = objects[0]
    ob.name = name+'_mesh'
    # Ensure single palette slot plus optional team slot; remove duplicate slots after join.
    unique = []
    remap = {}
    for i, mat in enumerate(ob.data.materials):
        if mat not in unique:
            unique.append(mat)
        remap[i] = unique.index(mat)
    face_indices = [remap[f.material_index] for f in ob.data.polygons]
    ob.data.materials.clear()
    for mat in unique:
        ob.data.materials.append(mat)
    for f, index in zip(ob.data.polygons, face_indices):
        f.material_index = index


def game_point(p):
    return Vector((-p[0], -p[2], p[1]))


def position(name, p):
    controls[name].location = game_point(p)


def segment(name, a, b):
    a, b = game_point(a), game_point(b)
    d = b-a
    ob = controls[name]
    ob.location = (a+b)*.5
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = Vector((0,0,1)).rotation_difference(d.normalized())
    ob.scale = (1,1,d.length)


def pose(phase=0, side=1, active=False, breathe=0):
    lean = .12+.32*math.sin(phase*math.pi) if active else .09 + breathe*.012
    position('hips', (0,1,-.35))
    position('torso', (0,1.40-lean*.15,-.25+lean*.5))
    controls['torso'].rotation_euler.x = lean
    position('head', (0,1.91-lean*.28,-.2+lean))
    for s, prefix in [(-1,'left'),(1,'right')]:
        hip = (s*.16,1.04,-.36)
        knee = (s*.19,.66,-.19+lean*.16)
        foot = (s*.19,.32,-.36)
        position(prefix+'Foot', foot)
        segment(prefix+'Thigh', hip, knee)
        segment(prefix+'Shin', knee, foot)
    blade_z = (1.28-phase*3.1 if phase < .64 else -.70+(phase-.64)*5.3) if active else .52
    blade_y = (-.17 if phase < .64 else .35+math.sin((phase-.64)/.36*math.pi)*.3) if active else .40
    bottom = (side*.72,blade_y,blade_z)
    top = (-side*.15,1.96-lean*.12,.2+lean)
    segment('shaft', bottom, top)
    position('blade', bottom)
    position('grip', top)
    for name in ['blade','grip']:
        controls[name].rotation_mode = 'QUATERNION'
        controls[name].rotation_quaternion = controls['shaft'].rotation_quaternion.copy()
    lower = [a*.52+b*.48 for a,b in zip(bottom,top)]
    for s, prefix in [(-1,'left'),(1,'right')]:
        hand = lower if s == side else top
        shoulder = (s*.25,1.56-lean*.22,-.26+lean)
        elbow = [(a+b)*.5 for a,b in zip(shoulder,hand)]
        elbow[0] += s*.12
        elbow[2] -= .14
        segment(prefix+'Upper', shoulder, elbow)
        segment(prefix+'Fore', elbow, hand)
        position(prefix+'Hand', hand)
        controls[prefix+'Hand'].rotation_mode = 'QUATERNION'
        controls[prefix+'Hand'].rotation_quaternion = controls['shaft'].rotation_quaternion.copy()


# Bake three named, self-contained glTF animation groups from the exact game stroke timing.
for clip, side, frames in [('Idle',1,61),('Paddle_Left',-1,27),('Paddle_Right',1,27)]:
    for ob in controls.values():
        ob.animation_data_create()
        action = bpy.data.actions.new(ob.name+'|'+clip)
        ob.animation_data.action = action
    for frame in range(1, frames+1):
        phase = (frame-1)/(frames-1)
        pose(phase, side, clip != 'Idle', math.sin(phase*math.tau))
        for ob in controls.values():
            for path in ['location', 'rotation_quaternion' if ob.rotation_mode == 'QUATERNION' else 'rotation_euler', 'scale']:
                ob.keyframe_insert(data_path=path, frame=frame)
    for ob in controls.values():
        action = ob.animation_data.action
        for fc in action.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = 'LINEAR'
        ob.animation_data.action = None
        track = ob.animation_data.nla_tracks.new()
        track.name = clip
        strip = track.strips.new(clip,1,action)
        strip.blend_type = 'REPLACE'
        strip.extrapolation = 'NOTHING'
        track.mute = True

scene.frame_start = 1
scene.frame_end = 61
pose()
bpy.context.view_layer.update()  # Flush node matrices before glTF static-transform capture.
root['asset'] = 'TIDE SUP Athlete v1'
root['author'] = 'Original procedural Blender asset for TIDE SUP Racing'
root['rig'] = '18 articulated transform controls; baked Idle/Paddle_Left/Paddle_Right'
root['units'] = 'metres'
root['game_deck_y'] = .27
# NLA tracks must be enabled for glTF exporter traversal. Save them muted for a clean rest pose.
bpy.ops.wm.save_as_mainfile(filepath=str(out/'sup-rider.blend'))
for ob in controls.values():
    for tr in ob.animation_data.nla_tracks:
        tr.mute = False
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for ob in root.children_recursive:
    ob.select_set(True)
result = bpy.ops.export_scene.gltf(
    filepath=str(out/'sup-rider.glb'), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=False, export_extras=True,
    export_animations=True, export_animation_mode='NLA_TRACKS',
    export_frame_range=False, export_force_sampling=True, export_optimize_animation_size=True,
    export_optimize_animation_keep_anim_object=True, export_anim_slide_to_zero=True,
    export_texcoords=False,
    export_materials='EXPORT', export_cameras=False, export_lights=False)
assert result == {'FINISHED'}, result

# Blender 4.3's NLA exporter can leave identity defaults on animated empties.
# Give generic viewers a valid rest pose even BEFORE playing any animation.
# Read actual exported Idle samples; preserve the binary chunk byte-for-byte.
import struct
path = out/'sup-rider.glb'
blob = path.read_bytes()
json_size = struct.unpack_from('<I', blob, 12)[0]
doc = json.loads(blob[20:20+json_size])
bin_header = 20+json_size
assert struct.unpack_from('<I',blob,bin_header+4)[0] == 0x004e4942
bin_start = bin_header+8
idle = next(a for a in doc['animations'] if a['name'] == 'Idle')
for channel in idle['channels']:
    sampler = idle['samplers'][channel['sampler']]
    assert sampler.get('interpolation','LINEAR') != 'CUBICSPLINE'
    accessor = doc['accessors'][sampler['output']]
    assert accessor['componentType'] == 5126 and 'sparse' not in accessor
    view = doc['bufferViews'][accessor['bufferView']]
    size = {'VEC3':3,'VEC4':4}[accessor['type']]
    offset = bin_start + view.get('byteOffset',0) + accessor.get('byteOffset',0)
    value = struct.unpack_from('<'+'f'*size,blob,offset)
    doc['nodes'][channel['target']['node']][channel['target']['path']] = list(value)
json_bytes = json.dumps(doc,separators=(',',':'),allow_nan=False).encode('utf8')
json_bytes += b' '*((-len(json_bytes))%4)
chunks = struct.pack('<II',len(json_bytes),0x4e4f534a)+json_bytes+blob[bin_header:]
path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(chunks))+chunks)

for ob in controls.values():
    for tr in ob.animation_data.nla_tracks:
        tr.mute = True
pose()
bpy.context.view_layer.update()
triangles = 0
for ob in root.children_recursive:
    if ob.type == 'MESH':
        ob.data.calc_loop_triangles()
        triangles += len(ob.data.loop_triangles)
manifest = {'blender':bpy.app.version_string, 'file':'sup-rider.glb', 'triangles':triangles,
            'mesh_objects':sum(ob.type == 'MESH' for ob in root.children_recursive),
            'controls':list(controls), 'animations':['Idle','Paddle_Left','Paddle_Right'],
            'textures':0, 'units':'metres', 'source':'sup-rider.blend',
            'bytes':(out/'sup-rider.glb').stat().st_size}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('RIDER_EXPORT_OK '+json.dumps(manifest), flush=True)

# Optional CPU preview: not included in GLB, never requires a GPU or touches the open GUI.
if opt.render:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 20
    scene.cycles.use_denoising = False  # Debian ARM build has no OpenImageDenoise.
    scene.render.resolution_x = 700
    scene.render.resolution_y = 850
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    world = scene.world
    world.use_nodes = True
    world.node_tree.nodes.get('Background').inputs[0].default_value = (.22,.30,.34,1)
    world.node_tree.nodes.get('Background').inputs[1].default_value = .65
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,.265))
    floor = bpy.context.object
    floor.data.materials.append(material('Preview background', '#607e87'))
    def area(name, loc, power, size):
        data = bpy.data.lights.new(name,'AREA')
        data.energy, data.shape, data.size = power, 'DISK', size
        ob = bpy.data.objects.new(name,data)
        scene.collection.objects.link(ob)
        ob.location = game_point(loc)
        ob.rotation_euler = (game_point((0,1,0))-ob.location).to_track_quat('-Z','Y').to_euler()
    area('Key',(3,5,4),450,4)
    area('Rim',(-3,3,-2),300,3)
    data = bpy.data.cameras.new('Preview camera')
    cam = bpy.data.objects.new('Preview camera',data)
    scene.collection.objects.link(cam)
    cam.location = game_point((-3.3,2.7,5.2))
    cam.rotation_euler = (game_point((.12,1.22,0))-cam.location).to_track_quat('-Z','Y').to_euler()
    data.type = 'ORTHO'
    data.ortho_scale = 2.9
    scene.camera = cam
    scene.render.filepath = str(out/'sup-rider-preview.png')
    bpy.ops.render.render(write_still=True)
    print('RIDER_RENDER_OK',scene.render.filepath, flush=True)
