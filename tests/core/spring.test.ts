import { describe, expect, it } from 'vitest';
import { spring, springMaxDt, springVelocity, stepSpring, stepSpring3, type SpringState, type Vec3Like } from '../../src/core/spring';

const v3 = (x = 0, y = 0, z = 0): Vec3Like => ({ x, y, z });

/** Runs the spring from 0 towards 1 on one axis; returns the final position and the largest |position| reached. */
function run(stiffness: number, zeta: number, dt: number, seconds: number) {
    const s = spring(stiffness, zeta);
    const state: SpringState = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < Math.round(seconds / dt); i++) {
        stepSpring(state, 1, s, dt);
        peak = Math.max(peak, Math.abs(state.x));
    }
    return { x: state.x, peak };
}

/** The same loop with the raw single step (what pkt-cards did): no substeps. */
function runRaw(stiffness: number, zeta: number, dt: number, seconds: number) {
    const s = spring(stiffness, zeta);
    let x = 0;
    let v = 0;
    let peak = 0;
    for (let i = 0; i < Math.round(seconds / dt); i++) {
        v = springVelocity(x, v, 1, s, dt);
        x += v * dt;
        peak = Math.max(peak, Math.abs(x));
    }
    return { x, peak };
}

describe('spring', () => {
    it('damping is 2·sqrt(stiffness)·zeta', () => {
        expect(spring(400, 0.5)).toEqual({ stiffness: 400, damping: 20 });
    });

    it('springVelocity pulls towards the target and brakes with the velocity', () => {
        const s = spring(100, 1);
        expect(springVelocity(0, 0, 1, s, 0.01)).toBeGreaterThan(0);
        expect(springVelocity(1, 0, 1, s, 0.01)).toBe(0);
        expect(springVelocity(1, 5, 1, s, 0.01)).toBeLessThan(5);
    });
});

describe('springMaxDt', () => {
    it('stiffness 2000, zeta 1 survives only ~0.0185 s', () => {
        expect(springMaxDt(spring(2000, 1))).toBeCloseTo(0.01853, 4);
    });

    it('undamped: 2 / sqrt(stiffness)', () => {
        expect(springMaxDt(spring(100, 0))).toBeCloseTo(0.2, 10);
    });

    it('is the real edge: the raw step is stable just below it and blows up just above it', () => {
        for (const [k, zeta] of [
            [170, 0.72],
            [2000, 1],
            [1500, 0.9],
            [400, 0.5],
        ] as const) {
            const edge = springMaxDt(spring(k, zeta));
            expect(runRaw(k, zeta, edge * 0.9, 20).peak).toBeLessThan(2);
            expect(runRaw(k, zeta, edge * 1.1, 20).peak).toBeGreaterThan(1e6);
        }
    });
});

describe('stepSpring', () => {
    it('a stable step is exactly the raw step (no change to a tuned feel)', () => {
        const s = spring(170, 0.72);
        const state: SpringState = { x: 0.3, v: 0.2 };
        let v = 0.2;
        let x = 0.3;
        v = springVelocity(x, v, 1, s, 1 / 60);
        x += v / 60;
        stepSpring(state, 1, s, 1 / 60);
        expect(state.x).toBe(x);
        expect(state.v).toBe(v);
    });

    // What pkt-cards does today: stiffness 2000 (its default) with zeta 1 under the frame cap 1/30. Raw, it explodes.
    // Что сегодня делает pkt-cards: жёсткость 2000 (его значение по умолчанию) и zeta 1 под потолком кадра 1/30. Сырой шаг разлетается.
    it('stiffness 2000, zeta 1, dt 1/30: the raw step explodes, stepSpring settles', () => {
        expect(runRaw(2000, 1, 1 / 30, 2).peak).toBeGreaterThan(1e6);
        const { x, peak } = run(2000, 1, 1 / 30, 2);
        expect(x).toBeCloseTo(1, 3);
        expect(peak).toBeLessThan(1.01);
    });

    it('settles for a grid of stiffness, damping and frame deltas, up to a dt of 0.1 s', () => {
        // 20000 is ten times the stiffest spring we use. Past ~64 substeps per call a spring is stiffer than any frame can follow.
        for (const k of [40, 170, 800, 2000, 20000]) {
            for (const zeta of [0.3, 0.7, 1, 2]) {
                for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.1]) {
                    const { x } = run(k, zeta, dt, 12);
                    expect(Number.isFinite(x), `k=${k} zeta=${zeta} dt=${dt}`).toBe(true);
                    expect(Math.abs(x - 1), `k=${k} zeta=${zeta} dt=${dt}`).toBeLessThan(0.02);
                }
            }
        }
    });
});

describe('stepSpring3', () => {
    it('moves all three axes independently and in place', () => {
        const s = spring(200, 0.8);
        const pos = v3();
        const vel = v3();
        stepSpring3(pos, vel, v3(1, -2, 0), s, 1 / 60);
        expect(pos.x).toBeGreaterThan(0);
        expect(pos.y).toBeLessThan(0);
        expect(pos.z).toBe(0);
    });

    it('arrives at the target even on a long frame', () => {
        const s = spring(2000, 1);
        const pos = v3();
        const vel = v3();
        for (let i = 0; i < 60; i++) stepSpring3(pos, vel, v3(1, 2, 3), s, 1 / 30);
        expect(pos.x).toBeCloseTo(1, 3);
        expect(pos.y).toBeCloseTo(2, 3);
        expect(pos.z).toBeCloseTo(3, 3);
    });

    it('zeta < 1 overshoots, zeta = 1 does not (noticeably)', () => {
        expect(run(300, 0.4, 1 / 120, 3).peak).toBeGreaterThan(1.1);
        expect(run(300, 1, 1 / 120, 3).peak).toBeLessThan(1.01);
    });
});
