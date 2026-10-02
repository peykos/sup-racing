# TIDE — SUP Racing

Play: https://peykos.github.io/sup-racing/

A standalone 3D stand-up paddle race built with Babylon.js. Race against four opponents around six ordered checkpoints in a fictional Aegean bay. Choose 1–3 laps, three difficulty levels, and calm water or golden-hour swell.

## Controls

- A/D or Left/Right: steer.
- Space, W or Up: hold for alternating paddle strokes.
- Q/E: left/right paddle stroke.
- Shift: sprint while energy remains.
- P/Escape: pause; R: restart; C: camera; M: sound; F: fullscreen.
- Phone/tablet: on-screen steering, paddle and sprint buttons. Landscape recommended.

The game requires a modern WebGL browser. No account or installation is needed. Personal bests are stored only in your browser. No analytics, server, multiplayer, external CDN or API keys are used. The local QA uploader is excluded from this public build.

## Static hosting

GitHub Pages serves the repository root from the main branch. All game assets are included, and paths work under the /sup-racing/ subdirectory. A local static HTTP server also works; do not open index.html with file:// because it uses JavaScript modules.

## Blender athlete

The original athlete is loaded from `assets/rider/sup-rider.glb`, with independent Idle, Paddle_Left and Paddle_Right animations and team-coloured life vests. The paddle animation follows the existing stroke timing; controls and race physics are unchanged.

Editable Blender source, a rendered preview, the export manifest and asset notes are in `assets/rider/`. The reproducible generator is `art/blender/create_rider.py`. Babylon.js and its matching 9.14.0 GLTF loader are vendored locally.

## Credits

Game code, procedural scenery, characters, boards and water shader are original. No video footage or third-party game assets are redistributed.

Babylon.js is distributed under Apache-2.0; see vendor/BABYLON-LICENSE.md and vendor/BABYLON-NOTICE.md.
