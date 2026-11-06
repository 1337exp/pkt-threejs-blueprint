// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import { createTuning, type KnobGroup, type Tuning } from '../../../src/core/tuning';
import { TuningPanel, formatKnobValue } from '../../../src/components/vue/tuning-panel';

const groups: KnobGroup<'speed' | 'stiffness' | 'glow'>[] = [
    { title: 'General', knobs: [{ key: 'speed', label: 'Time speed', min: 0.1, max: 2, step: 0.05, unit: '×' }] },
    {
        title: 'Hand',
        knobs: [
            { key: 'stiffness', label: 'Stiffness', min: 100, max: 2000, step: 10 },
            { key: 'glow', label: 'Glow', min: 0, max: 1, step: 0.001 },
        ],
    },
];

const memory = () => {
    const data = new Map<string, string>();
    return { read: (k: string) => data.get(k) ?? null, write: (k: string, v: string) => (data.set(k, v), true) };
};

const makeTuning = () => createTuning({ speed: 1, stiffness: 2000, glow: 0.3 }, { groups, storage: memory() });

const mounted: { app: App; el: HTMLElement }[] = [];

/** Mount the panel with reactive props so a test can swap the store. */
function mount(tuning: Tuning<any>, extra: Record<string, unknown> = {}, slots?: Record<string, () => unknown>) {
    const state = reactive({ tuning: tuning as Tuning<any>, ...extra });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp({ render: () => h(TuningPanel, { ...state, tuning: state.tuning, onChange: (state as any).onChange }, slots as never) });
    app.mount(el);
    mounted.push({ app, el });
    return { state, el, app };
}

afterEach(() => {
    for (const { app, el } of mounted.splice(0)) {
        app.unmount();
        el.remove();
    }
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const ranges = (el: HTMLElement) => [...el.querySelectorAll<HTMLInputElement>('input.tbp-range')];
const values = (el: HTMLElement) => [...el.querySelectorAll('.tbp-value')].map((node) => node.textContent);
const input = (range: HTMLInputElement, value: string) => {
    range.value = value;
    range.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('formatKnobValue', () => {
    it('decimals follow the step, the unit follows the number', () => {
        expect(formatKnobValue(1.05, 0.05, '×')).toBe('1.05 ×');
        expect(formatKnobValue(2000, 10)).toBe('2000');
        expect(formatKnobValue(0.3, 0.001)).toBe('0.300');
        expect(formatKnobValue(0.5, 0.5)).toBe('0.50');
    });
});

describe('TuningPanel: drawing the schema', () => {
    it('draws every group and knob with its label, formatted value and slider limits', () => {
        const { el } = mount(makeTuning());
        expect([...el.querySelectorAll('.tbp-title')].map((n) => n.textContent)).toEqual(['General', 'Hand']);
        expect(values(el)).toEqual(['1.00 ×', '2000', '0.300']);
        const [speed] = ranges(el);
        expect([speed!.min, speed!.max, speed!.step, speed!.value]).toEqual(['0.1', '2', '0.05', '1']);
        expect(speed!.getAttribute('aria-label')).toBe('Time speed');
    });

    it('marks only the values that differ from the defaults', async () => {
        const tuning = makeTuning();
        const { el } = mount(tuning);
        expect(el.querySelectorAll('.tbp-value--changed')).toHaveLength(0);
        tuning.set('stiffness', 800);
        await nextTick();
        const changed = [...el.querySelectorAll('.tbp-value--changed')].map((n) => n.textContent);
        expect(changed).toEqual(['800']);
    });

    it('floating pins it, default does not; the before slot is drawn above the groups', () => {
        const plain = mount(makeTuning());
        expect(plain.el.querySelector('.tbp-panel--floating')).toBeNull();
        const floating = mount(makeTuning(), { floating: true }, { before: () => h('div', { class: 'extra' }, 'flags') });
        expect(floating.el.querySelector('.tbp-panel--floating')).not.toBeNull();
        const scroll = floating.el.querySelector('.tbp-scroll')!;
        expect(scroll.firstElementChild!.className).toBe('extra');
    });

    it('puts the stylesheet on the page once, however many panels', () => {
        mount(makeTuning());
        mount(makeTuning());
        expect(document.querySelectorAll('style#tbp-styles')).toHaveLength(1);
    });
});

describe('TuningPanel: changing values', () => {
    it('a slider move goes through tuning.set: the live object changes, the label follows', async () => {
        const tuning = makeTuning();
        const { el } = mount(tuning);
        input(ranges(el)[1]!, '800');
        await nextTick();
        expect(tuning.values.stiffness).toBe(800);
        expect(values(el)[1]).toBe('800');
        expect(tuning.changed()).toEqual({ stiffness: 800 });
    });

    it('emits change after a move and after a reset, and the panel redraws on a change made elsewhere', async () => {
        const tuning = makeTuning();
        const onChange = vi.fn();
        const { el } = mount(tuning, { onChange });
        input(ranges(el)[0]!, '1.5');
        expect(onChange).toHaveBeenCalledTimes(1);
        tuning.set('glow', 0.9); // not through the panel
        await nextTick();
        expect(values(el)[2]).toBe('0.900');
        expect(onChange).toHaveBeenCalledTimes(2);
        (el.querySelectorAll('.tbp-btn')[1] as HTMLButtonElement).click();
        await nextTick();
        expect(onChange).toHaveBeenCalledTimes(3);
        expect(values(el)).toEqual(['1.00 ×', '2000', '0.300']);
    });

    it('Reset puts the defaults back', async () => {
        const tuning = makeTuning();
        const { el } = mount(tuning);
        tuning.set('speed', 0.5);
        tuning.set('stiffness', 300);
        (el.querySelectorAll('.tbp-btn')[1] as HTMLButtonElement).click();
        expect(tuning.values).toEqual({ speed: 1, stiffness: 2000, glow: 0.3 });
    });
});

describe('TuningPanel: copy as code', () => {
    it('writes the values as source to the clipboard, says so, and goes back to the label', async () => {
        vi.useFakeTimers();
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        const tuning = makeTuning();
        tuning.set('stiffness', 810);
        const { el } = mount(tuning, { sourceName: 'cardsTuning' });
        const copy = el.querySelector<HTMLButtonElement>('.tbp-btn--primary')!;
        expect(copy.textContent).toBe('Copy');
        copy.click();
        await vi.advanceTimersByTimeAsync(0);
        expect(writeText).toHaveBeenCalledWith(tuning.toSource('cardsTuning'));
        expect(writeText.mock.calls[0]![0]).toContain('stiffness: 810');
        expect(copy.textContent).toBe('Copied');
        await vi.advanceTimersByTimeAsync(2000);
        expect(copy.textContent).toBe('Copy');
    });

    it('says so when the clipboard is not available', async () => {
        vi.stubGlobal('navigator', {});
        const { el } = mount(makeTuning());
        const copy = el.querySelector<HTMLButtonElement>('.tbp-btn--primary')!;
        copy.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await nextTick();
        expect(copy.textContent).toBe('Clipboard unavailable');
    });

    it('takes the texts from labels, so another language is one prop', () => {
        const { el } = mount(makeTuning(), { labels: { copy: 'Скопировать', reset: 'Сбросить' } });
        expect([...el.querySelectorAll('.tbp-btn')].map((n) => n.textContent)).toEqual(['Скопировать', 'Сбросить']);
    });
});

describe('TuningPanel: the store behind it', () => {
    it('rebinds when the store is swapped, and stops listening to the old one', async () => {
        const first = makeTuning();
        const second = createTuning({ speed: 1, stiffness: 100, glow: 0 }, { groups, storage: memory() });
        const onChange = vi.fn();
        const { el, state } = mount(first, { onChange });
        state.tuning = second;
        await nextTick();
        expect(values(el)).toEqual(['1.00 ×', '100', '0.000']);
        first.set('speed', 2); // the old store is no longer ours: no redraw, no change event
        await nextTick();
        expect(values(el)[0]).toBe('1.00 ×');
        expect(onChange).not.toHaveBeenCalled();
        second.set('speed', 2);
        await nextTick();
        expect(values(el)[0]).toBe('2.00 ×');
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes when it goes away', () => {
        const tuning = makeTuning();
        const off = vi.fn();
        const subscribe = tuning.subscribe;
        tuning.subscribe = (listener) => {
            const stop = subscribe(listener);
            return () => (off(), stop());
        };
        const { app } = mount(tuning);
        app.unmount();
        expect(off).toHaveBeenCalledTimes(1);
    });
});
