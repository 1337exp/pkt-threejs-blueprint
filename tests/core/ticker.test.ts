import { describe, expect, it, vi } from 'vitest';
import { easeOutCubic } from '../../src/core/ease';
import { Ticker } from '../../src/core/ticker';

describe('Ticker', () => {
    it('advances game time by the real delta times speed and returns the game delta', () => {
        const ticker = new Ticker();
        expect(ticker.update(0.1)).toBeCloseTo(0.1, 12);
        ticker.speed = 0.25;
        expect(ticker.update(0.4)).toBeCloseTo(0.1, 12);
        expect(ticker.time).toBeCloseTo(0.2, 12);
    });

    it('speed 0 stops everything (hit-stop)', () => {
        const ticker = new Ticker();
        const seen: number[] = [];
        ticker.tween(1, (k) => seen.push(k));
        ticker.speed = 0;
        ticker.update(10);
        expect(ticker.time).toBe(0);
        expect(seen).toEqual([0]);
    });

    it('passes dt and time to subscribers and removes the one that returns false', () => {
        const ticker = new Ticker();
        const calls: [number, number][] = [];
        ticker.add((dt, time) => {
            calls.push([dt, time]);
            if (calls.length === 2) return false;
        });
        ticker.update(0.5);
        ticker.update(0.5);
        ticker.update(0.5);
        expect(calls).toEqual([
            [0.5, 0.5],
            [0.5, 1],
        ]);
        expect(ticker.busy).toBe(false);
    });

    it('an unsubscribe function stops the subscriber', () => {
        const ticker = new Ticker();
        const fn = vi.fn();
        const off = ticker.add(fn);
        ticker.update(0.1);
        off();
        ticker.update(0.1);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('a subscriber removed by an earlier one in the same update is not called', () => {
        const ticker = new Ticker();
        const second = vi.fn();
        let offSecond = () => {};
        ticker.add(() => offSecond());
        offSecond = ticker.add(second);
        ticker.update(0.1);
        expect(second).not.toHaveBeenCalled();
    });

    describe('tween', () => {
        it('goes 0…1 through the curve, ends on exactly ease(1), then resolves', async () => {
            const ticker = new Ticker();
            const seen: number[] = [];
            let resolved = false;
            const done = ticker.tween(1, (k) => seen.push(k), easeOutCubic).then(() => (resolved = true));
            ticker.update(0.5);
            expect(seen[0]).toBeCloseTo(easeOutCubic(0.5), 12);
            expect(resolved).toBe(false);
            ticker.update(0.7); // overshoots the end: clamped
            await done;
            expect(seen.at(-1)).toBe(1);
            expect(seen).toHaveLength(2);
            expect(resolved).toBe(true);
            expect(ticker.busy).toBe(false);
        });

        it('duration 0 resolves on the first update with exactly 1', async () => {
            const ticker = new Ticker();
            const seen: number[] = [];
            const done = ticker.tween(0, (k) => seen.push(k));
            ticker.update(0.016);
            await done;
            expect(seen).toEqual([1]);
        });

        it('wait resolves after the game seconds, not the real ones', async () => {
            const ticker = new Ticker();
            ticker.speed = 0.5;
            let resolved = false;
            void ticker.wait(1).then(() => (resolved = true));
            ticker.update(1);
            await Promise.resolve();
            expect(resolved).toBe(false);
            ticker.update(1);
            await Promise.resolve();
            expect(resolved).toBe(true);
        });
    });

    it('clear drops every subscription', () => {
        const ticker = new Ticker();
        const fn = vi.fn();
        ticker.add(fn);
        ticker.tween(1, fn);
        expect(ticker.busy).toBe(true);
        ticker.clear();
        ticker.update(0.1);
        expect(fn).not.toHaveBeenCalled();
        expect(ticker.busy).toBe(false);
    });
});
