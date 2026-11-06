# @1337exp/pkt-threejs-blueprint

**English** · [Русский](README.ru.md)

The small shared layer our Three.js prototypes keep rewriting: a game clock with tweens, springs that do not blow up, seeded random, and the core of a "tweak it live" panel. Import only what you need; nothing is pulled in that you did not ask for.

## Stack

TypeScript 6, Vitest, plain `tsc` (no bundler: one file per module is the tree-shaking). The core has no dependencies and no DOM. `three` is an optional peer, used only by the modules that say so in the table; `vue` is an optional peer of the panel. It does not depend on TaoUI or TaoUX.

```bash
npm install @1337exp/pkt-threejs-blueprint   # plus three and vue if you use the modules that need them
```

Work on the library itself:

```bash
npm install
npm run typecheck
npm test
npm run build
```

## What it can do

Each module is its own import (`@1337exp/pkt-threejs-blueprint/<module>`), there is no root entry.

| Module | What |
|---|---|
| `ease` | `Ease = (t) => number`, our curves (`easeOutBack` overshoots), `smoothstep(edge0, edge1, x)` in GLSL argument order |
| `ticker` | `Ticker`: game time with a `speed` (0 is a hit-stop), `tween` and `wait` as promises, `add`, `busy`, `clear` |
| `spring` | `spring(stiffness, zeta)`, `stepSpring` (a number) and `stepSpring3` (a vector): the exact solution, stable at any step, the same path at any frame rate |
| `rng` | `mulberry32(seed)`, `randomInt`; the sequence is frozen by a test, saved seeds stay valid |
| `tuning` | `createTuning(values, { groups, storageKey })`: live values, saving only the differences from the defaults, reset, "copy as code" (`toSource`), safe `localStorage` |
| `loop` | `startLoop(frame, { maxDt })`: the frame loop; `frame(dt, now)` gets a delta capped at `maxDt` (required: you choose it); `stop()` |
| `renderer` | needs `three`. `createRenderer(container)`, `bindResize(renderer, container, onResize)`: size and a pixel ratio capped at 2, read again on every resize |
| `pointer` | needs `three`. `clientToNdc(event, element)`, `rayOnPlane(ndc, camera, plane)`: a pointer to the point on a plane, with the camera matrix refreshed |
| `vue/tuning-panel` | needs `vue`. `TuningPanel`: draws a `tuning` (groups of sliders, what differs from the defaults, Copy as code, Reset). No `.vue` file, no UI library; looks are `--tbp-*` CSS variables with our dark-theme values as fallbacks |
| `dispose` | needs `three`. `disposeObject(root, { textures })`: geometries and materials (arrays too) freed once however many meshes share them; textures only when asked |

```ts
import { Ticker } from '@1337exp/pkt-threejs-blueprint/ticker';
import { easeOutBack } from '@1337exp/pkt-threejs-blueprint/ease';

const ticker = new Ticker();
// every frame: ticker.update(Math.min(realDt, maxDt));
await ticker.tween(0.4, (k) => (mesh.scale.x = 1 + k), easeOutBack);
```

### The frame delta

`dt` is the time between two frames in seconds, not a simulation rate: the frame rate stays the screen's (60, 120, 144 Hz). Cap it from above (`maxDt`) before feeding the ticker, so a hidden tab or a stall does not deliver a `dt` of seconds and send every tween to its end in one frame. Our projects use `1/30`, `0.05` or `0.1`; pick one deliberately.

Springs do not need a cap to stay alive: `stepSpring` and `stepSpring3` use the exact solution of the spring equation, so they are stable for any `dt` and give the same path at 30, 60 or 144 frames per second. The usual one-line Euler step (`v += (k·(target − x) − c·v)·dt; x += v·dt`) does neither: stiffness 2000 with `zeta` 1 blows up below ~54 frames per second, and even where it holds the path depends on the frame rate. Do not write that line by hand.

## How it is built

Three layers by dependency: `core/` (nothing), `three/` (needs `three`), `components/` (ready-made interface blocks over the core, styled with our dark-theme values copied as CSS variables, no TaoUI). Design, decisions and the analysis behind them: [docs/design.md](docs/design.md), [docs/analysis-grok.md](docs/analysis-grok.md).

## Not yet

A plain-DOM panel over `tuning` (the Vue one is done). Particles, ribbons, cameras, bloom and shaders stay in the games on purpose: they differ because the pictures differ.

## License

MIT, see [LICENSE](LICENSE).

## Us

Homepage: [666.io](https://666.io). If you want to help, suggest an idea or just talk, come by.
