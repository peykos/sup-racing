# TIDE SUP athlete

Original stylized athlete modelled and exported with Blender 4.3.2.
No downloaded models, image textures, licensed character packs or external URLs.

- `sup-rider.glb`: self-contained glTF 2.0, metres, Y up; 18 articulated mesh parts; vertex-colour PBR.
- `Idle`, `Paddle_Left`, `Paddle_Right`: baked rigid-node animation clips (not a skinned humanoid armature).
- `TeamColor`: vest material recoloured per racer. Mesh geometry is shared between the five independent instances.
- `sup-rider.blend`: editable source; NLA tracks are muted to show a neutral pose. Enable one named track per control to preview its motion.
- `sup-rider-preview.png`: Blender/Cycles preview, not an in-game screenshot.
- `manifest.json`: export counts and size from the generation script.

The Babylon adapter samples the stroke clip from the race simulation's existing 0.86-second stroke phase. Movement, AI, boards, steering, scoring and physics are unchanged. All paths are relative, including GitHub Pages subdirectories.

Regenerate with Blender (requires the Blender glTF exporter's NumPy dependency):

    blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python art/blender/create_rider.py -- --out-dir assets/rider --render

On this device, run the existing `blender-debian` PRoot installation, bind the project to `/work`, and use `/work/art/blender/create_rider.py` and `/work/assets/rider`. Debian ARM's Cycles build has no OpenImageDenoise: preview denoising is disabled.

Verification: `npm test` includes a real Babylon NullEngine + glTF loader test. It checks clips, independent instances, team materials, feet/deck placement, left/right paddle signs and finite transforms across each animation. This CPU test is not a WebGL screenshot check.
