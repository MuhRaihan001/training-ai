"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const MAX_NODES = 16;
const WIDTH = 960;
const X_FIRST = 190;
const X_LAST = WIDTH - 210;
const TOP = 64;
const GAP = 34;
const RADIUS = 11;
const TOOLTIP_WIDTH = 256;

const ACTIVATION_NAMES = {
    relu: "ReLU",
    sigmoid: "Sigmoid",
    softmax: "Softmax",
    linear: "Linear",
    softplus: "Softplus",
};
const PROBABILITY = new Set(["softmax", "sigmoid"]);

const SPEEDS = [
    { id: "slow", label: "Slow", delay: 900 },
    { id: "normal", label: "Normal", delay: 450 },
    { id: "fast", label: "Fast", delay: 140 },
];

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

const btn =
    "inline-flex h-11 items-center justify-center rounded-md border border-stone-500 bg-white px-5 " +
    "text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 " +
    "disabled:cursor-not-allowed disabled:text-stone-400 motion-reduce:transition-none";

const btnPrimary =
    "inline-flex h-11 items-center justify-center rounded-md bg-orange-700 px-5 " +
    "text-sm font-medium text-white transition-colors hover:bg-orange-800 active:bg-orange-900 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 motion-reduce:transition-none";

function shorten(text, max) {
    const value = String(text);
    return value.length > max ? value.slice(0, max - 1) + "…" : value;
}

// If there are too many neurons, show only the ones with the largest values.
function pickIndices(values, max) {
    const all = values.map((_, i) => i);
    if (all.length <= max) return all;
    return all
        .sort((a, b) => Math.abs(values[b]) - Math.abs(values[a]))
        .slice(0, max)
        .sort((a, b) => a - b);
}

function valueText(layer, v) {
    return PROBABILITY.has(layer.activation) ? percent.format(v) : number.format(v);
}

function buildView(data) {
    const count = data.layers.length;

    const layers = data.layers.map((layer, l) => {
        const shown = pickIndices(layer.values, MAX_NODES);
        const peak = Math.max(...layer.values.map(Math.abs)) || 1;
        const title =
            l === 0
                ? "Input layer"
                : l === count - 1
                    ? "Output layer"
                    : `Hidden layer ${l}`;
        return { ...layer, shown, peak, title };
    });

    // Step order: neuron by neuron, layer by layer (excluding the input layer).
    const steps = [];
    const offsets = [];
    layers.forEach((layer, l) => {
        offsets[l] = steps.length;
        if (l === 0) return;
        layer.shown.forEach((index, pos) => steps.push({ l, index, pos }));
    });

    const maxShown = Math.max(...layers.map((layer) => layer.shown.length));
    const height = TOP + (maxShown - 1) * GAP + 44;
    const midY = TOP + ((maxShown - 1) * GAP) / 2;
    const xs = layers.map(
        (_, l) => X_FIRST + (l * (X_LAST - X_FIRST)) / Math.max(1, count - 1)
    );
    const ys = layers.map((layer) =>
        layer.shown.map((_, pos) => midY + (pos - (layer.shown.length - 1) / 2) * GAP)
    );

    return { layers, steps, offsets, height, xs, ys };
}

export default function NetworkVisualizer({ data, result, onDone }) {
    const view = useMemo(() => buildView(data), [data]);
    const { layers, steps, offsets, height, xs, ys } = view;
    const total = steps.length;
    const last = layers.length - 1;
    const outputLayer = layers[last];

    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(
        () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
    const [speed, setSpeed] = useState("normal");
    const boxRef = useRef(null);
    const [hover, setHover] = useState(null);

    const finished = step >= total;
    const delay = SPEEDS.find((s) => s.id === speed).delay;

    useEffect(() => {
        if (!playing || finished) return;
        const timer = setTimeout(() => setStep((s) => s + 1), delay);
        return () => clearTimeout(timer);
    }, [playing, finished, step, delay]);

    useEffect(() => {
        if (finished) onDone?.();
    }, [finished, onDone]);

    const winner =
        outputLayer.values.length > 1
            ? outputLayer.values.indexOf(Math.max(...outputLayer.values))
            : 0;

    // Neuron tooltip: positioned relative to the diagram box, clamped so it doesn't overflow the edges.
    function show(l, pos, el) {
        const box = boxRef.current;
        if (!box) return;

        const b = box.getBoundingClientRect();
        const n = el.getBoundingClientRect();
        const half = TOOLTIP_WIDTH / 2;
        const x = n.left + n.width / 2 - b.left;

        setHover({
            l,
            pos,
            left: Math.min(Math.max(x, half), Math.max(half, b.width - half)),
            top: n.top - b.top,
            bottom: n.bottom - b.top,
            below: n.top - b.top < 230,
        });
    }

    function hide() {
        setHover(null);
    }

    function describeNeuron(l, pos) {
        const layer = layers[l];
        const index = layer.shown[pos];

        if (l === 0) {
            return {
                title: layer.labels[index],
                subtitle: `${layer.title}, feature ${index + 1}`,
                rows: [
                    ["Original value", number.format(layer.raw[index])],
                    ["After standardization", number.format(layer.values[index])],
                ],
                top: null,
            };
        }

        const title = l === last ? data.outputLabels[index] : `Neuron ${index + 1}`;
        const subtitle = layer.title;

        if (offsets[l] + pos >= step) {
            return { title, subtitle, rows: [["Status", "Not yet calculated"]], top: null };
        }

        const prev = layers[l - 1];
        const name = ACTIVATION_NAMES[layer.activation] ?? layer.activation;
        const top = prev.values
            .map((v, i) => ({ i, v, w: layer.weights[i][index], c: v * layer.weights[i][index] }))
            .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
            .slice(0, 3)
            .map((t) => ({
                key: t.i,
                label: l === 1 ? prev.labels[t.i] : `Neuron ${t.i + 1}`,
                text: `${number.format(t.v)} × ${number.format(t.w)} = ${number.format(t.c)}`,
            }));

        return {
            title,
            subtitle,
            rows: [
                ["Bias", number.format(layer.biases[index])],
                ["Weighted sum + bias", number.format(layer.pre[index])],
                [`${name} activation`, valueText(layer, layer.values[index])],
            ],
            top,
        };
    }

    const tip = hover ? describeNeuron(hover.l, hover.pos) : null;

    // Edges between neurons: the one being computed (or hovered) is drawn last (on top).
    const edges = [];
    for (let l = 1; l < layers.length; l++) {
        const prev = layers[l - 1];
        const layer = layers[l];

        layer.shown.forEach((nj, pos) => {
            const idx = offsets[l] + pos;
            const hovered = hover?.l === l && hover?.pos === pos;
            const state =
                idx === step - 1 || (hovered && idx < step)
                    ? "active"
                    : idx < step
                        ? "done"
                        : "idle";
            const contribs = prev.shown.map((ni) => prev.values[ni] * layer.weights[ni][nj]);
            const cmax = Math.max(...contribs.map(Math.abs)) || 1;

            prev.shown.forEach((_, pi) => {
                edges.push({
                    key: `${l}-${pos}-${pi}`,
                    x1: xs[l - 1],
                    y1: ys[l - 1][pi],
                    x2: xs[l],
                    y2: ys[l][pos],
                    state,
                    c: contribs[pi],
                    w: Math.abs(contribs[pi]) / cmax,
                });
            });
        });
    }
    edges.sort((a, b) => (a.state === "active") - (b.state === "active"));

    function edgeStyle(e) {
        if (e.state === "active") {
            return {
                stroke: e.c >= 0 ? "#c2410c" : "#44403c",
                strokeWidth: 1 + 2.5 * e.w,
                strokeOpacity: 0.3 + 0.7 * e.w,
                strokeDasharray: e.c < 0 ? "5 3" : undefined,
            };
        }
        if (e.state === "done") {
            return { stroke: "#78716c", strokeWidth: 0.8, strokeOpacity: 0.4 };
        }
        return { stroke: "#d6d3d1", strokeWidth: 0.8, strokeOpacity: 0.5 };
    }

    // Explanation text for the current step.
    let narration;
    if (step === 0) {
        narration =
            "The feature values have been standardized and fed into the input layer. Press Play or Step to start the calculation.";
    } else if (finished) {
        if (outputLayer.values.length > 1) {
            narration = `All layers have been calculated. The output neuron "${data.outputLabels[winner]}" has the highest value (${valueText(outputLayer, outputLayer.values[winner])}), so the model's decision is ${result?.label ?? data.outputLabels[winner]}.`;
        } else if (result?.label !== undefined) {
            narration = `All layers have been calculated. The output neuron's value is ${valueText(outputLayer, outputLayer.values[0])}, so the model decides on class ${result.label}.`;
        } else {
            narration = `All layers have been calculated. The output neuron's value is ${number.format(outputLayer.values[0])}, which is the model's predicted value.`;
        }
    } else {
        const cur = steps[step - 1];
        const layer = layers[cur.l];
        const name = ACTIVATION_NAMES[layer.activation] ?? layer.activation;
        const who =
            cur.l === last
                ? `output neuron "${data.outputLabels[cur.index]}"`
                : `neuron ${cur.index + 1}`;
        const z = layer.pre[cur.index];
        const off =
            layer.activation === "relu" && z <= 0
                ? " The result is 0, so this neuron does not fire."
                : "";
        narration = `${layer.title}, ${who}: the weighted sum of inputs plus bias is ${number.format(z)}. The ${name} activation produces ${valueText(layer, layer.values[cur.index])}.${off}`;
    }

    const truncated = layers.some((layer) => layer.shown.length < layer.values.length);

    function togglePlay() {
        if (finished) {
            setStep(0);
            setPlaying(true);
        } else {
            setPlaying((p) => !p);
        }
    }

    return (
        <section aria-labelledby="group-network" className="mt-10">
            <h2
                id="group-network"
                className="border-b border-stone-900 pb-2 text-sm font-semibold"
            >
                Decision-making process
            </h2>

            <div className="py-5">
                <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-700">
                    <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-6" style={{ borderTop: "3px solid #c2410c" }} />
                        Positive push
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-6" style={{ borderTop: "3px dashed #44403c" }} />
                        Negative push
                    </span>
                    <span className="inline-flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full border border-stone-600 bg-stone-800" />
                        Darker means stronger
                    </span>
                </div>

                <div ref={boxRef} className="relative">
                    <div
                        role="region"
                        tabIndex={0}
                        onScroll={hide}
                        aria-label="Scrollable neural network diagram"
                        className="overflow-x-auto rounded-md border border-stone-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
                    >
                        <svg
                            viewBox={`0 0 ${WIDTH} ${height}`}
                            role="group"
                            onClick={hide}
                            aria-label={`Neural network diagram with ${layers.length} layers. The step-by-step explanation is in the text below the diagram.`}
                            className="w-full min-w-[720px]"
                            xmlns="http://www.w3.org/2000/svg"
                            fontFamily="system-ui, sans-serif"
                        >
                            {layers.map((layer, l) => {
                                const units = layer.values.length;
                                const name = ACTIVATION_NAMES[layer.activation] ?? layer.activation;
                                let subtitle = l === 0 ? `${units} features` : `${units} neurons, ${name}`;
                                if (layer.shown.length < units) subtitle += `, ${layer.shown.length} shown`;

                                return (
                                    <g key={`title-${l}`}>
                                        <text x={xs[l]} y={22} textAnchor="middle" fontSize="13" fontWeight="600" fill="#1c1917">
                                            {layer.title}
                                        </text>
                                        <text x={xs[l]} y={39} textAnchor="middle" fontSize="11" fill="#57534e">
                                            {subtitle}
                                        </text>
                                    </g>
                                );
                            })}

                            {edges.map((e) => (
                                <line
                                    key={e.key}
                                    x1={e.x1}
                                    y1={e.y1}
                                    x2={e.x2}
                                    y2={e.y2}
                                    strokeLinecap="round"
                                    className="transition-[stroke-opacity] duration-300 motion-reduce:transition-none"
                                    {...edgeStyle(e)}
                                />
                            ))}

                            {layers.map((layer, l) =>
                                layer.shown.map((index, pos) => {
                                    const idx = offsets[l] + pos;
                                    const computed = l === 0 || idx < step;
                                    const active = l > 0 && idx === step - 1;
                                    const isWinner = finished && l === last && index === winner;
                                    const strength = computed
                                        ? Math.min(1, Math.abs(layer.values[index]) / layer.peak)
                                        : 0;
                                    const cx = xs[l];
                                    const cy = ys[l][pos];
                                    const hovered = hover?.l === l && hover?.pos === pos;
                                    const nodeName =
                                        l === 0
                                            ? layer.labels[index]
                                            : l === last
                                                ? data.outputLabels[index]
                                                : `neuron ${index + 1}`;

                                    return (
                                        <g
                                            key={`node-${l}-${pos}`}
                                            tabIndex={0}
                                            role="graphics-symbol"
                                            aria-label={`${layer.title}, ${nodeName}`}
                                            className="cursor-pointer outline-none"
                                            onPointerEnter={(e) =>
                                                e.pointerType === "mouse" && show(l, pos, e.currentTarget)
                                            }
                                            onPointerLeave={(e) => e.pointerType === "mouse" && hide()}
                                            onFocus={(e) => show(l, pos, e.currentTarget)}
                                            onBlur={hide}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                show(l, pos, e.currentTarget);
                                            }}
                                        >
                                            <circle cx={cx} cy={cy} r={RADIUS} fill="#ffffff" />
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={RADIUS}
                                                fill={isWinner ? "#c2410c" : "#292524"}
                                                fillOpacity={isWinner ? 1 : computed ? 0.08 + 0.92 * strength : 0}
                                                stroke={
                                                    active || isWinner
                                                        ? "#c2410c"
                                                        : hovered
                                                            ? "#1c1917"
                                                            : computed
                                                                ? "#44403c"
                                                                : "#a8a29e"
                                                }
                                                strokeWidth={active || isWinner ? 3 : hovered ? 2.5 : 1.5}
                                                className="transition-[fill-opacity] duration-300 motion-reduce:transition-none"
                                            />

                                            {l === 0 && (
                                                <g>
                                                    <text x={cx - RADIUS - 10} y={cy - 2} textAnchor="end" fontSize="12" fill="#1c1917">
                                                        {shorten(layer.labels[index], 20)}
                                                    </text>
                                                    <text x={cx - RADIUS - 10} y={cy + 11} textAnchor="end" fontSize="11" fill="#57534e" fontFamily="ui-monospace, monospace">
                                                        {number.format(layer.raw[index])}
                                                    </text>
                                                </g>
                                            )}

                                            {l === last && computed && (
                                                <g>
                                                    <text
                                                        x={cx + RADIUS + 10}
                                                        y={cy - 2}
                                                        fontSize="12"
                                                        fontWeight={isWinner ? 700 : 400}
                                                        fill={isWinner ? "#9a3412" : "#1c1917"}
                                                    >
                                                        {shorten(data.outputLabels[index], 22)}
                                                    </text>
                                                    <text
                                                        x={cx + RADIUS + 10}
                                                        y={cy + 11}
                                                        fontSize="11"
                                                        fill={isWinner ? "#9a3412" : "#57534e"}
                                                        fontFamily="ui-monospace, monospace"
                                                    >
                                                        {valueText(layer, layer.values[index])}
                                                    </text>
                                                </g>
                                            )}
                                        </g>
                                    );
                                })
                            )}
                        </svg>
                    </div>

                    {tip && (
                        <div
                            role="tooltip"
                            className="pointer-events-none absolute z-20 rounded-md border border-stone-400 bg-white p-3 text-xs text-stone-800 shadow-md"
                            style={{
                                width: TOOLTIP_WIDTH,
                                left: hover.left,
                                top: hover.below ? hover.bottom + 8 : hover.top - 8,
                                transform: hover.below ? "translateX(-50%)" : "translate(-50%, -100%)",
                            }}
                        >
                            <p className="text-sm font-semibold text-stone-900">{tip.title}</p>
                            <p className="text-stone-600">{tip.subtitle}</p>

                            <dl className="mt-2 space-y-1">
                                {tip.rows.map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-3">
                                        <dt className="text-stone-600">{label}</dt>
                                        <dd className="font-mono tabular-nums text-stone-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>

                            {tip.top && (
                                <div className="mt-2 border-t border-stone-200 pt-2">
                                    <p className="font-medium text-stone-900">Strongest inputs</p>
                                    <ul className="mt-1 space-y-1">
                                        {tip.top.map((t) => (
                                            <li key={t.key}>
                                                <span className="text-stone-600">{t.label}</span>
                                                <span className="block font-mono tabular-nums">{t.text}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {truncated && (
                    <p className="mt-2 text-sm text-stone-600">
                        Layers with more than {MAX_NODES} neurons only show the {MAX_NODES} neurons with the largest values. The calculation still uses all neurons.
                    </p>
                )}

                <p
                    role="status"
                    aria-live="polite"
                    className={
                        "mt-4 border-l-4 bg-white py-2 pl-3 pr-2 text-sm text-stone-800 " +
                        (finished ? "border-orange-700" : "border-stone-400")
                    }
                >
                    {narration}
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <button type="button" onClick={togglePlay} className={btnPrimary}>
                        {finished ? "Replay" : playing ? "Pause" : "Play"}
                    </button>

                    <button
                        type="button"
                        disabled={finished}
                        onClick={() => {
                            setPlaying(false);
                            setStep((s) => Math.min(total, s + 1));
                        }}
                        className={btn}
                    >
                        Step
                    </button>

                    <button
                        type="button"
                        disabled={finished}
                        onClick={() => {
                            setPlaying(false);
                            setStep(total);
                        }}
                        className={btn}
                    >
                        Skip
                    </button>

                    <div
                        role="group"
                        aria-label="Animation speed"
                        className="inline-flex overflow-hidden rounded-md border border-stone-500 bg-white"
                    >
                        {SPEEDS.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                aria-pressed={speed === s.id}
                                onClick={() => setSpeed(s.id)}
                                className={
                                    "h-11 px-4 text-sm font-medium transition-colors motion-reduce:transition-none " +
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700 " +
                                    (speed === s.id
                                        ? "bg-stone-900 text-white"
                                        : "text-stone-900 hover:bg-stone-100")
                                }
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    <p className="text-sm tabular-nums text-stone-600 sm:ml-auto">
                        Step {step} of {total}
                    </p>
                </div>
            </div>
        </section>
    );
}