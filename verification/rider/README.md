# Blender athlete verification

The permanent Node test suite checks game rules plus the real Babylon 9.14.0 NullEngine/glTF import, all three animation clips, five independent athletes, per-team materials, stroke-side handedness, finite transforms and a usable initial pose. See the captured suite outputs and `checks.json` for the actual result and artifact hashes.

`gltf-validation.json` is the Khronos glTF Validator result for the exported file. `sup-rider-preview.png` in the asset directory is a real Blender/Cycles render, not a gameplay screenshot.

Scope limit: browser/WebGL visual verification was not completed in this run. The Android Chrome intent did not produce a browser QA report, and the separately launched Debian Chromium QA process terminated with SIGTRAP. A native Termux Chromium download also timed out. Do not treat CPU loader tests, an HTTP 200 response or the Blender preview as proof of mobile browser rendering or FPS. No new full-browser PASS is claimed.

Only the character asset/animation integration changed. The original race simulation, steering, board generation and scoring were retained; `checks.json` includes source-identity checks against the pre-edit backup. The public build keeps the local QA upload endpoint disabled.
