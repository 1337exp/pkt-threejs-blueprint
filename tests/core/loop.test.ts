import { afterEach, describe, expect, it, vi } from 'vitest';
import { startLoop } from '../../src/core/loop';

/** A hand-driven requestAnimationFrame: nothing runs until `advance`. */
function fakeHost(start = 1000) {
    let pending: ((time: number) => void) | null = null;
    let handle = 0;
    let time = start;
    const cancelled: number[] = [];
    return {
        schedule: (callback: (time: number) => void) => {
            pending = callback;
            return ++handle;
        },
        cancel: (h: number) => {
            cancelled.push(h);
            if (h === handle) pending = null;
        },
        now: () => time,
        /** Move the clock by `ms` and deliver one frame. */
        advance(ms: number) {
            time += ms;
            const callback = pending;
            pending = null;
            callback?.(time);
        },
        /** Deliver a frame stamped `at` (the clock may jump anywhere). */
        deliver(at: number) {
            time = at;
            const callback = pending;
            pending = null;
            callback?.(at);
        },
        get scheduled() {
            return pending !== null;
        },
        cancelled,
    };
}

afterEach(() => vi.unstubAllGlobals());

describe('startLoop', () => {
    it('hands out the real frame delta in seconds', () => {
        const host = fakeHost();
        const seen: number[] = [];
        startLoop((dt) => seen.push(dt), { maxDt: 1 / 30, ...host });
        host.advance(16);
        host.advance(20);
        expect(seen[0]).toBeCloseTo(0.016, 12);
        expect(seen[1]).toBeCloseTo(0.02, 12);
    });

    it('measures the first frame from the moment of the call', () => {
        const host = fakeHost(5000);
        const seen: number[] = [];
        startLoop((dt) => seen.push(dt), { maxDt: 0.1, ...host });
        host.advance(10);
        expect(seen).toEqual([0.01]);
    });

    it('caps the delta at maxDt after a long gap (a hidden tab), whatever the cap is', () => {
        for (const maxDt of [1 / 30, 0.05, 0.1]) {
            const host = fakeHost();
            const seen: number[] = [];
            startLoop((dt) => seen.push(dt), { maxDt, ...host });
            host.advance(30_000);
            expect(seen).toEqual([maxDt]);
        }
    });

    it('a delta exactly at the cap passes unchanged, and the cap does not slow the frames below it', () => {
        const host = fakeHost();
        const seen: number[] = [];
        startLoop((dt) => seen.push(dt), { maxDt: 0.05, ...host });
        host.advance(50);
        host.advance(7);
        expect(seen[0]).toBeCloseTo(0.05, 12);
        expect(seen[1]).toBeCloseTo(0.007, 12);
    });

    it('never gives a negative delta when the clock steps back', () => {
        const host = fakeHost();
        const seen: number[] = [];
        startLoop((dt) => seen.push(dt), { maxDt: 0.1, ...host });
        host.advance(16);
        host.deliver(900);
        expect(seen[1]).toBe(0);
    });

    it('passes the raw timestamp for shaders and real time', () => {
        const host = fakeHost(0);
        const stamps: number[] = [];
        startLoop((_dt, now) => stamps.push(now), { maxDt: 0.05, ...host });
        host.advance(16);
        host.advance(5000);
        expect(stamps).toEqual([16, 5016]);
    });

    it('stop() ends it, twice is fine, and it can be called from inside a frame', () => {
        const host = fakeHost();
        let calls = 0;
        const loop = startLoop(
            () => {
                calls++;
                if (calls === 2) loop.stop();
            },
            { maxDt: 0.05, ...host },
        );
        expect(loop.running).toBe(true);
        host.advance(16);
        host.advance(16);
        expect(loop.running).toBe(false);
        host.advance(16);
        expect(calls).toBe(2);
        loop.stop();
        expect(host.cancelled).toHaveLength(1);
    });

    it('a throw inside a frame does not end the loop', () => {
        const host = fakeHost();
        let calls = 0;
        startLoop(
            () => {
                calls++;
                if (calls === 1) throw new Error('boom');
            },
            { maxDt: 0.05, ...host },
        );
        expect(() => host.advance(16)).toThrow('boom');
        expect(host.scheduled).toBe(true);
        host.advance(16);
        expect(calls).toBe(2);
    });

    it('refuses a missing or silly maxDt: the cap is a choice, not a default', () => {
        const host = fakeHost();
        for (const maxDt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined as unknown as number]) {
            expect(() => startLoop(() => {}, { maxDt, ...host }), String(maxDt)).toThrow(RangeError);
        }
    });

    it('without requestAnimationFrame it says so instead of failing quietly', () => {
        expect(() => startLoop(() => {}, { maxDt: 0.05 })).toThrow(/requestAnimationFrame/);
    });

    it('uses the global requestAnimationFrame and performance.now when none are passed', () => {
        const host = fakeHost(0);
        vi.stubGlobal('requestAnimationFrame', host.schedule);
        vi.stubGlobal('cancelAnimationFrame', host.cancel);
        const seen: number[] = [];
        const loop = startLoop((dt) => seen.push(dt), { maxDt: 1 });
        host.deliver(performance.now() + 100);
        expect(seen[0]).toBeGreaterThan(0.09);
        loop.stop();
        expect(host.cancelled).toHaveLength(1);
    });
});
