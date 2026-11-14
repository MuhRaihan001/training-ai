"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";

/* ====================================================================
   Shared styles and helpers
   ==================================================================== */

const focusClass =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

const btn =
    "inline-flex h-10 items-center justify-center rounded-md border border-stone-400 bg-white px-4 " +
    "text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 " +
    "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none " +
    focusClass;

const btnPrimary =
    "inline-flex h-10 items-center justify-center rounded-md bg-orange-700 px-4 text-sm font-medium " +
    "text-white transition-colors hover:bg-orange-800 active:bg-orange-900 " +
    "disabled:cursor-not-allowed disabled:bg-stone-300 disabled:text-stone-600 motion-reduce:transition-none " +
    focusClass;

const textLink =
    "rounded-sm font-medium text-stone-900 underline decoration-stone-400 underline-offset-4 " +
    "transition-colors hover:decoration-orange-700 motion-reduce:transition-none " +
    focusClass;

const intFormat = new Intl.NumberFormat("en-US");

const fmt = (v, digits = 3) => {
    if (!Number.isFinite(v)) return "-";
    const n = Number(v.toPrecision(digits));
    return Object.is(n, -0) ? "0" : n.toString();
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap = (v, step) => Number((Math.round(v / step) * step).toFixed(6));
const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length;

/* ====================================================================
   Basic display components
   ==================================================================== */

function Section({ id, title, intro, children }) {
    const headingId = `h-${id}`;
    return (
        <section
            id={id}
            aria-labelledby={headingId}
            className="scroll-mt-6 border-t border-stone-200 py-12 sm:py-16"
        >
            <h2
                id={headingId}
                className="text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
            >
                {title}
            </h2>
            {intro && (
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-stone-700">{intro}</p>
            )}
            <div className="mt-8 space-y-10">{children}</div>
        </section>
    );
}

function Sub({ title, children }) {
    return (
        <div className="space-y-3">
            <h3 className="text-lg font-semibold tracking-tight text-stone-900">{title}</h3>
            {children}
        </div>
    );
}

function P({ children }) {
    return <p className="max-w-2xl text-base leading-relaxed text-stone-700">{children}</p>;
}

function Note({ tone = "info", live = false, children }) {
    const border = { info: "border-stone-400", warn: "border-orange-700", ok: "border-green-600" }[tone];
    return (
        <p
            role={live ? "status" : undefined}
            aria-live={live ? "polite" : undefined}
            className={`max-w-2xl border-l-4 bg-white py-2 pl-3 pr-2 text-sm leading-relaxed text-stone-800 ${border}`}
        >
            {children}
        </p>
    );
}

function Lab({ title, hint, children }) {
    const id = useId();
    return (
        <div
            role="group"
            aria-labelledby={id}
            className="rounded-md border border-stone-300 bg-stone-100/70 p-4 sm:p-6"
        >
            <h3 id={id} className="text-base font-semibold text-stone-900">
                {title}
            </h3>
            {hint && <p className="mt-1 max-w-2xl text-sm text-stone-600">{hint}</p>}
            <div className="mt-5">{children}</div>
        </div>
    );
}

function Readout({ items }) {
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {items.map(([label, value, tone]) => (
                <div key={label} className="min-w-0">
                    <dt className="text-xs text-stone-500">{label}</dt>
                    <dd
                        className={
                            "break-words font-mono text-base tabular-nums " +
                            (tone === "warn" ? "text-orange-800" : "text-stone-900")
                        }
                    >
                        {value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

function Slider({ label, value, min, max, step, onChange, format = fmt }) {
    const id = useId();
    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-sm font-medium text-stone-900">
                    {label}
                </label>
                <output htmlFor={id} className="font-mono text-sm tabular-nums text-stone-900">
                    {format(value)}
                </output>
            </div>
            <input
                id={id}
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="mt-1 h-8 w-full accent-orange-700"
            />
        </div>
    );
}

function Segmented({ label, options, value, onChange }) {
    return (
        <div
            role="group"
            aria-label={label}
            className="inline-flex max-w-full flex-wrap overflow-hidden rounded-md border border-stone-400 bg-white"
        >
            {options.map(([id, text]) => (
                <button
                    key={id}
                    type="button"
                    aria-pressed={value === id}
                    onClick={() => onChange(id)}
                    className={
                        "h-9 px-3 text-sm font-medium transition-colors motion-reduce:transition-none " +
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700 " +
                        (value === id ? "bg-stone-900 text-white" : "text-stone-900 hover:bg-stone-100")
                    }
                >
                    {text}
                </button>
            ))}
        </div>
    );
}

function DataTable({ caption, head, rows, mono = true }) {
    return (
        <div
            role="region"
            tabIndex={0}
            aria-label={caption}
            className="overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
        >
            <table className="w-full min-w-[480px] text-left text-sm">
                <caption className="sr-only">{caption}</caption>
                <thead className="bg-stone-100 text-xs">
                    <tr>
                        {head.map((h) => (
                            <th key={h} scope="col" className="px-3 py-2 font-medium text-stone-900">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                    {rows.map((row, r) => (
                        <tr key={`${r}-${row[0]}`}>
                            {row.map((cell, i) => (
                                <td
                                    key={i}
                                    className={
                                        "px-3 py-2 align-top text-stone-800 " +
                                        (mono && i > 0 ? "font-mono text-xs tabular-nums" : "")
                                    }
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function CodeBlock({ code, label }) {
    return (
        <pre
            tabIndex={0}
            aria-label={label}
            className="max-h-96 max-w-3xl overflow-auto rounded-md border border-stone-700 bg-stone-900 p-4 font-mono text-xs leading-relaxed text-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
        >
            <code>{code}</code>
        </pre>
    );
}

function DefList({ items }) {
    return (
        <dl className="max-w-3xl divide-y divide-stone-200 border-y border-stone-200">
            {items.map(([term, text]) => (
                <div key={term} className="py-4 md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:gap-x-8">
                    <dt className="text-sm font-semibold text-stone-900">{term}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-stone-700 md:mt-0">{text}</dd>
                </div>
            ))}
        </dl>
    );
}

/* SVG chart with axes, grid, and (optionally) direct drag interaction on the chart. */
function Plot({
    xd,
    yd,
    xLabel,
    yLabel,
    label,
    children,
    onDrag,
    w = 560,
    h = 300,
    fx = fmt,
    fy = fmt,
    xt = 5,
    yt = 5,
}) {
    const m = { l: 54, r: 14, t: 12, b: 42 };
    const pw = w - m.l - m.r;
    const ph = h - m.t - m.b;
    const sx = (v) => m.l + ((v - xd[0]) / (xd[1] - xd[0])) * pw;
    const sy = (v) => m.t + ph - ((v - yd[0]) / (yd[1] - yd[0])) * ph;
    const ix = (px) => xd[0] + ((px - m.l) / pw) * (xd[1] - xd[0]);
    const iy = (py) => yd[0] + ((m.t + ph - py) / ph) * (yd[1] - yd[0]);
    const ticks = (d, n) => Array.from({ length: n }, (_, i) => d[0] + ((d[1] - d[0]) * i) / (n - 1));

    const clipId = "clip" + useId().replace(/:/g, "");
    const svgRef = useRef(null);
    const down = useRef(false);

    function read(e) {
        const el = svgRef.current;
        if (!el || !onDrag) return;
        const rect = el.getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * w;
        const py = ((e.clientY - rect.top) / rect.height) * h;
        onDrag(ix(px), iy(py));
    }

    const handlers = onDrag
        ? {
              onPointerDown: (e) => {
                  down.current = true;
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  read(e);
              },
              onPointerMove: (e) => {
                  if (down.current) read(e);
              },
              onPointerUp: () => {
                  down.current = false;
              },
              onPointerCancel: () => {
                  down.current = false;
              },
          }
        : {};

    return (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
            <svg
                ref={svgRef}
                viewBox={`0 0 ${w} ${h}`}
                role="img"
                aria-label={label}
                className="block w-full min-w-[420px] select-none"
                style={onDrag ? { touchAction: "none", cursor: "crosshair" } : undefined}
                fontFamily="system-ui, sans-serif"
                {...handlers}
            >
                <defs>
                    <clipPath id={clipId}>
                        <rect x={m.l} y={m.t} width={pw} height={ph} />
                    </clipPath>
                </defs>

                {ticks(yd, yt).map((v) => (
                    <g key={`y${v}`}>
                        <line x1={m.l} x2={w - m.r} y1={sy(v)} y2={sy(v)} stroke="#E7E5E4" />
                        <text x={m.l - 8} y={sy(v) + 4} textAnchor="end" fontSize="11" fill="#57534E">
                            {fy(v)}
                        </text>
                    </g>
                ))}
                {ticks(xd, xt).map((v) => (
                    <text key={`x${v}`} x={sx(v)} y={h - 24} textAnchor="middle" fontSize="11" fill="#57534E">
                        {fx(v)}
                    </text>
                ))}
                <text x={m.l + pw / 2} y={h - 6} textAnchor="middle" fontSize="11" fill="#57534E">
                    {xLabel}
                </text>
                <text
                    transform={`translate(13 ${m.t + ph / 2}) rotate(-90)`}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#57534E"
                >
                    {yLabel}
                </text>

                <g clipPath={`url(#${clipId})`}>{children({ sx, sy, ix, iy, m, pw, ph })}</g>
            </svg>
        </div>
    );
}

/* ====================================================================
   Lab 1: Linear regression (best-fit line)
   ==================================================================== */

const REG_NOISE = [-1.6, 1.3, -0.5, 2.2, -1.9, 0.7, 1.5, -2.3, 1.0, -0.6, 1.8, -1.1];
const REG_POINTS = REG_NOISE.map((n, i) => ({ x: i + 1, y: 1.5 * (i + 1) + 3 + n }));
const REG_MEAN = { x: avg(REG_POINTS.map((p) => p.x)), y: avg(REG_POINTS.map((p) => p.y)) };

const mseOf = (w, b) => avg(REG_POINTS.map((p) => (p.y - (w * p.x + b)) ** 2));

const BEST_FIT = (() => {
    let sxy = 0;
    let sxx = 0;
    for (const p of REG_POINTS) {
        sxy += (p.x - REG_MEAN.x) * (p.y - REG_MEAN.y);
        sxx += (p.x - REG_MEAN.x) ** 2;
    }
    const w = sxy / sxx;
    const b = REG_MEAN.y - w * REG_MEAN.x;
    return { w, b, mse: mseOf(w, b) };
})();

function RegressionLab() {
    const [w, setW] = useState(0.2);
    const [b, setB] = useState(12);
    const mse = mseOf(w, b);
    const close = mse <= BEST_FIT.mse * 1.1;

    function pivot(px, py) {
        if (Math.abs(px - REG_MEAN.x) < 0.5) return;
        const nextW = clamp(snap((py - REG_MEAN.y) / (px - REG_MEAN.x), 0.05), -1, 4);
        setW(nextW);
        setB(clamp(snap(REG_MEAN.y - nextW * REG_MEAN.x, 0.1), -15, 25));
    }

    return (
        <Lab
            title="Find the best line"
            hint="Click or drag anywhere on the chart and the line will rotate to pass through that point. The sliders do the same thing from the keyboard. The dashed orange lines are each point's error."
        >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
                <Plot
                    xd={[0, 13]}
                    yd={[0, 24]}
                    xLabel="House size"
                    yLabel="Price"
                    onDrag={pivot}
                    label={`Scatter plot of 12 house data points with prediction line y equals ${fmt(w)} x plus ${fmt(b)}. Mean squared error ${fmt(mse)}.`}
                >
                    {({ sx, sy }) => (
                        <>
                            {REG_POINTS.map((p) => (
                                <line
                                    key={`e${p.x}`}
                                    x1={sx(p.x)}
                                    x2={sx(p.x)}
                                    y1={sy(p.y)}
                                    y2={sy(w * p.x + b)}
                                    stroke="#C2410C"
                                    strokeOpacity="0.6"
                                    strokeDasharray="3 3"
                                />
                            ))}
                            <line
                                x1={sx(0)}
                                y1={sy(b)}
                                x2={sx(13)}
                                y2={sy(13 * w + b)}
                                stroke="#1C1917"
                                strokeWidth="2.5"
                            />
                            {REG_POINTS.map((p) => (
                                <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r="4.5" fill="#C2410C" stroke="#9A3412" />
                            ))}
                        </>
                    )}
                </Plot>

                <div className="space-y-4">
                    <Slider label="Slope (w)" value={w} min={-1} max={4} step={0.05} onChange={setW} />
                    <Slider label="Intercept (b)" value={b} min={-15} max={25} step={0.1} onChange={setB} />
                    <Readout
                        items={[
                            ["Error (MSE)", fmt(mse)],
                            ["Best MSE", fmt(BEST_FIT.mse)],
                        ]}
                    />
                    <button
                        type="button"
                        className={btn}
                        onClick={() => {
                            setW(BEST_FIT.w);
                            setB(BEST_FIT.b);
                        }}
                    >
                        Show best line
                    </button>
                    <Note tone={close ? "ok" : "info"} live>
                        {close
                            ? "The line is almost as good as it can get. This is what it means for a model to have learned."
                            : "The error is still large. Rotate or move the line until the MSE number drops."}
                    </Note>
                </div>
            </div>
        </Lab>
    );
}

/* ====================================================================
   Lab 2: A single neuron
   ==================================================================== */

const ACTS = {
    relu: {
        name: "ReLU",
        f: (z) => Math.max(0, z),
        yd: [-1, 11],
        note: "Negative values are clipped to 0. When z is negative, this neuron contributes nothing for that input.",
    },
    sigmoid: {
        name: "Sigmoid",
        f: (z) => 1 / (1 + Math.exp(-z)),
        yd: [-0.1, 1.1],
        note: "The output is squeezed into the range 0 to 1. At the ends the curve is nearly flat, so changing z barely changes the output.",
    },
    tanh: {
        name: "Tanh",
        f: Math.tanh,
        yd: [-1.2, 1.2],
        note: "Similar to sigmoid, but the range is -1 to 1 and it is centered on zero. Its ends are also flat.",
    },
    linear: {
        name: "Linear",
        f: (z) => z,
        yd: [-11, 11],
        note: "The output equals z. Used in the output layer for regression so predictions can take any value.",
    },
};

function NeuronLab() {
    const [x1, setX1] = useState(1);
    const [x2, setX2] = useState(-0.5);
    const [w1, setW1] = useState(1.2);
    const [w2, setW2] = useState(0.8);
    const [b, setB] = useState(0);
    const [act, setAct] = useState("relu");

    const spec = ACTS[act];
    const z = w1 * x1 + w2 * x2 + b;
    const a = spec.f(z);
    const curve = useMemo(
        () => Array.from({ length: 221 }, (_, i) => -11 + i * 0.1).map((v) => [v, spec.f(v)]),
        [spec]
    );

    return (
        <Lab
            title="Compute a single neuron"
            hint="Change the inputs, weights, and bias. You can also drag on the chart: the point moves and the bias adjusts to match."
        >
            <div className="mb-4">
                <Segmented
                    label="Activation function"
                    value={act}
                    onChange={setAct}
                    options={Object.entries(ACTS).map(([id, s]) => [id, s.name])}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <Plot
                    xd={[-11, 11]}
                    yd={spec.yd}
                    xLabel="z (weighted sum + bias)"
                    yLabel={`${spec.name}(z)`}
                    onDrag={(zx) => setB(clamp(snap(zx - (w1 * x1 + w2 * x2), 0.1), -3, 3))}
                    label={`${spec.name} curve. When z equals ${fmt(z)}, the neuron output is ${fmt(a)}.`}
                >
                    {({ sx, sy }) => (
                        <>
                            <line x1={sx(0)} x2={sx(0)} y1={sy(spec.yd[0])} y2={sy(spec.yd[1])} stroke="#D6D3D1" />
                            <line x1={sx(-11)} x2={sx(11)} y1={sy(0)} y2={sy(0)} stroke="#D6D3D1" />
                            <polyline
                                points={curve.map(([cx, cy]) => `${sx(cx)},${sy(cy)}`).join(" ")}
                                fill="none"
                                stroke="#44403C"
                                strokeWidth="2.5"
                            />
                            <line x1={sx(z)} x2={sx(z)} y1={sy(spec.yd[0])} y2={sy(a)} stroke="#C2410C" strokeDasharray="4 3" />
                            <circle cx={sx(z)} cy={sy(a)} r="6" fill="#C2410C" stroke="#fff" strokeWidth="2" />
                        </>
                    )}
                </Plot>

                <div className="space-y-3">
                    <Slider label="Input x₁" value={x1} min={-2} max={2} step={0.1} onChange={setX1} />
                    <Slider label="Input x₂" value={x2} min={-2} max={2} step={0.1} onChange={setX2} />
                    <Slider label="Weight w₁" value={w1} min={-2} max={2} step={0.1} onChange={setW1} />
                    <Slider label="Weight w₂" value={w2} min={-2} max={2} step={0.1} onChange={setW2} />
                    <Slider label="Bias b" value={b} min={-3} max={3} step={0.1} onChange={setB} />
                </div>
            </div>

            <div className="mt-5 space-y-2 font-mono text-sm leading-relaxed text-stone-900">
                <p className="break-words">
                    z = ({fmt(w1, 2)} × {fmt(x1, 2)}) + ({fmt(w2, 2)} × {fmt(x2, 2)}) + ({fmt(b, 2)}) ={" "}
                    <strong>{fmt(z)}</strong>
                </p>
                <p>
                    a = {spec.name}(z) = <strong>{fmt(a)}</strong>
                </p>
            </div>
            <div className="mt-3">
                <Note live>{spec.note}</Note>
            </div>
        </Lab>
    );
}

/* ====================================================================
   Lab 3: One-dimensional gradient descent
   ==================================================================== */

const GD_STEPS = 30;
const gdLoss = (w) => (w - 2) ** 2;

function GradientLab() {
    const [lr, setLr] = useState(0.1);
    const [start, setStart] = useState(-1);
    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);

    const path = useMemo(() => {
        const p = [start];
        for (let i = 0; i < GD_STEPS; i++) p.push(p[i] - lr * 2 * (p[i] - 2));
        return p;
    }, [start, lr]);

    const running = playing && step < GD_STEPS;
    useEffect(() => {
        if (!running) return;
        const timer = setTimeout(() => setStep((s) => s + 1), 400);
        return () => clearTimeout(timer);
    }, [running, step]);

    const restart = (setter) => (value) => {
        setter(value);
        setStep(0);
        setPlaying(false);
    };

    const current = path[step];
    const grad = 2 * (current - 2);
    const exploded = Math.abs(current - 2) > 50;
    const curve = useMemo(
        () => Array.from({ length: 81 }, (_, i) => -2 + i * 0.1).map((v) => [v, gdLoss(v)]),
        []
    );

    let verdict;
    let tone = "info";
    if (lr > 1.005) {
        verdict = "Learning rate too large: each step jumps farther from the bottom, so the loss grows and explodes instead.";
        tone = "warn";
    } else if (lr >= 0.995) {
        verdict = "Right at the limit: the point bounces back and forth across the bottom and never goes down.";
        tone = "warn";
    } else if (lr > 0.5) {
        verdict = "Fairly large: the point jumps over the bottom and comes back from the other side. It gets there eventually, but it oscillates.";
    } else if (lr >= 0.05) {
        verdict = "A healthy step size: the loss goes down smoothly to the bottom.";
        tone = "ok";
    } else {
        verdict = "Too small: the direction is right but it is very slow. It would take many more epochs.";
    }

    return (
        <Lab
            title="Descending the loss valley"
            hint="Drag the starting point on the chart, set the learning rate, then press Play. The orange line is the slope (gradient) at the current point."
        >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <Plot
                    xd={[-2, 6]}
                    yd={[-1, 17]}
                    xLabel="Weight value w"
                    yLabel="Loss"
                    onDrag={(x) => restart(setStart)(clamp(snap(x, 0.1), -1.9, 5.9))}
                    label={`Valley-shaped loss curve with its bottom at w equals 2. The current point is w equals ${fmt(current)}.`}
                >
                    {({ sx, sy }) => {
                        const shown = path.slice(0, step + 1);
                        return (
                            <>
                                <polyline
                                    points={curve.map(([cx, cy]) => `${sx(cx)},${sy(cy)}`).join(" ")}
                                    fill="none"
                                    stroke="#44403C"
                                    strokeWidth="2.5"
                                />
                                <line x1={sx(2)} x2={sx(2)} y1={sy(-1)} y2={sy(17)} stroke="#A8A29E" strokeDasharray="2 3" />
                                <polyline
                                    points={shown
                                        .map((p) => `${sx(clamp(p, -50, 50))},${sy(clamp(gdLoss(p), -50, 500))}`)
                                        .join(" ")}
                                    fill="none"
                                    stroke="#C2410C"
                                    strokeWidth="1.5"
                                    strokeOpacity="0.6"
                                />
                                {shown.map((p, i) => (
                                    <circle
                                        key={i}
                                        cx={sx(clamp(p, -50, 50))}
                                        cy={sy(clamp(gdLoss(p), -50, 500))}
                                        r={i === step ? 7 : 3.5}
                                        fill={i === step ? "#C2410C" : "#FFFFFF"}
                                        stroke="#C2410C"
                                        strokeWidth="2"
                                    />
                                ))}
                                <line
                                    x1={sx(current - 0.9)}
                                    y1={sy(gdLoss(current) - grad * 0.9)}
                                    x2={sx(current + 0.9)}
                                    y2={sy(gdLoss(current) + grad * 0.9)}
                                    stroke="#C2410C"
                                    strokeWidth="2"
                                />
                            </>
                        );
                    }}
                </Plot>

                <div className="space-y-4">
                    <Slider
                        label="Learning rate (η)"
                        value={lr}
                        min={0.01}
                        max={1.1}
                        step={0.01}
                        onChange={restart(setLr)}
                        format={(v) => fmt(v, 2)}
                    />
                    <Slider
                        label="Starting w"
                        value={start}
                        min={-1.9}
                        max={5.9}
                        step={0.1}
                        onChange={restart(setStart)}
                        format={(v) => fmt(v, 2)}
                    />
                    <Slider
                        label="Step"
                        value={step}
                        min={0}
                        max={GD_STEPS}
                        step={1}
                        onChange={(v) => {
                            setStep(v);
                            setPlaying(false);
                        }}
                        format={(v) => `${v} / ${GD_STEPS}`}
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => {
                                if (step >= GD_STEPS) {
                                    setStep(0);
                                    setPlaying(true);
                                } else setPlaying((p) => !p);
                            }}
                        >
                            {running ? "Pause" : "Play"}
                        </button>
                        <button
                            type="button"
                            className={btn}
                            disabled={step >= GD_STEPS}
                            onClick={() => {
                                setPlaying(false);
                                setStep((s) => Math.min(GD_STEPS, s + 1));
                            }}
                        >
                            One step
                        </button>
                    </div>
                    <Readout
                        items={[
                            ["w", exploded ? "exploded" : fmt(current), exploded ? "warn" : undefined],
                            ["Loss", exploded ? "exploded" : fmt(gdLoss(current))],
                            ["Gradient", exploded ? "-" : fmt(grad)],
                            ["Factor per step", fmt(1 - 2 * lr, 2)],
                        ]}
                    />
                </div>
            </div>
            <div className="mt-4">
                <Note tone={tone} live>
                    {verdict}
                </Note>
            </div>
            <p className="mt-3 max-w-2xl text-xs text-stone-500">
                Formula for each step: new w = w − η × gradient. Here loss = (w − 2)², so the gradient is 2(w − 2) and
                each step multiplies the distance to the bottom by (1 − 2η).
            </p>
        </Lab>
    );
}

/* ====================================================================
   Lab 4: Tensor shape
   ==================================================================== */

function TensorLab() {
    const [mode, setMode] = useState("image");
    const [batch, setBatch] = useState(32);
    const [size, setSize] = useState(64);
    const [rgb, setRgb] = useState(true);
    const [features, setFeatures] = useState(3);

    const shape = mode === "image" ? [batch, size, size, rgb ? 3 : 1] : [batch, features];
    const count = shape.reduce((a, b) => a * b, 1);
    const bytes = count * 4;
    const memory = bytes >= 1024 * 1024 ? `${fmt(bytes / 1024 / 1024, 3)} MB` : `${fmt(bytes / 1024, 3)} KB`;
    const rank = shape.length === 2 ? "2 (matrix)" : "4 (4D tensor)";

    return (
        <Lab
            title="How big is one batch of data?"
            hint="Data enters the model as a tensor. Change the sizes and see the shape and memory required."
        >
            <div className="mb-4">
                <Segmented
                    label="Data type"
                    value={mode}
                    onChange={setMode}
                    options={[
                        ["table", "CSV table"],
                        ["image", "Image"],
                    ]}
                />
            </div>
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                    <Slider label="Batch size" value={batch} min={1} max={128} step={1} onChange={setBatch} />
                    {mode === "table" ? (
                        <Slider label="Number of features" value={features} min={1} max={50} step={1} onChange={setFeatures} />
                    ) : (
                        <>
                            <Slider
                                label="Image side (pixels)"
                                value={size}
                                min={8}
                                max={128}
                                step={8}
                                onChange={setSize}
                            />
                            <label className="flex items-center gap-3 text-sm font-medium text-stone-900">
                                <input
                                    type="checkbox"
                                    checked={rgb}
                                    onChange={(e) => setRgb(e.target.checked)}
                                    className="h-5 w-5 accent-orange-700"
                                />
                                Color (3 RGB channels). Turn off for grayscale (1 channel).
                            </label>
                        </>
                    )}
                </div>
                <div className="space-y-4">
                    <p className="break-words font-mono text-lg text-stone-900">[{shape.join(", ")}]</p>
                    <Readout
                        items={[
                            ["Rank (dimensions)", rank],
                            ["Total numbers", intFormat.format(count)],
                            ["float32 memory", memory],
                            [
                                "Per sample",
                                intFormat.format(count / batch) + (mode === "image" ? " numbers" : " features"),
                            ],
                        ]}
                    />
                    <Note live>
                        {mode === "image"
                            ? "The order is [batch, height, width, channels]. This playground uses 64 × 64 × 3, which is 12,288 numbers per image."
                            : "The order is [batch, features]. Each CSV row becomes one feature vector after text is converted into numbers."}
                    </Note>
                </div>
            </div>
        </Lab>
    );
}

const TF_CODE = `import * as tf from "@tensorflow/tfjs";

// 1. Build the model: 3 features in, 1 number out (regression)
const model = tf.sequential();
model.add(tf.layers.dense({ units: 16, activation: "relu", inputShape: [3] }));
model.add(tf.layers.dense({ units: 8, activation: "relu" }));
model.add(tf.layers.dense({ units: 1, activation: "linear" }));

// 2. Choose the optimizer and loss
model.compile({
    optimizer: tf.train.adam(0.001),
    loss: "meanSquaredError",
    metrics: ["mae"],
});

// 3. Train
await model.fit(xTrain, yTrain, {
    epochs: 100,
    batchSize: 32,
    validationData: [xVal, yVal],
});

// 4. Predict for one new row
const result = model.predict(tf.tensor2d([[85, 3, 10]]));
result.print();`;

/* ====================================================================
   Lab 5: Convolution on an 8 x 8 image
   ==================================================================== */

const N = 8;
const make = (fn) => Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (fn(r, c) ? 1 : 0)));

const PRESETS = {
    box: ["Square", () => make((r, c) => r >= 1 && r <= 6 && c >= 1 && c <= 6 && (r === 1 || r === 6 || c === 1 || c === 6))],
    vertical: ["Vertical line", () => make((r, c) => c === 3 || c === 4)],
    horizontal: ["Horizontal line", () => make((r) => r === 3 || r === 4)],
    diagonal: ["Diagonal", () => make((r, c) => r === c)],
    empty: ["Empty", () => make(() => false)],
};

const KERNELS = {
    vertical: {
        name: "Vertical edge detection",
        k: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
        note: "Gives a large value where the color changes from left to right, which is a vertical edge.",
    },
    horizontal: {
        name: "Horizontal edge detection",
        k: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
        note: "Gives a large value where the color changes from top to bottom, which is a horizontal edge.",
    },
    blur: {
        name: "Smooth (blur)",
        k: Array.from({ length: 3 }, () => Array(3).fill(1 / 9)),
        note: "Each result is the average of the 9 surrounding pixels, so the image becomes softer.",
    },
};

function convolve(img, k) {
    const size = img.length - 2;
    return Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) => {
            let sum = 0;
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) sum += k[i][j] * img[r + i][c + j];
            return sum;
        })
    );
}

function maxPool(map) {
    const size = Math.floor(map.length / 2);
    return Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) =>
            Math.max(map[2 * r][2 * c], map[2 * r][2 * c + 1], map[2 * r + 1][2 * c], map[2 * r + 1][2 * c + 1])
        )
    );
}

function Cells({ data, name, colorOf, numbers = false, highlight, onEnter, onLeave }) {
    const n = data.length;
    return (
        <div
            role="img"
            aria-label={name}
            onPointerLeave={onLeave}
            className="grid w-44 gap-px border border-stone-400 bg-stone-400"
            style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
            {data.flatMap((row, r) =>
                row.map((v, c) => {
                    const { bg, fg } = colorOf(v);
                    return (
                        <div
                            key={`${r}-${c}`}
                            onPointerEnter={() => onEnter?.(r, c)}
                            className="flex aspect-square items-center justify-center font-mono text-[10px] tabular-nums"
                            style={{
                                background: bg,
                                color: fg,
                                boxShadow: highlight?.(r, c) ? "inset 0 0 0 2px #C2410C" : undefined,
                            }}
                        >
                            {numbers ? fmt(v, 2) : null}
                        </div>
                    );
                })
            )}
        </div>
    );
}

function heat(v, peak) {
    if (v === 0 || peak === 0) return { bg: "#FFFFFF", fg: "#78716C" };
    const t = Math.min(1, Math.abs(v) / peak);
    const alpha = 0.15 + 0.85 * t;
    return v > 0
        ? { bg: `rgba(194, 65, 12, ${alpha.toFixed(2)})`, fg: t > 0.5 ? "#FFFFFF" : "#1C1917" }
        : { bg: `rgba(68, 64, 60, ${alpha.toFixed(2)})`, fg: t > 0.5 ? "#FFFFFF" : "#1C1917" };
}

function ConvLab() {
    const [grid, setGrid] = useState(PRESETS.box[1]);
    const [kernelId, setKernelId] = useState("vertical");
    const [relu, setRelu] = useState(true);
    const [focus, setFocus] = useState(null);

    const boxRef = useRef(null);
    const paint = useRef(null);

    const kernel = KERNELS[kernelId];
    const raw = useMemo(() => convolve(grid, kernel.k), [grid, kernel]);
    const map = useMemo(() => (relu ? raw.map((row) => row.map((v) => Math.max(0, v))) : raw), [raw, relu]);
    const pooled = useMemo(() => maxPool(map), [map]);
    const peak = Math.max(...map.flat().map(Math.abs), 0);
    const poolPeak = Math.max(...pooled.flat().map(Math.abs), 0);

    function cellAt(e) {
        const rect = boxRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const c = Math.floor(((e.clientX - rect.left) / rect.width) * N);
        const r = Math.floor(((e.clientY - rect.top) / rect.height) * N);
        return r < 0 || r >= N || c < 0 || c >= N ? null : [r, c];
    }

    function apply(e) {
        const cell = cellAt(e);
        if (!cell || paint.current === null) return;
        const [r, c] = cell;
        const value = paint.current;
        setGrid((g) =>
            g[r][c] === value ? g : g.map((line, i) => (i === r ? line.map((v, j) => (j === c ? value : v)) : line))
        );
    }

    const inputHighlight = (r, c) => {
        if (!focus) return false;
        if (focus.layer === "conv") return r >= focus.r && r < focus.r + 3 && c >= focus.c && c < focus.c + 3;
        return r >= focus.r * 2 && r < focus.r * 2 + 4 && c >= focus.c * 2 && c < focus.c * 2 + 4;
    };
    const mapHighlight = (r, c) => {
        if (!focus) return false;
        if (focus.layer === "conv") return r === focus.r && c === focus.c;
        return r >= focus.r * 2 && r < focus.r * 2 + 2 && c >= focus.c * 2 && c < focus.c * 2 + 2;
    };
    const poolHighlight = (r, c) => focus?.layer === "pool" && focus.r === r && focus.c === c;

    return (
        <Lab
            title="Pixel images and convolution filters"
            hint="Draw in the left box by clicking or dragging (click a black pixel to erase it). Then hover over the result boxes to see which part of the image the filter reads."
        >
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Segmented
                    label="Example images"
                    value={null}
                    onChange={(id) => setGrid(PRESETS[id][1])}
                    options={Object.entries(PRESETS).map(([id, [name]]) => [id, name])}
                />
                <Segmented
                    label="Filter"
                    value={kernelId}
                    onChange={setKernelId}
                    options={Object.entries(KERNELS).map(([id, k]) => [id, k.name])}
                />
                <label className="flex items-center gap-2 text-sm font-medium text-stone-900">
                    <input
                        type="checkbox"
                        checked={relu}
                        onChange={(e) => setRelu(e.target.checked)}
                        className="h-5 w-5 accent-orange-700"
                    />
                    ReLU
                </label>
            </div>

            <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
                <figure>
                    <div
                        ref={boxRef}
                        onPointerDown={(e) => {
                            const cell = cellAt(e);
                            if (!cell) return;
                            paint.current = 1 - grid[cell[0]][cell[1]];
                            e.currentTarget.setPointerCapture?.(e.pointerId);
                            apply(e);
                        }}
                        onPointerMove={(e) => {
                            apply(e);
                        }}
                        onPointerUp={() => {
                            paint.current = null;
                        }}
                        onPointerCancel={() => {
                            paint.current = null;
                        }}
                        style={{ touchAction: "none", cursor: "crosshair" }}
                    >
                        <Cells
                            data={grid}
                            name="8 by 8 pixel input image that can be drawn on"
                            colorOf={(v) => (v ? { bg: "#1C1917", fg: "#fff" } : { bg: "#FFFFFF", fg: "#000" })}
                            highlight={inputHighlight}
                        />
                    </div>
                    <figcaption className="mt-2 text-sm text-stone-700">Input image (8 × 8)</figcaption>
                </figure>

                <figure>
                    <Cells
                        data={map}
                        numbers
                        name={`6 by 6 feature map from the ${kernel.name} filter`}
                        colorOf={(v) => heat(v, peak)}
                        highlight={mapHighlight}
                        onEnter={(r, c) => setFocus({ layer: "conv", r, c })}
                        onLeave={() => setFocus(null)}
                    />
                    <figcaption className="mt-2 text-sm text-stone-700">Feature map (6 × 6)</figcaption>
                </figure>

                <figure>
                    <Cells
                        data={pooled}
                        numbers
                        name="3 by 3 max pooling result"
                        colorOf={(v) => heat(v, poolPeak)}
                        highlight={poolHighlight}
                        onEnter={(r, c) => setFocus({ layer: "pool", r, c })}
                        onLeave={() => setFocus(null)}
                    />
                    <figcaption className="mt-2 text-sm text-stone-700">After max pooling (3 × 3)</figcaption>
                </figure>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
                <div>
                    <p className="mb-1 text-sm font-medium text-stone-900">3 × 3 filter values</p>
                    <div className="grid w-36 grid-cols-3 gap-px border border-stone-400 bg-stone-400">
                        {kernel.k.flat().map((v, i) => (
                            <div
                                key={i}
                                className="flex aspect-square items-center justify-center bg-white font-mono text-xs tabular-nums text-stone-900"
                            >
                                {fmt(v, 2)}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    <Note live>{kernel.note}</Note>
                    <p className="max-w-2xl text-sm leading-relaxed text-stone-700">
                        The filter slides across the whole image. At each position, 9 pixels are multiplied by the 9
                        filter numbers and summed. Orange means the pattern was found, dark gray means the value is
                        negative. ReLU discards negative values, and max pooling takes the largest value in each 2 × 2
                        block so the size shrinks.
                    </p>
                </div>
            </div>
        </Lab>
    );
}

/* ====================================================================
   Lab 6: Softmax and crossentropy
   ==================================================================== */

const PET_CLASSES = ["Cat", "Dog", "Bird"];

function SoftmaxLab() {
    const [z, setZ] = useState([2, 1, -1]);
    const [truth, setTruth] = useState(0);

    const peak = Math.max(...z);
    const exps = z.map((v) => Math.exp(v - peak));
    const total = exps.reduce((a, b) => a + b, 0);
    const p = exps.map((v) => v / total);
    const loss = -Math.log(Math.max(p[truth], 1e-12));
    const guess = p.indexOf(Math.max(...p));

    return (
        <Lab
            title="From raw scores to probabilities"
            hint="The last layer outputs one raw score (logit) per class. Softmax turns them into probabilities that add up to 100%."
        >
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-stone-900">This image is actually a:</span>
                <Segmented
                    label="True class"
                    value={truth}
                    onChange={setTruth}
                    options={PET_CLASSES.map((name, i) => [i, name])}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                    {PET_CLASSES.map((name, i) => (
                        <Slider
                            key={name}
                            label={`${name} score`}
                            value={z[i]}
                            min={-5}
                            max={8}
                            step={0.1}
                            onChange={(v) => setZ((prev) => prev.map((old, k) => (k === i ? v : old)))}
                            format={(v) => fmt(v, 2)}
                        />
                    ))}
                </div>

                <div className="space-y-4">
                    <ul className="space-y-2">
                        {PET_CLASSES.map((name, i) => (
                            <li key={name} className="grid grid-cols-[5rem_minmax(0,1fr)_4rem] items-center gap-3 text-sm">
                                <span className={i === truth ? "font-semibold text-stone-900" : "text-stone-700"}>
                                    {name}
                                    {i === truth && <span className="sr-only"> (true class)</span>}
                                </span>
                                <span aria-hidden="true" className="h-3 rounded-sm bg-stone-200">
                                    <span
                                        className={"block h-3 rounded-sm " + (i === truth ? "bg-orange-700" : "bg-stone-500")}
                                        style={{ width: `${Math.max(0.5, p[i] * 100)}%` }}
                                    />
                                </span>
                                <span className="text-right font-mono tabular-nums text-stone-900">
                                    {(p[i] * 100).toFixed(1)}%
                                </span>
                            </li>
                        ))}
                    </ul>
                    <Readout
                        items={[
                            ["Model prediction", PET_CLASSES[guess]],
                            ["Loss = −ln(correct p)", fmt(loss), loss > 1.5 ? "warn" : undefined],
                        ]}
                    />
                    <Note tone={guess === truth ? "ok" : "warn"} live>
                        {guess === truth
                            ? loss < 0.2
                                ? "Correct and confident: the loss is close to 0."
                                : "The guess is correct, but the probability is not high yet, so the loss is still noticeable."
                            : "Wrong guess. The more confident the model is in the wrong answer, the larger the loss and the stronger the correction."}
                    </Note>
                </div>
            </div>
        </Lab>
    );
}

/* ====================================================================
   Lab 7: Network architecture and parameter count
   ==================================================================== */

function NetPreview({ sizes }) {
    const W = 560;
    const H = 190;
    const MAX_DOTS = 8;
    const xs = sizes.map((_, i) => 44 + (i * (W - 88)) / Math.max(1, sizes.length - 1));
    const ys = sizes.map((size) => {
        const count = Math.min(size, MAX_DOTS);
        return Array.from({ length: count }, (_, k) => 78 + (k - (count - 1) / 2) * 16);
    });
    const names = sizes.map((_, i) => (i === 0 ? "Input" : i === sizes.length - 1 ? "Output" : `Hidden ${i}`));

    const lines = [];
    for (let l = 1; l < sizes.length; l++) {
        ys[l - 1].forEach((y1, a) =>
            ys[l].forEach((y2, b) =>
                lines.push(
                    <line key={`${l}-${a}-${b}`} x1={xs[l - 1]} y1={y1} x2={xs[l]} y2={y2} stroke="#D6D3D1" strokeWidth="0.7" />
                )
            )
        );
    }

    return (
        <div className="overflow-x-auto rounded-md border border-stone-200 bg-white">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={`Network diagram with layer sizes ${sizes.join(", ")}.`}
                className="block w-full min-w-[420px]"
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
                            fill={l === 0 || l === sizes.length - 1 ? "#292524" : "#FFFFFF"}
                            stroke="#44403C"
                            strokeWidth="1.2"
                        />
                    ))
                )}
                {sizes.map((size, l) => (
                    <g key={`t${l}`}>
                        {size > MAX_DOTS && (
                            <text x={xs[l]} y={156} textAnchor="middle" fontSize="10" fill="#57534E">
                                +{size - MAX_DOTS}
                            </text>
                        )}
                        <text x={xs[l]} y={171} textAnchor="middle" fontSize="10" fontWeight="600" fill="#1C1917">
                            {names[l]}
                        </text>
                        <text x={xs[l]} y={184} textAnchor="middle" fontSize="10" fill="#57534E">
                            {size}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

function ArchitectureLab() {
    const [inputs, setInputs] = useState(4);
    const [layers, setLayers] = useState([16, 8]);
    const [outputs, setOutputs] = useState(3);
    const [rows, setRows] = useState(500);

    const sizes = [inputs, ...layers, outputs];
    const table = sizes.slice(1).map((units, i) => {
        const prev = sizes[i];
        return {
            name: i === sizes.length - 2 ? "Output" : `Hidden ${i + 1}`,
            shape: `${prev} → ${units}`,
            params: (prev + 1) * units,
        };
    });
    const total = table.reduce((s, r) => s + r.params, 0);
    const risky = total > rows;

    return (
        <Lab
            title="Design a network and count its parameters"
            hint="Set the number of inputs, hidden layers, and neurons. Parameters are all the weights and biases that must be learned."
        >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                    <Slider label="Number of inputs (features)" value={inputs} min={1} max={30} step={1} onChange={setInputs} />
                    {layers.map((units, i) => (
                        <div key={i} className="flex items-end gap-3">
                            <div className="min-w-0 flex-1">
                                <Slider
                                    label={`Neurons in hidden ${i + 1}`}
                                    value={units}
                                    min={1}
                                    max={64}
                                    step={1}
                                    onChange={(v) => setLayers((prev) => prev.map((old, k) => (k === i ? v : old)))}
                                />
                            </div>
                            <button
                                type="button"
                                className={btn}
                                disabled={layers.length <= 1}
                                aria-label={`Remove hidden ${i + 1}`}
                                onClick={() => setLayers((prev) => prev.filter((_, k) => k !== i))}
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className={btn}
                        disabled={layers.length >= 6}
                        onClick={() => setLayers((prev) => [...prev, 8])}
                    >
                        Add layer
                    </button>
                    <Slider
                        label="Output neurons (number of classes)"
                        value={outputs}
                        min={1}
                        max={10}
                        step={1}
                        onChange={setOutputs}
                    />
                    <Slider
                        label="Number of training rows"
                        value={rows}
                        min={50}
                        max={5000}
                        step={50}
                        onChange={setRows}
                        format={(v) => intFormat.format(v)}
                    />
                </div>

                <div className="min-w-0 space-y-4">
                    <NetPreview sizes={sizes} />
                    <DataTable
                        caption="Number of parameters in each layer"
                        head={["Layer", "Shape", "Parameters"]}
                        rows={[
                            ...table.map((r) => [r.name, r.shape, intFormat.format(r.params)]),
                            ["Total", "", intFormat.format(total)],
                        ]}
                    />
                    <Note tone={risky ? "warn" : "ok"} live>
                        {risky
                            ? `There are ${intFormat.format(total)} parameters for ${intFormat.format(rows)} rows of data. More parameters than data makes it easy for the model to memorize (overfitting).`
                            : `${intFormat.format(total)} parameters for ${intFormat.format(rows)} rows of data. This ratio is still reasonable, but keep watching the validation loss.`}
                    </Note>
                    <p className="text-xs text-stone-500">
                        Parameters in one layer = (number of inputs to that layer + 1 bias) × its number of neurons.
                    </p>
                </div>
            </div>
        </Lab>
    );
}

/* ====================================================================
   Lab 8: Learning curves, overfitting, early stopping
   ==================================================================== */

const CURVE_EPOCHS = 100;
const CURVE = Array.from({ length: CURVE_EPOCHS }, (_, i) => {
    const e = i + 1;
    return {
        e,
        train: 0.05 + 0.95 * Math.exp(-e / 20),
        val: 0.22 + 0.78 * Math.exp(-e / 14) + 0.00009 * Math.max(0, e - 28) ** 2 + 0.004 * Math.sin(e * 1.7),
    };
});
const BEST_EPOCH = CURVE.reduce((best, p) => (p.val < best.val ? p : best)).e;

function stopEpochFor(patience) {
    let best = Infinity;
    let bestEpoch = 0;
    for (const p of CURVE) {
        if (p.val < best) {
            best = p.val;
            bestEpoch = p.e;
        } else if (p.e - bestEpoch >= patience) return p.e;
    }
    return CURVE_EPOCHS;
}

function CurvesLab() {
    const [epoch, setEpoch] = useState(30);
    const [early, setEarly] = useState(false);
    const [patience, setPatience] = useState(10);

    const stop = stopEpochFor(patience);
    const eff = early ? Math.min(epoch, stop) : epoch;
    const now = CURVE[eff - 1];
    const stopped = early && epoch >= stop;

    let phase;
    let tone = "info";
    if (eff < BEST_EPOCH - 10) {
        phase = "Underfitting: both losses are still high, the model has not captured the pattern yet. Keep training.";
    } else if (eff <= BEST_EPOCH + 10) {
        phase = "A good point: the validation loss is near its lowest and the gap to the training loss is still small.";
        tone = "ok";
    } else {
        phase = "Overfitting: the training loss keeps falling, but the validation loss rises. The model is starting to memorize the training data.";
        tone = "warn";
    }

    const line = (key, upto) => (sx, sy) =>
        CURVE.slice(0, upto)
            .map((p) => `${sx(p.e)},${sy(p[key])}`)
            .join(" ");

    return (
        <Lab
            title="When should training stop?"
            hint="Drag the epoch line on the chart. Turn on early stopping to see training stop automatically. These curves are an illustration for learning, not the result of real training."
        >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <Plot
                    xd={[0, CURVE_EPOCHS]}
                    yd={[0, 1.1]}
                    xLabel="Epoch"
                    yLabel="Loss"
                    onDrag={(x) => setEpoch(clamp(Math.round(x), 1, CURVE_EPOCHS))}
                    label={`Training and validation loss curves. The lowest validation loss is at epoch ${BEST_EPOCH}. The current epoch is ${eff}.`}
                >
                    {({ sx, sy, m, ph }) => (
                        <>
                            <polyline points={line("train", CURVE_EPOCHS)(sx, sy)} fill="none" stroke="#C2410C" strokeOpacity="0.25" strokeWidth="2" />
                            <polyline points={line("val", CURVE_EPOCHS)(sx, sy)} fill="none" stroke="#44403C" strokeOpacity="0.25" strokeWidth="2" strokeDasharray="6 4" />
                            <polyline points={line("train", eff)(sx, sy)} fill="none" stroke="#C2410C" strokeWidth="2.5" />
                            <polyline points={line("val", eff)(sx, sy)} fill="none" stroke="#44403C" strokeWidth="2.5" strokeDasharray="6 4" />

                            <line x1={sx(BEST_EPOCH)} x2={sx(BEST_EPOCH)} y1={m.t} y2={m.t + ph} stroke="#16A34A" strokeDasharray="2 3" />
                            <text
                                x={sx(BEST_EPOCH) + 5}
                                y={m.t + 14}
                                fontSize="11"
                                fill="#166534"
                            >
                                Best validation ({BEST_EPOCH})
                            </text>
                            {early && (
                                <>
                                    <line x1={sx(stop)} x2={sx(stop)} y1={m.t} y2={m.t + ph} stroke="#C2410C" strokeDasharray="2 3" />
                                    <text x={sx(stop) + 5} y={m.t + 30} fontSize="11" fill="#9A3412">
                                        Stopped ({stop})
                                    </text>
                                </>
                            )}

                            <line x1={sx(eff)} x2={sx(eff)} y1={m.t} y2={m.t + ph} stroke="#1C1917" strokeWidth="1.5" />
                            <circle cx={sx(eff)} cy={sy(now.train)} r="5" fill="#fff" stroke="#C2410C" strokeWidth="2" />
                            <circle cx={sx(eff)} cy={sy(now.val)} r="5" fill="#fff" stroke="#44403C" strokeWidth="2" />
                        </>
                    )}
                </Plot>

                <div className="space-y-4">
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-stone-700">
                        <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="inline-block w-6" style={{ borderTop: "3px solid #C2410C" }} />
                            Training loss
                        </span>
                        <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className="inline-block w-6" style={{ borderTop: "3px dashed #44403C" }} />
                            Validation loss
                        </span>
                    </div>
                    <Slider
                        label="Epoch"
                        value={epoch}
                        min={1}
                        max={CURVE_EPOCHS}
                        step={1}
                        onChange={setEpoch}
                        format={(v) => (stopped ? `${v} (stopped at ${stop})` : String(v))}
                    />
                    <label className="flex items-start gap-3 text-sm font-medium text-stone-900">
                        <input
                            type="checkbox"
                            checked={early}
                            onChange={(e) => setEarly(e.target.checked)}
                            className="mt-0.5 h-5 w-5 accent-orange-700"
                        />
                        Early stopping
                    </label>
                    {early && (
                        <Slider
                            label="Patience"
                            value={patience}
                            min={3}
                            max={30}
                            step={1}
                            onChange={setPatience}
                            format={(v) => `${v} epochs`}
                        />
                    )}
                    <Readout
                        items={[
                            ["Epochs run", String(eff)],
                            ["Training loss", fmt(now.train)],
                            ["Validation loss", fmt(now.val)],
                            ["Gap", fmt(now.val - now.train)],
                        ]}
                    />
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <Note tone={tone} live>
                    {phase}
                </Note>
                {early && (
                    <Note>
                        The playground stops training if the validation loss does not improve for {patience} epochs in
                        a row. Patience that is too small can stop too early because the validation loss does
                        fluctuate.
                    </Note>
                )}
            </div>
        </Lab>
    );
}

/* ====================================================================
   Lab 9: Optimizer race on a 2D loss surface
   ==================================================================== */

const OPTIMIZERS = [
    {
        id: "sgd",
        name: "SGD",
        formula: "w ← w − η·g",
        how: "The most basic step: move against the gradient by the learning rate times the gradient.",
        plus: "Simple, memory-efficient, and when well tuned it often produces models that generalize well.",
        minus: "Slow in narrow, elongated valleys, zig-zags, and is very sensitive to the learning rate.",
        use: "A baseline, and large datasets where you want to tune the learning rate carefully.",
    },
    {
        id: "momentum",
        name: "SGD with Momentum",
        formula: "v ← 0.9·v + g;  w ← w − η·v",
        how: "Keeps a velocity from previous steps, like a rolling ball that carries momentum.",
        plus: "Faster in elongated valleys and dampens zig-zagging because consistent directions reinforce each other.",
        minus: "Can overshoot the bottom and swing back. In this playground the momentum factor is fixed at 0.9.",
        use: "When SGD feels slow or oscillates, and you want to stay with a simple optimizer.",
    },
    {
        id: "rmsprop",
        name: "RMSprop",
        formula: "s ← 0.9·s + 0.1·g²;  w ← w − η·g / √s",
        how: "Divides the gradient by a moving average of recent gradient magnitudes, so each parameter gets its own step size.",
        plus: "Adaptive per-parameter steps, good when gradient scales differ widely between parameters or are unstable.",
        minus: "No bias correction at the start and the learning rate still needs tuning. Sometimes jitters near the bottom.",
        use: "Data with noisy gradients or features on varied scales.",
    },
    {
        id: "adam",
        name: "Adam",
        formula: "m ← momentum of g;  s ← average of g²;  w ← w − η·m̂ / (√ŝ + ε)",
        how: "Combines momentum (direction) with RMSprop (step scale) plus bias correction early in training.",
        plus: "A safe first choice: converges quickly and is relatively forgiving about the learning rate.",
        minus: "Twice the memory. In some cases it generalizes slightly worse than well-tuned SGD with momentum.",
        use: "The default for almost every case, including the convolutional networks in this playground.",
    },
    {
        id: "adagrad",
        name: "Adagrad",
        formula: "G ← G + g²;  w ← w − η·g / √G",
        how: "Accumulates the squares of all gradients since the start, so parameters that change often get smaller and smaller steps.",
        plus: "Very well suited to sparse features, because rarely active parameters still get large steps.",
        minus: "The accumulator only grows, so the effective learning rate keeps shrinking and training can stall too early.",
        use: "Sparse data such as text. For long training runs, choose another optimizer.",
    },
    {
        id: "adadelta",
        name: "Adadelta",
        formula: "step ← g·√(avg Δw² + ε) / √(avg g² + ε)",
        how: "An improvement on Adagrad: uses a moving-average window and matches the step units to previous steps.",
        plus: "Does not make the learning rate shrink forever, and at first it depends less on the learning rate value.",
        minus: "Often feels slow, especially with a small learning rate. Rarely used compared to Adam.",
        use: "If you want to depend less on the learning rate, with an initial value around 1.",
    },
];

const OPT_STYLES = [
    { stroke: "#C2410C", dash: undefined },
    { stroke: "#1D4ED8", dash: "6 4" },
    { stroke: "#15803D", dash: "2 3" },
    { stroke: "#7E22CE", dash: "10 3 2 3" },
    { stroke: "#B45309", dash: "1 4" },
    { stroke: "#0F766E", dash: "12 4" },
];

const RACE_STEPS = 80;
const raceLoss = (x, y) => 0.1 * x * x + 2 * y * y;

function simulate(id, lr, start, steps) {
    const p = [start.x, start.y];
    const pts = [[p[0], p[1]]];
    const v = [0, 0];
    const a = id === "adagrad" ? [0.1, 0.1] : [0, 0];
    const m = [0, 0];
    const d = [0, 0];
    let diverged = false;

    for (let t = 1; t <= steps; t++) {
        const g = [0.2 * p[0], 4 * p[1]];
        for (let k = 0; k < 2; k++) {
            const gk = g[k];
            let u;
            switch (id) {
                case "sgd":
                    u = lr * gk;
                    break;
                case "momentum":
                    v[k] = 0.9 * v[k] + gk;
                    u = lr * v[k];
                    break;
                case "rmsprop":
                    a[k] = 0.9 * a[k] + 0.1 * gk * gk;
                    u = (lr * gk) / Math.sqrt(a[k] + 1e-7);
                    break;
                case "adam":
                    m[k] = 0.9 * m[k] + 0.1 * gk;
                    a[k] = 0.999 * a[k] + 0.001 * gk * gk;
                    u = (lr * (m[k] / (1 - 0.9 ** t))) / (Math.sqrt(a[k] / (1 - 0.999 ** t)) + 1e-7);
                    break;
                case "adagrad":
                    a[k] += gk * gk;
                    u = (lr * gk) / Math.sqrt(a[k] + 1e-7);
                    break;
                default: {
                    a[k] = 0.95 * a[k] + 0.05 * gk * gk;
                    const delta = (gk * Math.sqrt(d[k] + 1e-3)) / Math.sqrt(a[k] + 1e-3);
                    d[k] = 0.95 * d[k] + 0.05 * delta * delta;
                    u = lr * delta;
                }
            }
            p[k] -= u;
        }
        const f = raceLoss(p[0], p[1]);
        if (!Number.isFinite(f) || f > 1e6) {
            diverged = true;
            break;
        }
        pts.push([p[0], p[1]]);
    }
    return { pts, diverged };
}

function OptimizerRace() {
    const [lr, setLr] = useState(0.1);
    const [start, setStart] = useState({ x: -5, y: 2 });
    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [shown, setShown] = useState(OPTIMIZERS.map((o) => o.id));

    const paths = useMemo(
        () => OPTIMIZERS.map((o) => ({ id: o.id, ...simulate(o.id, lr, start, RACE_STEPS) })),
        [lr, start]
    );

    const running = playing && step < RACE_STEPS;
    useEffect(() => {
        if (!running) return;
        const timer = setTimeout(() => setStep((s) => s + 1), 120);
        return () => clearTimeout(timer);
    }, [running, step]);

    const restart = () => {
        setStep(0);
        setPlaying(false);
    };
    const moveStart = (x, y) => {
        setStart({ x: clamp(snap(x, 0.1), -5.9, 5.9), y: clamp(snap(y, 0.1), -2.9, 2.9) });
        restart();
    };
    const toggle = (id) => setShown((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]));

    const levels = [0.3, 1, 2.5, 5, 9, 16];

    return (
        <Lab
            title="Optimizer race"
            hint="All optimizers start from the same point and head toward the bottom of the valley (the cross mark). The valley is deliberately long and narrow. Click or drag on the chart to move the starting point, then press Play."
        >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <Plot
                    xd={[-6, 6]}
                    yd={[-3, 3]}
                    xLabel="Weight 1"
                    yLabel="Weight 2"
                    onDrag={moveStart}
                    xt={7}
                    yt={7}
                    label="Contour map of an elliptical loss valley with the paths of six optimizers from the same starting point."
                >
                    {({ sx, sy }) => (
                        <>
                            {levels.map((c) => (
                                <ellipse
                                    key={c}
                                    cx={sx(0)}
                                    cy={sy(0)}
                                    rx={sx(Math.sqrt(c / 0.1)) - sx(0)}
                                    ry={sy(0) - sy(Math.sqrt(c / 2))}
                                    fill="none"
                                    stroke="#D6D3D1"
                                />
                            ))}
                            <path
                                d={`M${sx(-0.3)} ${sy(0)}H${sx(0.3)}M${sx(0)} ${sy(-0.3)}V${sy(0.3)}`}
                                stroke="#1C1917"
                                strokeWidth="2"
                            />
                            {paths.map((path, k) => {
                                if (!shown.includes(path.id)) return null;
                                const style = OPT_STYLES[k];
                                const visible = path.pts.slice(0, step + 1);
                                const end = visible[visible.length - 1];
                                return (
                                    <g key={path.id}>
                                        <polyline
                                            points={visible
                                                .map(([x, y]) => `${sx(clamp(x, -50, 50))},${sy(clamp(y, -50, 50))}`)
                                                .join(" ")}
                                            fill="none"
                                            stroke={style.stroke}
                                            strokeWidth="2"
                                            strokeDasharray={style.dash}
                                            strokeLinejoin="round"
                                        />
                                        <circle
                                            cx={sx(clamp(end[0], -50, 50))}
                                            cy={sy(clamp(end[1], -50, 50))}
                                            r="5"
                                            fill="#fff"
                                            stroke={style.stroke}
                                            strokeWidth="2.5"
                                        />
                                    </g>
                                );
                            })}
                            <circle cx={sx(start.x)} cy={sy(start.y)} r="6" fill="#1C1917" stroke="#fff" strokeWidth="2" />
                        </>
                    )}
                </Plot>

                <div className="space-y-4">
                    <Slider
                        label="Learning rate (η)"
                        value={lr}
                        min={0.01}
                        max={1}
                        step={0.01}
                        onChange={(v) => {
                            setLr(v);
                            restart();
                        }}
                        format={(v) => fmt(v, 2)}
                    />
                    <Slider
                        label="Starting point, weight 1"
                        value={start.x}
                        min={-5.9}
                        max={5.9}
                        step={0.1}
                        onChange={(v) => moveStart(v, start.y)}
                        format={(v) => fmt(v, 2)}
                    />
                    <Slider
                        label="Starting point, weight 2"
                        value={start.y}
                        min={-2.9}
                        max={2.9}
                        step={0.1}
                        onChange={(v) => moveStart(start.x, v)}
                        format={(v) => fmt(v, 2)}
                    />
                    <Slider
                        label="Step"
                        value={step}
                        min={0}
                        max={RACE_STEPS}
                        step={1}
                        onChange={(v) => {
                            setStep(v);
                            setPlaying(false);
                        }}
                        format={(v) => `${v} / ${RACE_STEPS}`}
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={btnPrimary}
                            onClick={() => {
                                if (step >= RACE_STEPS) {
                                    setStep(0);
                                    setPlaying(true);
                                } else setPlaying((p) => !p);
                            }}
                        >
                            {running ? "Pause" : "Play"}
                        </button>
                        <button type="button" className={btn} onClick={restart}>
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            <ul className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                {OPTIMIZERS.map((o, k) => {
                    const path = paths[k];
                    const idx = Math.min(step, path.pts.length - 1);
                    const [x, y] = path.pts[idx];
                    const burst = path.diverged && step >= path.pts.length;
                    const f = raceLoss(x, y);
                    return (
                        <li key={o.id}>
                            <label className="flex min-h-9 items-center gap-2 text-sm text-stone-900">
                                <input
                                    type="checkbox"
                                    checked={shown.includes(o.id)}
                                    onChange={() => toggle(o.id)}
                                    className="h-5 w-5 shrink-0 accent-orange-700"
                                />
                                <span
                                    aria-hidden="true"
                                    className="inline-block w-6 shrink-0"
                                    style={{ borderTop: `3px ${OPT_STYLES[k].dash ? "dashed" : "solid"} ${OPT_STYLES[k].stroke}` }}
                                />
                                <span className="min-w-0 flex-1 truncate">{o.name}</span>
                                <span
                                    className={
                                        "font-mono text-xs tabular-nums " + (burst ? "text-orange-800" : "text-stone-700")
                                    }
                                >
                                    {burst ? "exploded" : f < 0.001 ? "≈ 0" : fmt(f)}
                                </span>
                            </label>
                        </li>
                    );
                })}
            </ul>
            <p className="mt-3 max-w-2xl text-xs text-stone-500">
                The number on the right is the loss at the current step. The loss function is 0.1·x² + 2·y², so the y
                axis is much steeper than x. Adadelta uses ε = 0.001 in this simulation so its motion is visible. Try
                raising the learning rate to 0.5 or more to see SGD start to become unstable.
            </p>
        </Lab>
    );
}

/* ====================================================================
   Lab 10: Loss function explorer
   ==================================================================== */

const LOSS_DEMOS = {
    mse: {
        name: "MSE",
        kind: "reg",
        xd: [0, 20],
        start: 3,
        f: (p, y) => (y - p) ** 2,
        xLabel: "Prediction",
        insight: "The difference is squared: being twice as far off means a loss 4 times larger. A single outlier can dominate.",
    },
    mae: {
        name: "MAE",
        kind: "reg",
        xd: [0, 20],
        start: 3,
        f: (p, y) => Math.abs(y - p),
        xLabel: "Prediction",
        insight: "The gradient is always ±1, so outliers do not dominate. But the push does not shrink as you get close to the bottom.",
    },
    mape: {
        name: "MAPE",
        kind: "reg",
        xd: [0, 20],
        start: 3,
        f: (p, y) => (100 * Math.abs(y - p)) / Math.abs(y),
        xLabel: "Prediction",
        insight: "Error as a percentage of the true value. It is asymmetric: predicting too low caps out at 100%, while predicting too high is unbounded.",
    },
    msle: {
        name: "MSLE",
        kind: "reg",
        xd: [0, 20],
        start: 3,
        f: (p, y) => (Math.log1p(Math.max(p, 0)) - Math.log1p(Math.max(y, 0))) ** 2,
        xLabel: "Prediction",
        insight: "Uses ln(1 + value), so what is measured is the relative difference. Missing by 2 on a target of 3 feels bigger than missing by 2 on a target of 300.",
    },
    poisson: {
        name: "Poisson",
        kind: "reg",
        xd: [0.05, 20],
        start: 3,
        f: (p, y) => p - y * Math.log(p),
        xLabel: "Prediction (must be positive)",
        insight: "For count data. The bottom of the curve stays at prediction equals target, but predicting too low is punished more sharply than predicting too high.",
    },
    bce: {
        name: "Binary crossentropy",
        kind: "bin",
        xd: [0.01, 0.99],
        start: 0.2,
        f: (p, y) => -(y * Math.log(p) + (1 - y) * Math.log(1 - p)),
        xLabel: "Model's probability of class 1",
        insight: "The loss shoots up when the model is confident but wrong. That is why crossentropy gives a strong correction to confident mistakes.",
    },
    hinge: {
        name: "Hinge",
        kind: "margin",
        xd: [-3, 3],
        start: -1,
        f: (s, y) => Math.max(0, 1 - y * s),
        xLabel: "Model score (s)",
        insight: "The loss is zero as soon as y·s ≥ 1. Samples that are already correct and confident no longer draw the model's attention.",
    },
    sqhinge: {
        name: "Squared hinge",
        kind: "margin",
        xd: [-3, 3],
        start: -1,
        f: (s, y) => Math.max(0, 1 - y * s) ** 2,
        xLabel: "Model score (s)",
        insight: "Like hinge but squared: the curve is smooth and large violations are punished harder.",
    },
};

function LossExplorer() {
    const [id, setId] = useState("mse");
    const [target, setTarget] = useState(8);
    const [label, setLabel] = useState(1);
    const [x, setX] = useState(3);

    const demo = LOSS_DEMOS[id];
    const y = demo.kind === "reg" ? target : label;
    const [lo, hi] = demo.xd;
    const xStep = demo.kind === "reg" ? 0.1 : demo.kind === "bin" ? 0.01 : 0.05;
    const xs = clamp(x, lo, hi);

    const { curve, yd } = useMemo(() => {
        const pts = Array.from({ length: 161 }, (_, i) => {
            const px = lo + ((hi - lo) * i) / 160;
            return [px, demo.f(px, y)];
        });
        const vals = pts.map((pt) => pt[1]);
        const top = Math.max(...vals);
        const bottom = Math.min(...vals);
        return { curve: pts, yd: [bottom < 0 ? bottom * 1.15 : 0, top * 1.05 || 1] };
    }, [demo, y, lo, hi]);

    const fx = demo.f(xs, y);
    const h = (hi - lo) * 1e-4;
    const a = Math.max(lo, xs - h);
    const b = Math.min(hi, xs + h);
    const slope = (demo.f(b, y) - demo.f(a, y)) / (b - a);
    const dir = slope > 1e-3 ? -1 : slope < -1e-3 ? 1 : 0;

    function select(next) {
        setId(next);
        setX(LOSS_DEMOS[next].start);
        setLabel(1);
    }

    let push;
    if (dir === 1) push = "Negative gradient: increasing this value lowers the loss, so the optimizer will push it to the right.";
    else if (dir === -1) push = "Positive gradient: decreasing this value lowers the loss, so the optimizer will push it to the left.";
    else push = "The gradient is almost zero: there is no push. This is the bottom of the curve, or a flat section such as hinge once the margin is satisfied.";

    return (
        <Lab
            title="Compare the shapes of loss functions"
            hint="Choose a loss, then drag the point on the chart or use the slider. The height of the curve is the loss, and the orange arrow shows the direction of the optimizer's push."
        >
            <div className="mb-4">
                <Segmented
                    label="Loss function"
                    value={id}
                    onChange={select}
                    options={Object.entries(LOSS_DEMOS).map(([key, d]) => [key, d.name])}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
                <Plot
                    xd={demo.xd}
                    yd={yd}
                    xLabel={demo.xLabel}
                    yLabel={`${demo.name} loss`}
                    onDrag={(px) => setX(clamp(snap(px, xStep), lo, hi))}
                    label={`${demo.name} curve. At value ${fmt(xs)} the loss equals ${fmt(fx)} and the gradient is ${fmt(slope)}.`}
                >
                    {({ sx, sy }) => (
                        <>
                            {demo.kind === "reg" && (
                                <line x1={sx(y)} x2={sx(y)} y1={sy(yd[0])} y2={sy(yd[1])} stroke="#16A34A" strokeDasharray="3 3" />
                            )}
                            <polyline
                                points={curve.map(([cx, cy]) => `${sx(cx)},${sy(cy)}`).join(" ")}
                                fill="none"
                                stroke="#44403C"
                                strokeWidth="2.5"
                            />
                            {dir !== 0 && (
                                <g>
                                    <line
                                        x1={sx(xs)}
                                        y1={sy(fx)}
                                        x2={sx(xs) + dir * 38}
                                        y2={sy(fx)}
                                        stroke="#C2410C"
                                        strokeWidth="3"
                                    />
                                    <polygon
                                        points={`${sx(xs) + dir * 48},${sy(fx)} ${sx(xs) + dir * 36},${sy(fx) - 6} ${sx(xs) + dir * 36},${sy(fx) + 6}`}
                                        fill="#C2410C"
                                    />
                                </g>
                            )}
                            <circle cx={sx(xs)} cy={sy(fx)} r="6" fill="#C2410C" stroke="#fff" strokeWidth="2" />
                        </>
                    )}
                </Plot>

                <div className="space-y-4">
                    {demo.kind === "reg" ? (
                        <Slider
                            label="True target value"
                            value={target}
                            min={1}
                            max={15}
                            step={0.5}
                            onChange={setTarget}
                        />
                    ) : (
                        <div>
                            <p className="mb-1 text-sm font-medium text-stone-900">True class</p>
                            <Segmented
                                label="True class"
                                value={label}
                                onChange={setLabel}
                                options={demo.kind === "bin" ? [[1, "1"], [0, "0"]] : [[1, "+1"], [-1, "−1"]]}
                            />
                        </div>
                    )}
                    <Slider
                        label={demo.kind === "reg" ? "Model prediction" : demo.kind === "bin" ? "Probability p" : "Score s"}
                        value={xs}
                        min={lo}
                        max={hi}
                        step={xStep}
                        onChange={setX}
                        format={(v) => fmt(v, 3)}
                    />
                    <Readout
                        items={[
                            ["Loss", fmt(fx)],
                            ["Gradient", fmt(slope)],
                        ]}
                    />
                </div>
            </div>
            <div className="mt-4 space-y-2">
                <Note live>{push}</Note>
                <Note>{demo.insight}</Note>
            </div>
        </Lab>
    );
}

/* ====================================================================
   Content: explanation lists
   ==================================================================== */

const ACTIVATION_NOTES = [
    ["ReLU", "max(0, z). Fast to compute and the first choice for hidden layers. The downside is that a neuron that always receives a negative z never activates again."],
    ["Tanh", "Range -1 to 1, centered on zero. Smoother than ReLU, but its gradient shrinks at the ends of the curve so deep layers learn slowly."],
    ["Sigmoid", "Range 0 to 1. Suited to the output of two-class classification. It is rarely chosen for hidden layers because its gradient shrinks quickly."],
    ["Linear", "No change. Used in regression outputs, and also by hinge loss, which needs raw scores."],
    ["Softplus", "A smooth version of ReLU that is always positive. The playground uses it in the output for Poisson loss."],
    ["Softmax", "Turns a set of scores into probabilities that sum to 1. Used in the output of classification with more than two classes."],
];

const HYPERPARAMETERS = [
    ["Learning rate", "The size of each weight correction step. Too small: learning is very slow. Too large: the loss jumps around or becomes NaN. Start at 0.001 for Adam or 0.01 for SGD, then change it by a factor of 3 to 10."],
    ["Epochs", "How many times the whole training set is seen. Too few leaves the model underfitting, too many makes it memorize. Watch the validation loss curve or turn on early stopping."],
    ["Batch size", "The number of samples before the weights are updated. Small batch: frequent but noisy updates, often helps generalization, slower per epoch. Large batch: smooth and fast per epoch, but uses more memory."],
    ["Seed", "A number that fixes the randomness: the data split and the initial weights. With the same seed, two runs can be compared fairly. Leave it empty for different results each run."],
    ["Data split", "Data is shuffled then split into training, validation, and test sets (70/15/15 if there are at least 30 rows). Validation is used to monitor training. Test data is used only at the end as an estimate of performance on new data."],
    ["Early stopping", "Stops when the validation loss has not improved for 10 epochs in a row. Saves time and reduces overfitting, but needs validation data."],
    ["Layers and neurons", "More layers and neurons mean more capacity, but also more parameters, more data needed, and easier overfitting. Start small, add more if underfitting."],
    ["Activation function", "ReLU to start. Tanh and Sigmoid are smoother but their gradients shrink at the ends of the curve (vanishing gradient)."],
    ["Column handling", "Numeric columns are standardized (mean 0, standard deviation 1). Text columns are converted with One-hot (one 0/1 column per value) or Label (0, 1, 2…). One-hot suits unordered categories, but increases the number of inputs."],
];

const METRICS = [
    ["Accuracy", "The percentage of correct guesses. It can be misleading when one class dominates the data."],
    ["Precision", "Of everything predicted as class X, how much is truly X."],
    ["Recall", "Of everything that is truly class X, how much was found."],
    ["F1-score", "Precision and recall combined into one number (harmonic mean)."],
    ["MAE and RMSE", "Average error in the units of the target. RMSE punishes large errors more heavily."],
    ["R²", "How much of the target's variation the model explains. 1 is perfect, 0 equals guessing the mean, negative is worse than that."],
];

const LOSS_GUIDE = {
    reg: [
        {
            name: "Mean Squared Error (MSE)",
            formula: "mean of (y − ŷ)²",
            how: "The average of the squared differences between target and prediction.",
            plus: "Smooth and easy to optimize. The gradient shrinks near the bottom so steps are gentle.",
            minus: "Very sensitive to outliers, and its units are squared too, which makes it hard to read directly.",
            use: "The default choice for regression.",
        },
        {
            name: "Mean Absolute Error (MAE)",
            formula: "mean of |y − ŷ|",
            how: "The average of the absolute differences.",
            plus: "More robust to outliers, and its units match the target so it is easy to read.",
            minus: "Constant gradient, so it is less smooth near the bottom and needs a smaller learning rate at the end.",
            use: "Data with outliers where you do not want the outliers to dominate.",
        },
        {
            name: "Mean Absolute Percentage Error (MAPE)",
            formula: "mean of |y − ŷ| / |y| × 100",
            how: "Error expressed as a percentage of the true value.",
            plus: "Easy to understand and to compare across scales, for example being off by 8%.",
            minus: "Blows up when the target is near 0 and punishes predictions that are too high more than too low.",
            use: "Targets that are always far from zero and where you care about relative differences.",
        },
        {
            name: "Mean Squared Logarithmic Error (MSLE)",
            formula: "mean of (ln(1+y) − ln(1+ŷ))²",
            how: "MSE on values that have been log-transformed.",
            plus: "Focuses on relative differences, suited to targets with a very wide range such as prices or populations.",
            minus: "Targets and predictions cannot be negative, and predictions that are too low are punished more heavily.",
            use: "Positive targets whose values can differ by orders of magnitude.",
        },
        {
            name: "Poisson",
            formula: "mean of (ŷ − y·ln ŷ)",
            how: "Derived from the Poisson distribution for count data.",
            plus: "Appropriate for event counts such as visits per day or number of claims.",
            minus: "The target must be ≥ 0 and predictions must be positive (the playground uses a softplus output). Less suitable for ordinary continuous data.",
            use: "Targets that are whole numbers from counting.",
        },
    ],
    cls: [
        {
            name: "Binary Crossentropy",
            formula: "−[y·ln p + (1−y)·ln(1−p)]",
            how: "Measures how far the probability of class 1 is from the true label (0 or 1). The output uses sigmoid.",
            plus: "The standard for two classes. Produces a strong gradient when the model is confidently wrong.",
            minus: "Sensitive to wrong labels, because the penalty rises sharply for confident misses.",
            use: "Two-class classification.",
        },
        {
            name: "Categorical Crossentropy",
            formula: "−Σ y_k · ln p_k",
            how: "The multiclass version: labels are one-hot, the output is softmax, and only the probability of the correct class counts.",
            plus: "The standard for multiclass, including image classification in this playground.",
            minus: "One-hot labels take up memory when there are very many classes, and it only supports one correct label per sample.",
            use: "Three or more classes.",
        },
        {
            name: "Sparse Categorical Crossentropy",
            formula: "−ln p_(correct class)",
            how: "The same calculation as categorical, but labels are class index numbers (0, 1, 2…) with no one-hot encoding.",
            plus: "Memory-efficient for many classes.",
            minus: "Learning results are the same as categorical. The only difference is how labels are stored.",
            use: "Many classes and labels that are already indices.",
        },
        {
            name: "Kullback-Leibler Divergence",
            formula: "Σ y · ln(y / p)",
            how: "Measures the difference between two probability distributions: the target and the prediction.",
            plus: "Useful when the target is a distribution (soft labels) rather than one definite class.",
            minus: "With one-hot labels the result is equivalent to crossentropy, so it gives no extra benefit. It is asymmetric.",
            use: "Targets that are probability distributions.",
        },
        {
            name: "Hinge",
            formula: "max(0, 1 − y·s),  y ∈ {−1, +1}",
            how: "Like an SVM: only samples that are still near or past the decision boundary are penalized.",
            plus: "Focuses on hard samples around the boundary. Samples that are already correct and confident are ignored.",
            minus: "Does not produce probabilities and is not smooth right at the margin point.",
            use: "Two classes when a firm separating boundary matters more than probabilities.",
        },
        {
            name: "Squared Hinge",
            formula: "max(0, 1 − y·s)²",
            how: "Hinge, squared.",
            plus: "The curve is smooth, and large violations are punished harder.",
            minus: "More sensitive to outliers than hinge, and also has no probabilities.",
            use: "A replacement for hinge when you want a smoother gradient.",
        },
    ],
    other: [
        {
            name: "Cosine Proximity",
            formula: "−(y·ŷ) / (‖y‖·‖ŷ‖)",
            how: "Compares the direction of two vectors and ignores their length.",
            plus: "Suited to embeddings and similarity, where direction matters more than magnitude.",
            minus: "Needs a target with more than one dimension. With the single target column in this playground, training will fail.",
            use: "Vector comparison, not ordinary classification or regression.",
        },
    ],
};

const OUTPUT_MAP = [
    ["MSE, MAE, MAPE, MSLE", "Linear", "1"],
    ["Poisson", "Softplus", "1"],
    ["Binary crossentropy", "Sigmoid", "1"],
    ["Hinge, Squared hinge", "Linear", "1"],
    ["Categorical, Sparse, KL", "Softmax", "number of classes"],
];

const CNN_ROWS = [
    ["Conv 3×3, 16 filters, ReLU", "64×64×3 → 64×64×16", "448"],
    ["Max pooling 2×2", "→ 32×32×16", "0"],
    ["Conv 3×3, 32 filters, ReLU", "→ 32×32×32", "4,640"],
    ["Max pooling 2×2", "→ 16×16×32", "0"],
    ["Conv 3×3, 64 filters, ReLU", "→ 16×16×64", "18,496"],
    ["Max pooling 2×2", "→ 8×8×64", "0"],
    ["Flatten", "→ 4,096", "0"],
    ["Dropout 0.3", "→ 4,096", "0"],
    ["Dense 64, ReLU", "→ 64", "262,208"],
    ["Dense k, Softmax", "→ k classes", "65 × k"],
];

const TROUBLE = [
    ["Loss becomes NaN or infinity", "The learning rate is too large or there are extreme values in the data. Divide the learning rate by 10, and check numeric columns for extreme values."],
    ["Loss barely goes down", "The learning rate is too small, there are too few epochs, or the model is too small. Raise the learning rate gradually, add epochs, or add neurons."],
    ["Training loss falls, validation loss rises", "Overfitting. Turn on early stopping, shrink the network, reduce epochs, or add data."],
    ["Both losses stay high", "Underfitting. Add network capacity, train longer, or check whether the features are really related to the target."],
    ["High accuracy but the model is useless", "The classes are probably imbalanced. Look at recall and the per-class confusion matrix, not just accuracy."],
    ["Results differ every time you train", "The data split and initial weights are random. Set a seed so comparisons between settings are fair."],
    ["Training fails with a loss message", "The loss does not match the target. Use the loss the playground suggests: MSE for numbers, binary crossentropy for 2 classes, categorical crossentropy for more than 2 classes."],
];

const TOC = [
    ["introduction", "Introduction to machine learning"],
    ["neuron", "Neurons and neural networks"],
    ["learning", "How a model learns"],
    ["tensorflow", "TensorFlow"],
    ["images", "Image classification"],
    ["configuration", "Training configuration"],
    ["optimizer", "Optimizers"],
    ["loss", "Loss functions"],
    ["tips", "Troubleshooting"],
];

/* ====================================================================
   Explanation cards for optimizers and loss functions
   ==================================================================== */

function InfoCard({ item, swatch }) {
    return (
        <article className="min-w-0 rounded-md border border-stone-200 bg-white p-4">
            <div className="flex items-center gap-2">
                {swatch && (
                    <span
                        aria-hidden="true"
                        className="inline-block w-6 shrink-0"
                        style={{ borderTop: `3px ${swatch.dash ? "dashed" : "solid"} ${swatch.stroke}` }}
                    />
                )}
                <h4 className="text-base font-semibold text-stone-900">{item.name}</h4>
            </div>
            <p className="mt-2 break-words rounded-sm bg-stone-100 px-2 py-1 font-mono text-xs text-stone-800">
                {item.formula}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-stone-700">{item.how}</p>
            <dl className="mt-3 space-y-2 text-sm leading-relaxed">
                <div className="border-l-2 border-green-600 pl-3">
                    <dt className="font-medium text-stone-900">Pros</dt>
                    <dd className="text-stone-700">{item.plus}</dd>
                </div>
                <div className="border-l-2 border-orange-700 pl-3">
                    <dt className="font-medium text-stone-900">Cons</dt>
                    <dd className="text-stone-700">{item.minus}</dd>
                </div>
                <div className="border-l-2 border-stone-400 pl-3">
                    <dt className="font-medium text-stone-900">Best for</dt>
                    <dd className="text-stone-700">{item.use}</dd>
                </div>
            </dl>
        </article>
    );
}

function LossGuide() {
    const [group, setGroup] = useState("reg");
    return (
        <div className="space-y-4">
            <Segmented
                label="Loss group"
                value={group}
                onChange={setGroup}
                options={[
                    ["reg", "Regression (5)"],
                    ["cls", "Classification (6)"],
                    ["other", "Other (1)"],
                ]}
            />
            <div className="grid gap-4 md:grid-cols-2">
                {LOSS_GUIDE[group].map((item) => (
                    <InfoCard key={item.name} item={item} />
                ))}
            </div>
        </div>
    );
}

/* ====================================================================
   Page
   ==================================================================== */

export default function MateriPage() {
    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
                <header>
                    <nav aria-label="Breadcrumb" className="text-xs text-stone-500">
                        <Link href="/" className={"rounded-sm underline-offset-4 hover:text-stone-900 hover:underline " + focusClass}>
                            Neural Network Playground
                        </Link>
                        <span aria-hidden="true"> / </span>
                        <span aria-current="page">Learn</span>
                    </nav>
                    <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                        Learn neural networks, from zero to image classification
                    </h1>
                    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-stone-700">
                        Every concept on this page has a chart you can drag. Change the numbers, see what changes, then
                        use that understanding when you set up the configuration on the training page.
                    </p>
                </header>

                <div className="mt-10 grid gap-x-12 gap-y-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
                    <nav aria-label="Table of contents" className="lg:sticky lg:top-6 lg:self-start">
                        <p className="mb-2 text-sm font-semibold text-stone-900">On this page</p>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:flex-col lg:gap-1">
                            {TOC.map(([id, label]) => (
                                <li key={id}>
                                    <a
                                        href={`#${id}`}
                                        className={
                                            "inline-flex min-h-8 items-center rounded-sm text-sm text-stone-700 underline-offset-4 " +
                                            "hover:text-stone-900 hover:underline " +
                                            focusClass
                                        }
                                    >
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="min-w-0">
                        {/* 1 ------------------------------------------------------------ */}
                        <Section
                            id="introduction"
                            title="Introduction to machine learning"
                            intro="Machine learning lets computers find rules from examples, instead of having humans write the rules one by one."
                        >
                            <Sub title="AI, machine learning, and deep learning">
                                <P>
                                    The three are nested inside each other. Artificial intelligence (AI) is the broad field
                                    of making machines behave intelligently. Machine learning (ML) is its branch that learns
                                    from data. Deep learning is ML that uses neural networks with many layers, and that is
                                    what you train in this playground.
                                </P>
                                <div
                                    role="img"
                                    aria-label="Nested diagram: AI contains machine learning, which contains deep learning"
                                    className="max-w-lg rounded-md border border-stone-400 bg-white p-3"
                                >
                                    <p className="text-sm font-semibold text-stone-900">Artificial intelligence (AI)</p>
                                    <div className="mt-2 rounded-md border border-stone-400 bg-stone-100 p-3">
                                        <p className="text-sm font-semibold text-stone-900">Machine learning</p>
                                        <div className="mt-2 rounded-md border border-orange-700 bg-orange-50 p-3">
                                            <p className="text-sm font-semibold text-stone-900">
                                                Deep learning (neural network)
                                            </p>
                                            <p className="text-xs text-stone-600">What you train in this playground</p>
                                        </div>
                                    </div>
                                </div>
                            </Sub>

                            <Sub title="Traditional programming and machine learning">
                                <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                                    <div className="rounded-md border border-stone-200 bg-white p-4">
                                        <h4 className="text-sm font-semibold text-stone-900">Traditional programming</h4>
                                        <p className="mt-1 text-sm leading-relaxed text-stone-700">
                                            Humans write the <strong>rules</strong>. Rules + input data produce answers.
                                            Works well when the rules are clear, such as calculating tax.
                                        </p>
                                    </div>
                                    <div className="rounded-md border border-orange-700 bg-white p-4">
                                        <h4 className="text-sm font-semibold text-stone-900">Machine learning</h4>
                                        <p className="mt-1 text-sm leading-relaxed text-stone-700">
                                            Humans provide the <strong>data and the answers</strong>. The computer finds
                                            the rules itself, which is called a model. Works well when the rules are hard
                                            to write down, such as telling cats from dogs.
                                        </p>
                                    </div>
                                </div>
                            </Sub>

                            <Sub title="Two kinds of tasks">
                                <DefList
                                    items={[
                                        ["Regression", "Predicting a number, such as a house price or a temperature. Sample dataset: House Prices."],
                                        ["Classification", "Predicting a category, such as pass or fail (2 classes) and cat, dog, bird (many classes). Sample datasets: Student Graduation, Three Groups, and image classification."],
                                    ]}
                                />
                                <P>
                                    Both are supervised learning: the model learns from data that already has answers
                                    (targets). The playground checks the last column of the CSV to decide the task, then
                                    suggests a suitable loss.
                                </P>
                            </Sub>

                            <RegressionLab />
                            <P>
                                What you just did is the core of all machine learning: finding the parameters (here w and
                                b) that make the error as small as possible. A neural network does the same thing, just
                                with thousands of parameters and shapes that do not have to be straight lines.
                            </P>
                        </Section>

                        {/* 2 ------------------------------------------------------------ */}
                        <Section
                            id="neuron"
                            title="Neurons and neural networks"
                            intro="A neural network is built from small units called neurons. A single neuron does only a simple calculation; their power comes from their number."
                        >
                            <Sub title="What does one neuron compute?">
                                <P>
                                    A neuron multiplies each input by its weight, adds everything up along with the bias,
                                    then passes the result (z) through an activation function. These weights and the bias
                                    are what change during training.
                                </P>
                            </Sub>
                            <NeuronLab />

                            <Sub title="Why do we need activation functions?">
                                <P>
                                    Without activation, no matter how many layers you stack, the result is still a straight
                                    line. A nonlinear activation lets the network capture curved and complex patterns.
                                </P>
                                <DefList items={ACTIVATION_NOTES} />
                            </Sub>

                            <Sub title="The layers of a network">
                                <P>
                                    A network consists of an input layer (one neuron per feature), one or more hidden
                                    layers, and an output layer that gives the answer. The output of one layer becomes the
                                    input of the next. You can try designing one in the{" "}
                                    <a href="#configuration" className={textLink}>
                                        configuration
                                    </a>{" "}
                                    section.
                                </P>
                            </Sub>
                        </Section>

                        {/* 3 ------------------------------------------------------------ */}
                        <Section
                            id="learning"
                            title="How a model learns"
                            intro="Training is the repetition of a small cycle: guess, measure how wrong it was, then fix it a little."
                        >
                            <Sub title="One training cycle">
                                <ol className="max-w-2xl list-decimal space-y-2 pl-5 text-base leading-relaxed text-stone-700">
                                    <li>
                                        <strong className="text-stone-900">Forward pass.</strong> Data flows from the input
                                        to the output and produces a prediction.
                                    </li>
                                    <li>
                                        <strong className="text-stone-900">Compute the loss.</strong> The loss function
                                        measures how far the prediction is from the target.
                                    </li>
                                    <li>
                                        <strong className="text-stone-900">Backpropagation.</strong> The gradient is
                                        computed: the direction and strength of the change to each weight that will lower
                                        the loss.
                                    </li>
                                    <li>
                                        <strong className="text-stone-900">Update the weights.</strong> The optimizer moves
                                        the weights along the gradient, by the learning rate.
                                    </li>
                                </ol>
                                <P>
                                    This cycle repeats batch after batch. One <em>epoch</em> is finished when the whole
                                    training set has been used once. With 800 rows of training data and a batch size of
                                    32, one epoch contains 25 weight updates.
                                </P>
                            </Sub>

                            <GradientLab />
                            <P>
                                A real network has thousands of weights, so its loss valley has thousands of dimensions.
                                The principle is still the same as the single weight above: go down along the slope, with
                                a step size set by the learning rate.
                            </P>
                        </Section>

                        {/* 4 ------------------------------------------------------------ */}
                        <Section
                            id="tensorflow"
                            title="TensorFlow"
                            intro="TensorFlow is a machine learning library from Google that handles matrix and gradient calculations, so you only need to assemble the model."
                        >
                            <Sub title="TensorFlow.js in the browser">
                                <P>
                                    This playground uses TensorFlow.js, the JavaScript version of TensorFlow. Training
                                    runs directly in the browser (using the GPU through WebGL when available), so your CSV
                                    and image data are not sent to a server. The Python version uses Keras with nearly the
                                    same concepts, which is why the playground can generate equivalent Python and Node.js
                                    code.
                                </P>
                                <DefList
                                    items={[
                                        ["Tensor", "A container of multi-dimensional numbers. A scalar is rank 0, a vector rank 1, a matrix rank 2, and a batch of color images rank 4."],
                                        ["Layer", "One stage of computation, such as dense (ordinary neurons), conv2d, or dropout."],
                                        ["Sequential", "A model whose layers are stacked in order from input to output."],
                                        ["compile and fit", "compile chooses the optimizer and loss. fit runs training with the epochs and batch size."],
                                    ]}
                                />
                            </Sub>

                            <TensorLab />

                            <Sub title="What does the code look like?">
                                <P>
                                    This is roughly what the playground does for the House Prices dataset (3 features, 1 target):
                                </P>
                                <CodeBlock code={TF_CODE} label="Example TensorFlow.js code for a regression model" />
                            </Sub>
                        </Section>

                        {/* 5 ------------------------------------------------------------ */}
                        <Section
                            id="images"
                            title="Image classification"
                            intro="To a computer, an image is just a table of numbers. The model's job is to find patterns in those numbers that separate one class from another."
                        >
                            <Sub title="Why not use plain dense layers?">
                                <P>
                                    A 64 × 64 color image contains 12,288 numbers. If every neuron in the first layer is
                                    connected to all of them, a single layer of just 64 neurons already has more than
                                    786,000 weights, and an object that shifts slightly is treated as a completely
                                    different pattern. A Convolutional Neural Network (CNN) solves this with small filters
                                    that are reused across the whole image.
                                </P>
                            </Sub>

                            <Sub title="The flow in this playground">
                                <ol className="max-w-2xl list-decimal space-y-2 pl-5 text-base leading-relaxed text-stone-700">
                                    <li>
                                        You choose a folder with one subfolder per class, for example pets/cats and
                                        pets/dogs. The subfolder names become the class names.
                                    </li>
                                    <li>
                                        Each image is converted to 64 × 64 RGB pixels, and the values 0 to 255 are divided
                                        by 255 to give 0 to 1. Transparent areas become white.
                                    </li>
                                    <li>
                                        Images are shuffled and split 70/15/15 into training, validation, and test sets (if
                                        there are at least 30 images).
                                    </li>
                                    <li>Three convolution and pooling blocks extract features, from simple edges up to shapes.</li>
                                    <li>
                                        Flatten, dropout, and one dense layer combine the features, then softmax outputs the
                                        probability of each class.
                                    </li>
                                    <li>The model is trained with categorical crossentropy and evaluated on the test data.</li>
                                </ol>
                            </Sub>

                            <ConvLab />

                            <Sub title="What each part of a CNN does">
                                <DefList
                                    items={[
                                        ["Convolution", "A set of small (3 × 3) filters slid across the whole image. The filter values are learned through training, not set by hand like the examples above."],
                                        ["Pooling", "Summarizes each 2 × 2 block into its largest value. The image size is halved, computation is lighter, and the model becomes more tolerant of small shifts."],
                                        ["Flatten", "Flattens the feature maps into one long vector so they can enter a dense layer."],
                                        ["Dropout", "During training, some neurons (30%) are switched off at random. This forces the model not to rely on a single path and reduces overfitting."],
                                        ["Dense and softmax", "Dense combines the features. Softmax at the output turns scores into probabilities, one neuron per class."],
                                    ]}
                                />
                            </Sub>

                            <Sub title="Parameter count of the image model">
                                <DataTable
                                    caption="CNN layers in the playground and their parameter counts"
                                    head={["Layer", "Output shape", "Parameters"]}
                                    rows={CNN_ROWS}
                                />
                                <P>
                                    The total is 285,792 + 65 × k parameters, or 285,922 for two classes. Almost all of them
                                    are in the dense layer, while the three convolution layers have only about 23,000. That
                                    is the efficiency of reusing filters.
                                </P>
                            </Sub>

                            <SoftmaxLab />

                            <Sub title="Tips for image data">
                                <DefList
                                    items={[
                                        ["Balance the classes", "If one class has far more images, the model can 'cheat' by always guessing that class. The playground shows a warning in the Data check section."],
                                        ["Variety matters", "Photos with varied backgrounds, angles, and lighting make the model more robust than uniform photos."],
                                        ["Number of images", "The playground needs at least 2 classes and accepts up to 2,000 images. More images per class almost always helps."],
                                        ["Read the validation curve", "Image models overfit very easily. If the validation loss rises, stop training or turn on early stopping."],
                                    ]}
                                />
                            </Sub>
                        </Section>

                        {/* 6 ------------------------------------------------------------ */}
                        <Section
                            id="configuration"
                            title="Training configuration"
                            intro="The settings you choose before training are called hyperparameters. The model does not learn them itself, you choose them."
                        >
                            <DefList items={HYPERPARAMETERS} />

                            <Sub title="Designing the architecture">
                                <P>
                                    The architecture determines the model's capacity. Notice how the parameter count jumps
                                    as neurons are added, and compare it with the amount of data you have.
                                </P>
                            </Sub>
                            <ArchitectureLab />

                            <Sub title="Underfitting, overfitting, and early stopping">
                                <P>
                                    The goal of training is a model that does well on <em>new</em> data, not just on the
                                    training data. That is why the validation loss matters more than the training loss.
                                </P>
                            </Sub>
                            <CurvesLab />

                            <Sub title="Evaluation metrics">
                                <P>
                                    After training, the model is tested on test data it has never seen. The metrics the
                                    playground displays:
                                </P>
                                <DefList items={METRICS} />
                            </Sub>
                        </Section>

                        {/* 7 ------------------------------------------------------------ */}
                        <Section
                            id="optimizer"
                            title="Optimizers"
                            intro="The gradient only tells you which way is down. The optimizer decides how that gradient is used to move the weights, and this is what makes training differ in speed and stability."
                        >
                            <OptimizerRace />

                            <Sub title="The six optimizers in the playground">
                                <div className="grid gap-4 md:grid-cols-2">
                                    {OPTIMIZERS.map((o, i) => (
                                        <InfoCard key={o.id} item={o} swatch={OPT_STYLES[i]} />
                                    ))}
                                </div>
                                <Note>
                                    Rule of thumb: start with Adam and a learning rate of 0.001. If the results are
                                    unstable or you want to try for better generalization, try SGD with Momentum and a
                                    learning rate of 0.01.
                                </Note>
                            </Sub>
                        </Section>

                        {/* 8 ------------------------------------------------------------ */}
                        <Section
                            id="loss"
                            title="Loss functions"
                            intro="A loss function is a single number that says how wrong the model is. Your choice determines what the model treats as important."
                        >
                            <LossExplorer />

                            <Sub title="Twelve loss functions">
                                <P>
                                    Choose a loss based on the type of target. The playground detects the type of the
                                    target column and suggests a suitable loss, and warns you if your choice does not match
                                    the data.
                                </P>
                                <LossGuide />
                            </Sub>

                            <Sub title="The loss determines the output layer">
                                <P>
                                    The output layer must match the loss. The playground sets this automatically:
                                </P>
                                <DataTable
                                    caption="Activation and number of output neurons for each loss"
                                    head={["Loss", "Output activation", "Output neurons"]}
                                    rows={OUTPUT_MAP}
                                />
                            </Sub>
                        </Section>

                        {/* 9 ------------------------------------------------------------ */}
                        <Section
                            id="tips"
                            title="Troubleshooting"
                            intro="The symptoms that appear most often during training, and the first step to fix each one."
                        >
                            <DefList items={TROUBLE} />

                            <div>
                                <p className="max-w-2xl text-base leading-relaxed text-stone-700">
                                    Now it is time to try it with real data.
                                </p>
                                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                    <Link
                                        href="/training"
                                        className={
                                            "inline-flex h-11 items-center justify-center rounded-md bg-orange-700 px-6 " +
                                            "text-sm font-medium text-white transition-colors hover:bg-orange-800 " +
                                            "active:bg-orange-900 motion-reduce:transition-none " +
                                            focusClass
                                        }
                                    >
                                        Train a CSV model
                                    </Link>
                                    <Link
                                        href="/training/image"
                                        className={
                                            "inline-flex h-11 items-center justify-center rounded-md bg-stone-900 px-6 " +
                                            "text-sm font-medium text-white transition-colors hover:bg-stone-800 " +
                                            "active:bg-stone-950 motion-reduce:transition-none " +
                                            focusClass
                                        }
                                    >
                                        Train an image model
                                    </Link>
                                    <Link
                                        href="/test"
                                        className={
                                            "inline-flex h-11 items-center justify-center rounded-md border border-stone-500 " +
                                            "bg-white px-6 text-sm font-medium text-stone-900 transition-colors " +
                                            "hover:bg-stone-100 motion-reduce:transition-none " +
                                            focusClass
                                        }
                                    >
                                        Test a model
                                    </Link>
                                </div>
                            </div>
                        </Section>
                    </div>
                </div>
            </div>
        </main>
    );
}