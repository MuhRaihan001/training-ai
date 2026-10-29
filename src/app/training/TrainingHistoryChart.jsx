"use client";

import { useMemo, useRef, useState } from "react";
import { accuracyOf } from "@/utils/insight";
import { fmt, fmtPercent } from "./ui";

const W = 640;
const H = 300;
const M = { l: 56, r: 16, t: 16, b: 44 };

const SERIES = [
    { key: "loss", label: "Training loss", stroke: "#C2410C", dash: undefined },
    { key: "val_loss", label: "Validation loss", stroke: "#44403C", dash: "6 4" },
];

export default function TrainingHistoryChart({ history, marks = {} }) {
    const [active, setActive] = useState(null);
    const svgRef = useRef(null);

    const model = useMemo(() => {
        const n = history.length;
        const series = SERIES.filter((s) => history.some((h) => Number.isFinite(h[s.key])));
        const all = series.flatMap((s) => history.map((h) => h[s.key]).filter(Number.isFinite));
        if (!n || !all.length) return null;

        const max = Math.max(...all);
        const min = Math.min(0, ...all);
        const pw = W - M.l - M.r;
        const ph = H - M.t - M.b;
        const x = (i) => M.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
        const y = (v) => M.t + ph - ((v - min) / (max - min || 1)) * ph;

        const lines = series.map((s) => ({
            ...s,
            points: history
                .map((h, i) => (Number.isFinite(h[s.key]) ? `${x(i)},${y(h[s.key])}` : null))
                .filter(Boolean)
                .join(" "),
        }));
        const yTicks = Array.from({ length: 5 }, (_, t) => min + ((max - min) * t) / 4);
        const xTicks = [...new Set(Array.from({ length: 5 }, (_, t) => Math.round(((n - 1) * t) / 4)))];

        return { n, lines, yTicks, xTicks, pw, ph, x, y };
    }, [history]);

    if (!model) {
        return (
            <p className="rounded-md border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                No loss values were recorded, so there is nothing to plot.
            </p>
        );
    }

    const { n, lines, yTicks, xTicks, pw, ph, x, y } = model;

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
    const tipRows = entry
        ? [
              ...lines.map((s) => [s.label, fmt(entry[s.key])]),
              ["Training accuracy", fmtPercent(accuracyOf(entry))],
              ["Validation accuracy", fmtPercent(accuracyOf(entry, true))],
          ].filter(([, v]) => v && v !== "-")
        : [];

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
                aria-label="Loss per epoch chart. Use the left and right arrow keys to inspect each epoch. All values are also listed in the epoch details table."
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
                                    {fmt(v)}
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
                            Loss
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
                                <circle key={s.key} cx={x(0)} cy={y(history[0][s.key])} r="3.5" fill={s.stroke} />
                            ))}

                        {entry && (
                            <g>
                                <line x1={x(active)} x2={x(active)} y1={M.t} y2={M.t + ph} stroke="#78716C" />
                                {lines.map(
                                    (s) =>
                                        Number.isFinite(entry[s.key]) && (
                                            <circle
                                                key={s.key}
                                                cx={x(active)}
                                                cy={y(entry[s.key])}
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
