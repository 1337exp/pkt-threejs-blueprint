# Анализ Grok: что общего в семи проектах

> Это ответ **другой модели** (Grok `grok-4.7-high` через агента Cursor, только чтение, 2026-11-06), сохранён как есть, на английском.
> Ссылки на файлы и строки в основном верны; выборочно перепроверено по коду (ticker, TableScene/DiceStage, bursts, effects, rng).
> Решения принимаются в [design.md](design.md), и вот где они расходятся с отчётом:
>
> - В v0.1 Grok кладёт `clamp`, `lerp`, `smoothstep`, `damp`: они уже есть в `THREE.MathUtils`, поэтому в `three/` берём оттуда
>   (в `core` свой минимум допустим: там нет `three`).
> - Он называет панель настройки «конвенцией, а не модулем». Мы выделяем её ядро без Vue (`core/tuning`), а панели
>   выносим в слой `components`.
> - Утверждение «четыре `mulberry32` эквивалентны» он не запускал; мы проверили: потоки совпадают.
> - Про GLSL он прав: общих строк нет, `hash` в grass и topo разные функции.

---
Build the library, and keep v0.1 free of meshes, shaders, and a `Stage` class. The code that is actually copied is the animation clock and a seeded RNG. The seven renderers diverged because the pictures are different, and a shared scene base would freeze the wrong shape.

Versions in `package.json`: `three` `^0.187.0` in game-teewee, pkt-cards, pkt-dice, and open-jaw; `^0.186.1` in pkt-3match, pkt-block-topo, and pkt-grass-blocks. I did not read `pkt-grass-blocks/архив`, `open-jaw/src/content`, or Vue SFCs except where they own the frame loop or the tuning panel. I did not execute any of the RNG copies, so equivalence below is from reading the expressions.

## 1. Per project

**game-teewee** (`three` r187). `GameRenderer` builds a `WebGLRenderer` (`antialias`, `powerPreference: 'high-performance'`), caps DPR at 2, and sets `toneMapping = NoToneMapping`. It does not set `outputColorSpace`. Camera is a perspective 50° follow-cam in `render()`, with exponential catch-up, speed zoom, and shake. The frame loop lives in `Game` (`game.ts` 64–105): `requestAnimationFrame`, dt clamped to 0.1s, fixed sim step, then `renderer.render(alpha, dt)`. Resize is a `ResizeObserver` that also resizes `NeonComposer` and a particle pixel scale (`renderer.ts` 46–88, 217–317). No three lights. Bloom is a two-composer selective pass, HalfFloat targets, 4 samples, `UnrealBloomPass`, custom mix, `OutputPass` (`composer.ts` 49–77). Picking is an unproject onto z = 0 (`renderer.ts` 113–120); buttons are `Input`, not raycasts. Motion is exponential smoothing and a one-off squash oscillator (`playerView.ts` 301–321), not a tween library. Sparks are a CPU ring buffer of 3000 points; the trail is a 2D ribbon in XY (`effects.ts` 44–217). Neon colours go through `neon()` / `HUE` (`util.ts` 4–32). Disposal is per object plus `disposeTree` (`util.ts` 139–151, `renderer.ts` 320–328).

**pkt-3match** (r186). `Stage` owns the renderer, a 32° perspective camera fitted to the board, and the pointer bridge (`Stage.ts` 21–65, 90–148). DPR cap 2 is applied on resize; `setSize(..., false)`. Clear color `#070911`. No lights, shadows, tone mapping, or post. dt is clamped to 0.05s. Tweens are `Animator` (delay, `busy`, default `ease.outCubic`) ticked by hand (`anim.ts` 29–71). Pointer math unprojects onto a z plane without `Raycaster` (`Stage.ts` 150–158); cell choice is `pointer.ts`. Bursts are one `Points` object, motion in the vertex shader (`bursts.ts` 10–90). Gems are `ShaderMaterial` plus `#include <colorspace_fragment>` (`gemMaterial.ts` 128–147). No `CanvasTexture`. `dispose()` drops the mode, bursts, and renderer (`Stage.ts` 115–127).

**pkt-block-topo** (r186, no Vue). `Stage` uses an orthographic camera, `ResizeObserver`, and `renderer.setAnimationLoop` with `THREE.Timer` (`stage.ts` 40–60, 113–147). DPR cap 2. Background `0x05080d`. No lamps: daylight is shader uniforms plus bloom strength (`stage.ts` 45–55, 75–80). Composer is `RenderPass` + `UnrealBloomPass` + `OutputPass` on a HalfFloat target with 4 samples. Camera state is `CameraRig` (yaw, pitch, zoom, pan, exponential catch-up) and is pure math (`cameraRig.ts` 17–86). Picking is a `Raycaster` ray tested against slope triangles and column boxes, because the vertices move in the shader (`board/index.ts` 128–161). Ribbons are screen-space quads of constant pixel width (`shaders/edges.ts` 12–34). Grain is a PNG, not a canvas (`textures.ts` 7–11). Palette UI is hand-built DOM (`tuning.ts` 89–93). `Stage` has no `dispose`. `Board.dispose` frees geometries, materials, and uniform textures (`board/index.ts` 163–172).

**pkt-cards** (r187, Vue + TaoUI for the shell). `TableScene` is the closest thing to a reusable stage: renderer, DPR cap 2, `display:block`, `touchAction:none`, perspective 30°, `ResizeObserver`, rAF with dt clamped to 1/30, `Ticker`, and `step()` for when rAF is not running (`TableScene.ts` 90–143, 225–274). Shadows are on: hemisphere + spot, `PCFShadowMap`, 2048 map (`92–122`). No tone-mapping override, no post. `Ticker` and `ease.ts` drive motion; cards move with `stepSpring3` (`spring.ts` 12–27, `CardView.ts` 249–251). Pointer work is `Raycaster.setFromCamera` plus a table plane and mesh hits (`TableInput.ts` 146–179). Faces, glow, ring, and cloth are `CanvasTexture` in sRGB (`faces.ts` 90–94, `surface.ts` 16–41). `tuning` is a plain object the panel writes and the scene reads every frame (`tuning.ts` 1–8). `dispose` cancels the frame, disconnects the observer, and frees textures, geometry, and the renderer (`265–274`).

**pkt-dice** (r187, Vue + TaoUI). `DiceStage` is the same shell as `TableScene`: same renderer flags, DPR cap, DOM style, `ResizeObserver`, rAF clamp 1/30, `Ticker`, `step()` (`DiceStage.ts` 76–103, 127–130, 247–267). No lights and no shadows; the die is `ShaderMaterial` with a fake light vector (`materials.ts` 199–226`). Background is sRGB `Color.setRGB` from `tuning.background` (`DiceStage.ts` 167). Camera is a tilted look-at, not orbit (`234–245`). Throw input is `Raycaster` against the floor plane (`132–137`). `anim/ticker.ts` matches cards byte for byte. `ease.ts` matches cards and adds `smoothstep` (`ease.ts` 15–19). Trails are camera-facing triangle strips rebuilt on the CPU (`ribbon.ts` 13–67`). Impacts are canvas sprites tweened by `Ticker` (`textures.ts` 5–12, `fx.ts` 322–375). Same `tuning` object pattern (`tuning.ts` 1–9, 231–232).

**pkt-grass-blocks** (r186). One script, not a class (`main.ts` 14–22, 44–54, 136–139). Orthographic iso camera, DPR cap 2, `outputColorSpace = SRGBColorSpace` (the only project that sets it), `setAnimationLoop`, `setSize(..., false)`, `window.resize`. Yaw is a drag, zoom changes the frustum, not `camera.zoom` (`34–77`). No lights, shadows, post, picking, tweens, or `dispose`. Wind is `tuftTime` into the shader. Sliders write `controls.*.value` objects shared as uniforms (`controls.ts` 3–40, `main.ts` 80–113). Stone and grass are `ShaderMaterial`; tiles are PNGs (`terrain.ts` 23–83). Noise is a private GLSL `hash21` / `vnoise` (`shaders.ts` 3–19). I read `shaders.ts` lines 1–100 and the call sites, not the grass/stone/tuft bodies past that.

**open-jaw** (r187). `ToothScene` creates the renderer (`antialias`, `alpha: true`), forces DPR into `[1.5, 2]`, clear alpha 0, perspective 30° (`toothScene.ts` 122–127, 232–248). `OrbitControls` with damping, pan off, zoom off, polar angle locked. No lights: `uLightDir` in the shader. No post. Resize is called with pixel size from a `ResizeObserver` in `ToothView.vue` (`72–74`, `255–262`). The loop is also in that Vue file: rAF, dt clamped to 0.1s, then `scene.frame()` (`79–98`). Motion is `smoothstep` and exponential approach (`toothScene.ts` 88, 265–270). Shaders share one vertex shader and a large `COMMON` chunk that is anatomy, not a general library (`shaders/common.ts` 15–36). `?tune` feeds a `Float32Array` (`tune.ts` 31–36`). `dispose` walks every mesh (`toothScene.ts` 327–339). `field.geometry` is shared by the tooth, the crown, and the neighbours (`188–216`), so that walk disposes one geometry several times.

## 2. Duplication map

| Concept | Where | Similarity | Lines (approx.) |
|---|---|---|---|
| `Ticker` + `tween`/`wait` | `pkt-cards/src/anim/ticker.ts`, `pkt-dice/src/anim/ticker.ts` | **IDENTICAL** (same comments) | 48 × 2 |
| Easing | cards `anim/ease.ts` 1–13; dice `anim/ease.ts` 1–19 | **NEAR** (dice adds `smoothstep`) | 13 / 19 |
| `Animator` | `pkt-3match/src/shared/render/anim.ts` | **DIVERGENT** from `Ticker` | 72 |
| Critically damped `1 - exp(-rate·dt)` | cards `TableScene.ts` 220; dice hold/shake; 3match `DynamicMode.ts` 178–180, `timerBar.ts` 87; topo `cameraRig.ts` 71–74; teewee `renderer.ts` 233–245; jaw `toothScene.ts` 269; grass has none | **NEAR** formula, copied inline | 1 line × many |
| Spring integrator | `pkt-cards/src/anim/spring.ts` only. Teewee squash (`playerView.ts` 308–311) is a different oscillator | one implementation | 27 |
| rAF + dt clamp + `step()` | cards `TableScene.ts` 137–143, 225–228; dice `DiceStage.ts` 96–102, 127–130 | **NEAR** (same 1/30 cap, same `step`) | ~20 × 2 |
| rAF / `setAnimationLoop` elsewhere | 3match `Stage.ts` 131–134 (cap 0.05, no `step`); teewee `game.ts` 64–80 (cap 0.1, fixed sim step); topo `stage.ts` 117–133 (`THREE.Timer`); grass `main.ts` 136–139 (no clamp); jaw `ToothView.vue` 82–96 (cap 0.1, pauses off-screen) | **DIVERGENT** | 15–40 each |
| DPR cap 2 + size | cards 91, 246–256; dice 77, 247–253; 3match 95–96 (`setSize` false); topo 42, 136–146; grass 18, 44–47; teewee 47, 79–84; jaw 124, 255–258 (floor 1.5, `setSize` false) | **NEAR** cap, **DIVERGENT** who owns resize | ~10 each |
| Explicit color pipeline | teewee `renderer.ts` 48 `NoToneMapping`; grass `main.ts` 19 `SRGBColorSpace`; 3match and dice shaders include `<colorspace_fragment>` (`bursts.ts` 49, `gemMaterial.ts` 132, `materials.ts` 174). Cards, topo, jaw do not set either field | **DIVERGENT** | 1–2 each |
| Lights and shadows | cards only: `TableScene.ts` 92–122 | unique | ~30 |
| Post / bloom | teewee `composer.ts` 39–109 (selective, overscan); topo `stage.ts` 48–55 (one composer) | **DIVERGENT** | 180 vs ~20 |
| Pointer NDC | 3match `Stage.ts` 152–154; cards `TableInput.ts` 148; dice `DiceStage.ts` 68; topo `stage.ts` 92–94; teewee `renderer.ts` 116 | **NEAR** (same formula) | ~3 × 5 |
| Picking | 3match unproject + `pointer.ts`; teewee unproject to z=0; dice `intersectPlane`; cards plane + `intersectObjects` (`TableInput.ts` 175–199); topo custom triangles (`board/index.ts` 133–160); grass and jaw: none | **DIVERGENT** | 10–40 |
| Camera rig | topo `cameraRig.ts` 77–85; grass `main.ts` 34–42 uses the same yaw/pitch placement. Dice, cards, 3match, teewee, jaw are different cameras. Jaw alone uses `OrbitControls` (`toothScene.ts` 236–245) | placement trig **NEAR** for two ortho views; rigs **DIVERGENT** | 87 vs 10 |
| Camera shake | cards `TableScene.ts` 236–241; dice `DiceStage.ts` 169–173 (decay uses `realDt`); teewee `renderer.ts` 246–249 (quadratic, no exp) | **NEAR** cards/dice, else **DIVERGENT** | ~6 |
| Tuning bag read every frame | cards `tuning.ts` 5–67 + `TuningKnob`; dice `tuning.ts` 231–244 (same knob type, extra `only`) | schema **NEAR**, values domain | 148 / ~340 |
| Tuning UI | cards and dice `TuningPanel.vue` (TaoUI, unread beyond the header comment); topo `mountTuning` DOM (`tuning.ts` 89+); grass HTML ranges (`main.ts` 80–113); jaw Vue `TUNE` (`tune.ts` 15–36); teewee `VisualSettings` (`visual.ts` 16–57) | **DIVERGENT** | — |
| Ribbon / trail | dice `ribbon.ts` (CPU, face camera); teewee `effects.ts` 142–212 (CPU, XY); topo `board/ribbon.ts` + `shaders/edges.ts` (GPU, pixel width); teewee `util.ts` 38–84 (static 2D outline) | **DIVERGENT** | 73 / 75 / 67+50 / 47 |
| Canvas → texture | dice `textures.ts` 5–12; cards `faces.ts` 90–94 and `surface.ts` 37–41; teewee `util.ts` 112–136 (text only) | wrapper **NEAR**, drawings not | ~10 |
| GLSL shared chunks | topo `shaders/common.ts` (`lineGlsl`, `edgeFadeGlsl`, cell quads); jaw `shaders/common.ts` (`VERTEX`, `COMMON`); grass `shaders.ts` 3–19 (`hash21`). No string is copied across projects | **DIVERGENT** | 83 / 246 / 19 |
| Particle burst | teewee `effects.ts` 44–140 (CPU, 2D); 3match `bursts.ts` (GPU time); dice `fx.ts` 332–400 (a few sprites) | **DIVERGENT** | 96 / 136 / ~90 |
| `dispose` helper | teewee `util.ts` 139–151 only. Everyone else disposes fields by hand. Topo `Stage` and grass dispose nothing | one helper | 13 |
| Palette helpers | teewee `neon`/`HUE`; 3match `palette.ts` `GEMS`; topo `daylight.ts` `PALETTES`; jaw constants inside `COMMON`; grass hex in `terrain.ts` 64–80 | **DIVERGENT** | — |
| mulberry32 | teewee `math.ts` 68–76; 3match `rng.ts` 5–14; grass `tufts.ts` 37–45; topo `generate.ts` 18–25 (xor written on the other side) | **NEAR** (same constants; topo is the same operations reassociated) | ~12 × 4 |
| Impact ring | cards `TableScene.ts` 186–206; dice `fx.ts` 356–374 | **NEAR** idea, different types | ~20 |

## 3. Where the divergent versions differ

**Ticker vs Animator.** Cards and dice share a subscription set, a `speed` multiplier (dice sets it to 0 for hit-stop, `DiceStage.ts` 154), and a promise tween with no delay. 3match jobs have `delay`, a `busy` flag, and they finish by calling `ease(1)` as exactly 1 (`anim.ts` 58–70). 3match `outBack` uses overshoot 1.2 (`anim.ts` 8–12); cards/dice use 1.70158 (`ease.ts` 10). Keep both curves. The cards/dice `Ticker` is the one to lift: it already has `speed`, and 3match’s delay can be added later without changing the 1.2 overshoot. Replacing 3match’s `Animator` in v0.1 would change gem motion.

**Frame loops.** Cards and dice are the pair to copy: clamp, `step(dt)`, game time separate from wall time. `THREE.Timer` in topo (`stage.ts` 38, 118–121) is the better wall clock if a loop helper appears later, because it already distinguishes a capped `dt` from unscaled shader time. Teewee’s loop must stay in `Game`: it accumulates a fixed physics step (`game.ts` 89–97). Jaw’s loop must stay in the Vue file: it stops when the view leaves the screen (`ToothView.vue` 110–117).

**Ortho cameras.** `CameraRig.place` (`cameraRig.ts` 78–85) and grass `placeCamera` (`main.ts` 34–42) use the same spherical offset. Topo then applies `camera.zoom` inside a fixed `VIEW_HALF` frustum, 45° steps, and smoothed pan. Grass multiplies the frustum by `zoom` and orbits freely. Those are two products. `CameraRig` is the one to keep if a second tactical map appears. It is already tested without a canvas (`pkt-block-topo/tests/camera.test.ts` 1–37). Do not point grass at it.

**Picking.** The only shared piece is NDC from a `PointerEvent`. After that, 3match quantizes into cells (`pointer.ts` 11–28), cards special-case the fan so hover does not flicker (`TableInput.ts` 159–194), dice clamps NDC to the visible floor (`DiceStage.ts` 26–27, 133–137), and topo cannot use `intersectObjects` because the slope lives in the vertex shader (`board/index.ts` 128–132). A shared `Raycaster` wrapper would erase those reasons.

**Ribbons.** Dice’s `Ribbon` faces the camera and is the right trail for a moving object in 3D. Topo’s ribbon is a hairline in pixels at any zoom (`shaders/edges.ts` 1–3, 20–30). Teewee’s trail is a flat XY strip because the game is a side view (`effects.ts` 182–209). Merging them produces a trail that is wrong in all three games.

**Bursts.** Teewee integrates on the CPU so gameplay can spawn sparks with gravity (`effects.ts` 82–126). 3match integrates in the shader so a pop does not allocate (`bursts.ts` 53–56, 104–129). Dice plays three authored sprites (`fx.ts` 332–375). The 3match buffer is the one to copy the next time a puzzle needs sparks. It is not a library module until a second game asks for it.

**Bloom.** Topo’s composer is the small one. Teewee’s exists to bloom some groups and not others, with an overscan margin so glow does not pop at the screen edge (`composer.ts` 1–3, 30–35, 87–104). Shipping topo’s bloom as “the” bloom would not replace `NeonComposer`, and turning it on in cards or jaw would change those pictures.

**Color.** Teewee turns tone mapping off because neon colors are pushed above 1 for bloom (`util.ts` 4–7, `renderer.ts` 48). Grass sets sRGB output and samples PNG tiles as sRGB (`main.ts` 19, `terrain.ts` 30). 3match and the dice outline convert in the shader with `<colorspace_fragment>`. A helper that “sets the correct pipeline” will fight at least one of these.

**RNG.** The four mulberry32 copies use the same increment `0x6d2b79f5` and the same shifts. Topo writes `x = (x + imul) ^ x` instead of `t ^= t + imul` (`generate.ts` 18–24 vs `rng.ts` 5–13). I believe those are the same function. I did not run them. Freeze a few outputs in a test before pointing `generate.ts` at a shared function: `?map=gen` is supposed to be stable (`generate.ts` 1–3).

**Dispose.** `disposeTree` (`util.ts` 139–151) disposes geometry, material, and that material’s `.map`. It does not see shader uniforms, and it will dispose a shared texture. Jaw’s traverse has the shared-geometry problem above. Topo’s board loop is the careful one: textures only when they sit on uniforms (`board/index.ts` 168–170). A shared walker needs an identity set and textures off by default.

## 4. Candidate modules

Ranked. Value is a 1–5 judgement of (projects that would actually switch) × lines removed × how stable the design already is.

1. **`ticker`** — game clock, subscriptions, `tween`, `wait`. Score **5**. Risk **low**. ~70 lines. From `pkt-cards/src/anim/ticker.ts` and `anim/ease.ts`, plus dice’s `smoothstep`. Adopters now: pkt-cards, pkt-dice. Leave 3match’s `Animator` in place. Public API:

```ts
export type Ease = (t: number) => number;
export const linear: Ease, easeOutCubic: Ease, easeOutBack: Ease, easeOutBackSoft: Ease; // 1.70158 and 1.2
export const clamp: (v: number, min: number, max: number) => number;
export const lerp: (a: number, b: number, t: number) => number;
export const smoothstep: (e0: number, e1: number, x: number) => number;
export const damp: (current: number, target: number, rate: number, dt: number) => number;
export type TickFn = (dt: number, time: number) => boolean | void;
export class Ticker {
  time: number; speed: number;
  add(fn: TickFn): () => void;
  update(realDt: number): number;
  tween(duration: number, onUpdate: (k: number) => void, ease?: Ease): Promise<void>;
  wait(seconds: number): Promise<void>;
}
```

`damp` is `current + (target - current) * (1 - Math.exp(-rate * dt))`. It belongs here because that line is the studio’s motion style and it has no dependency.

2. **`rng`** — score **3**. Risk **low**. ~20 lines. From `pkt-3match/src/shared/core/rng.ts`. Adopters: 3match, teewee, grass tufts, block-topo generator after a frozen output test. No `three` import.

```ts
export type Rng = () => number;
export function mulberry32(seed: number): Rng;
export function randomInt(rng: Rng, count: number): number;
```

3. **`pointer`** — score **3**. Risk **low**. ~25 lines. The NDC lines cited above. Adopters: cards, dice, 3match, topo, teewee. Cell logic, fan hysteresis, and floor clamps stay in the games.

```ts
export function clientToNdc(el: HTMLElement, clientX: number, clientY: number, out: Vector2): Vector2;
export function rayOnPlane(raycaster: Raycaster, camera: Camera, ndc: Vector2, plane: Plane, out: Vector3): Vector3 | null;
```

4. **`spring`** — score **2**. Risk **low**. 27 lines from `pkt-cards/src/anim/spring.ts`. Only cards adopts it now. Ship it anyway: it is pure, and the next table prototype will need it. Do not rewrite teewee’s squash onto it.

```ts
export interface Spring { stiffness: number; damping: number }
export function spring(stiffness: number, zeta: number): Spring;
export function springVelocity(x: number, v: number, target: number, s: Spring, dt: number): number;
export function stepSpring3(pos: Vector3, vel: Vector3, target: Vector3, s: Spring, dt: number): void;
```

5. **`renderer`** — score **4** as functions, **1** as a `Stage` class. Risk **med** if it grows options, **high** if it becomes a base class. ~80 lines, extracted from the identical parts of `TableScene.ts` 90–143 and `DiceStage.ts` 76–103. Adopters first: dice, then cards. 3match, teewee, topo, grass, and jaw keep their own loops until a second feature forces the move.

```ts
export interface RendererOptions { canvas?: HTMLCanvasElement; parent?: HTMLElement; antialias?: boolean; alpha?: boolean; maxDpr?: number }
export function createRenderer(opts: RendererOptions): WebGLRenderer;
export function bindResize(renderer: WebGLRenderer, el: HTMLElement, camera: PerspectiveCamera | OrthographicCamera, onSize?: (w: number, h: number) => void): () => void;
export function startLoop(update: (dt: number) => void, maxDt?: number): { stop(): void; step(dt?: number): void };
```

6. **`canvasTexture`** — score **2**. Risk **low**. ~15 lines from dice `bake` (`textures.ts` 5–12`) and cards `wrap` (`faces.ts` 90–94). Drawings stay in the games.

```ts
export function canvasTexture(canvas: HTMLCanvasElement, opts?: { anisotropy?: number; wrap?: boolean; colorSpace?: ColorSpace }): CanvasTexture;
```

7. **`dispose`** — score **2**. Risk **med**. Do this after the pure modules, with a `Set` so shared geometries are freed once. Default: do not dispose textures. Source to learn from: `util.ts` 139–151 and `board/index.ts` 168–170. Not from jaw’s traverse.

```ts
export function disposeObject(root: Object3D, opts?: { textures?: boolean }): void;
```

**Not candidates now.** Screen-space ribbon (topo only, score 1). Selective bloom (score 1). A particle system (score 1). `CameraRig` (score 1 until a second map). Material factories (`neonMaterial`, `gemMaterial`, `DieMaterials`, `cardMaterial`): each is a look.

## 5. What stays in the games

- **Teewee:** physics, fixed step, follow camera, `NeonComposer`, `HUE`, level strokes, hero skin, particle behavior. The bloom pass encodes “which groups glow” and that list is the game.
- **3match:** board, clusters, `pressCell` / `dragCell`, gem shader, plate, the soft `outBack`. `Animator.busy` is tied to input lock in the modes.
- **Block-topo:** grid, slopes, daylight palettes, `lineGlsl` / cell-quad shaders, the triangle picker, water. `CameraRig` can move later; its zoom limits are imported from board metrics (`cameraRig.ts` 5), so it is not free of the map yet.
- **Cards:** cloth, card faces, fan picking, hand rig, spot light, zones. `tuning.ts` keys are the game.
- **Dice:** `throwPlan`, die deformation shader, swirl trails, comic textures, hit-stop. `Ribbon` stays until a second 3D trail needs the same billboard.
- **Grass:** skin geometry, tuft scattering, the grass and stone shaders, the slider list.
- **Jaw:** SDF, surface nets, tooth field, `COMMON` palette, clipping plane, orbit limits, labels. The GLSL is the product.
- **Every Vue panel.** Knob lists, TaoUI, `localStorage`, and “copy these values back into the source file” are app UI. Cards and dice already solved this the same way on purpose (`TuningPanel.vue` header: a `reactive()` proxy over the same object the scene reads). That pattern is a convention, not a module. Putting it in the three package pulls in Vue and TaoUI.

## 6. Design constraints

- **`three` is a peerDependency**, `>=0.186.1 <0.188.0`. Four apps are on 187 and three on 186. I did not diff those two releases. v0.1 should not import `three/addons`, so a postprocessing change cannot break consumers. Do not re-export `three`.
- **ESM, subpath exports, no root barrel**, same shape as `@1337exp/taoux` (`taoux/package.json` exports `./ease`, `./camera`, and the rest one by one). `"sideEffects": false`. One import per module: `@1337exp/pkt-three/ticker`.
- **Vue-free.** No adapter in v0.1. The apps already write a plain object from Vue or from DOM.
- **GLSL**, when it exists at all, is a template string exported from its own subpath and interpolated the way topo already does (`shaders/edges.ts` 14: `${lineGlsl}`). No `.glsl` file loader and no shader graph. A chunk used by one project stays in that project.
- **Dispose and HMR.** No `import.meta.hot` anywhere under these `src` trees (searched). Vue views call `dispose()` on unmount (`GameView.vue`, `App.vue` in cards and dice, `GameScreen.vue`, `ToothView.vue`). The package should not register Vite hooks. `dispose` functions should be safe to call twice. Textures stay alive unless the caller opts in, because grass caches tiles (`terrain.ts` 21–33) and cards share a geometry kit.
- **Tests without WebGL.** Vitest on numbers and `Vector3`, which `pkt-block-topo/tests/camera.test.ts` already does under Node. No `headless-gl`. `createRenderer` is not unit-tested; the app screenshot or a `step()` call covers it.
- **Color.** Do not set `toneMapping` or `outputColorSpace` inside `createRenderer`. Teewee and grass disagree, and the rest rely on three’s defaults.

## 7. Package layout and migration

```text
pkt-three/
  package.json          # name @1337exp/pkt-three, type module, peer three
  src/ticker.ts         # Ticker, eases, damp, clamp, lerp, smoothstep
  src/rng.ts
  src/spring.ts
  src/pointer.ts        # v0.2
  src/renderer.ts       # v0.2, functions only
  src/canvasTexture.ts  # v0.2
  test/ticker.test.ts
  test/rng.test.ts
  test/spring.test.ts
```

**Order.**

1. Publish `ticker` + `rng` + `spring` with tests. Freeze mulberry32 against the current `pkt-3match` function for seeds `1` and `42` before anyone switches.
2. Switch **pkt-dice and pkt-cards in the same change.** Their ticker files are identical; moving one and not the other is how the next fork starts. Dice is the guinea pig for the import, cards follows in that PR because `spring.ts` moves with it.
3. Check dice with `vue-tsc` (the project has no render test). Check cards with the existing `screenshot` script (`pkt-cards/package.json` `screenshot`). I did not run either.
4. Next, and only next, `renderer.ts` into **pkt-dice**. `DiceStage` has no shadow map and no async cloth load, so a bad resize shows up immediately. Then the same helper into `TableScene`, which must keep its spot light and `handRig` math (`TableScene.ts` 100–108, 246–256).
5. Leave teewee, 3match, topo, grass, and jaw alone until one of them is about to paste `Ticker` or `createRenderer` again. 3match’s `outBack` constant stays local.

## 8. Doubts, and the smallest v0.1

A shared library is the wrong tool for anything that has forked for a visual reason. Bloom, ribbons, particles, cameras, and shaders each exist in two or three forms because the games do not want the same picture. Copy-paste is cheaper there: the files are already small, and a breaking change in a shader chunk would retune every title at once.

The real duplication is narrow. Two projects share 48 lines of ticker. Four projects share a dozen lines of RNG. Five projects share a three-line NDC formula. The other five codebases are not waiting for a framework.

**v0.1 is `ticker` (with `damp` and the eases), `rng`, and `spring`.** No renderer, no GLSL, no Vue. That is small enough to finish, testable without a GPU, and it is the code that will otherwise be pasted into the next prototype. Add `createRenderer` only when a third project starts by copying `DiceStage`’s constructor.
