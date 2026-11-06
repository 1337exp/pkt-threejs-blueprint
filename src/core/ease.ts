/**
 * Easing curve: `t` from 0 to 1 → progress from 0 to 1 (Back overshoots past 1).
 * Кривая времени: `t` от 0 до 1 → прогресс от 0 до 1 (у Back — с перелётом).
 */
export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeInQuad: Ease = (t) => t * t;
export const easeOutQuad: Ease = (t) => 1 - (1 - t) * (1 - t);
export const easeInCubic: Ease = (t) => t * t * t;
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Overshoots by ~10 % and settles (overshoot constant 1.70158). / Перелёт около 10 % и возврат (константа 1.70158). */
export const easeOutBack: Ease = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

/**
 * Smooth 0 → 1 transition between `edge0` and `edge1`, the same argument order as `smoothstep` in GLSL.
 * Note: `THREE.MathUtils.smoothstep` takes `(x, min, max)`.
 * Плавный переход от 0 к 1 между `edge0` и `edge1`, порядок аргументов как у `smoothstep` в GLSL.
 * Внимание: `THREE.MathUtils.smoothstep` принимает `(x, min, max)`.
 */
export const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
};
