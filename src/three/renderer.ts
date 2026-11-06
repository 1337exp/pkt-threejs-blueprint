import { WebGLRenderer, type WebGLRendererParameters } from 'three';

/**
 * A renderer on a canvas inside `container`: antialiased by default, the canvas is a block (no stray line gap under it)
 * and `touch-action: none` (a finger drag is for the game, not for scrolling the page). The size and the pixel ratio are set
 * by {@link bindResize}; without it the canvas keeps three's defaults.
 * Рендерер на холсте внутри `container`: со сглаживанием по умолчанию, холст блочный (без щели под ним) и с `touch-action: none`
 * (перетаскивание пальцем для игры, а не для прокрутки страницы). Размер и плотность пикселей ставит {@link bindResize};
 * без него холст остаётся с умолчаниями three.
 */
export function createRenderer(container: HTMLElement, parameters: WebGLRendererParameters = {}): WebGLRenderer {
    const renderer = new WebGLRenderer({ antialias: true, ...parameters });
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
    return renderer;
}

/** The part of a renderer that {@link bindResize} touches. / Часть рендерера, которой касается {@link bindResize}. */
export interface ResizableRenderer {
    setPixelRatio(ratio: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
}

export interface ResizeOptions {
    /**
     * Pixel ratio cap. A phone at 3x is three times the pixels of a pixel shader for no visible gain; 2 is our default.
     * Потолок плотности пикселей. Телефон с 3x это втрое больше работы для пиксельного шейдера без заметной пользы; у нас по умолчанию 2.
     */
    maxPixelRatio?: number;
    /**
     * Also set the canvas CSS size (three's default). Pass `false` when CSS lays the canvas out itself.
     * Ставить ли ещё и CSS-размер холста (умолчание three). Передай `false`, если холст раскладывает сам CSS.
     */
    updateStyle?: boolean;
}

/**
 * Keep the renderer the size of `container`: on every change of its size it sets the pixel ratio (capped, read again each time,
 * because the window may move to another screen) and the size, then calls `onResize(width, height)` for the camera and the rest.
 * Called once right away. A zero size (a hidden container) is skipped. Returns the function that stops it.
 * Держать рендерер размером с `container`: при каждом изменении размера ставит плотность пикселей (с потолком, читается заново,
 * потому что окно может уйти на другой экран) и размер, затем зовёт `onResize(width, height)` для камеры и остального.
 * Первый вызов сразу. Нулевой размер (скрытый контейнер) пропускается. Возвращает функцию, которая это останавливает.
 */
export function bindResize(
    renderer: ResizableRenderer,
    container: HTMLElement,
    onResize?: (width: number, height: number) => void,
    options: ResizeOptions = {},
): () => void {
    const { maxPixelRatio = 2, updateStyle = true } = options;
    const apply = (): void => {
        const width = container.clientWidth;
        const height = container.clientHeight;
        if (!width || !height) return;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
        renderer.setSize(width, height, updateStyle);
        onResize?.(width, height);
    };
    const observer = new ResizeObserver(apply);
    observer.observe(container);
    apply();
    return () => observer.disconnect();
}
