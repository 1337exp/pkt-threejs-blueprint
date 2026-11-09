import { WebGLRenderer, type WebGLRendererParameters } from 'three';

export interface CanvasOptions {
    /**
     * The CSS `touch-action` of the canvas. The default is `none`: a finger drag belongs to the game. A scene that has no gesture of its own
     * (a table you only tap, a model you only look at) should pass `pan-y`, so that a finger moving along the page still scrolls it.
     * CSS `touch-action` холста. По умолчанию `none`: перетаскивание пальцем принадлежит игре. Сцене без своих жестов (стол, по которому только
     * тапают, модель, на которую только смотрят) стоит передать `pan-y`, чтобы палец, ведущий вдоль страницы, всё же её листал.
     */
    touchAction?: string;
}

/** The part of a canvas that {@link styleCanvas} touches. / Часть холста, которой касается {@link styleCanvas}. */
export interface StylableCanvas {
    style: { display: string; touchAction: string };
}

/**
 * The look of the canvas that {@link createRenderer} asks for: a block (no stray line gap under it) and the chosen `touch-action`.
 * It is a function of its own so that it can be tested without WebGL.
 * Вид холста, которого просит {@link createRenderer}: блочный (без щели под ним) и выбранный `touch-action`. Отдельная функция, чтобы
 * её можно было проверить без WebGL.
 */
export function styleCanvas(canvas: StylableCanvas, options: CanvasOptions = {}): void {
    canvas.style.display = 'block';
    canvas.style.touchAction = options.touchAction ?? 'none';
}

/**
 * A renderer on a canvas inside `container`: antialiased by default, the canvas is a block (no stray line gap under it)
 * and `touch-action: none` (a finger drag is for the game, not for scrolling the page; change it with `options.touchAction`).
 * The size and the pixel ratio are set by {@link bindResize}; without it the canvas keeps three's defaults.
 * Рендерер на холсте внутри `container`: со сглаживанием по умолчанию, холст блочный (без щели под ним) и с `touch-action: none`
 * (перетаскивание пальцем для игры, а не для прокрутки страницы; меняется через `options.touchAction`). Размер и плотность
 * пикселей ставит {@link bindResize}; без него холст остаётся с умолчаниями three.
 */
export function createRenderer(container: HTMLElement, parameters: WebGLRendererParameters = {}, options: CanvasOptions = {}): WebGLRenderer {
    const renderer = new WebGLRenderer({ antialias: true, ...parameters });
    styleCanvas(renderer.domElement, options);
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
