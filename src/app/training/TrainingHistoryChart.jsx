"use client";

import { useMemo, useRef, useState } from "react";
import { accuracyOf } from "@/utils/insight";
import { maeOf } from "@/utils/evaluation";
import { fmt, fmtPercent } from "./ui";

const W = 640;
const H = 300;
const M = { l: 56, r: 16, t: 16, b: 44 };

export const CHART_KINDS = {
    loss: {
        title: "Loss",
        series: [
            { key: "train", label: "Training loss", stroke: "#C2410C", dash: undefined, get: (h) => h.loss },
            { key: "val", label: "Validation loss", stroke: "#44403C", dash: "6 4", get: (h) => h.val_loss },
        ],
        format: fmt,
    },
    accuracy: {
        title: "Accuracy",
        series: [
            { key: "train", label: "Training accuracy", stroke: "#C2410C", dash: undefined, get: (h) => accuracyOf(h) },
            { key: "val", label: "Validation accuracy", stroke: "#44403C", dash: "6 4", get: (h) => accuracyOf(h, true) },
        ],
        format: (v) => `${Math.round(v * 100)}%`,
        tip: fmtPercent,
        range: [0, 1],
    },
    mae: {
        title: "Mean absolute error (MAE)",
        series: [
            { key: "train", label: "Training MAE", stroke: "#C2410C", dash: undefined, get: (h) => maeOf(h) },
            { key: "val", label: "Validation MAE", stroke: "#44403C", dash: "6 4", get: (h) => maeOf(h, true) },
        ],
        format: fmt,
    },
};

export function hasMetric(history, kind) {
    return history.some((h) => CHART_KINDS[kind].series.some((s) => Number.isFinite(s.get(h))));
}

export default function TrainingHistoryChart({ history, marks = {}, kind = "loss" }) {
    const [active, setActive] = useState(null);
    const svgRef = useRef(null);
    const spec = CHART_KINDS[kind];

    const model = useMemo(() => {
        const n = history.length;
        const series = spec.series.filter((s) => history.some((h) => Number.isFinite(s.get(h))));
        const all = series.flatMap((s) => history.map((h) => s.get(h)).filter(Number.isFinite));
        if (!n || !all.length) return null;

        const max = spec.range ? spec.range[1] : Math.max(...all);
        const min = spec.range ? spec.range[0] : Math.min(0, ...all);
        const pw = W - M.l - M.r;
        const ph = H - M.t - M.b;
        const x = (i) => M.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
        const y = (v) => M.t + ph - ((v - min) / (max - min || 1)) * ph;

        const lines = series.map((s) => ({
            ...s,
            points: history
                .map((h, i) => (Number.isFinite(s.get(h)) ? `${x(i)},${y(s.get(h))}` : null))
                .filter(Boolean)
                .join(" "),
        }));
        const yTicks = Array.from({ length: 5 }, (_, t) => min + ((max - min) * t) / 4);
        const xTicks = [...new Set(Array.from({ length: 5 }, (_, t) => Math.round(((n - 1) * t) / 4)))];

        return { n, lines, yTicks, xTicks, pw, ph, x, y };
    }, [history, spec]);

    if (!model) {
        return (
            <p className="rounded-md border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                No {spec.title.toLowerCase()} values were recorded, so there is nothing to plot.
            </p>
        );
    }

    const { n, lines, yTicks, xTicks, pw, ph, x, y } = model;
    const tipFormat = spec.tip ?? spec.format;

    function indexFromPointer(e) {
        const rect = svgRef.current.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * W;
        const i = Math.round(((px - M.l) / pw) * (n - 1));
        return Math.min(n - 1, Math.max(0, i));
    }

    function handleKeyDown(e) {
        const from = active ?? (e.key === "ArrowLeft" ? n : -1);
        if (e.key === "ArrowRight") setActive(Math.min(n - 1, from + 1));
        else if (e.key === "ArrowLeft") setActive(Math.max(0, from - 1));
        else if (e.key === "Home") setActive(0);
        else if (e.key === "End") setActive(n - 1);
        else if (e.key === "Escape") setActive(null);
        else return;
        e.preventDefault();
    }

    const entry = active != null ? history[active] : null;
    const pct = active != null ? (x(active) / W) * 100 : 0;

    let tipRows = [];
    if (entry) {
        tipRows = lines.map((s) => [s.label, tipFormat(s.get(entry))]);
        if (kind === "loss") {
            tipRows.push(["Training accuracy", fmtPercent(accuracyOf(entry))]);
            tipRows.push(["Validation accuracy", fmtPercent(accuracyOf(entry, true))]);
        }
        tipRows = tipRows.filter(([, v]) => v && v !== "-");
    }

    const markList = [
        ["slowdown", "Slows down"],
        ["best", "Best validation"],
    ].filter(([k]) => marks[k] !== undefined && marks[k] < n);

    return (
        <div>
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-700">
                {lines.map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-2">
                        <span
                            aria-hidden="true"
                            className="inline-block w-6"
                            style={{ borderTop: `3px ${s.dash ? "dashed" : "solid"} ${s.stroke}` }}
                        />
                        {s.label}
                    </span>
                ))}
            </div>

            <div
                role="group"
                tabIndex={0}
                aria-label={`${spec.title} per epoch chart. Use the left and right arrow keys to inspect each epoch. All values are also listed in the epoch details table.`}
                onKeyDown={handleKeyDown}
                onBlur={() => setActive(null)}
                className="overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
            >
                <div className="relative min-w-[520px]">
                    <svg
                        ref={svgRef}
                        viewBox={`0 0 ${W} ${H}`}
                        aria-hidden="true"
                        className="block w-full"
                        fontFamily="system-ui, sans-serif"
                        onPointerMove={(e) => setActive(indexFromPointer(e))}
                        onPointerLeave={() => setActive(null)}
                    >
                        {yTicks.map((v) => (
                            <g key={v}>
                                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#E7E5E4" />
                                <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#57534E">
                                    {spec.format(v)}
                                </text>
                            </g>
                        ))}
                        {xTicks.map((i) => (
                            <text key={i} x={x(i)} y={H - 24} textAnchor="middle" fontSize="11" fill="#57534E">
                                {history[i].epoch ?? i + 1}
                            </text>
                        ))}
                        <text x={M.l + pw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#57534E">
                            Epoch
                        </text>
                        <text
                            transform={`translate(14 ${M.t + ph / 2}) rotate(-90)`}
                            textAnchor="middle"
                            fontSize="11"
                            fill="#57534E"
                        >
                            {kind === "mae" ? "MAE" : spec.title}
                        </text>

                        {markList.map(([key, label], k) => {
                            const px = x(marks[key]);
                            const right = px > W * 0.7;
                            return (
                                <g key={key}>
                                    <line x1={px} x2={px} y1={M.t} y2={M.t + ph} stroke="#A8A29E" strokeDasharray="2 3" />
                                    <text
                                        x={right ? px - 4 : px + 4}
                                        y={M.t + 12 + k * 14}
                                        textAnchor={right ? "end" : "start"}
                                        fontSize="11"
                                        fill="#57534E"
                                    >
                                        {label} ({(history[marks[key]].epoch ?? marks[key] + 1)})
                                    </text>
                                </g>
                            );
                        })}

                        {lines.map((s) => (
                            <polyline
                                key={s.key}
                                points={s.points}
                                fill="none"
                                stroke={s.stroke}
                                strokeWidth="2"
                                strokeDasharray={s.dash}
                                strokeLinejoin="round"
                            />
                        ))}

                        {n === 1 &&
                            lines.map((s) => (
                                <circle key={s.key} cx={x(0)} cy={y(s.get(history[0]))} r="3.5" fill={s.stroke} />
                            ))}

                        {entry && (
                            <g>
                                <line x1={x(active)} x2={x(active)} y1={M.t} y2={M.t + ph} stroke="#78716C" />
                                {lines.map(
                                    (s) =>
                                        Number.isFinite(s.get(entry)) && (
                                            <circle
                                                key={s.key}
                                                cx={x(active)}
                                                cy={y(s.get(entry))}
                                                r="4"
                                                fill="#FFFFFF"
                                                stroke={s.stroke}
                                                strokeWidth="2"
                                            />
                                        )
                                )}
                            </g>
                        )}
                    </svg>

                    {entry && (
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute top-2 z-10 w-44 rounded-md border border-stone-300 bg-white p-2 text-xs shadow-sm"
                            style={{
                                left: `${pct}%`,
                                transform: pct > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
                            }}
                        >
                            <p className="font-medium text-stone-900">Epoch {entry.epoch ?? active + 1}</p>
                            <dl className="mt-1 space-y-0.5">
                                {tipRows.map(([label, value]) => (
                                    <div key={label} className="flex justify-between gap-3">
                                        <dt className="text-stone-500">{label}</dt>
                                        <dd className="font-mono tabular-nums text-stone-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </div>
            </div>

            <p role="status" aria-live="polite" className="sr-only">
                {entry
                    ? `Epoch ${entry.epoch ?? active + 1}: ${tipRows.map(([l, v]) => `${l} ${v}`).join(", ")}`
                    : ""}
            </p>
        </div>
    );
}