/**
 * Anything with x, y, z: `THREE.Vector3` fits, and the core does not import three.
 * Всё, у чего есть x, y, z: подходит `THREE.Vector3`, а ядро three не импортирует.
 */
export interface Vec3Like {
    x: number;
    y: number;
    z: number;
}

/** A number and its velocity. / Число и его скорость. */
export interface SpringState {
    x: number;
    v: number;
}

/**
 * A damped spring: lively motion (hover, drag, layout) goes through it.
 * `zeta < 1` overshoots and wobbles, `1` arrives without overshoot, `> 1` is sluggish.
 * Пружина с затуханием: всё «живое» движение (наведение, перетаскивание, раскладка) идёт через неё.
 * `zeta < 1` с перелётом и покачиванием, `1` ровно приходит в цель, `> 1` вязко.
 */
export interface Spring {
    stiffness: number;
    damping: number;
}

/** Build a spring from stiffness and damping ratio. / Собрать пружину из жёсткости и коэффициента затухания. */
export function spring(stiffness: number, zeta: number): Spring {
    return { stiffness, damping: 2 * Math.sqrt(stiffness) * zeta };
}

/**
 * The spring's step as a matrix: over `dt` the offset `y = x - target` and the velocity `v` become
 * `y' = a·y + b·v`, `v' = c·y + d·v`. These are the exact solutions of `x'' = -stiffness·y - damping·x'`
 * (a matrix exponential), so the step is stable for any `dt` and splitting it into several steps changes nothing.
 * The three cases are by the sign of `damping² - 4·stiffness`: under- (cos, sin), critically and over-damped.
 * Шаг пружины в виде матрицы: за `dt` смещение `y = x - target` и скорость `v` становятся
 * `y' = a·y + b·v`, `v' = c·y + d·v`. Это точные решения `x'' = -stiffness·y - damping·x'` (матричная экспонента),
 * поэтому шаг устойчив при любом `dt`, а деление его на несколько шагов ничего не меняет.
 * Три случая по знаку `damping² - 4·stiffness`: недодемпфированный (cos, sin), критический и передемпфированный.
 */
const m = { a: 1, b: 0, c: 0, d: 1 };

function transition(s: Spring, dt: number): void {
    const k = s.stiffness;
    const alpha = s.damping / 2;
    const disc = alpha * alpha - k;
    // Relative tolerance: closer than this to critical, the critical formula is exact to well below a pixel.
    // Относительный допуск: ближе этого к критическому критическая формула точна с запасом до долей пикселя.
    const eps = 1e-9 * (alpha * alpha + k);

    if (Math.abs(disc) <= eps) {
        const e = Math.exp(-alpha * dt);
        m.a = e * (1 + alpha * dt);
        m.b = e * dt;
        m.c = -e * alpha * alpha * dt;
        m.d = e * (1 - alpha * dt);
    } else if (disc < 0) {
        const w = Math.sqrt(-disc);
        const e = Math.exp(-alpha * dt);
        const cs = Math.cos(w * dt);
        const sn = Math.sin(w * dt);
        m.a = e * (cs + (alpha / w) * sn);
        m.b = (e * sn) / w;
        m.c = -((e * k) / w) * sn;
        m.d = e * (cs - (alpha / w) * sn);
    } else {
        // e·cosh and e·sinh written through the two decaying exponentials: no overflow on a long step.
        // e·cosh и e·sinh через две затухающие экспоненты: без переполнения на длинном шаге.
        const r = Math.sqrt(disc);
        const e1 = Math.exp(-(alpha - r) * dt);
        const e2 = Math.exp(-(alpha + r) * dt);
        const ch = (e1 + e2) / 2;
        const sh = (e1 - e2) / 2;
        m.a = ch + (alpha / r) * sh;
        m.b = sh / r;
        m.c = -(k / r) * sh;
        m.d = ch - (alpha / r) * sh;
    }
}

/**
 * One step for a number, in place. Exact for a fixed target and stable for any `dt`: the same time gives the same
 * result at 30, 60 or 144 frames per second. A target that moves is sampled once per step, as in any per-frame code.
 * Шаг для числа на месте. Точен при неподвижной цели и устойчив при любом `dt`: одно и то же время даёт один и тот же
 * результат на 30, 60 или 144 кадрах в секунду. Движущаяся цель берётся раз за шаг, как в любом покадровом коде.
 */
export function stepSpring(state: SpringState, target: number, s: Spring, dt: number): void {
    if (!(dt > 0)) return;
    transition(s, dt);
    const y = state.x - target;
    const v = state.v;
    state.x = target + m.a * y + m.b * v;
    state.v = m.c * y + m.d * v;
}

/**
 * One step for a vector: changes `pos` and `vel` in place. Same guarantees as {@link stepSpring}.
 * Шаг для вектора: меняет `pos` и `vel` на месте. Те же гарантии, что у {@link stepSpring}.
 */
export function stepSpring3(pos: Vec3Like, vel: Vec3Like, target: Vec3Like, s: Spring, dt: number): void {
    if (!(dt > 0)) return;
    transition(s, dt);
    const { a, b, c, d } = m;
    const yx = pos.x - target.x;
    const yy = pos.y - target.y;
    const yz = pos.z - target.z;
    const vx = vel.x;
    const vy = vel.y;
    const vz = vel.z;
    pos.x = target.x + a * yx + b * vx;
    pos.y = target.y + a * yy + b * vy;
    pos.z = target.z + a * yz + b * vz;
    vel.x = c * yx + d * vx;
    vel.y = c * yy + d * vy;
    vel.z = c * yz + d * vz;
}
