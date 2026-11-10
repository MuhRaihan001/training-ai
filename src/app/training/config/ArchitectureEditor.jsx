"use client";

import { HIDDEN_ACTIVATIONS, MAX_HIDDEN_LAYERS, MAX_UNITS } from "@/utils/model/architecture";
import { btnSecondary, btnText, controlClass } from "@/app/training/shared/ui";

const MAX_DOTS = 8;
const W = 560;
const H = 184;

function NetworkPreview({ layers, inputs, outputs }) {
    const sizes = [inputs ?? 4, ...layers.map((layer) => layer.units), outputs];
    const names = ["Input", ...layers.map((_, i) => `Hidden ${i + 1}`), "Output"];
    const counts = [inputs ?? "?", ...layers.map((layer) => layer.units), outputs];

    const xs = sizes.map((_, i) => 44 + (i * (W - 88)) / Math.max(1, sizes.length - 1));
    const shown = sizes.map((size) => Math.min(size, MAX_DOTS));
    const ys = shown.map((count) =>
        Array.from({ length: count }, (_, k) => 78 + (k - (count - 1) / 2) * 16)
    );

    const lines = [];
    for (let l = 1; l < sizes.length; l++) {
        ys[l - 1].forEach((y1, a) =>
            ys[l].forEach((y2, b) =>
                lines.push(<line key={`${l}-${a}-${b}`} x1={xs[l - 1]} y1={y1} x2={xs[l]} y2={y2} stroke="#d6d3d1" strokeWidth="0.7" />)
            )
        );
    }

    const description = `Network preview: input ${counts[0]}, hidden layers ${layers
        .map((layer) => layer.units)
        .join(", ")}, output ${outputs}.`;

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={description}
            className="mt-3 block w-full max-w-xl"
            fontFamily="system-ui, sans-serif"
        >
            {lines}
            {ys.map((column, l) =>
                column.map((y, k) => (
                    <circle
                        key={`${l}-${k}`}
                        cx={xs[l]}
                        cy={y}
                        r="5.5"
                        fill={l === 0 || l === sizes.length - 1 ? "#292524" : "#ffffff"}
                        stroke="#44403c"
                        strokeWidth="1.2"
                    />
                ))
            )}
            {sizes.map((size, l) => (
                <g key={`label-${l}`}>
                    {size > MAX_DOTS && (
                        <text x={xs[l]} y={152} textAnchor="middle" fontSize="10" fill="#57534e">
                            +{size - MAX_DOTS}
                        </text>
                    )}
                    <text x={xs[l]} y={167} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1c1917">
                        {names[l]}
                    </text>
                    <text x={xs[l]} y={179} textAnchor="middle" fontSize="10" fill="#57534e">
                        {counts[l]}
                    </text>
                </g>
            ))}
        </svg>
    );
}

export default function ArchitectureEditor({ layers, onChange, inputs, outputs }) {
    const update = (index, patch) =>
        onChange(layers.map((layer, i) => (i === index ? { ...layer, ...patch } : layer)));

    return (
        <div>
            <ul className="divide-y divide-stone-200 rounded-md border border-stone-200 bg-white px-3">
                {layers.map((layer, i) => (
                    <li
                        key={i}
                        className="grid gap-3 py-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_9rem_auto] sm:items-center"
                    >
                        <span className="text-sm font-medium text-stone-900">Layer {i + 1}</span>

                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min="1"
                                max={MAX_UNITS}
                                step="1"
                                value={layer.units}
                                onChange={(e) => update(i, { units: Number(e.target.value) })}
                                aria-label={`Neurons in hidden layer ${i + 1}`}
                                className="h-10 min-w-0 flex-1 accent-orange-700"
                            />
                            <output className="w-20 shrink-0 font-mono text-sm tabular-nums text-stone-900">
                                {layer.units} {layer.units === 1 ? "neuron" : "neurons"}
                            </output>
                        </div>

                        <select
                            value={layer.activation}
                            onChange={(e) => update(i, { activation: e.target.value })}
                            aria-label={`Activation of hidden layer ${i + 1}`}
                            className={controlClass}
                        >
                            {HIDDEN_ACTIVATIONS.map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => onChange(layers.filter((_, k) => k !== i))}
                            disabled={layers.length <= 1}
                            aria-label={`Remove hidden layer ${i + 1}`}
                            className={btnText}
                        >
                            Remove
                        </button>
                    </li>
                ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => onChange([...layers, { units: 8, activation: "relu" }])}
                    disabled={layers.length >= MAX_HIDDEN_LAYERS}
                    className={btnSecondary}
                >
                    Add layer
                </button>
                <p className="text-xs text-stone-500">
                    Up to {MAX_HIDDEN_LAYERS} hidden layers. The output layer is set automatically from the loss function.
                </p>
            </div>

            <NetworkPreview layers={layers} inputs={inputs} outputs={outputs} />
        </div>
    );
}
