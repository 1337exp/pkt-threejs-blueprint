import { describe, expect, it } from 'vitest';
import { mulberry32, randomInt } from '../../src/core/rng';

// Frozen from the original in pkt-3match/src/shared/core/rng.ts (copied verbatim, run under Node).
// Заморожено по оригиналу из pkt-3match/src/shared/core/rng.ts (скопирован дословно, запущен в Node).
const FROZEN: Record<number, number[]> = {
    1: [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849],
    42: [0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423],
};

describe('mulberry32', () => {
    it.each(Object.keys(FROZEN).map(Number))('seed %i matches the original byte for byte', (seed) => {
        const rng = mulberry32(seed);
        expect(Array.from({ length: 5 }, () => rng())).toEqual(FROZEN[seed]);
    });

    it('is deterministic and independent between instances', () => {
        const a = mulberry32(7);
        const b = mulberry32(7);
        a();
        a();
        expect(b()).toBe(mulberry32(7)());
    });

    it('stays inside [0, 1)', () => {
        const rng = mulberry32(123456789);
        for (let i = 0; i < 10000; i++) {
            const v = rng();
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThan(1);
        }
    });

    it('different seeds give different sequences', () => {
        expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    });
});

describe('randomInt', () => {
    it('covers [0, count) and never reaches count', () => {
        const rng = mulberry32(99);
        const seen = new Set<number>();
        for (let i = 0; i < 2000; i++) seen.add(randomInt(rng, 6));
        expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it('count 1 always gives 0', () => {
        expect(randomInt(() => 0.9999999, 1)).toBe(0);
    });
});
