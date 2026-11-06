/**
 * A random number generator returning [0, 1). Any one fits, a seeded one included.
 * Генератор случайных чисел [0, 1). Подойдёт любой, в том числе с зерном.
 */
export type Rng = () => number;

/**
 * A tiny deterministic generator (mulberry32): the same seed gives the same sequence on every machine, so a game,
 * a map or a scatter of grass can be replayed from its seed. The sequence is frozen by a test against the original
 * from pkt-3match: do not change the arithmetic, saved seeds depend on it.
 * Маленький детерминированный генератор (mulberry32): одно зерно даёт одну последовательность на любой машине, поэтому партию,
 * карту или раскладку травы можно повторить по зерну. Последовательность заморожена тестом по оригиналу из pkt-3match:
 * арифметику не менять, от неё зависят сохранённые зёрна.
 */
export function mulberry32(seed: number): Rng {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** An integer in [0, count). / Целое число в [0, count). */
export function randomInt(rng: Rng, count: number): number {
    return Math.floor(rng() * count);
}
