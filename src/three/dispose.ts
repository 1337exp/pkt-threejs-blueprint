import type { BufferGeometry, Material, Object3D, Texture } from 'three';

export interface DisposeOptions {
    /**
     * Also free the textures the materials hold (the standard slots such as `map`, and shader uniforms). Off by default:
     * a texture is often shared with something that outlives this tree (an atlas, a cache), and freeing it is then a bug.
     * Освобождать ли ещё и текстуры материалов (обычные слоты вроде `map` и uniform'ы шейдеров). По умолчанию выключено:
     * текстура часто общая с тем, что переживёт это дерево (атлас, кэш), и освободить её тогда ошибка.
     */
    textures?: boolean;
}

interface HasGeometry {
    geometry?: BufferGeometry;
    material?: Material | Material[];
    isInstancedMesh?: boolean;
    dispose?: () => void;
}

const isTexture = (value: unknown): value is Texture => typeof value === 'object' && value !== null && (value as Texture).isTexture === true;

/**
 * Free the GPU resources of everything under `root`: geometries and materials (a single one or an array), and with
 * `textures: true` their textures. Each resource is freed exactly once however many meshes share it.
 * Does not detach anything: remove `root` from its parent yourself.
 * Освободить ресурсы видеокарты у всего под `root`: геометрии и материалы (одиночные или массивом), а с `textures: true` ещё и их текстуры.
 * Каждый ресурс освобождается ровно один раз, сколько бы мешей его ни делило.
 * Ничего не отцепляет: убери `root` у родителя сам.
 */
export function disposeObject(root: Object3D, options: DisposeOptions = {}): void {
    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const instanced: HasGeometry[] = [];

    root.traverse((object) => {
        const item = object as unknown as HasGeometry;
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) for (const material of Array.isArray(item.material) ? item.material : [item.material]) materials.add(material);
        if (item.isInstancedMesh) instanced.push(item);
    });

    const textures = new Set<Texture>();
    if (options.textures) {
        for (const material of materials) {
            for (const value of Object.values(material)) if (isTexture(value)) textures.add(value);
            const uniforms = (material as { uniforms?: Record<string, { value: unknown }> }).uniforms;
            if (uniforms) for (const uniform of Object.values(uniforms)) if (isTexture(uniform.value)) textures.add(uniform.value);
        }
    }

    // An instanced mesh also owns its instance buffers. / У instanced-меша есть ещё и свои буферы экземпляров.
    for (const mesh of instanced) mesh.dispose?.();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
}
