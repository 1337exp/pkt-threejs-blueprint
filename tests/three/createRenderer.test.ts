import { describe, expect, it, vi } from 'vitest';

// A stand-in for three's WebGLRenderer: it needs no WebGL, it only has a canvas that records what is done to it.
vi.mock('three', () => ({
    WebGLRenderer: class {
        domElement = { style: { display: '', touchAction: '' } };
        constructor(readonly parameters: unknown) {}
    },
}));

const { createRenderer } = await import('../../src/three/renderer');

const container = () => {
    const appended: unknown[] = [];
    return { appended, appendChild: (node: unknown) => appended.push(node) } as unknown as HTMLElement & { appended: unknown[] };
};

describe('createRenderer', () => {
    it('puts the canvas into the container, antialiased, as a block with touch-action none', () => {
        const host = container();
        const renderer = createRenderer(host) as unknown as { domElement: { style: Record<string, string> }; parameters: unknown };
        expect(host.appended).toEqual([renderer.domElement]);
        expect(renderer.parameters).toEqual({ antialias: true });
        expect(renderer.domElement.style).toEqual({ display: 'block', touchAction: 'none' });
    });

    it('passes the touch-action option through to the canvas', () => {
        const renderer = createRenderer(container(), {}, { touchAction: 'pan-y' }) as unknown as { domElement: { style: Record<string, string> } };
        expect(renderer.domElement.style.touchAction).toBe('pan-y');
    });

    it('lets the caller turn antialiasing off', () => {
        const renderer = createRenderer(container(), { antialias: false }) as unknown as { parameters: unknown };
        expect(renderer.parameters).toEqual({ antialias: false });
    });
});
