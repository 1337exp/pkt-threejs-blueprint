import { linear, type Ease } from './ease.js';

/**
 * A function the ticker calls every update. Return `false` to remove it.
 * Функция, которую тикер зовёт на каждом обновлении. Вернул `false` — снимается.
 */
export type TickFn = (dt: number, time: number) => boolean | void;

/**
 * Game time. Tweens and pauses count frames, not `setTimeout`: pause or slow the game and everything slows at once.
 * Feed it the real frame delta (already capped, see the `maxDt` notes in the docs); it scales that by `speed`.
 *
 * Игровое время. Твины и паузы считаются по кадрам, а не по `setTimeout`: поставил игру на паузу или замедлил,
 * и замедлилось всё сразу. Подавай реальную дельту кадра (уже ограниченную сверху, см. заметки про `maxDt` в документации);
 * тикер умножает её на `speed`.
 */
export class Ticker {
    /** Game seconds since creation. / Игровые секунды с создания. */
    time = 0;
    /** Speed multiplier: 0.25 is slow motion, 0 is a full stop (hit-stop). / Множитель скорости: 0.25 — замедление, 0 — полная остановка (hit-stop). */
    speed = 1;
    private readonly fns = new Set<TickFn>();

    /** True while something is subscribed (a tween in flight, a running effect). / Пока что-то подписано (идёт твин, работает эффект). */
    get busy(): boolean {
        return this.fns.size > 0;
    }

    /** Subscribe; returns the function that unsubscribes. / Подписать; возвращает функцию отписки. */
    add(fn: TickFn): () => void {
        this.fns.add(fn);
        return () => this.fns.delete(fn);
    }

    /**
     * Advance by a real frame delta, in seconds. Returns the game delta (`realDt * speed`).
     * A function removed by an earlier one during the same update is not called.
     * Продвинуть на реальную дельту кадра в секундах. Возвращает игровую дельту (`realDt * speed`).
     * Функция, которую в этом же обновлении отписала предыдущая, не вызывается.
     */
    update(realDt: number): number {
        const dt = realDt * this.speed;
        this.time += dt;
        for (const fn of [...this.fns]) {
            if (!this.fns.has(fn)) continue;
            if (fn(dt, this.time) === false) this.fns.delete(fn);
        }
        return dt;
    }

    /**
     * Tween: `onUpdate` gets the progress 0…1 after the curve; the last call is exactly `ease(1)`. The promise resolves after it.
     * Твин: `onUpdate` получает прогресс 0…1 уже после кривой; последний вызов ровно `ease(1)`. Обещание выполняется после него.
     */
    tween(duration: number, onUpdate: (k: number) => void, ease: Ease = linear): Promise<void> {
        return new Promise((resolve) => {
            let t = 0;
            this.add((dt) => {
                t = Math.min(duration, t + dt);
                onUpdate(ease(duration > 0 ? t / duration : 1));
                if (t >= duration) {
                    resolve();
                    return false;
                }
            });
        });
    }

    /** Pause for game seconds. / Пауза в игровых секундах. */
    wait(seconds: number): Promise<void> {
        return this.tween(seconds, () => {});
    }

    /**
     * Drop every subscription (scene teardown). Promises of dropped tweens never resolve: do not `await` them across a teardown.
     * Снять все подписки (разбор сцены). Обещания снятых твинов не выполняются: не жди их через разбор.
     */
    clear(): void {
        this.fns.clear();
    }
}
