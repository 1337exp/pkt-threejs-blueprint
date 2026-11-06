import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshBasicMaterial, Mesh, PointLight, ShaderMaterial, Texture, type BufferGeometry, type Material } from 'three';
import { disposeObject } from '../../src/three/dispose';

/** Counts the `dispose` events a three resource fires. */
function watch(resource: BufferGeometry | Material | Texture | Mesh): { readonly count: number } {
    const state = { count: 0 };
    (resource as unknown as { addEventListener(type: string, listener: () => void): void }).addEventListener('dispose', () => state.count++);
    return {
        get count() {
            return state.count;
        },
    };
}

describe('disposeObject', () => {
    it('frees a geometry and a material shared by many meshes exactly once', () => {
        const geometry = new BoxGeometry();
        const material = new MeshBasicMaterial();
        const g = watch(geometry);
        const m = watch(material);
        const root = new Group().add(new Mesh(geometry, material), new Mesh(geometry, material), new Group().add(new Mesh(geometry, material)));
        disposeObject(root);
        expect(g.count).toBe(1);
        expect(m.count).toBe(1);
    });

    it('frees every material of a material array', () => {
        const a = new MeshBasicMaterial();
        const b = new MeshBasicMaterial();
        const wa = watch(a);
        const wb = watch(b);
        disposeObject(new Mesh(new BoxGeometry(), [a, b, a]));
        expect([wa.count, wb.count]).toEqual([1, 1]);
    });

    it('leaves textures alone by default: they are often shared with a cache', () => {
        const map = new Texture();
        const t = watch(map);
        disposeObject(new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map })));
        expect(t.count).toBe(0);
    });

    it('with textures: true frees them once, even when two materials share one', () => {
        const map = new Texture();
        const alpha = new Texture();
        const t = watch(map);
        const u = watch(alpha);
        const root = new Group().add(
            new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map, alphaMap: alpha })),
            new Mesh(new BoxGeometry(), new MeshBasicMaterial({ map })),
        );
        disposeObject(root, { textures: true });
        expect([t.count, u.count]).toEqual([1, 1]);
    });

    it('with textures: true also finds textures in shader uniforms', () => {
        const tex = new Texture();
        const t = watch(tex);
        const material = new ShaderMaterial({ uniforms: { uMap: { value: tex }, uTime: { value: 0 } } });
        disposeObject(new Mesh(new BoxGeometry(), material), { textures: true });
        expect(t.count).toBe(1);
    });

    it('frees the instance buffers of an instanced mesh', () => {
        const mesh = new InstancedMesh(new BoxGeometry(), new MeshBasicMaterial(), 4);
        const w = watch(mesh);
        disposeObject(mesh);
        expect(w.count).toBe(1);
    });

    it('objects without resources (groups, lights) are fine, and nothing is detached', () => {
        const root = new Group();
        const child = new Group();
        root.add(child, new PointLight());
        expect(() => disposeObject(root)).not.toThrow();
        expect(child.parent).toBe(root);
    });
});
