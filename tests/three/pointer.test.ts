import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Plane, Vector2, Vector3 } from 'three';
import { clientToNdc, rayOnPlane } from '../../src/three/pointer';

const element = (left: number, top: number, width: number, height: number) => ({ getBoundingClientRect: () => ({ left, top, width, height }) });

describe('clientToNdc', () => {
    const el = element(100, 50, 200, 100);

    it('centre is (0, 0), corners are (±1, ±1) with y up', () => {
        expect(clientToNdc({ clientX: 200, clientY: 100 }, el).toArray()).toEqual([0, 0]);
        expect(clientToNdc({ clientX: 100, clientY: 50 }, el).toArray()).toEqual([-1, 1]);
        expect(clientToNdc({ clientX: 300, clientY: 150 }, el).toArray()).toEqual([1, -1]);
    });

    it('accounts for the page offset of the element, not just the window', () => {
        expect(clientToNdc({ clientX: 150, clientY: 75 }, el).toArray()).toEqual([-0.5, 0.5]);
        expect(clientToNdc({ clientX: 150, clientY: 75 }, element(0, 0, 200, 100)).toArray()).toEqual([0.5, -0.5]);
    });

    it('points outside the element go beyond ±1 (the caller decides what to do)', () => {
        expect(clientToNdc({ clientX: 500, clientY: 50 }, el).x).toBe(3);
    });

    it('writes into `out` when given, and returns it', () => {
        const out = new Vector2();
        expect(clientToNdc({ clientX: 100, clientY: 50 }, el, out)).toBe(out);
        expect(out.toArray()).toEqual([-1, 1]);
    });

    it('a zero-size element gives (0, 0), not NaN', () => {
        expect(clientToNdc({ clientX: 10, clientY: 10 }, element(0, 0, 0, 0)).toArray()).toEqual([0, 0]);
    });
});

describe('rayOnPlane', () => {
    const table = new Plane(new Vector3(0, 0, 1), 0);
    const camera = () => {
        // fov 90, aspect 1, 10 above the table looking straight down: ndc ±1 lands at ±10 on the table.
        const c = new PerspectiveCamera(90, 1, 0.1, 100);
        c.position.set(0, 0, 10);
        c.lookAt(0, 0, 0);
        return c;
    };

    it('the centre of the screen hits the point the camera looks at', () => {
        const hit = rayOnPlane({ x: 0, y: 0 }, camera(), table)!;
        expect(hit.x).toBeCloseTo(0, 9);
        expect(hit.y).toBeCloseTo(0, 9);
        expect(hit.z).toBeCloseTo(0, 9);
    });

    it('the screen edges land where the field of view says', () => {
        const c = camera();
        const right = rayOnPlane({ x: 1, y: 0 }, c, table)!;
        const top = rayOnPlane({ x: 0, y: 1 }, c, table)!;
        expect(right.x).toBeCloseTo(10, 6);
        expect(top.y).toBeCloseTo(10, 6);
    });

    it('a camera moved since the last render still aims right (the matrix is refreshed)', () => {
        const c = camera();
        c.updateMatrixWorld();
        c.position.x = 4; // no render, no updateMatrixWorld
        const hit = rayOnPlane({ x: 0, y: 0 }, c, table)!;
        expect(hit.x).toBeCloseTo(4, 9);
    });

    it('returns null when the plane is behind the camera or parallel to the ray', () => {
        expect(rayOnPlane({ x: 0, y: 0 }, camera(), new Plane(new Vector3(0, 0, 1), -20))).toBeNull();
        // A wall at x = 5, the ray runs straight down at x = 0: parallel, never meets it.
        expect(rayOnPlane({ x: 0, y: 0 }, camera(), new Plane(new Vector3(1, 0, 0), -5))).toBeNull();
    });

    it('writes into `out` when given, and returns it', () => {
        const out = new Vector3();
        expect(rayOnPlane({ x: 1, y: 0 }, camera(), table, out)).toBe(out);
        expect(out.x).toBeCloseTo(10, 6);
    });

    it('works through a camera rig (a parent that moves the camera)', () => {
        const rig = new PerspectiveCamera(90, 1, 0.1, 100);
        rig.position.set(0, 0, 10);
        rig.lookAt(0, 0, 0);
        rig.updateMatrixWorld();
        const hit = rayOnPlane({ x: 0, y: 0 }, rig, table)!;
        rig.position.set(3, -2, 10);
        const moved = rayOnPlane({ x: 0, y: 0 }, rig, table)!;
        expect(moved.x - hit.x).toBeCloseTo(3, 9);
        expect(moved.y - hit.y).toBeCloseTo(-2, 9);
    });
});
