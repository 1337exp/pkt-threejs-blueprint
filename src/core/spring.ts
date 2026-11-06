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
 * The longest step (seconds) a spring survives. Semi-implicit Euler is stable while `damping·dt < 2` and
 * `stiffness·dt² + 2·damping·dt < 4`, which is `dt < 4 / (sqrt(damping² + 4·stiffness) + damping)`. Past it the motion blows up:
 * stiffness 2000 with `zeta` 1 survives only 0.0185 s, so a frame cap of 1/30 is not enough. `stepSpring` and `stepSpring3`
 * split a longer step by themselves; use this when you integrate with {@link springVelocity} yourself.
 * Самый длинный шаг (в секундах), который пружина переживает. Полунеявный Эйлер устойчив, пока `damping·dt < 2` и
 * `stiffness·dt² + 2·damping·dt < 4`, то есть `dt < 4 / (sqrt(damping² + 4·stiffness) + damping)`. За границей движение разлетается:
 * жёсткость 2000 при `zeta` 1 переживает только 0,0185 с, так что потолка кадра 1/30 мало. `stepSpring` и `stepSpring3`
 * сами делят длинный шаг; эта функция нужна, если ты интегрируешь сам через {@link springVelocity}.
 */
export function springMaxDt(s: Spring): number {
    return 4 / (Math.sqrt(s.damping * s.damping + 4 * s.stiffness) + s.damping);
}

/**
 * A cap on substeps per call, so a silly spring cannot hang a frame. Needing more means the spring is stiffer than any
 * frame can follow (stiffness 100000 at a 0.1 s frame): lower the stiffness or the frame cap.
 * Потолок подшагов за вызов, чтобы нелепая пружина не подвесила кадр. Если нужно больше, пружина жёстче, чем способен
 * догнать любой кадр (жёсткость 100000 на кадре 0,1 с): снизь жёсткость или потолок кадра.
 */
const MAX_SUBSTEPS = 64;

const substeps = (s: Spring, dt: number): number => Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / springMaxDt(s))));

/**
 * One raw step for a number: returns the new velocity, move the value yourself (`x += v * dt`). No substeps: keep `dt`
 * below {@link springMaxDt}, or use {@link stepSpring}.
 * Один сырой шаг для числа: возвращает новую скорость, значение двигай сам (`x += v * dt`). Без подшагов: держи `dt`
 * меньше {@link springMaxDt} или бери {@link stepSpring}.
 */
export function springVelocity(x: number, v: number, target: number, s: Spring, dt: number): number {
    return v + (s.stiffness * (target - x) - s.damping * v) * dt;
}

/**
 * One step for a number, in place. A step longer than {@link springMaxDt} is split into equal substeps; a step that is
 * already stable runs as one, exactly like {@link springVelocity} followed by `x += v * dt`.
 * Шаг для числа на месте. Шаг длиннее {@link springMaxDt} делится на равные подшаги; уже устойчивый шаг идёт одним,
 * ровно как {@link springVelocity} и затем `x += v * dt`.
 */
export function stepSpring(state: SpringState, target: number, s: Spring, dt: number): void {
    const n = substeps(s, dt);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
        state.v = springVelocity(state.x, state.v, target, s, h);
        state.x += state.v * h;
    }
}

/**
 * One step for a vector: changes `pos` and `vel` in place. Substeps like {@link stepSpring}.
 * Шаг для вектора: меняет `pos` и `vel` на месте. Подшаги, как у {@link stepSpring}.
 */
export function stepSpring3(pos: Vec3Like, vel: Vec3Like, target: Vec3Like, s: Spring, dt: number): void {
    const n = substeps(s, dt);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
        vel.x = springVelocity(pos.x, vel.x, target.x, s, h);
        vel.y = springVelocity(pos.y, vel.y, target.y, s, h);
        vel.z = springVelocity(pos.z, vel.z, target.z, s, h);
        pos.x += vel.x * h;
        pos.y += vel.y * h;
        pos.z += vel.z * h;
    }
}
