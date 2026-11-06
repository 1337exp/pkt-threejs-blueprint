import { defineComponent, h, onBeforeUnmount, shallowRef, watch, type PropType, type VNode } from 'vue';
import type { Tuning } from '../../core/tuning.js';

/**
 * The "tweak it live" panel for Vue: draws the schema of a `Tuning` (groups of sliders), shows what differs from the defaults,
 * and offers "copy as code" and "reset". It owns no state: every change goes through `tuning.set`, so saving and the live object
 * stay the core's business. Written with `defineComponent` and render functions, not a `.vue` file, so plain `tsc` builds it.
 * Панель «покрутить вживую» для Vue: рисует схему `Tuning` (группы ползунков), показывает, что отличается от умолчаний,
 * и даёт «скопировать как код» и «сбросить». Своего состояния не держит: любое изменение идёт через `tuning.set`, поэтому
 * сохранение и живой объект остаются делом ядра. Написана на `defineComponent` и функциях отрисовки, а не в `.vue`, чтобы её собирал обычный `tsc`.
 */

/** Texts of the panel. Defaults are English; pass your own for another language. / Тексты панели. По умолчанию английские; передай свои для другого языка. */
export interface TuningPanelLabels {
    copy: string;
    reset: string;
    copied: string;
    copyFailed: string;
}

const DEFAULT_LABELS: TuningPanelLabels = { copy: 'Copy', reset: 'Reset', copied: 'Copied', copyFailed: 'Clipboard unavailable' };

/**
 * A value for the label next to a slider: as many decimals as the step needs, plus the unit.
 * Значение для подписи рядом с ползунком: столько знаков, сколько нужно шагу, и единица.
 */
export function formatKnobValue(value: number, step: number, unit = ''): string {
    const text = value.toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0);
    return unit ? `${text} ${unit}` : text;
}

/**
 * The look. Every colour, radius and gap is a CSS variable with a fallback, so an app restyles the panel by setting `--tbp-*`
 * anywhere above it. The fallbacks are the values of our dark theme (TaoUI), copied, not imported.
 * Вид. Каждый цвет, радиус и отступ это CSS-переменная с запасным значением, поэтому приложение перекрашивает панель, задав `--tbp-*`
 * где угодно выше неё. Запасные значения это значения нашей тёмной темы (TaoUI), скопированные, а не подключённые.
 */
const CSS = `
.tbp-panel {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: var(--tbp-space-3, 12px);
    padding: var(--tbp-space-3, 12px);
    background: var(--tbp-bg, #151515);
    border: 1px solid var(--tbp-border, rgb(51 51 51 / 0.4));
    border-radius: var(--tbp-radius, 8px);
    color: var(--tbp-text, #bfbfbf);
    font: var(--tbp-font-size, 12px) / 1.4 var(--tbp-font, system-ui, sans-serif);
}
.tbp-panel--floating {
    position: absolute;
    top: var(--tbp-space-4, 16px);
    right: var(--tbp-space-4, 16px);
    bottom: var(--tbp-space-4, 16px);
    width: 280px;
    max-height: calc(100% - 2 * var(--tbp-space-4, 16px));
}
.tbp-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: var(--tbp-space-1, 4px); }
.tbp-group + .tbp-group { margin-top: var(--tbp-space-3, 12px); }
.tbp-title { margin-bottom: var(--tbp-space-2, 8px); color: var(--tbp-text-bright, #fff); font-weight: 600; font-size: var(--tbp-font-size-title, 13px); }
.tbp-knob { display: block; margin-bottom: var(--tbp-space-2, 8px); }
.tbp-head { display: flex; justify-content: space-between; margin-bottom: var(--tbp-space-1, 4px); color: var(--tbp-text-muted, #8a8a8a); }
.tbp-value { color: var(--tbp-text-bright, #fff); font-weight: 500; font-variant-numeric: tabular-nums; }
.tbp-value--changed { color: var(--tbp-accent, #ffc04a); }
.tbp-range { display: block; width: 100%; margin: 0; accent-color: var(--tbp-accent, #ffc04a); }
.tbp-actions { display: flex; gap: var(--tbp-space-2, 8px); }
.tbp-btn {
    flex: 1;
    padding: var(--tbp-space-2, 8px) var(--tbp-space-3, 12px);
    background: var(--tbp-field, rgb(51 51 51 / 0.2));
    border: 1px solid var(--tbp-border, rgb(51 51 51 / 0.4));
    border-radius: var(--tbp-radius-sm, 4px);
    color: var(--tbp-text, #bfbfbf);
    font: inherit;
    cursor: pointer;
}
.tbp-btn:hover { background: var(--tbp-hover, #262626); color: var(--tbp-text-bright, #fff); }
.tbp-btn--primary { background: var(--tbp-accent, #ffc04a); border-color: transparent; color: var(--tbp-on-accent, #0d0d0d); font-weight: 600; }
.tbp-btn--primary:hover { background: var(--tbp-accent-hover, #ffb40b); color: var(--tbp-on-accent, #0d0d0d); }
`;

const STYLE_ID = 'tbp-styles';

/** Put the stylesheet into the page once. Does nothing without a `document` (server rendering, tests in node). / Положить стили на страницу один раз. Ничего не делает без `document` (серверная отрисовка, тесты в node). */
function ensureStyles(): void {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
}

export const TuningPanel = defineComponent({
    name: 'TbpTuningPanel',
    props: {
        /** The store to draw. May be swapped at runtime (the panel rebinds). / Хранилище, которое рисуем. Можно менять на лету (панель переподключится). */
        tuning: { type: Object as PropType<Tuning<any>>, required: true },
        /** Pin to the right edge of a positioned parent. Off: an ordinary block you place yourself. / Прижать к правому краю позиционированного родителя. Выключено: обычный блок, ставь сам. */
        floating: { type: Boolean, default: false },
        labels: { type: Object as PropType<Partial<TuningPanelLabels>>, default: () => ({}) },
        /** The name in "copy as code": `export const <name> = { … }`. / Имя в «скопировать как код»: `export const <name> = { … }`. */
        sourceName: { type: String, default: 'tuning' },
    },
    emits: {
        /** After every change and reset made through the panel or anywhere else through the same store. / После каждого изменения и сброса, из панели или откуда угодно через то же хранилище. */
        change: () => true,
    },
    setup(props, { emit, slots }) {
        ensureStyles();

        // The store's values are a plain object, not reactive: bump a counter to redraw after the store says it changed.
        // Значения хранилища это обычный объект, не реактивный: после оповещения хранилища увеличиваем счётчик, чтобы перерисоваться.
        const version = shallowRef(0);
        const copyState = shallowRef<'idle' | 'copied' | 'failed'>('idle');
        let unsubscribe: () => void = () => {};
        let timer: ReturnType<typeof setTimeout> | undefined;

        watch(
            () => props.tuning,
            (tuning) => {
                unsubscribe();
                unsubscribe = tuning.subscribe(() => {
                    version.value++;
                    emit('change');
                });
                version.value++;
            },
            { immediate: true },
        );
        onBeforeUnmount(() => {
            unsubscribe();
            clearTimeout(timer);
        });

        async function copy(): Promise<void> {
            try {
                await navigator.clipboard.writeText(props.tuning.toSource(props.sourceName));
                copyState.value = 'copied';
            } catch {
                copyState.value = 'failed';
            }
            clearTimeout(timer);
            timer = setTimeout(() => (copyState.value = 'idle'), 1600);
        }

        return () => {
            void version.value;
            const { tuning } = props;
            const labels = { ...DEFAULT_LABELS, ...props.labels };
            const copyLabel = copyState.value === 'copied' ? labels.copied : copyState.value === 'failed' ? labels.copyFailed : labels.copy;

            const groups: VNode[] = tuning.groups.map((group) =>
                h('section', { class: 'tbp-group', key: group.title }, [
                    h('div', { class: 'tbp-title' }, group.title),
                    ...group.knobs.map((knob) => {
                        const value = tuning.values[knob.key] as number;
                        const changed = value !== tuning.defaults[knob.key];
                        return h('label', { class: 'tbp-knob', key: knob.key }, [
                            h('span', { class: 'tbp-head' }, [
                                h('span', knob.label),
                                h('b', { class: ['tbp-value', { 'tbp-value--changed': changed }] }, formatKnobValue(value, knob.step, knob.unit)),
                            ]),
                            h('input', {
                                class: 'tbp-range',
                                type: 'range',
                                min: knob.min,
                                max: knob.max,
                                step: knob.step,
                                value,
                                'aria-label': knob.label,
                                onInput: (event: Event) => tuning.set(knob.key, Number((event.target as HTMLInputElement).value)),
                            }),
                        ]);
                    }),
                ]),
            );

            return h('div', { class: ['tbp-panel', { 'tbp-panel--floating': props.floating }] }, [
                h('div', { class: 'tbp-scroll' }, [slots.before?.(), ...groups]),
                h('div', { class: 'tbp-actions' }, [
                    h('button', { class: 'tbp-btn tbp-btn--primary', type: 'button', onClick: copy }, copyLabel),
                    h('button', { class: 'tbp-btn', type: 'button', onClick: () => tuning.reset() }, labels.reset),
                ]),
            ]);
        };
    },
});
