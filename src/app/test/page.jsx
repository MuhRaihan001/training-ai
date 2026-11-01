"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadBundle, loadBundleObject, predict, predictBatch, traceForward } from "@/utils/modelBundle";
import { parseDataset } from "@/utils/csv";
import { buildCsv, downloadText } from "@/utils/csvExport";
import { storageGet } from "@/utils/storage";
import NetworkVisualizer from "./NetworkVisualizer";

const inputClass =
    "block h-11 w-full rounded-md border border-stone-500 bg-white px-3 font-mono text-sm " +
    "tabular-nums text-stone-900 transition-colors motion-reduce:transition-none " +
    "focus:border-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-700/40";

const fileClass =
    "block h-11 w-full cursor-pointer rounded-md text-sm text-stone-600 " +
    "file:mr-4 file:h-11 file:cursor-pointer file:rounded-md file:border file:border-stone-500 " +
    "file:bg-white file:px-4 file:text-sm file:font-medium file:text-stone-900 " +
    "file:transition-colors motion-reduce:file:transition-none hover:file:bg-stone-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50";

const btnSecondary =
    "inline-flex h-11 items-center justify-center rounded-md border border-stone-500 bg-white px-5 " +
    "text-sm font-medium text-stone-900 transition-colors hover:bg-stone-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 " +
    "disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

const btnPrimary =
    "inline-flex h-11 items-center justify-center rounded-md bg-orange-700 px-5 text-sm font-medium " +
    "text-white transition-colors hover:bg-orange-800 active:bg-orange-900 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 " +
    "disabled:cursor-not-allowed disabled:bg-stone-400 motion-reduce:transition-none";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const percentFormat = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
});

const MODE_HINTS = {
    onehot: "Text, converted to one-hot",
    label: "Text, converted to numbers (label)",
};

const PREVIEW_ROWS = 6;

function niceStep(raw) {
    if (!(raw > 0)) return 1;
    const power = 10 ** Math.floor(Math.log10(raw));
    const fraction = raw / power;
    const nice = fraction < 1.5 ? 1 : fraction < 3.5 ? 2 : fraction < 7.5 ? 5 : 10;
    return nice * power;
}

function roundTo(value, step) {
    const decimals = Math.min(6, Math.max(0, Math.ceil(-Math.log10(step))));
    return Number(value.toFixed(decimals));
}

function columnOffsets(meta) {
    let offset = 0;
    return meta.columns.map((col) => {
        const start = offset;
        offset += col.mode === "onehot" ? col.categories.length : 1;
        return start;
    });
}

function sliderSpec(col, offset, meta) {
    const mean = meta.featureStats?.mean?.[offset] ?? 0;
    const std = meta.featureStats?.std?.[offset] ?? 1;

    let min;
    let max;
    let integer = false;

    if (col.stats) {
        ({ min, max, integer } = col.stats);
    } else {
        min = mean - 3 * std;
        max = mean + 3 * std;
    }

    if (!(max > min)) {
        min -= 1;
        max += 1;
    }

    const step = integer ? 1 : niceStep((max - min) / 200);
    const lower = roundTo(Math.floor(min / step) * step, step);
    const upper = roundTo(Math.ceil(max / step) * step, step);
    const start = roundTo(Math.min(upper, Math.max(lower, mean)), step);

    return { min: lower, max: upper, step, start: integer ? Math.round(start) : start };
}

function defaultInputs(meta) {
    const offsets = columnOffsets(meta);
    return meta.columns.map((col, i) =>
        col.mode === "numeric" ? String(sliderSpec(col, offsets[i], meta).start) : (col.categories[0] ?? "")
    );
}

export default function TestModelPage() {
    const [loaded, setLoaded] = useState(null);
    const [inputs, setInputs] = useState([]);
    const [result, setResult] = useState(null);
    const [liveError, setLiveError] = useState("");
    const [traceData, setTraceData] = useState(null);
    const [runId, setRunId] = useState(0);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [handoff, setHandoff] = useState(null);

    const [batch, setBatch] = useState(null);
    const [batchError, setBatchError] = useState("");
    const [batchBusy, setBatchBusy] = useState(false);
    const [batchKey, setBatchKey] = useState(0);

    const modelRef = useRef(null);
    const liveRef = useRef(0);

    useEffect(() => {
        return () => modelRef.current?.dispose();
    }, []);

    function applyLoaded(next) {
        modelRef.current?.dispose();
        modelRef.current = next.model;

        setLoaded(next);
        setInputs(defaultInputs(next.meta));
        setTraceData(null);
        setResult(null);
        setLiveError("");
        setBatch(null);
        setBatchError("");
        setBatchKey((key) => key + 1);
    }

    useEffect(() => {
        let cancelled = false;

        async function check() {
            try {
                const stored = await storageGet("handoff");
                if (cancelled || !stored) return;

                setHandoff(stored);

                if (new URLSearchParams(window.location.search).get("from") === "training") {
                    setLoading(true);
                    const next = await loadBundleObject(stored);
                    if (!cancelled) applyLoaded(next);
                }
            } catch (err) {
                if (!cancelled) setError(err.message || "The model could not be loaded.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        check();
        return () => {
            cancelled = true;
        };

    }, []);

    useEffect(() => {
        if (!loaded) return;

        const id = ++liveRef.current;
        const timer = setTimeout(async () => {
            try {
                const prediction = await predict(loaded.model, loaded.meta, inputs);
                if (id !== liveRef.current) return;
                setResult(prediction);
                setLiveError("");
            } catch (err) {
                if (id !== liveRef.current) return;
                setResult(null);
                setLiveError(err.message || "Prediction failed.");
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [loaded, inputs]);

    async function handleFile(event) {
        const file = event.target.files?.[0];

        setError("");
        if (!file) return;

        setLoading(true);

        try {
            const text = await file.text();
            applyLoaded(await loadBundle(text));
        } catch (err) {
            setLoaded(null);
            setError(err.message || "The model could not be loaded.");
        } finally {
            setLoading(false);
        }
    }

    async function handleUseHandoff() {
        setError("");
        setLoading(true);

        try {
            applyLoaded(await loadBundleObject(handoff));
        } catch (err) {
            setError(err.message || "The model could not be loaded.");
        } finally {
            setLoading(false);
        }
    }

    function handleInput(index, value) {
        setInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
        setTraceData(null);
        setError("");
    }

    function handleTrace() {
        if (!loaded) return;

        try {
            setError("");
            setTraceData(traceForward(loaded.model, loaded.meta, inputs));
            setRunId((id) => id + 1);
        } catch (err) {
            setTraceData(null);
            setError(err.message || "The step-by-step view could not be built.");
        }
    }

    async function handleBatchFile(event) {
        const file = event.target.files?.[0];

        setBatch(null);
        setBatchError("");
        if (!file || !loaded) return;

        setBatchBusy(true);

        try {
            const table = parseDataset(file, await file.text());
            const output = await predictBatch(loaded.model, loaded.meta, table);
            setBatch({ fileName: file.name, table, ...output });
        } catch (err) {
            setBatchError(err.message || "The file could not be predicted.");
        } finally {
            setBatchBusy(false);
        }
    }

    function resultCells(item) {
        if (item.error) return ["", ""];
        const main = item.label ?? numberFormat.format(item.value);
        const confidence = item.scores ? numberFormat.format(Math.max(...item.scores.map((s) => s.score))) : "";
        return [main, confidence];
    }

    function handleDownloadBatch() {
        if (!batch || !loaded) return;

        const { meta } = loaded;
        const classification = Boolean(meta.classes);
        const headers = [...batch.table.headers, `predicted_${meta.targetName}`];
        if (classification) headers.push("confidence");
        if (batch.failed > 0) headers.push("error");

        const rows = batch.table.rows.map((row, i) => {
            const item = batch.results[i];
            const [main, confidence] = resultCells(item);
            const out = [...row, main];
            if (classification) out.push(confidence);
            if (batch.failed > 0) out.push(item.error ?? "");
            return out;
        });

        const base = batch.fileName.replace(/\.csv$/i, "");
        downloadText(`${base}-predictions.csv`, buildCsv(headers, rows));
    }

    const meta = loaded?.meta;
    const dropped = meta?.dropped ?? [];
    const offsets = meta ? columnOffsets(meta) : [];
    const classification = Boolean(meta?.classes);

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
                <header className="max-w-2xl">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Test Model</h1>
                    <p className="mt-2 text-base text-stone-600">
                        Load a trained model, then move the sliders to see how the prediction changes.
                    </p>
                    <Link
                        href="/training"
                        className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-orange-800"
                    >
                        Back to training
                    </Link>
                </header>

                <section aria-labelledby="group-load" className="mt-10">
                    <h2 id="group-load" className="border-b border-stone-900 pb-2 text-sm font-semibold">
                        Load model
                    </h2>
                    <div className="py-5">
                        {handoff && (
                            <div className="mb-5">
                                <button type="button" onClick={handleUseHandoff} disabled={loading} className={btnPrimary}>
                                    Use the model from the last training
                                </button>
                                <p className="mt-1.5 text-xs text-stone-500">
                                    Or load a saved model file below.
                                </p>
                            </div>
                        )}

                        <label htmlFor="model-file" className="block text-sm font-medium">
                            Model file (.json)
                        </label>
                        <p id="model-file-hint" className="mb-3 mt-1 text-sm text-stone-600">
                            Use the file downloaded with the Download Model button.
                        </p>
                        <input
                            type="file"
                            id="model-file"
                            accept=".json,application/json"
                            onChange={handleFile}
                            aria-describedby="model-file-hint"
                            className={fileClass + " max-w-md"}
                        />
                        {loading && (
                            <p role="status" className="mt-2 text-sm text-stone-600">
                                Loading model...
                            </p>
                        )}
                    </div>
                </section>

                {error && (
                    <p
                        role="alert"
                        className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <span className="font-semibold">Needs fixing: </span>
                        {error}
                    </p>
                )}

                {meta && (
                    <>
                        <section aria-labelledby="group-info" className="mt-10">
                            <h2 id="group-info" className="border-b border-stone-900 pb-2 text-sm font-semibold">
                                Model info
                            </h2>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 sm:grid-cols-4">
                                {[
                                    ["Target", meta.targetName],
                                    ["Loss", meta.loss],
                                    ["Optimizer", meta.optimizer],
                                    ["Training data", numberFormat.format(meta.rowCount) + " rows"],
                                ].map(([label, value]) => (
                                    <div key={label} className="min-w-0">
                                        <dt className="text-sm text-stone-600">{label}</dt>
                                        <dd className="mt-1 break-all font-mono text-sm text-stone-900">{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            <p className="text-sm text-stone-600">
                                Model inputs:{" "}
                                <span className="font-mono">{numberFormat.format(meta.featureNames.length)}</span> from{" "}
                                {meta.columns.length} columns
                                {dropped.length > 0 && (
                                    <>
                                        . Columns dropped during training:{" "}
                                        <span className="font-mono">{dropped.join(", ")}</span>
                                    </>
                                )}
                            </p>
                            {meta.classes && (
                                <p className="mt-1 text-sm text-stone-600">
                                    Classes: <span className="font-mono">{meta.classes.join(", ")}</span>
                                </p>
                            )}
                        </section>

                        <section aria-labelledby="group-inputs" className="mt-10">
                            <h2 id="group-inputs" className="border-b border-stone-900 pb-2 text-sm font-semibold">
                                Feature inputs
                            </h2>

                            <div className="divide-y divide-stone-200">
                                {meta.columns.map((col, i) => {
                                    const categorical = col.mode !== "numeric";
                                    const spec = categorical ? null : sliderSpec(col, offsets[i], meta);
                                    const parsed = Number(String(inputs[i] ?? "").replace(",", "."));
                                    const sliderValue = Number.isFinite(parsed)
                                        ? Math.min(spec?.max ?? 0, Math.max(spec?.min ?? 0, parsed))
                                        : (spec?.min ?? 0);

                                    return (
                                        <div
                                            key={i}
                                            className="py-4 md:grid md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] md:items-center md:gap-x-8"
                                        >
                                            <div className="mb-2 md:mb-0">
                                                <label htmlFor={`feature-${i}`} className="block text-sm font-medium">
                                                    {col.name}
                                                </label>
                                                {categorical && (
                                                    <p className="text-xs text-stone-500">{MODE_HINTS[col.mode]}</p>
                                                )}
                                            </div>

                                            {categorical ? (
                                                <select
                                                    id={`feature-${i}`}
                                                    value={inputs[i] ?? ""}
                                                    onChange={(e) => handleInput(i, e.target.value)}
                                                    className={inputClass + " max-w-sm"}
                                                >
                                                    {col.categories.map((c) => (
                                                        <option key={c} value={c}>
                                                            {c}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="range"
                                                        min={spec.min}
                                                        max={spec.max}
                                                        step={spec.step}
                                                        value={sliderValue}
                                                        onChange={(e) => handleInput(i, e.target.value)}
                                                        aria-label={`${col.name} slider, from ${spec.min} to ${spec.max}`}
                                                        className="h-11 min-w-0 flex-1 accent-orange-700"
                                                    />
                                                    <input
                                                        id={`feature-${i}`}
                                                        type="text"
                                                        inputMode="decimal"
                                                        autoComplete="off"
                                                        value={inputs[i] ?? ""}
                                                        onChange={(e) => handleInput(i, e.target.value)}
                                                        className={inputClass + " w-28 shrink-0"}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section
                            aria-labelledby="group-result"
                            role="status"
                            aria-live="polite"
                            className="mt-8 rounded-md border border-green-300 bg-green-50 px-4 py-4"
                        >
                            <h2 id="group-result" className="text-sm font-semibold text-green-900">
                                Prediction for {meta.targetName}
                            </h2>

                            {result ? (
                                <>
                                    <p className="mt-1 font-mono text-2xl tabular-nums text-green-900">
                                        {result.label ?? numberFormat.format(result.value)}
                                    </p>

                                    {result.scores && (
                                        <ul className="mt-3 space-y-1 text-sm text-green-900">
                                            {result.scores.map((s) => (
                                                <li key={s.label} className="flex justify-between gap-4">
                                                    <span>{s.label}</span>
                                                    <span className="font-mono tabular-nums">
                                                        {percentFormat.format(s.score)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            ) : (
                                <p className="mt-1 text-sm text-green-900">
                                    {liveError || "Calculating…"}
                                </p>
                            )}

                            <p className="mt-3 text-xs text-green-900">
                                Updates automatically when you change an input.
                            </p>
                        </section>

                        <div className="mt-4">
                            <button type="button" onClick={handleTrace} disabled={!result} className={btnSecondary}>
                                Show step-by-step
                            </button>
                        </div>

                        {traceData && (
                            <NetworkVisualizer key={runId} data={traceData} result={result} />
                        )}

                        <section aria-labelledby="group-batch" className="mt-12">
                            <h2 id="group-batch" className="border-b border-stone-900 pb-2 text-sm font-semibold">
                                Batch prediction
                            </h2>
                            <div className="py-5">
                                <label htmlFor="batch-file" className="block text-sm font-medium">
                                    CSV file with new rows
                                </label>
                                <p id="batch-file-hint" className="mb-3 mt-1 text-sm text-stone-600">
                                    The file needs a header row with these columns:{" "}
                                    <span className="font-mono">{meta.columns.map((c) => c.name).join(", ")}</span>.
                                    {classification ? " Class" : " Target"} values are not needed. Extra columns are kept
                                    in the download.
                                </p>
                                <input
                                    key={batchKey}
                                    type="file"
                                    id="batch-file"
                                    accept=".csv"
                                    onChange={handleBatchFile}
                                    aria-describedby="batch-file-hint"
                                    className={fileClass + " max-w-md"}
                                />

                                {batchBusy && (
                                    <p role="status" className="mt-2 text-sm text-stone-600">
                                        Predicting…
                                    </p>
                                )}

                                {batchError && (
                                    <p
                                        role="alert"
                                        className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
                                    >
                                        <span className="font-semibold">Batch prediction failed: </span>
                                        {batchError}
                                    </p>
                                )}

                                {batch && (
                                    <div className="mt-4">
                                        <p role="status" className="text-sm text-stone-800">
                                            Predicted {numberFormat.format(batch.results.length - batch.failed)} of{" "}
                                            {numberFormat.format(batch.results.length)} rows
                                            {batch.failed > 0 && `. ${batch.failed} rows were skipped, see the error column`}.
                                        </p>

                                        <div
                                            role="region"
                                            tabIndex={0}
                                            aria-label="Preview of batch predictions"
                                            className="mt-3 overflow-x-auto rounded-md border border-stone-200 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700"
                                        >
                                            <table className="w-full text-left font-mono text-xs tabular-nums">
                                                <caption className="sr-only">
                                                    First {Math.min(PREVIEW_ROWS, batch.table.rows.length)} rows with their
                                                    predictions.
                                                </caption>
                                                <thead className="bg-stone-100">
                                                    <tr>
                                                        {batch.table.headers.map((h, i) => (
                                                            <th key={i} scope="col" className="whitespace-nowrap px-3 py-1.5 font-medium text-stone-900">
                                                                {h}
                                                            </th>
                                                        ))}
                                                        <th scope="col" className="whitespace-nowrap bg-orange-50 px-3 py-1.5 font-medium text-stone-900">
                                                            predicted_{meta.targetName}
                                                        </th>
                                                        {classification && (
                                                            <th scope="col" className="whitespace-nowrap bg-orange-50 px-3 py-1.5 font-medium text-stone-900">
                                                                confidence
                                                            </th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-200">
                                                    {batch.table.rows.slice(0, PREVIEW_ROWS).map((row, r) => {
                                                        const item = batch.results[r];
                                                        const [main, confidence] = resultCells(item);
                                                        return (
                                                            <tr key={r}>
                                                                {row.map((cell, c) => (
                                                                    <td key={c} className="max-w-[12rem] truncate px-3 py-1.5 text-stone-700" title={cell}>
                                                                        {cell}
                                                                    </td>
                                                                ))}
                                                                <td className="whitespace-nowrap bg-orange-50 px-3 py-1.5 text-stone-900">
                                                                    {item.error ? (
                                                                        <span className="font-sans text-red-800">{item.error}</span>
                                                                    ) : (
                                                                        main
                                                                    )}
                                                                </td>
                                                                {classification && (
                                                                    <td className="whitespace-nowrap bg-orange-50 px-3 py-1.5 text-stone-900">
                                                                        {confidence}
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        <button type="button" onClick={handleDownloadBatch} className={btnPrimary + " mt-4"}>
                                            Download predictions (CSV)
                                        </button>
                                    </div>
                                )}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </main>
    );
}
