"use client";

import { useState } from "react";
import { primaryMetric } from "@/utils/runs";
import CompareChart from "./CompareChart";
import {
    LOSS_LABELS,
    OPTIMIZER_LABELS,
    architectureSummary,
    btnPrimary,
    btnSecondary,
    btnText,
    fmt,
    fmtPercent,
    formatDuration,
    sectionHeading,
} from "./ui";

const MAX_CHART_RUNS = 6;

function metricText(metric) {
    if (!metric) return "-";
    return metric.percent ? fmtPercent(metric.value) ?? "-" : fmt(metric.value);
}

export default function RunComparison({ runs, activeId, onOpen, onDelete, onClear, onBack }) {
    const [selected, setSelected] = useState(() => runs.slice(0, 4).map((run) => run.id));
    const [curve, setCurve] = useState("loss");

    if (runs.length === 0) {
        return (
            <section className="mt-10" aria-labelledby="compare-title">
                <h2 id="compare-title" className="text-lg font-semibold text-stone-900">
                    Experiments
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                    No experiments yet. Every training run is saved here so you can compare settings.
                </p>
                <button type="button" onClick={onBack} className={btnPrimary + " mt-4"}>
                    Back to Configuration
                </button>
            </section>
        );
    }

    const chosen = selected.filter((id) => runs.some((run) => run.id === id));
    const metrics = runs.map(primaryMetric);

    const groups = {};
    runs.forEach((run, i) => {
        const metric = metrics[i];
        if (!metric) return;
        const key = `${run.dataset.fileName}|${metric.name}|${metric.basis}`;
        (groups[key] ??= []).push(i);
    });
    const bestIndexes = new Set();
    Object.values(groups).forEach((indexes) => {
        if (indexes.length < 2) return;
        const best = indexes.reduce((winner, i) => {
            const a = metrics[i];
            const b = metrics[winner];
            return (a.higherBetter ? a.value > b.value : a.value < b.value) ? i : winner;
        });
        bestIndexes.add(best);
    });

    function toggle(id) {
        setSelected((prev) => {
            const current = prev.filter((item) => runs.some((run) => run.id === item));
            if (current.includes(id)) return current.filter((item) => item !== id);
            return current.length >= MAX_CHART_RUNS ? current : [...current, id];
        });
    }

    const series = chosen
        .map((id) => runs.find((run) => run.id === id))
        .map((run) => ({
            id: run.id,
            label: run.label,
            values: run.history.map((entry) => entry[curve]),
        }));

    return (
        <section aria-labelledby="compare-title" className="mt-10 space-y-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 id="compare-title" className="text-lg font-semibold text-stone-900">
                        Experiments
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm text-stone-600">
                        Change one setting at a time and compare the runs. Metrics come from the test set when one
                        exists, otherwise from validation, otherwise from training data.
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={onBack} className={btnPrimary}>
                        New experiment
                    </button>
                    <button type="button" onClick={onClear} className={btnSecondary}>
                        Clear all
                    </button>
                </div>
            </div>

            <div
                role="region"
                tabIndex={0}
                aria-label="Experiment table"
                className="overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
            >
                <table className="w-full min-w-[860px] text-left text-sm">
                    <caption className="sr-only">
                        Saved training runs with their settings and results. The checkbox adds a run to the chart.
                    </caption>
                    <thead className="bg-stone-100 text-xs">
                        <tr>
                            <th scope="col" className="px-3 py-2 font-medium text-stone-900">Chart</th>
                            <th scope="col" className="px-3 py-2 font-medium text-stone-900">Run</th>
                            <th scope="col" className="px-3 py-2 font-medium text-stone-900">Settings</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-stone-900">Train loss</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-stone-900">Result</th>
                            <th scope="col" className="px-3 py-2 text-right font-medium text-stone-900">Time</th>
                            <th scope="col" className="px-3 py-2 font-medium text-stone-900">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {runs.map((run, i) => {
                            const metric = metrics[i];
                            const last = run.history[run.history.length - 1];
                            const isActive = run.id === activeId;

                            return (
                                <tr key={run.id} className={isActive ? "bg-orange-50" : undefined}>
                                    <td className="px-3 py-2 align-top">
                                        <input
                                            type="checkbox"
                                            checked={chosen.includes(run.id)}
                                            onChange={() => toggle(run.id)}
                                            aria-label={`Show ${run.label} in the chart`}
                                            className="h-5 w-5 accent-orange-700"
                                        />
                                    </td>
                                    <th scope="row" className="px-3 py-2 text-left align-top font-normal">
                                        <span className="font-medium text-stone-900">{run.label}</span>
                                        {bestIndexes.has(i) && (
                                            <span className="ml-2 rounded-sm border border-green-300 bg-green-50 px-1 py-px text-[10px] font-medium text-green-900">
                                                best
                                            </span>
                                        )}
                                        {run.stoppedBy && (
                                            <span className="ml-2 rounded-sm border border-stone-300 bg-stone-100 px-1 py-px text-[10px] text-stone-700">
                                                stopped early
                                            </span>
                                        )}
                                        <span className="block max-w-[12rem] truncate text-xs text-stone-500" title={run.dataset.fileName}>
                                            {run.dataset.fileName}
                                        </span>
                                        <span className="block text-xs text-stone-500">
                                            {new Date(run.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </th>
                                    <td className="px-3 py-2 align-top text-xs text-stone-700">
                                        <span className="block">
                                            {OPTIMIZER_LABELS[run.config.optimizer] ?? run.config.optimizer}, lr{" "}
                                            <span className="font-mono">{run.config.learningRate}</span>, batch{" "}
                                            <span className="font-mono">{run.config.batchSize}</span>
                                        </span>
                                        <span className="block">
                                            {run.history.length} of {run.config.epochs} epochs,{" "}
                                            {LOSS_LABELS[run.config.loss] ?? run.config.loss}
                                        </span>
                                        <span className="block text-stone-500">
                                            {architectureSummary({ config: run.config, meta: run.meta })}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums text-stone-900">
                                        {fmt(last?.loss)}
                                    </td>
                                    <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums text-stone-900">
                                        {metricText(metric)}
                                        {metric && (
                                            <span className="block font-sans text-stone-500">
                                                {metric.name}, {metric.basis}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right align-top font-mono text-xs tabular-nums text-stone-700">
                                        {formatDuration(run.durationMs)}
                                    </td>
                                    <td className="px-3 py-2 align-top">
                                        <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => onOpen(run.id)} className={btnText}>
                                                Open
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onDelete(run.id)}
                                                aria-label={`Delete ${run.label}`}
                                                className={btnText}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <h3 className={sectionHeading + " flex-1"}>Loss curves</h3>
                    <div
                        role="group"
                        aria-label="Which loss to plot"
                        className="inline-flex self-start overflow-hidden rounded-md border border-stone-400 bg-white"
                    >
                        {[
                            ["loss", "Training"],
                            ["val_loss", "Validation"],
                        ].map(([id, label]) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={curve === id}
                                onClick={() => setCurve(id)}
                                className={
                                    "h-9 px-3 text-sm font-medium transition-colors motion-reduce:transition-none " +
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-700 " +
                                    (curve === id ? "bg-stone-900 text-white" : "text-stone-900 hover:bg-stone-100")
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
                <p className="mt-2 text-xs text-stone-500">
                    Pick up to {MAX_CHART_RUNS} runs with the checkboxes. Runs on different datasets use different loss
                    scales, so compare curves from the same dataset.
                </p>
                <div className="mt-3">
                    <CompareChart series={series} title={curve === "loss" ? "Training loss" : "Validation loss"} />
                </div>
            </div>
        </section>
    );
}
