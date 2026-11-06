import { describe, expect, it, vi } from 'vitest';
import { createTuning, localStorageAdapter, type TuningStorage } from '../../src/core/tuning';

/** In-memory storage that records calls. */
function memory(initial: Record<string, string> = {}) {
    const data = new Map(Object.entries(initial));
    const storage: TuningStorage & { writes: number } = {
        writes: 0,
        read: (key) => data.get(key) ?? null,
        write(key, text) {
            storage.writes++;
            data.set(key, text);
            return true;
        },
    };
    return { data, storage };
}

const base = () => ({ speed: 1, stiffness: 170, damping: 0.72 });

describe('createTuning', () => {
    it('keeps the object you pass as the live one and snapshots its content as the defaults', () => {
        const values = base();
        const tuning = createTuning(values, { storage: memory().storage });
        expect(tuning.values).toBe(values);
        tuning.set('speed', 2);
        expect(values.speed).toBe(2);
        expect(tuning.defaults.speed).toBe(1);
    });

    it('saves only the differences from the defaults', () => {
        const { data, storage } = memory();
        const tuning = createTuning(base(), { storageKey: 'k', storage });
        tuning.set('stiffness', 300);
        expect(JSON.parse(data.get('k')!)).toEqual({ stiffness: 300 });
        tuning.set('stiffness', 170); // back to the default: nothing to save
        expect(JSON.parse(data.get('k')!)).toEqual({});
    });

    it('restores saved tweaks on creation', () => {
        const { storage } = memory({ k: JSON.stringify({ stiffness: 999, damping: 0.5 }) });
        const tuning = createTuning(base(), { storageKey: 'k', storage });
        expect(tuning.values).toEqual({ speed: 1, stiffness: 999, damping: 0.5 });
        expect(tuning.changed()).toEqual({ stiffness: 999, damping: 0.5 });
    });

    it('an untouched knob follows new defaults in code, a tweaked one keeps the tweak', () => {
        const { storage } = memory({ k: JSON.stringify({ stiffness: 999 }) });
        const tuning = createTuning({ speed: 1.5, stiffness: 170, damping: 0.72 }, { storageKey: 'k', storage });
        expect(tuning.values.speed).toBe(1.5);
        expect(tuning.values.stiffness).toBe(999);
    });

    it('ignores unknown keys, non-numbers and non-finite numbers in a saved value', () => {
        const { storage } = memory({ k: '{"speed":"fast","stiffness":null,"damping":1e999,"ghost":5}' });
        const tuning = createTuning(base(), { storageKey: 'k', storage });
        expect(tuning.values).toEqual(base());
        expect('ghost' in tuning.values).toBe(false);
    });

    it('survives a damaged save and a storage that fails', () => {
        const damaged = createTuning(base(), { storageKey: 'k', storage: memory({ k: '{not json' }).storage });
        expect(damaged.values).toEqual(base());
        const failing: TuningStorage = { read: () => null, write: () => false };
        const tuning = createTuning(base(), { storageKey: 'k', storage: failing });
        expect(() => tuning.set('speed', 3)).not.toThrow();
        expect(tuning.values.speed).toBe(3);
    });

    it('without a storage key nothing is read or written', () => {
        const { storage } = memory();
        const read = vi.spyOn(storage, 'read');
        const tuning = createTuning(base(), { storage });
        tuning.set('speed', 2);
        tuning.reset();
        expect(read).not.toHaveBeenCalled();
        expect(storage.writes).toBe(0);
    });

    it('ignores a value that is not a finite number', () => {
        const tuning = createTuning(base(), { storage: memory().storage });
        tuning.set('speed', Number.NaN);
        tuning.set('speed', Number.POSITIVE_INFINITY);
        expect(tuning.values.speed).toBe(1);
    });

    it('reset returns the defaults, saves the empty diff and notifies', () => {
        const { data, storage } = memory();
        const tuning = createTuning(base(), { storageKey: 'k', storage });
        const listener = vi.fn();
        tuning.subscribe(listener);
        tuning.set('speed', 2);
        tuning.reset();
        expect(tuning.values).toEqual(base());
        expect(data.get('k')).toBe('{}');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('unsubscribe stops notifications', () => {
        const tuning = createTuning(base(), { storage: memory().storage });
        const listener = vi.fn();
        const off = tuning.subscribe(listener);
        off();
        tuning.set('speed', 2);
        expect(listener).not.toHaveBeenCalled();
    });

    it('toSource writes the whole object in the original key order, rounded to 3 digits', () => {
        const tuning = createTuning(base(), { storage: memory().storage });
        tuning.set('damping', 0.123456);
        expect(tuning.toSource()).toBe('export const tuning = {\n    speed: 1,\n    stiffness: 170,\n    damping: 0.123,\n};\n');
        expect(tuning.toSource('cardsTuning').startsWith('export const cardsTuning = {')).toBe(true);
    });

    it('carries the schema for a panel', () => {
        const groups = [{ title: 'Hand', knobs: [{ key: 'stiffness' as const, label: 'Stiffness', min: 100, max: 2000, step: 10 }] }];
        expect(createTuning(base(), { groups, storage: memory().storage }).groups).toBe(groups);
    });
});

describe('localStorageAdapter', () => {
    it('does not throw without localStorage (Node, private mode): reads null, writes false', () => {
        const adapter = localStorageAdapter();
        expect(adapter.read('x')).toBeNull();
        expect(adapter.write('x', '1')).toBe(false);
    });

    it('uses localStorage when it exists', () => {
        const store = new Map<string, string>();
        (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
        try {
            const adapter = localStorageAdapter();
            expect(adapter.write('x', '1')).toBe(true);
            expect(adapter.read('x')).toBe('1');
        } finally {
            delete (globalThis as { localStorage?: unknown }).localStorage;
        }
    });

    it('a throwing localStorage (quota, ban) gives null / false', () => {
        (globalThis as { localStorage?: unknown }).localStorage = {
            getItem: () => {
                throw new Error('denied');
            },
            setItem: () => {
                throw new Error('quota');
            },
        };
        try {
            const adapter = localStorageAdapter();
            expect(adapter.read('x')).toBeNull();
            expect(adapter.write('x', '1')).toBe(false);
        } finally {
            delete (globalThis as { localStorage?: unknown }).localStorage;
        }
    });
});
