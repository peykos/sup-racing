# Low-poly rebuild verification

Classification: FORMAL CPU + BROWSER QA VERIFIED (scope below).

- `npm test`: 32/32 passing permanent Node tests, both local and publication trees. Covers race rules and completed races, shoreline collisions, all four new GLBs, real Babylon loader/clone behavior, character selection, left/right paddle transforms and celebration poses. The two legacy rider tests remain as regressions.
- Khronos `gltf-validator`: all four new exports have 0 errors, 0 warnings, 0 infos. Detailed reports: `gltf-validation.json`.
- `v2/qa.js` running in native Android Chrome: 30/30 checks. Includes an actual WebGL2 context and compiled water shader, three characters, keyboard and pointer handlers, pause/resume, full-course completion through normal steering/paddling inputs (accelerated simulation), replay and results. Portrait 390×780, landscape 844×390, desktop 1280×800 were tested as real same-origin iframe viewports, not additional physical devices.
- Browser result gate: `python tests/check_lowpoly_browser.py verification/lowpoly/browser-summary.json` must return exit 0.
- `artifact-hashes.json` identifies tested runtime sources and GLB bytes. Local and publication copies were compared byte-for-byte before publishing.
- Original Blender 4.3.2 / Debian PRoot build and CPU kit render completed with exit 0. The generated `.blend` files, GLBs and generator are bundled in `assets/lowpoly/tide-lowpoly-assets.zip`.

## Evidence / limits

`browser-summary.json` retains the exact check results and tested URL. `screenshots/` retains real WebGL canvas captures and composed page captures; page composition uses html2canvas and does not faithfully capture every SVG icon. Screenshots are not synthetic renders or mockups. All three characters and the final landscape layout were visually inspected.

The Node integration run uses NullEngine and by itself is not GPU evidence. GPU/browser evidence comes separately from native Android Chrome. Headless Termux Chromium's GPU process crashed during the attempted SwiftShader path, so it was not used to certify the game. An Android foreground intent plus opt-in in-page QA was the successful route.

The browser tests exercise synthetic keyboard/pointer events through the actual event handlers. They do not constitute a manual multi-touch playtest. This is a complete small single-player prototype, not multiplayer or a broad device-compatibility certification.

Previous version retained in Git history and in the local pre-rebuild backup. Runtime libraries remain Babylon.js / loaders 9.14.0. No external character packs were imported.
