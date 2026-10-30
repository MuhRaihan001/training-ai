"use client";

import { fmt, fmtPercent } from "./ui";

const count = new Intl.NumberFormat("en-US");

const W = 420;
const H = 340;
const M = { l: 60, r: 16, t: 14, b: 48 };
const TICKS = 5;

function domainOf(values, padding = 0.05) {
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
        min -= 1;
        max += 1;
    }
    const pad = (max - min) * padding;
    return [min - pad, max + pad];
}

function Stat({ label, value, note }) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="mt-1 font-mono text-lg tabular-nums text-stone-900">{value}</dd>
            {note && <dd className="mt-0.5 text-xs text-stone-500">{note}</dd>}
        </div>
    );
}

function PointPlot({ points, xDomain, yDomain, xLabel, yLabel, guide, label }) {
    const pw = W - M.l - M.r;
    const ph = H - M.t - M.b;
    const x = (v) => M.l + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * pw;
    const y = (v) => M.t + ph - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * ph;
    const ticks = (d) => Array.from({ length: TICKS }, (_, t) => d[0] + ((d[1] - d[0]) * t) / (TICKS - 1));

    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={label}
            className="block w-full min-w-[320px]"
            fontFamily="system-ui, sans-serif"
        >
            {ticks(yDomain).map((v) => (
                <g key={`y-${v}`}>
                    <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="#E7E5E4" />
                    <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#57534E">
                        {fmt(v)}
                    </text>
                </g>
            ))}
            {ticks(xDomain).map((v) => (
                <text key={`x-${v}`} x={x(v)} y={H - 28} textAnchor="middle" fontSize="11" fill="#57534E">
                    {fmt(v)}
                </text>
            ))}

            <text x={M.l + pw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#57534E">
                {xLabel}
            </text>
            <text
                transform={`translate(14 ${M.t + ph / 2}) rotate(-90)`}
                textAnchor="middle"
                fontSize="11"
                fill="#57534E"
            >
                {yLabel}
            </text>

            {guide === "diagonal" && (
                <line
                    x1={x(xDomain[0])}
                    y1={y(yDomain[0])}
                    x2={x(xDomain[1])}
                    y2={y(yDomain[1])}
                    stroke="#44403C"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                />
            )}
            {guide === "zero" && (
                <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="#44403C" strokeWidth="1.5" strokeDasharray="6 4" />
            )}

            {points.map(([px, py], i) => (
                <circle key={i} cx={x(px)} cy={y(py)} r="3.5" fill="#C2410C" fillOpacity="0.55" stroke="#9A3412" strokeWidth="0.75" />
            ))}
        </svg>
    );
}

export default function RegressionAnalysis({ data, targetName }) {
    const { points, mae, rmse, r2 } = data;

    const avp = points.map((p) => [p.actual, p.predicted]);
    const residuals = points.map((p) => [p.predicted, p.actual - p.predicted]);

    const shared = domainOf([...points.map((p) => p.actual), ...points.map((p) => p.predicted)]);
    const predictedDomain = domainOf(points.map((p) => p.predicted));
    const residualMax = Math.max(...points.map((p) => Math.abs(p.actual - p.predicted)), 1e-9) * 1.1;

    let reading;
    if (r2 === null) {
        reading = "R² is not defined because every actual value is the same.";
    } else if (r2 < 0) {
        reading = `R² is negative (${fmt(r2)}): on this data the model does worse than always predicting the average.`;
    } else {
        reading = `R² of ${fmt(r2)} means the model explains about ${fmtPercent(r2)} of the variation in ${targetName}.`;
    }

    return (
        <div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-y border-stone-200 py-4 sm:grid-cols-4">
                <Stat label="MAE" value={fmt(mae)} note="Average error, in target units" />
                <Stat label="RMSE" value={fmt(rmse)} note="Penalizes large errors" />
                <Stat label="R²" value={r2 === null ? "-" : fmt(r2)} note="1 is a perfect fit" />
                <Stat label="Samples" value={count.format(data.count)} />
            </dl>

            <p className="mt-3 max-w-2xl text-sm text-stone-700">{reading}</p>

            <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-8 xl:grid-cols-2">
                <figure className="min-w-0">
                    <figcaption className="text-sm font-medium text-stone-900">Actual vs predicted</figcaption>
                    <div className="mt-2 overflow-x-auto rounded-md border border-stone-200 bg-white">
                        <PointPlot
                            points={avp}
                            xDomain={shared}
                            yDomain={shared}
                            xLabel={`Actual ${targetName}`}
                            yLabel={`Predicted ${targetName}`}
                            guide="diagonal"
                            label={`Scatter plot of actual versus predicted ${targetName}. Points close to the dashed diagonal line are accurate predictions. MAE ${fmt(mae)}, RMSE ${fmt(rmse)}.`}
                        />
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                        Points on the dashed line are perfect predictions. Points above it are over-predicted, below it
                        are under-predicted.
                    </p>
                </figure>

                <figure className="min-w-0">
                    <figcaption className="text-sm font-medium text-stone-900">Residual plot</figcaption>
                    <div className="mt-2 overflow-x-auto rounded-md border border-stone-200 bg-white">
                        <PointPlot
                            points={residuals}
                            xDomain={predictedDomain}
                            yDomain={[-residualMax, residualMax]}
                            xLabel={`Predicted ${targetName}`}
                            yLabel="Residual (actual − predicted)"
                            guide="zero"
                            label={`Residual plot: predicted ${targetName} against the error of each prediction. Points scattered evenly around the dashed zero line indicate no systematic bias.`}
                        />
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                        Residual = actual − predicted. Points should scatter evenly around zero. A curve or a funnel
                        shape means the model is missing a pattern.
                    </p>
                </figure>
            </div>

            {data.sampled && (
                <p className="mt-3 text-xs text-stone-500">
                    The charts show an evenly spaced sample of {count.format(points.length)} points. The metrics above
                    use all {count.format(data.count)} rows.
                </p>
            )}
        </div>
    );
}