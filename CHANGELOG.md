# Changelog

## 0.1.0

First release. Each module is its own import (`@1337exp/pkt-threejs-blueprint/<module>`), there is no root entry.

- **`ease`**: `Ease`, our curves (`easeOutBack` overshoots), `smoothstep(edge0, edge1, x)` in GLSL argument order.
- **`ticker`**: `Ticker`, game time with a `speed` (0 is a hit-stop), `tween` and `wait` as promises.
- **`spring`**: `spring(stiffness, zeta)`, `stepSpring`, `stepSpring3`. The exact solution of the spring equation: stable at any step, the same path at any frame rate.
- **`rng`**: `mulberry32`, `randomInt`. The sequence is frozen by a test, so saved seeds stay valid.
- **`tuning`**: `createTuning`, the core of a "tweak it live" panel (live values, saving only the differences from the defaults, reset, copy as code).
- **`loop`**: `startLoop(frame, { maxDt })`, the frame loop with a capped delta; `maxDt` is required.
- **`renderer`** (needs `three`): `createRenderer`, `bindResize`.
- **`pointer`** (needs `three`): `clientToNdc`, `rayOnPlane`.
- **`dispose`** (needs `three`): `disposeObject`.
- **`vue/tuning-panel`** (needs `vue`): `TuningPanel`, styled with `--tbp-*` CSS variables.
