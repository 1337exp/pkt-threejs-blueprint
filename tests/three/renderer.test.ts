import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindResize, styleCanvas } from '../../src/three/renderer';

/** A hand-driven ResizeObserver: `fire` delivers a change. */
class FakeObserver {
    static last: FakeObserver | null = null;
    observed: unknown[] = [];
    disconnected = false;
    constructor(readonly callback: () => void) {
        FakeObserver.last = this;
    }
    observe(target: unknown) {
        this.observed.push(target);
    }
    disconnect() {
        this.disconnected = true;
    }
    fire() {
        this.callback();
    }
}

function fakeRenderer() {
    const calls: unknown[][] = [];
    return {
        calls,
        setPixelRatio: (ratio: number) => calls.push(['ratio', ratio]),
        setSize: (w: number, h: number, style?: boolean) => calls.push(['size', w, h, style]),
    };
}

const container = (clientWidth: number, clientHeight: number) => ({ clientWidth, clientHeight }) as unknown as HTMLElement;

beforeEach(() => {
    FakeObserver.last = null;
    vi.stubGlobal('ResizeObserver', FakeObserver);
    vi.stubGlobal('window', { devicePixelRatio: 3 });
});
afterEach(() => vi.unstubAllGlobals());

describe('bindResize', () => {
    it('sizes the renderer at once and tells the caller', () => {
        const renderer = fakeRenderer();
        const seen: number[][] = [];
        bindResize(renderer, container(800, 600), (w, h) => seen.push([w, h]));
        expect(renderer.calls).toEqual([
            ['ratio', 2],
            ['size', 800, 600, true],
        ]);
        expect(seen).toEqual([[800, 600]]);
    });

    it('caps the pixel ratio (3x phone -> 2) and lets a lower real ratio through', () => {
        const high = fakeRenderer();
        bindResize(high, container(10, 10));
        expect(high.calls[0]).toEqual(['ratio', 2]);

        vi.stubGlobal('window', { devicePixelRatio: 1.5 });
        const mid = fakeRenderer();
        bindResize(mid, container(10, 10));
        expect(mid.calls[0]).toEqual(['ratio', 1.5]);

        vi.stubGlobal('window', { devicePixelRatio: 3 });
        const custom = fakeRenderer();
        bindResize(custom, container(10, 10), undefined, { maxPixelRatio: 1 });
        expect(custom.calls[0]).toEqual(['ratio', 1]);
    });

    it('a missing devicePixelRatio counts as 1', () => {
        vi.stubGlobal('window', {});
        const renderer = fakeRenderer();
        bindResize(renderer, container(10, 10));
        expect(renderer.calls[0]).toEqual(['ratio', 1]);
    });

    it('re-reads the size and the pixel ratio on every change', () => {
        const renderer = fakeRenderer();
        const el = { clientWidth: 400, clientHeight: 300 } as unknown as HTMLElement;
        const seen: number[][] = [];
        bindResize(renderer, el, (w, h) => seen.push([w, h]));
        Object.assign(el, { clientWidth: 640, clientHeight: 480 });
        vi.stubGlobal('window', { devicePixelRatio: 1 });
        FakeObserver.last!.fire();
        expect(seen).toEqual([
            [400, 300],
            [640, 480],
        ]);
        expect(renderer.calls.slice(-2)).toEqual([
            ['ratio', 1],
            ['size', 640, 480, true],
        ]);
    });

    it('skips a zero size (a hidden container): no calls, no callback', () => {
        const renderer = fakeRenderer();
        let called = false;
        bindResize(renderer, container(0, 300), () => (called = true));
        bindResize(renderer, container(300, 0), () => (called = true));
        expect(renderer.calls).toEqual([]);
        expect(called).toBe(false);
    });

    it('updateStyle: false is passed through to setSize', () => {
        const renderer = fakeRenderer();
        bindResize(renderer, container(10, 20), undefined, { updateStyle: false });
        expect(renderer.calls[1]).toEqual(['size', 10, 20, false]);
    });

    it('observes the container, and the returned function disconnects', () => {
        const el = container(10, 10);
        const stop = bindResize(fakeRenderer(), el);
        expect(FakeObserver.last!.observed).toEqual([el]);
        stop();
        expect(FakeObserver.last!.disconnected).toBe(true);
    });
});

describe('styleCanvas', () => {
    const canvas = () => ({ style: { display: '', touchAction: '' } });

    it('makes the canvas a block and keeps a finger drag for the game by default', () => {
        const c = canvas();
        styleCanvas(c);
        expect(c.style).toEqual({ display: 'block', touchAction: 'none' });
    });

    it('takes the touch-action that the scene asks for, so a finger can still scroll the page', () => {
        const c = canvas();
        styleCanvas(c, { touchAction: 'pan-y' });
        expect(c.style).toEqual({ display: 'block', touchAction: 'pan-y' });
    });

    it('uses none for an options object that has no touchAction', () => {
        const c = canvas();
        styleCanvas(c, {});
        expect(c.style.touchAction).toBe('none');
    });
});
