"use client";

import { fmt } from "./ui";

const W = 640;
const H = 300;
const M = { l: 56, r: 16, t: 16, b: 44 };

const STYLES = [
    { stroke: "#C2410C", dash: undefined },
    { stroke: "#1D4ED8", dash: "6 4" },
    { stroke: "#15803D", dash: "2 3" },
    { stroke: "#7E22CE", dash: "10 3 2 3" },
    { stroke: "#B45309", dash: "1 4" },
    { stroke: "#0F766E", dash: "12 4" },
];

export default function CompareChart({ series, title }) {
    const lines = series.filter((s) => s.values.some(Number.isFinite));
    const all = lines.flatMap((s) => s.values.filter(Number.isFinite));

    if (lines.length === 0 || all.length === 0) {
        return (
            <p className="rounded-md border border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                Nothing to plot. Select at least one run that has this kind of loss recorded.
            </p>
        );
    }

    const n = Math.max(...lines.map((s) => s.values.length));
    const max = Math.max(...all);
    const min = Math.min(0, ...all);
    const pw = W - M.l - M.r;
    const ph = H - M.t - M.b;
    const x = (i) => M.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v) => M.t + ph - ((v - min) / (max - min || 1)) * ph;
    const yTicks = Array.from({ length: 5 }, (_, t) => min + ((max - min) * t) / 4);
    const xTicks = [...new Set(Array.from({ length: 5 }, (_, t) => Math.round(((n - 1) * t) / 4)))];

    return (
        <div>
            <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-stone-700">
                {lines.map((s, k) => {
                    const style = STYLES[k % STYLES.length];
                    return (
                        <span key={s.id} className="inline-flex items-center gap-2">
                            <span
                                aria-hidden="true"
                                className="inline-block w-6"
                                style={{ borderTop: `3px ${style.dash ? "dashed" : "solid"} ${style.stroke}` }}
                            />
                            {s.label}
                        </span>
                    );
                })}
            </div>

            <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    role="img"
                    aria-label={`${title} per epoch for ${lines.length} runs. The table above lists the final values.`}
                    className="block w-full min-w-[520px]"
                    fontFamily="system-ui, sans-serif"
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
                            {i + 1}
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
                        {title}
                    </text>

                    {lines.map((s, k) => {
                        const style = STYLES[k % STYLES.length];
                        const points = s.values
                            .map((v, i) => (Number.isFinite(v) ? `${x(i)},${y(v)}` : null))
                            .filter(Boolean)
                            .join(" ");
                        return (
                            <polyline
                                key={s.id}
                                points={points}
                                fill="none"
                                stroke={style.stroke}
                                strokeWidth="2"
                                strokeDasharray={style.dash}
                                strokeLinejoin="round"
                            />
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}
