# TIDE — Island Sprint (2.0)

Play: https://peykos.github.io/sup-racing/

An original low-poly SUP race built in Blender and Babylon.js, with a fictional Aegean island course. Choose LEO, MAYA or NOA, then race four AI opponents around six ordered buoys. Character appearance is cosmetic: all three have identical player physics.

## What's new

- Three original articulated characters: cap and sunglasses, ponytail/headband, and curls/sport band.
- Four baked GLB animations per character: `Idle`, `Paddle_Left`, `Paddle_Right`, `Celebrate`. Paddle animation follows the actual stroke side and timing.
- A Blender-built kit of 15 reusable objects: three SUP boards, island, palm, rock, house, lighthouse, pier, umbrella, buoy, start/finish arch, sailboat, cloud and gull.
- Faceted animated water, shallow-water colouring, island scenery, spray and wakes.
- New Greek mobile-first UI, character selection, minimap, checkpoint compass, rhythm/energy meters, HD/ECO quality and two cameras.
- 1–3 laps, three AI difficulties, calm/swell, pause, replay, results and per-configuration local bests.

## Controls

- A/D or Left/Right: steer.
- Q/E: left/right paddle; hold to repeat.
- Space: hold for automatic alternating paddles.
- Shift: hold sprint (uses energy).
- C: chase/wide camera; P/Escape: pause; M: sound.
- Touch: steering, separate paddle buttons, sprint and an automatic-paddles toggle. Portrait and landscape are supported.

## Blender sources / GLB exports

Download: [complete editable asset pack](assets/lowpoly/tide-lowpoly-assets.zip)

`assets/lowpoly/` contains three rider GLBs and `coastal-kit.glb`, with matching `.blend` files and a manifest. All geometry and vertex colours are embedded; there are no texture downloads. Animation uses 18 articulated transform controls per rider, not skinned bones. The coastal kit is a prefab library: its objects intentionally share a local origin for instancing rather than forming a ready-arranged level in a generic viewer.

Rebuild with Blender 4.3+ (NumPy must be available to Blender's glTF exporter):

    blender --background --factory-startup --disable-autoexec --python-exit-code 1 --python art/blender/build_lowpoly.py -- --out-dir assets/lowpoly --render

On this Android device the existing Blender 4.3.2 runs in `blender-debian` via PRoot, binding the project to `/work`. `--render` generates the kit contact sheet using CPU Cycles without denoising.

## Run / tests

Serve the repository root over HTTP, not `file://`:

    python3 -m http.server 8765
    npm test

The browser entry is `index.html`; `v2/` is also independently previewable. Runtime libraries are vendored Babylon.js / GLTF loader 9.14.0. No build step, account, external CDN or API key is required. No analytics or multiplayer services are used. WebGL is required; unavailable WebGL produces a visible error rather than a fake 3D fallback.

`tests/lowpoly.test.js` exercises all four GLBs and the real Babylon NullEngine loader, cloning, rest poses, animation sides, celebration, actor selection and the complete world. `tests/core.test.js` covers race rules and full races. NullEngine tests do not establish visual rendering.

Local-only browser verification: run `python server.py --qa-dir <evidence-dir>`, then open `/v2/?qa=run` in native Android Chrome. The opt-in harness tests actual WebGL, controls, full simulated course completion, three character choices and portrait/landscape/desktop layouts; it writes screenshots/reports to the local QA server. It never runs during ordinary play. Screenshot composition uses the vendored html2canvas helper; raw WebGL canvas captures are retained separately. Verification results are in `verification/lowpoly/`.

## Art references / credits

The [art-direction notes](art/ART_DIRECTION.md) cite Kenney Nature Kit and Quaternius as visual references for economical geometry, silhouettes and limited palettes. No third-party character/scenery models were imported or copied. The game geometry, animations and shader are original procedural work.

Babylon.js is distributed under Apache-2.0; see `vendor/BABYLON-LICENSE.md` and `vendor/BABYLON-NOTICE.md`. The previous game implementation and first-generation rider remain in `src/` / `assets/rider/` as legacy source; the new runtime uses `v2/` and `assets/lowpoly/`.
