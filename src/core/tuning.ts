/**
 * The core of "tweak it live": a bag of numbers the scene reads every frame, plus saving, reset and "copy as code".
 * No DOM, no framework: a panel (Vue, plain DOM, anything) only draws the schema and calls `set`.
 * Ядро «покрутить вживую»: набор чисел, которые сцена читает каждый кадр, плюс сохранение, сброс и «скопировать как код».
 * Без DOM и без фреймворка: панель (Vue, чистый DOM, что угодно) только рисует схему и зовёт `set`.
 */

/** One slider. / Один ползунок. */
export interface Knob<K extends string = string> {
    key: K;
    label: string;
    min: number;
    max: number;
    step: number;
    /** Unit label: "s", "×". / Подпись единиц: «с», «×». */
    unit?: string;
}

/** Sliders under a heading. / Ползунки под заголовком. */
export interface KnobGroup<K extends string = string> {
    title: string;
    knobs: Knob<K>[];
}

/**
 * Where tweaks are kept. `read` returns null when nothing is saved or storage is unavailable; `write` returns false on failure.
 * Neither throws.
 * Где хранятся правки. `read` возвращает null, если ничего нет или хранилище недоступно; `write` возвращает false при неудаче.
 * Ни то ни другое не бросает исключений.
 */
export interface TuningStorage {
    read(key: string): string | null;
    write(key: string, text: string): boolean;
}

interface WebStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/**
 * `localStorage`, safe: private mode, a site ban, a full quota or a missing `localStorage` give null / false, not an exception.
 * `localStorage` без риска: приватный режим, запрет сайта, полная квота или отсутствие `localStorage` дают null / false, а не исключение.
 */
export function localStorageAdapter(): TuningStorage {
    const web = (): WebStorage | null => {
        try {
            return (globalThis as { localStorage?: WebStorage }).localStorage ?? null;
        } catch {
            return null;
        }
    };
    return {
        read(key) {
            try {
                return web()?.getItem(key) ?? null;
            } catch {
                return null;
            }
        },
        write(key, text) {
            try {
                const storage = web();
                if (!storage) return false;
                storage.setItem(key, text);
                return true;
            } catch {
                return false;
            }
        },
    };
}

export interface TuningOptions<K extends string> {
    /** The schema for a panel. The store itself does not need it. / Схема для панели. Самому хранилищу не нужна. */
    groups?: KnobGroup<K>[];
    /** Storage key. Without it nothing is saved. / Ключ хранилища. Без него ничего не сохраняется. */
    storageKey?: string;
    /** Default: {@link localStorageAdapter}. / По умолчанию {@link localStorageAdapter}. */
    storage?: TuningStorage;
}

export interface Tuning<T extends { [K in keyof T]: number }> {
    /** The live object (the same one you passed in): read it from the scene every frame. / Живой объект (тот же, что передали): читай его из сцены каждый кадр. */
    readonly values: T;
    /** What the numbers were when the store was created: the defaults in code. / Какими числа были при создании: значения по умолчанию в коде. */
    readonly defaults: Readonly<T>;
    readonly groups: readonly KnobGroup<Extract<keyof T, string>>[];
    /** Change one number: saves and notifies. Not a finite number: ignored. / Изменить одно число: сохраняет и оповещает. Не конечное число: игнорируется. */
    set<K extends keyof T>(key: K, value: number): void;
    /** Back to the defaults in code. / Вернуть значения по умолчанию из кода. */
    reset(): void;
    /** Only what differs from the defaults. / Только то, что отличается от умолчаний. */
    changed(): Partial<T>;
    /** The values as source code to paste over the defaults: `export const tuning = { … };`. / Значения как код, чтобы вставить поверх умолчаний. */
    toSource(name?: string): string;
    /** Called after every `set` and `reset`; returns the function that stops listening. / Зовётся после каждого `set` и `reset`; возвращает функцию отписки. */
    subscribe(listener: () => void): () => void;
}

/**
 * Wrap a bag of numbers. `values` stays the live object (the scene keeps reading it); its current content becomes the defaults.
 * Saved tweaks are applied at once. Only the **differences from the defaults** are saved, so a knob you never touched
 * follows new defaults when you change them in code.
 * Обернуть набор чисел. `values` остаётся живым объектом (сцена продолжает его читать); его текущее содержимое становится
 * значениями по умолчанию. Сохранённые правки применяются сразу. Сохраняются только **отличия от умолчаний**, поэтому
 * ручка, которую не трогали, идёт за новыми умолчаниями, когда их меняют в коде.
 */
export function createTuning<T extends { [K in keyof T]: number }>(values: T, options: TuningOptions<Extract<keyof T, string>> = {}): Tuning<T> {
    const keys = Object.keys(values) as (keyof T & string)[];
    const defaults = Object.freeze({ ...values }) as Readonly<T>;
    const { storageKey, groups = [] } = options;
    const storage = options.storage ?? localStorageAdapter();
    const listeners = new Set<() => void>();

    const changed = (): Partial<T> => {
        const diff: Partial<T> = {};
        for (const key of keys) if (values[key] !== defaults[key]) diff[key] = values[key];
        return diff;
    };
    const persist = (): void => {
        if (storageKey !== undefined) storage.write(storageKey, JSON.stringify(changed()));
    };
    const notify = (): void => {
        for (const listener of [...listeners]) listener();
    };

    if (storageKey !== undefined) {
        const text = storage.read(storageKey);
        if (text !== null) {
            try {
                const saved = JSON.parse(text) as Record<string, unknown> | null;
                // Only keys we know and finite numbers: a stale or damaged save must not break the scene.
                // Только известные ключи и конечные числа: устаревшее или испорченное сохранение не должно ломать сцену.
                for (const key of keys) {
                    const value = saved?.[key];
                    if (typeof value === 'number' && Number.isFinite(value)) values[key] = value as T[typeof key];
                }
            } catch {
                // damaged save: work with the defaults / испорченное сохранение: работаем с умолчаниями
            }
        }
    }

    return {
        values,
        defaults,
        groups,
        set(key, value) {
            if (!Number.isFinite(value)) return;
            values[key] = value as T[typeof key];
            persist();
            notify();
        },
        reset() {
            Object.assign(values, defaults);
            persist();
            notify();
        },
        changed,
        toSource(name = 'tuning') {
            const lines = keys.map((key) => `    ${key}: ${+values[key].toFixed(3)},`);
            return `export const ${name} = {\n${lines.join('\n')}\n};\n`;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
