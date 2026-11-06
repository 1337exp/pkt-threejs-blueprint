import { Raycaster, Vector2, Vector3, type Camera, type Plane } from 'three';

/** Anything with a client position: a `PointerEvent`, a `MouseEvent`, a `Touch`. / Всё, у чего есть позиция в окне: `PointerEvent`, `MouseEvent`, `Touch`. */
export interface ClientPoint {
    clientX: number;
    clientY: number;
}

/** Anything that knows its rectangle on the page: an element, the canvas. / Всё, что знает свой прямоугольник на странице: элемент, холст. */
export interface RectSource {
    getBoundingClientRect(): { left: number; top: number; width: number; height: number };
}

/**
 * A point of the window in normalized device coordinates of `element`: x from -1 (left) to 1 (right), y from -1 (bottom) to 1 (top),
 * as `Raycaster.setFromCamera` wants it. A zero-size element gives (0, 0).
 * Точка окна в нормализованных координатах `element`: x от -1 (слева) до 1 (справа), y от -1 (снизу) до 1 (сверху),
 * как нужно `Raycaster.setFromCamera`. Элемент нулевого размера даёт (0, 0).
 */
export function clientToNdc(point: ClientPoint, element: RectSource, out: Vector2 = new Vector2()): Vector2 {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return out.set(0, 0);
    return out.set(((point.clientX - rect.left) / rect.width) * 2 - 1, -((point.clientY - rect.top) / rect.height) * 2 + 1);
}

const raycaster = new Raycaster();

/**
 * Where the ray through `ndc` meets `plane`; `null` when it never does (parallel, or the plane is behind the camera).
 * Refreshes the camera's world matrix first, so a camera moved since the last render (a shake, a rig) still aims right.
 * Pass `out` to avoid an allocation per move event.
 * Где луч через `ndc` встречает `plane`; `null`, если не встречает (параллелен или плоскость позади камеры).
 * Сначала обновляет мировую матрицу камеры, поэтому камера, сдвинутая после последнего кадра (тряска, штатив), всё равно целится верно.
 * Передай `out`, чтобы не создавать объект на каждое событие движения.
 */
export function rayOnPlane(ndc: { x: number; y: number }, camera: Camera, plane: Plane, out: Vector3 = new Vector3()): Vector3 | null {
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc as Vector2, camera);
    return raycaster.ray.intersectPlane(plane, out);
}
