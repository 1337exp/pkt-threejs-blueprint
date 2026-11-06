import { describe, expect, it } from 'vitest';
import { easeInCubic, easeInOutCubic, easeInQuad, easeOutBack, easeOutCubic, easeOutQuad, linear, smoothstep } from '../../src/core/ease';

describe('curves', () => {
    it.each([
        ['linear', linear],
        ['easeInQuad', easeInQuad],
        ['easeOutQuad', easeOutQuad],
        ['easeInCubic', easeInCubic],
        ['easeOutCubic', easeOutCubic],
        ['easeInOutCubic', easeInOutCubic],
        ['easeOutBack', easeOutBack],
    ])('%s starts at 0 and ends at 1', (_name, ease) => {
        expect(ease(0)).toBeCloseTo(0, 10);
        expect(ease(1)).toBeCloseTo(1, 10);
    });

    it('easeOutBack overshoots 1 and comes back', () => {
        const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeOutBack(i / 100)));
        expect(peak).toBeGreaterThan(1.05);
        expect(peak).toBeLessThan(1.15);
    });

    it('in-curves start slow, out-curves start fast', () => {
        expect(easeInCubic(0.2)).toBeLessThan(0.2);
        expect(easeOutCubic(0.2)).toBeGreaterThan(0.2);
    });
});

describe('smoothstep (GLSL argument order)', () => {
    it('clamps outside the edges', () => {
        expect(smoothstep(2, 4, 1)).toBe(0);
        expect(smoothstep(2, 4, 5)).toBe(1);
    });

    it('is 0.5 in the middle', () => {
        expect(smoothstep(2, 4, 3)).toBe(0.5);
    });
});
