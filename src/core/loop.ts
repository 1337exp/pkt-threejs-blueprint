/**
 * The frame loop: calls `frame(dt, now)` once per screen frame with the delta capped at `maxDt`.
 * No `three` and no DOM types here: `requestAnimationFrame` is taken from `globalThis` (or injected), so the cap logic runs in tests.
 * Цикл кадров: зовёт `frame(dt, now)` раз за кадр экрана с дельтой, ограниченной `maxDt`.
 * Здесь нет ни `three`, ни типов DOM: `requestAnimationFrame` берётся из `globalThis` (или подставляется), так что логика потолка проверяется тестами.
 */

export interface LoopOptions {
    /**
     * The upper bound of the frame delta, in seconds. It is NOT a simulation rate: the frame rate stays the screen's.
     * It exists so that a hidden tab or a stall does not deliver a `dt` of seconds, which would send every tween to its end
     * and every spring across the screen in one frame. Our projects use 1/30, 0.05 or 0.1: pick it deliberately.
     * Springs from `spring` do not depend on it for stability.
     * Верхний предел дельты кадра в секундах. Это НЕ частота симуляции: частота кадров остаётся экранной.
     * Он нужен, чтобы после фона вкладки или подвисания не прилетел `dt` в секунды: все твины ушли бы в конец,
     * а пружины прыгнули бы через весь экран за один кадр. У нас 1/30, 0.05 или 0.1: выбирай осознанно.
     * Пружинам из `spring` он для устойчивости не нужен.
     */
    maxDt: number;
    /** Default: the global `requestAnimationFrame`. / По умолчанию глобальный `requestAnimationFrame`. */
    schedule?: (callback: (now: number) => void) => number;
    /** Default: the global `cancelAnimationFrame`. / По умолчанию глобальный `cancelAnimationFrame`. */
    cancel?: (handle: number) => void;
    /** Time in milliseconds, on the same clock as the timestamps `schedule` passes. Default: `performance.now`. / Время в миллисекундах на тех же часах, что и метки от `schedule`. По умолчанию `performance.now`. */
    now?: () => number;
}

export interface Loop {
    /** Stop the loop. Safe to call twice and from inside `frame`. / Остановить цикл. Можно звать дважды и изнутри `frame`. */
    stop(): void;
    readonly running: boolean;
}

interface Host {
    requestAnimationFrame?: (callback: (now: number) => void) => number;
    cancelAnimationFrame?: (handle: number) => void;
    performance?: { now(): number };
}

/**
 * Start the loop. `frame(dt, now)` gets `dt` in seconds (never negative, never above `maxDt`) and `now`, the raw timestamp in milliseconds:
 * keep real time for shaders from `now`, and move things by `dt`. The first frame measures from the moment of the call.
 * Запустить цикл. `frame(dt, now)` получает `dt` в секундах (не меньше нуля и не больше `maxDt`) и `now`, сырую метку в миллисекундах:
 * реальное время для шейдеров бери из `now`, а двигай всё по `dt`. Первый кадр отсчитывается от момента вызова.
 */
export function startLoop(frame: (dt: number, now: number) => void, options: LoopOptions): Loop {
    const { maxDt } = options;
    if (!(maxDt > 0) || !Number.isFinite(maxDt)) throw new RangeError(`startLoop: maxDt must be a positive number of seconds, got ${maxDt}`);

    const host = globalThis as Host;
    const schedule = options.schedule ?? host.requestAnimationFrame?.bind(host);
    const cancel = options.cancel ?? host.cancelAnimationFrame?.bind(host);
    const now = options.now ?? (() => host.performance?.now() ?? Date.now());
    if (!schedule || !cancel) throw new Error('startLoop: requestAnimationFrame is not available here, pass `schedule` and `cancel`');

    let last = now();
    let handle = 0;
    let running = true;

    const tick = (time: number): void => {
        // Schedule first: a throw inside `frame` must not silently end the loop, and `stop()` inside it must still win.
        // Сначала планируем следующий: исключение в `frame` не должно молча остановить цикл, а `stop()` внутри него всё равно побеждает.
        handle = schedule(tick);
        const dt = Math.min(Math.max((time - last) / 1000, 0), maxDt);
        last = time;
        frame(dt, time);
    };
    handle = schedule(tick);

    return {
        get running() {
            return running;
        },
        stop() {
            if (!running) return;
            running = false;
            cancel(handle);
        },
    };
}
