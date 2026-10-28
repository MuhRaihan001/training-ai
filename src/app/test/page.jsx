"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadBundle, predict, traceForward } from "@/utils/modelBundle";
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

const numberFormat = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });
const percentFormat = new Intl.NumberFormat("id-ID", {
    style: "percent",
    maximumFractionDigits: 1,
});

export default function TestModelPage() {
    const [loaded, setLoaded] = useState(null);
    const [inputs, setInputs] = useState([]);
    const [result, setResult] = useState(null);
    const [traceData, setTraceData] = useState(null);
    const [runId, setRunId] = useState(0);
    const [animDone, setAnimDone] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [predicting, setPredicting] = useState(false);
    const modelRef = useRef(null);

    useEffect(() => {
        return () => modelRef.current?.dispose();
    }, []);

    function resetOutput() {
        setResult(null);
        setTraceData(null);
        setAnimDone(false);
    }

    async function handleFile(event) {
        const file = event.target.files?.[0];

        setError("");
        resetOutput();

        if (!file) return;

        setLoading(true);

        try {
            const text = await file.text();
            const next = await loadBundle(text);

            modelRef.current?.dispose();
            modelRef.current = next.model;

            setLoaded(next);
            setInputs(next.meta.featureNames.map(() => ""));
        } catch (err) {
            setLoaded(null);
            setError(err.message || "Model tidak dapat dimuat.");
        } finally {
            setLoading(false);
        }
    }

    function handleInput(index, value) {
        setInputs((prev) => prev.map((v, i) => (i === index ? value : v)));
        resetOutput();
        setError("");
    }

    async function handlePredict(event) {
        event.preventDefault();
        if (!loaded) return;

        setPredicting(true);
        setError("");

        try {
            const prediction = await predict(loaded.model, loaded.meta, inputs);
            const trace = traceForward(loaded.model, loaded.meta, inputs);

            setResult(prediction);
            setTraceData(trace);
            setAnimDone(false);
            setRunId((id) => id + 1);
        } catch (err) {
            resetOutput();
            setError(err.message || "Prediksi gagal.");
        } finally {
            setPredicting(false);
        }
    }

    const meta = loaded?.meta;

    return (
        <main className="min-h-screen bg-stone-50 text-stone-900 antialiased">
            <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-16">
                <header className="max-w-2xl">
                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Tes Model
                    </h1>
                    <p className="mt-2 text-base text-stone-600">
                        Muat file model hasil training, lalu coba prediksi dengan data baru.
                    </p>
                    <Link
                        href="/training"
                        className="mt-3 inline-block text-sm font-medium underline underline-offset-4 hover:text-orange-800"
                    >
                        Kembali ke training
                    </Link>
                </header>

                <section aria-labelledby="group-load" className="mt-10">
                    <h2
                        id="group-load"
                        className="border-b border-stone-900 pb-2 text-sm font-semibold"
                    >
                        Muat model
                    </h2>
                    <div className="py-5">
                        <label htmlFor="model-file" className="block text-sm font-medium">
                            File model (.json)
                        </label>
                        <p id="model-file-hint" className="mb-3 mt-1 text-sm text-stone-600">
                            Gunakan file yang diunduh lewat tombol Download Model.
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
                                Memuat model...
                            </p>
                        )}
                    </div>
                </section>

                {error && (
                    <p
                        role="alert"
                        className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
                    >
                        <span className="font-semibold">Perlu diperbaiki: </span>
                        {error}
                    </p>
                )}

                {meta && (
                    <>
                        <section aria-labelledby="group-info" className="mt-10">
                            <h2
                                id="group-info"
                                className="border-b border-stone-900 pb-2 text-sm font-semibold"
                            >
                                Info model
                            </h2>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 sm:grid-cols-4">
                                {[
                                    ["Target", meta.targetName],
                                    ["Loss", meta.loss],
                                    ["Optimizer", meta.optimizer],
                                    ["Data latih", numberFormat.format(meta.rowCount) + " baris"],
                                ].map(([label, value]) => (
                                    <div key={label} className="min-w-0">
                                        <dt className="text-sm text-stone-600">{label}</dt>
                                        <dd className="mt-1 break-all font-mono text-sm text-stone-900">
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                            {meta.classes && (
                                <p className="text-sm text-stone-600">
                                    Kelas: <span className="font-mono">{meta.classes.join(", ")}</span>
                                </p>
                            )}
                        </section>

                        <form onSubmit={handlePredict} className="mt-10">
                            <h2 className="border-b border-stone-900 pb-2 text-sm font-semibold">
                                Input fitur
                            </h2>

                            <div className="divide-y divide-stone-200">
                                {meta.featureNames.map((name, i) => (
                                    <div
                                        key={i}
                                        className="py-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-center md:gap-x-10"
                                    >
                                        <label
                                            htmlFor={`feature-${i}`}
                                            className="mb-2 block text-sm font-medium md:mb-0"
                                        >
                                            {name}
                                        </label>
                                        <input
                                            id={`feature-${i}`}
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            value={inputs[i] ?? ""}
                                            onChange={(e) => handleInput(i, e.target.value)}
                                            required
                                            className={inputClass}
                                        />
                                    </div>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={predicting}
                                className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-orange-700 px-5 text-sm font-medium text-white transition-colors hover:bg-orange-800 active:bg-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 disabled:cursor-not-allowed disabled:bg-stone-400 motion-reduce:transition-none sm:w-auto"
                            >
                                {predicting ? "Memprediksi..." : "Prediksi"}
                            </button>
                        </form>

                        {traceData && (
                            <NetworkVisualizer
                                key={runId}
                                data={traceData}
                                result={result}
                                onDone={() => setAnimDone(true)}
                            />
                        )}

                        {result && animDone && (
                            <section
                                aria-labelledby="group-result"
                                role="status"
                                className="mt-8 rounded-md border border-green-300 bg-green-50 px-4 py-4"
                            >
                                <h2 id="group-result" className="text-sm font-semibold text-green-900">
                                    Hasil prediksi untuk {meta.targetName}
                                </h2>

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
                            </section>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}