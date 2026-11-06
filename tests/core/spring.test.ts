import { describe, expect, it } from 'vitest';
import { spring, stepSpring, stepSpring3, type SpringState, type Vec3Like } from '../../src/core/spring';

const v3 = (x = 0, y = 0, z = 0): Vec3Like => ({ x, y, z });

/** Advance a spring over `seconds` in steps of `dt` (the last step is shortened to land exactly). */
function run(stiffness: number, zeta: number, dt: number, seconds: number, start: SpringState = { x: 0, v: 0 }, target = 1) {
    const s = spring(stiffness, zeta);
    const state: SpringState = { ...start };
    let peak = Math.abs(state.x);
    let left = seconds;
    while (left > 1e-12) {
        const h = Math.min(dt, left);
        stepSpring(state, target, s, h);
        peak = Math.max(peak, Math.abs(state.x));
        left -= h;
    }
    return { x: state.x, v: state.v, peak };
}

/** An independent reference: classic RK4 with a tiny step. Not the formula under test. */
function reference(stiffness: number, zeta: number, seconds: number, start: SpringState, target: number) {
    const k = stiffness;
    const c = 2 * Math.sqrt(stiffness) * zeta;
    let x = start.x;
    let v = start.v;
    const h = 1e-5;
    const n = Math.round(seconds / h);
    const acc = (px: number, pv: number) => -k * (px - target) - c * pv;
    for (let i = 0; i < n; i++) {
        const k1x = v;
        const k1v = acc(x, v);
        const k2x = v + (h / 2) * k1v;
        const k2v = acc(x + (h / 2) * k1x, v + (h / 2) * k1v);
        const k3x = v + (h / 2) * k2v;
        const k3v = acc(x + (h / 2) * k2x, v + (h / 2) * k2v);
        const k4x = v + h * k3v;
        const k4v = acc(x + h * k3x, v + h * k3v);
        x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
        v += (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    }
    return { x, v };
}

describe('spring', () => {
    it('damping is 2·sqrt(stiffness)·zeta', () => {
        expect(spring(400, 0.5)).toEqual({ stiffness: 400, damping: 20 });
    });
});

describe('stepSpring: the exact solution', () => {
    // The three regimes (under-, critically, over-damped) against a numerical integration that shares no code with the formula.
    // Три режима (недо-, критический, пере-) против численного интегрирования, у которого с формулой нет общего кода.
    it('matches an independent RK4 reference in every regime', () => {
        for (const k of [40, 170, 2000]) {
            for (const zeta of [0.3, 0.72, 1, 2.5]) {
                const start = { x: 0.2, v: -1.5 };
                const ref = reference(k, zeta, 0.4, start, 1);
                const got = run(k, zeta, 0.4, 0.4, start);
                expect(got.x, `x k=${k} zeta=${zeta}`).toBeCloseTo(ref.x, 6);
                expect(got.v, `v k=${k} zeta=${zeta}`).toBeCloseTo(ref.v, 4);
            }
        }
    });

    it('does not depend on the frame rate: one long step equals many short ones', () => {
        for (const k of [170, 1500, 2000]) {
            for (const zeta of [0.5, 0.9, 1, 2]) {
                const start = { x: -0.4, v: 3 };
                const whole = run(k, zeta, 1, 1, start);
                for (const dt of [1 / 144, 1 / 60, 1 / 30, 0.1]) {
                    const parts = run(k, zeta, dt, 1, start);
                    expect(parts.x, `x k=${k} zeta=${zeta} dt=${dt}`).toBeCloseTo(whole.x, 9);
                    expect(parts.v, `v k=${k} zeta=${zeta} dt=${dt}`).toBeCloseTo(whole.v, 7);
                }
            }
        }
    });

    it('is stable for any step, however long, and settles at the target', () => {
        for (const k of [1, 170, 2000, 100000]) {
            for (const zeta of [0, 0.3, 1, 3, 50]) {
                for (const dt of [1e-4, 1 / 144, 1 / 30, 0.1, 1, 60, 1e5]) {
                    const state: SpringState = { x: 5, v: -40 };
                    const s = spring(k, zeta);
                    for (let i = 0; i < 4; i++) stepSpring(state, 1, s, dt);
                    expect(Number.isFinite(state.x) && Number.isFinite(state.v), `k=${k} zeta=${zeta} dt=${dt}`).toBe(true);
                    // The energy never grows (the offset and the velocity stay in a sane bound).
                    // Энергия не растёт (смещение и скорость остаются в разумных пределах).
                    expect(Math.abs(state.x), `k=${k} zeta=${zeta} dt=${dt}`).toBeLessThan(200);
                }
                if (zeta > 0) {
                    const state: SpringState = { x: 5, v: -40 };
                    stepSpring(state, 1, spring(k, zeta), 1e5);
                    expect(state.x, `k=${k} zeta=${zeta}`).toBeCloseTo(1, 6);
                    expect(state.v, `k=${k} zeta=${zeta}`).toBeCloseTo(0, 6);
                }
            }
        }
    });

    it('is continuous through critical damping (no jump at zeta = 1)', () => {
        const at = (zeta: number) => run(2000, zeta, 1 / 60, 0.2, { x: 0, v: 0 });
        const exact = at(1);
        for (const zeta of [1 - 1e-7, 1 + 1e-7, 1 - 1e-4, 1 + 1e-4]) {
            expect(at(zeta).x, `zeta=${zeta}`).toBeCloseTo(exact.x, 3);
            expect(at(zeta).v, `zeta=${zeta}`).toBeCloseTo(exact.v, 1);
        }
    });

    it('stays put at the target, and a no-op step changes nothing', () => {
        const s = spring(2000, 1);
        const state: SpringState = { x: 1, v: 0 };
        stepSpring(state, 1, s, 1 / 60);
        expect(state).toEqual({ x: 1, v: 0 });
        const moving: SpringState = { x: 0.3, v: 0.2 };
        for (const dt of [0, -1, Number.NaN]) {
            stepSpring(moving, 1, s, dt);
            expect(moving).toEqual({ x: 0.3, v: 0.2 });
        }
    });

    it('a spring without stiffness is free flight (with or without braking)', () => {
        const free: SpringState = { x: 0, v: 3 };
        stepSpring(free, 100, { stiffness: 0, damping: 0 }, 0.5);
        expect(free.x).toBeCloseTo(1.5, 12);
        expect(free.v).toBeCloseTo(3, 12);
        const braked: SpringState = { x: 0, v: 3 };
        stepSpring(braked, 100, { stiffness: 0, damping: 2 }, 0.5);
        expect(braked.v).toBeCloseTo(3 * Math.exp(-1), 12);
        expect(braked.x).toBeCloseTo((3 * (1 - Math.exp(-1))) / 2, 12);
    });

    it('zeta < 1 overshoots, zeta = 1 does not (noticeably)', () => {
        expect(run(300, 0.4, 1 / 60, 3).peak).toBeGreaterThan(1.1);
        expect(run(300, 1, 1 / 60, 3).peak).toBeLessThan(1.001);
    });

    // What pkt-cards runs: stiffness 2000, zeta 1 under a frame cap. It used to explode below ~54 frames per second.
    // Что гоняет pkt-cards: жёсткость 2000, zeta 1 под потолком кадра. Раньше она разлеталась ниже ~54 кадров в секунду.
    it('stiffness 2000, zeta 1: 30, 60 and 144 fps give the same path', () => {
        const at = (dt: number) => run(2000, 1, dt, 0.1, { x: 0, v: 0 });
        const base = at(1 / 144);
        for (const dt of [1 / 60, 1 / 30]) {
            expect(at(dt).x).toBeCloseTo(base.x, 9);
        }
        expect(run(2000, 1, 1 / 30, 2).x).toBeCloseTo(1, 6);
    });
});

describe('stepSpring3', () => {
    it('does the same as stepSpring on each axis, in place', () => {
        const s = spring(200, 0.8);
        const pos = v3(0.1, -0.2, 0.3);
        const vel = v3(1, -2, 0.5);
        const target = v3(1, -2, 0);
        const axes = [
            { x: 0.1, v: 1, t: 1 },
            { x: -0.2, v: -2, t: -2 },
            { x: 0.3, v: 0.5, t: 0 },
        ].map(({ x, v, t }) => {
            const state: SpringState = { x, v };
            stepSpring(state, t, s, 1 / 60);
            return state;
        });
        stepSpring3(pos, vel, target, s, 1 / 60);
        expect([pos.x, pos.y, pos.z]).toEqual(axes.map((a) => a.x));
        expect([vel.x, vel.y, vel.z]).toEqual(axes.map((a) => a.v));
    });

    it('arrives at the target even on a long frame', () => {
        const s = spring(2000, 1);
        const pos = v3();
        const vel = v3();
        for (let i = 0; i < 60; i++) stepSpring3(pos, vel, v3(1, 2, 3), s, 1 / 30);
        expect(pos.x).toBeCloseTo(1, 6);
        expect(pos.y).toBeCloseTo(2, 6);
        expect(pos.z).toBeCloseTo(3, 6);
    });

    it('a no-op step changes nothing', () => {
        const pos = v3(1, 2, 3);
        const vel = v3(4, 5, 6);
        stepSpring3(pos, vel, v3(), spring(100, 1), 0);
        expect(pos).toEqual(v3(1, 2, 3));
        expect(vel).toEqual(v3(4, 5, 6));
    });
});
