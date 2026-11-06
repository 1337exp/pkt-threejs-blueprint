# pkt-threejs-blueprint

**English** · [Русский](README.ru.md)

The small shared layer our Three.js prototypes keep rewriting: a game clock with tweens, springs that do not blow up, seeded random, and the core of a "tweak it live" panel. Import only what you need; nothing is pulled in that you did not ask for. Working name, not published yet.

## Stack

TypeScript 6, Vitest, plain `tsc` (no bundler: one file per module is the tree-shaking). The core has no dependencies and no DOM. `three` is an optional peer, used only by the `three/` layer that comes next. It does not depend on TaoUI or TaoUX.

```bash
npm install
npm run typecheck
npm test
npm run build
```

## What it can do

Each module is its own import (`pkt-threejs-blueprint/<module>`), there is no root entry.

| Module | What |
|---|---|
| `ease` | `Ease = (t) => number`, our curves (`easeOutBack` overshoots), `smoothstep(edge0, edge1, x)` in GLSL argument order |
| `ticker` | `Ticker`: game time with a `speed` (0 is a hit-stop), `tween` and `wait` as promises, `add`, `busy`, `clear` |
| `spring` | `spring(stiffness, zeta)`, `stepSpring` (a number) and `stepSpring3` (a vector), `springMaxDt` |
| `rng` | `mulberry32(seed)`, `randomInt`; the sequence is frozen by a test, saved seeds stay valid |
| `tuning` | `createTuning(values, { groups, storageKey })`: live values, saving only the differences from the defaults, reset, "copy as code" (`toSource`), safe `localStorage` |

```ts
import { Ticker } from 'pkt-threejs-blueprint/ticker';
import { easeOutBack } from 'pkt-threejs-blueprint/ease';

const ticker = new Ticker();
// every frame: ticker.update(Math.min(realDt, maxDt));
await ticker.tween(0.4, (k) => (mesh.scale.x = 1 + k), easeOutBack);
```

### The frame delta

`dt` is the time between two frames in seconds, not a simulation rate: the frame rate stays the screen's (60, 120, 144 Hz). Cap it from above (`maxDt`) before feeding the ticker, so a hidden tab or a stall does not deliver a `dt` of seconds and send every tween to its end in one frame. Our projects use `1/30`, `0.05` or `0.1`; pick one deliberately.

Springs need more than a cap: a spring survives only steps shorter than `springMaxDt` (stiffness 2000 with `zeta` 1: 0.0185 s). `stepSpring` and `stepSpring3` split a longer step themselves; a stable step runs as one, identical to the raw formula.

## How it is built

Three layers by dependency: `core/` (nothing), `three/` (needs `three`), `components/` (ready-made interface blocks over the core, styled with our dark-theme values copied as CSS variables, no TaoUI). Design, decisions and the analysis behind them: [docs/design.md](docs/design.md), [docs/analysis-grok.md](docs/analysis-grok.md).

## Not yet

`three/` (renderer helpers, pointer to NDC, `dispose`), `components/` (a Vue panel and a plain-DOM panel over `tuning`). Particles, ribbons, cameras, bloom and shaders stay in the games on purpose: they differ because the pictures differ.

## License

MIT, see [LICENSE](LICENSE).

## Us

Homepage: [666.io](https://666.io). If you want to help, suggest an idea or just talk, come by.
